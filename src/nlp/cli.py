"""CLI entry point for the race query engine.

Usage:
    python -m src.nlp.cli "Saratoga race 5 today"
    python -m src.nlp.cli "who wins the Kentucky Derby"
    python -m src.nlp.cli --horse "Flightline"
    python -m src.nlp.cli --scrape SAR 2026-03-22
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime
from pathlib import Path

from config.settings import DatabaseConfig, Settings
from src.data.database import get_engine, get_session


def main() -> None:
    parser = argparse.ArgumentParser(
        description="HorseGPT Race Query — natural language to loaded prompt"
    )
    parser.add_argument("query", nargs="*", help="Natural language race query")
    parser.add_argument("--db", default="sqlite:///horsegpt.db", help="Database URL")
    parser.add_argument("--no-features", action="store_true",
                        help="Skip feature computation (faster)")
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    parser.add_argument("--scrape", nargs=2, metavar=("TRACK", "DATE"),
                        help="Scrape data first: --scrape SAR 2026-03-22")
    parser.add_argument("--horse", type=str, help="Look up a horse by name")
    parser.add_argument("--exotic", action="store_true",
                        help="Generate single-race exotic bet plan")
    parser.add_argument("--dd", action="store_true", help="Daily Double starting from queried race")
    parser.add_argument("--pick3", action="store_true", help="Pick 3 starting from queried race")
    parser.add_argument("--pick4", action="store_true", help="Pick 4 starting from queried race")
    parser.add_argument("--pick5", action="store_true", help="Pick 5 starting from queried race")
    parser.add_argument("--pick6", action="store_true", help="Pick 6 starting from queried race")
    parser.add_argument("--bankroll", type=float, default=200.0,
                        help="Bankroll in dollars (default: 200)")
    args = parser.parse_args()

    settings = Settings(db=DatabaseConfig(url=args.db))
    engine = get_engine(settings)
    session = get_session(engine)

    try:
        # Scrape mode
        if args.scrape:
            track, date_str = args.scrape
            race_date = datetime.strptime(date_str, "%Y-%m-%d").date()
            _do_scrape(track, race_date, session)
            return

        # Build query text
        if args.horse:
            query_text = f'horse "{args.horse}"'
        elif args.query:
            query_text = " ".join(args.query)
        else:
            parser.print_help()
            sys.exit(1)

        # Check for exotic bet modes
        multi_race_type = None
        if args.dd:
            multi_race_type = "dd"
        elif args.pick3:
            multi_race_type = "pick3"
        elif args.pick4:
            multi_race_type = "pick4"
        elif args.pick5:
            multi_race_type = "pick5"
        elif args.pick6:
            multi_race_type = "pick6"

        if args.exotic or multi_race_type:
            _do_exotic(query_text, session, args.bankroll, multi_race_type)
            return

        from src.nlp.prompt_builder import build_loaded_prompt

        result = build_loaded_prompt(
            query_text,
            session,
            include_features=not args.no_features,
        )

        if args.json:
            import json
            output = {
                "query": {
                    "track_code": result["query"].track_code,
                    "race_number": result["query"].race_number,
                    "race_date": str(result["query"].race_date),
                    "horse_name": result["query"].horse_name,
                    "confidence": result["query"].confidence,
                },
                "prompt": result["prompt"],
            }
            print(json.dumps(output, indent=2))
        else:
            print(result["prompt"])

    finally:
        session.close()


def _do_exotic(query_text: str, session, bankroll: float, multi_race_type: str | None) -> None:
    """Run exotic bet engine from a natural language query."""
    from src.nlp.race_query import parse_race_query
    from src.data.models import Race

    parsed = parse_race_query(query_text)
    if not parsed.track_code or not parsed.race_number:
        print(f"Could not parse race from: {query_text}")
        return

    race = (
        session.query(Race)
        .filter_by(
            track_code=parsed.track_code,
            race_date=parsed.race_date,
            race_number=parsed.race_number,
        )
        .first()
    )
    if race is None:
        print(f"Race not found: {parsed.track_code} R{parsed.race_number} {parsed.race_date}")
        return

    entries = sorted(race.entries, key=lambda e: e.post_position)

    if multi_race_type:
        # Multi-race exotic
        from src.betting.exotic_engine import format_multi_race_slip, generate_multi_race_plan

        num_legs = {"dd": 2, "pick3": 3, "pick4": 4, "pick5": 5, "pick6": 6}
        n_legs = num_legs[multi_race_type]

        races = []
        entries_per_race = []
        for i in range(n_legs):
            r = (
                session.query(Race)
                .filter_by(
                    track_code=parsed.track_code,
                    race_date=parsed.race_date,
                    race_number=parsed.race_number + i,
                )
                .first()
            )
            if r is None:
                print(f"Race {parsed.race_number + i} not found.")
                return
            races.append(r)
            entries_per_race.append(sorted(r.entries, key=lambda e: e.post_position))

        plan = generate_multi_race_plan(
            races, entries_per_race, session,
            bet_type=multi_race_type, bankroll=bankroll,
        )
        print(format_multi_race_slip(plan))
    else:
        # Single-race exotic
        from src.betting.exotic_engine import format_bet_slip, generate_bet_plan

        plan = generate_bet_plan(race, entries, session, bankroll=bankroll)
        print(format_bet_slip(plan))


def _do_scrape(track: str, race_date: date, session) -> None:
    """Scrape data and ingest it."""
    from src.data.scrapers.equibase import scrape_entries, scrape_results

    output_dir = Path("data/scraped")
    print(f"Scraping {track} {race_date}...")

    card = scrape_entries(track, race_date, output_dir)
    print(f"  Entries: {len(card.races)} races, "
          f"{sum(len(r.horses) for r in card.races)} horses")

    results = scrape_results(track, race_date, output_dir)
    print(f"  Results: {len(results.races)} races")

    print(f"\nData saved to {output_dir}/")
    print("To ingest into DB: python -m src.data.ingest --input data/scraped/")


if __name__ == "__main__":
    main()
