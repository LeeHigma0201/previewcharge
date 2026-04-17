"""End-to-end driver for the Keeneland preview spreadsheet.

Usage (typical):

  # Phase 1: scrape HRN, create v0 CSV + task queue (prompt cells everywhere
  # that needs extra data)
  python scripts/keeneland_preview.py --track keeneland --date 2026-04-17 \
      --export-only

  # Phase 2 (done by the parent Claude Code agent): dispatch tasks.jsonl via
  # Agent + WebFetch in waves; append each result to results.jsonl.

  # Phase 3: apply results to the DB, regenerate CSV
  python scripts/keeneland_preview.py --track keeneland --date 2026-04-17 \
      --ingest-results
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import asdict
from datetime import datetime, date
from pathlib import Path

# Allow running the script directly: put project root on sys.path.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from sqlalchemy.orm import Session, joinedload

from src.data.database import get_engine, get_session
from src.data.models import Base, Entry, Race
from src.data.scrapers.horseracingnation import scrape_entries
from src.data.scrapers.ingest_scraped import scraped_to_parsed
from src.data.ingest import ingest_entry
from src.agents.dispatcher import (
    append_result,
    apply_results,
    build_task_queue,
    read_results,
    write_tasks,
)
from src.features.prompt_matrix import build_race_matrix, build_card_matrix


DATA_SCRAPED = Path("data/scraped")
DATA_PREVIEWS = Path("data/previews")


def _prepare_db(db_url: str) -> Session:
    from config.settings import DatabaseConfig, Settings
    settings = Settings(db=DatabaseConfig(url=db_url))
    engine = get_engine(settings)
    Base.metadata.create_all(engine)
    return get_session(engine)


def _races_for(session: Session, track_code: str, race_date: date) -> list[Race]:
    return (
        session.query(Race)
        .options(
            joinedload(Race.entries).joinedload(Entry.past_performances),
            joinedload(Race.entries).joinedload(Entry.horse),
        )
        .filter(Race.track_code == track_code, Race.race_date == race_date)
        .order_by(Race.race_number)
        .all()
    )


def cmd_scrape(args: argparse.Namespace) -> int:
    """Scrape HRN and ingest the skeleton into the DB."""
    DATA_SCRAPED.mkdir(parents=True, exist_ok=True)
    race_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    card = scrape_entries(args.track.upper(), race_date, output_dir=DATA_SCRAPED)
    n_horses = sum(len(r.horses) for r in card.races)
    print(f"HRN scrape: {len(card.races)} races, {n_horses} horses")
    if n_horses == 0:
        print("No horses parsed. Is the date correct and on the HRN schedule?", file=sys.stderr)
        return 1

    # Ingest horses + race skeleton into the DB.
    session = _prepare_db(args.db)
    try:
        count = 0
        for parsed in scraped_to_parsed(card):
            if parsed.horse_name:
                ingest_entry(session, parsed)
                count += 1
        session.commit()
        print(f"Ingested {count} entries into {args.db}")
    finally:
        session.close()
    return 0


def _write_matrix(races: list[Race], session: Session, out_csv: Path) -> None:
    out_csv.parent.mkdir(parents=True, exist_ok=True)
    df = build_card_matrix(races, session)
    df.to_csv(out_csv, index=False)
    # Audit: how many cells are numeric vs prompt vs empty.
    n_cells = df.shape[0] * (df.shape[1] - 1)  # exclude identifier pass-through
    numeric = 0
    prompts = 0
    for col in df.columns:
        for v in df[col]:
            if isinstance(v, (int, float)) and not _is_nan(v):
                numeric += 1
            elif isinstance(v, str) and v.startswith("PROMPT["):
                prompts += 1
    print(f"Matrix: {df.shape[0]} rows x {df.shape[1]} cols  "
          f"(numeric={numeric}  prompts={prompts}  cells≈{n_cells})")


def _is_nan(v: object) -> bool:
    try:
        import math
        return isinstance(v, float) and math.isnan(v)
    except Exception:
        return False


def _load_horse_urls(track_code: str, race_date: date) -> dict[str, str]:
    """Build a name → HRN profile URL map from the saved scraped card JSON."""
    card_path = DATA_SCRAPED / f"{track_code.upper()}_{race_date.isoformat()}_hrn_entries.json"
    if not card_path.exists():
        return {}
    data = json.loads(card_path.read_text())
    urls: dict[str, str] = {}
    for race in data.get("races", []):
        for h in race.get("horses", []):
            url = h.get("horse_url") or ""
            name = h.get("horse_name") or ""
            if url and name and name not in urls:
                urls[name] = url
    return urls


def cmd_export_tasks(args: argparse.Namespace) -> int:
    """Build v0 CSV and emit tasks.jsonl from the matrix's unresolved specs."""
    race_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    session = _prepare_db(args.db)
    try:
        races = _races_for(session, args.track.upper(), race_date)
        if not races:
            print("No races in DB — run with --scrape first.", file=sys.stderr)
            return 1

        horse_urls = _load_horse_urls(args.track, race_date)
        DATA_PREVIEWS.mkdir(parents=True, exist_ok=True)
        csv_path = DATA_PREVIEWS / f"{args.track.upper()}_{race_date.isoformat()}_v0.csv"
        df = build_card_matrix(races, session, horse_urls=horse_urls)
        # Inject track_code/race_date so the task builder can use them.
        df.insert(0, "track_code", args.track.upper())
        df.insert(1, "race_date", race_date.isoformat())
        df.to_csv(csv_path, index=False)

        tasks = build_task_queue(df, horse_urls=horse_urls)
        tasks_path = DATA_PREVIEWS / f"{args.track.upper()}_{race_date.isoformat()}_tasks.jsonl"
        n = write_tasks(tasks, tasks_path)
        print(f"Wrote {csv_path}")
        print(f"Wrote {tasks_path} ({n} tasks)")
    finally:
        session.close()
    return 0


def cmd_ingest_results(args: argparse.Namespace) -> int:
    """Apply results.jsonl into the DB and regenerate the CSV."""
    race_date = datetime.strptime(args.date, "%Y-%m-%d").date()
    results_path = DATA_PREVIEWS / f"{args.track.upper()}_{race_date.isoformat()}_results.jsonl"
    session = _prepare_db(args.db)
    try:
        results = read_results(results_path)
        if not results:
            print(f"No results found at {results_path}", file=sys.stderr)
            return 1
        counts = apply_results(session, results)
        print(f"Applied {sum(counts.values())} result rows: {counts}")

        races = _races_for(session, args.track.upper(), race_date)
        out_csv = DATA_PREVIEWS / f"{args.track.upper()}_{race_date.isoformat()}_final.csv"
        df = build_card_matrix(races, session)
        df.insert(0, "track_code", args.track.upper())
        df.insert(1, "race_date", race_date.isoformat())
        df.to_csv(out_csv, index=False)
        print(f"Rebuilt {out_csv}")
    finally:
        session.close()
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description="Keeneland preview spreadsheet driver")
    p.add_argument("--track", default="KEE", help="Track code (KEE) or slug (keeneland)")
    p.add_argument("--date", required=True, help="Race date YYYY-MM-DD")
    p.add_argument("--db", default="sqlite:///horsegpt.db", help="SQLAlchemy DB URL")
    p.add_argument("--scrape", action="store_true", help="Scrape HRN + ingest into DB")
    p.add_argument("--export-only", action="store_true",
                   help="Scrape, then build v0 CSV + tasks.jsonl (no dispatch)")
    p.add_argument("--ingest-results", action="store_true",
                   help="Apply results.jsonl and regenerate the CSV")
    args = p.parse_args()

    if args.ingest_results:
        return cmd_ingest_results(args)
    if args.export_only:
        rc = cmd_scrape(args)
        if rc != 0:
            return rc
        return cmd_export_tasks(args)
    if args.scrape:
        return cmd_scrape(args)
    # Default: scrape + export (no results yet).
    rc = cmd_scrape(args)
    if rc != 0:
        return rc
    return cmd_export_tasks(args)


if __name__ == "__main__":
    sys.exit(main())
