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
