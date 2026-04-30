"""Initialize the HorseGPT database. Creates all tables."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from src.data.database import create_tables, get_engine


def main() -> None:
    settings = Settings.load()
    engine = get_engine(settings)

    # Check which tables exist before init (to report new ones)
    from sqlalchemy import inspect
    inspector = inspect(engine)
    existing = set(inspector.get_table_names())

    # create_all uses IF NOT EXISTS — safe to run on existing DBs.
    # New tables (e.g. track_bias, odds_snapshots) get added without
    # dropping existing data.
    create_tables(engine)

    inspector = inspect(engine)
    current = set(inspector.get_table_names())
    new_tables = current - existing

    print(f"Database initialized: {settings.db.url}")
    print(f"Tables: {', '.join(sorted(current))}")
    if new_tables:
        print(f"New tables added: {', '.join(sorted(new_tables))}")


if __name__ == "__main__":
    main()
