"""Database engine and session management."""

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from config.settings import Settings
from src.data.models import Base


def get_engine(settings: Settings | None = None) -> Engine:
    settings = settings or Settings.load()
    return create_engine(settings.db.url, echo=False)


def create_tables(engine: Engine) -> None:
    Base.metadata.create_all(engine)


def drop_tables(engine: Engine) -> None:
    Base.metadata.drop_all(engine)


def get_session(engine: Engine) -> Session:
    factory = sessionmaker(bind=engine)
    return factory()
