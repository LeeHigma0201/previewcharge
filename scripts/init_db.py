"""Initialize the HorseGPT database. Creates all tables."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from config.settings import Settings
from src.data.database import create_tables, get_engine


def main() -> None:
    settings = Settings.load()
    engine = get_engine(settings)
    create_tables(engine)
    print(f"Database initialized: {settings.db.url}")
    # Verify tables
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    print(f"Tables created: {', '.join(tables)}")


if __name__ == "__main__":
    main()
