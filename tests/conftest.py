"""Test fixtures for HorseGPT."""

import sys
from datetime import date
from pathlib import Path

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.data.models import Base, Entry, Horse, PastPerformance, Race, Workout


@pytest.fixture
def engine():
    """In-memory SQLite engine."""
    eng = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(eng)
    yield eng
    Base.metadata.drop_all(eng)


@pytest.fixture
def session(engine):
    """Database session."""
    factory = sessionmaker(bind=engine)
    sess = factory()
    yield sess
    sess.close()


@pytest.fixture
def sample_race(session: Session) -> Race:
    """Create a sample race with entries and past performances."""
    race = Race(
        track_code="SAR",
        race_date=date(2023, 8, 15),
        race_number=5,
        distance_yards=1320,
        surface="D",
        race_type="ALW",
        purse=100000,
        track_condition="FT",
        num_entrants=8,
    )
    session.add(race)
    session.flush()

    horses_data = [
        ("Speed Demon", "E", 3.0, 90, 95, 80, 85),
        ("Stalker Sam", "P", 5.0, 85, 80, 85, 90),
        ("Closer Carl", "C", 8.0, 88, 75, 70, 95),
        ("Early Bird", "EP", 4.0, 87, 92, 82, 83),
        ("Pace Setter", "E", 6.0, 82, 93, 83, 78),
        ("Mid Pack", "P", 10.0, 80, 82, 80, 82),
        ("Long Shot", "S", 20.0, 78, 78, 75, 88),
        ("Dark Horse", "C", 15.0, 83, 72, 68, 92),
    ]

    for i, (name, style, ml, speed, e1, e2, lp) in enumerate(horses_data):
        horse = Horse(name=name, sire=f"Sire_{name}", dam=f"Dam_{name}")
        session.add(horse)
        session.flush()

        entry = Entry(
            race_id=race.id,
            horse_id=horse.id,
            post_position=i + 1,
            program_number=str(i + 1),
            morning_line_odds=ml,
            running_style=style,
            bris_speed=speed,
            bris_pace_e1=e1,
            bris_pace_e2=e2,
            bris_late_pace=lp,
            jockey=f"Jockey_{i}",
            trainer=f"Trainer_{i}",
        )
        session.add(entry)
        session.flush()

        # Add 3 past performances
        for pp_num in range(1, 4):
            pp = PastPerformance(
                entry_id=entry.id,
                pp_number=pp_num,
                race_date=date(2023, 8 - pp_num, 10),
                track_code="SAR",
                distance_yards=1320,
                surface="D",
                track_condition="FT",
                finish_position=(i % 4) + 1,
                num_entrants=8,
                beyer_speed=speed - pp_num * 2,
                e1_pace=e1 - pp_num,
                e2_pace=e2 - pp_num,
                late_pace=lp - pp_num,
                final_odds=ml + pp_num,
                purse=80000 + pp_num * 5000,
            )
            session.add(pp)

    session.commit()
    return race
