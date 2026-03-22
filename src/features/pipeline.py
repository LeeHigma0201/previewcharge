"""Feature pipeline orchestrator.

Computes feature matrices for races and stores them for model consumption.

Usage:
    python -m src.features.pipeline --db horsegpt.db
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

import pandas as pd
from sqlalchemy.orm import Session, joinedload

from src.data.database import get_engine, get_session
from src.data.models import Entry, Race
from src.features.core import compute_race_features


def build_feature_matrix(session: Session, race_ids: list[int] | None = None) -> pd.DataFrame:
    """Build the full feature matrix across multiple races.

    Args:
        session: SQLAlchemy session.
        race_ids: If given, only compute features for these races.
                  Otherwise compute for all races in the database.

    Returns:
        DataFrame with entry_id index, feature columns, and target column.
    """
    query = session.query(Race).options(
        joinedload(Race.entries).joinedload(Entry.past_performances)
    )
    if race_ids:
        query = query.filter(Race.id.in_(race_ids))

    races = query.all()
    all_dfs = []

    for i, race in enumerate(races):
        df = compute_race_features(race, session)
        if not df.empty:
            df["race_id"] = race.id
            df["race_date"] = race.race_date
            all_dfs.append(df)

        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(races)} races...")

    if not all_dfs:
        return pd.DataFrame()

    result = pd.concat(all_dfs)
    print(f"Feature matrix: {len(result)} entries x {len(result.columns)} columns")
    return result


def get_feature_columns(df: pd.DataFrame) -> list[str]:
    """Get the list of feature columns (excludes metadata and target)."""
    exclude = {"race_id", "race_date", "finish_position", "final_odds"}
    return [c for c in df.columns if c not in exclude]


def main() -> None:
    parser = argparse.ArgumentParser(description="Build feature matrix for HorseGPT")
    parser.add_argument("--db", default="sqlite:///horsegpt.db", help="Database URL")
    parser.add_argument("--output", default="features.parquet", help="Output file")
    args = parser.parse_args()

    from config.settings import DatabaseConfig, Settings

    settings = Settings(db=DatabaseConfig(url=args.db))
    engine = get_engine(settings)
    session = get_session(engine)

    try:
        df = build_feature_matrix(session)
        if df.empty:
            print("No data found. Run `make ingest` first.", file=sys.stderr)
            sys.exit(1)
        df.to_parquet(args.output)
        print(f"Features saved to {args.output}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
