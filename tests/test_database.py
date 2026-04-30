"""Tests for database models and operations."""

from datetime import date

from src.data.models import Entry, Horse, Race


def test_create_tables(engine):
    """Verify all tables are created."""
    from sqlalchemy import inspect
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    assert tables == {"races", "horses", "entries", "past_performances", "workouts", "track_bias", "odds_snapshots"}


def test_sample_race_has_entries(sample_race, session):
    """Verify the sample race fixture creates correct data."""
    race = session.query(Race).filter_by(id=sample_race.id).first()
    assert race is not None
    assert len(race.entries) == 8
    assert race.track_code == "SAR"
    assert race.distance_yards == 1320


def test_entry_relationships(sample_race, session):
    """Verify entry relationships work correctly."""
    entry = session.query(Entry).first()
    assert entry.race is not None
    assert entry.horse is not None
    assert len(entry.past_performances) == 3


def test_horse_uniqueness(session):
    """Verify horse name uniqueness."""
    h1 = Horse(name="Test Horse", sire="Sire A")
    session.add(h1)
    session.commit()

    h2 = Horse(name="Test Horse", sire="Sire B")
    session.add(h2)
    try:
        session.commit()
        assert False, "Should have raised IntegrityError"
    except Exception:
        session.rollback()
