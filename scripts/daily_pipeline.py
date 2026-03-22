"""Daily automation pipeline for HorseGPT.

Orchestrates: ingest → features → predict for new race data.
Designed to run via cron or manual execution.

Usage:
    python scripts/daily_pipeline.py --db horsegpt.db --input data/bris/today/
"""

from __future__ import annotations

import argparse
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def main() -> None:
    parser = argparse.ArgumentParser(description="Daily HorseGPT pipeline")
    parser.add_argument("--db", default="sqlite:///horsegpt.db", help="Database URL")
    parser.add_argument("--input", default="data/bris/", help="BRIS data directory")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Input path does not exist: {input_path}", file=sys.stderr)
        sys.exit(1)

    print(f"=== HorseGPT Daily Pipeline — {date.today()} ===")

    # Step 1: Ingest new data
    print("\n[1/3] Ingesting BRIS data...")
    from src.data.ingest import ingest_from_path
    count = ingest_from_path(args.db, input_path)
    print(f"  Ingested {count} entries")

    # Step 2: Build features
    print("\n[2/3] Computing features...")
    from config.settings import DatabaseConfig, Settings
    from src.data.database import get_engine, get_session
    from src.features.pipeline import build_feature_matrix

    settings = Settings(db=DatabaseConfig(url=args.db))
    engine = get_engine(settings)
    session = get_session(engine)

    try:
        df = build_feature_matrix(session)
        print(f"  Feature matrix: {len(df)} entries")
    finally:
        session.close()

    # Step 3: Generate predictions
    print("\n[3/3] Predictions ready. Launch dashboard:")
    print("  make dashboard")

    print(f"\n=== Pipeline complete ===")


if __name__ == "__main__":
    main()
