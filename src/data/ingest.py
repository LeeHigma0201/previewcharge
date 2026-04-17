"""Orchestrates BRIS parsing into the SQLite database.

Usage:
    python -m src.data.ingest --db horsegpt.db --input data/bris/
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy.orm import Session

from src.data.bris_parser import ParsedEntry, parse_bris_directory, parse_bris_file
from src.data.database import get_engine, get_session
from src.data.models import Entry, Horse, PastPerformance, Race, Workout


def _get_or_create_horse(session: Session, parsed: ParsedEntry) -> Horse:
    """Get existing horse or create new one."""
    if not parsed.horse_name:
        raise ValueError("Entry has no horse name")

    horse = session.query(Horse).filter_by(name=parsed.horse_name).first()
    if horse is None:
        horse = Horse(
            name=parsed.horse_name,
            sire=parsed.sire,
            dam=parsed.dam,
            dam_sire=parsed.dam_sire,
            birth_year=parsed.birth_year,
            sex=parsed.sex,
        )
        session.add(horse)
        session.flush()
    return horse


def _get_or_create_race(session: Session, parsed: ParsedEntry) -> Race:
    """Get existing race or create new one."""
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
        race = Race(
            track_code=parsed.track_code,
            race_date=parsed.race_date,
            race_number=parsed.race_number,
            distance_yards=parsed.distance_yards,
            surface=parsed.surface,
            race_type=parsed.race_type,
            purse=parsed.purse,
            claiming_price=parsed.claiming_price_race,
            track_condition=parsed.track_condition,
            num_entrants=parsed.num_entrants,
            race_class=parsed.race_class,
        )
        session.add(race)
        session.flush()
    return race


def ingest_entry(session: Session, parsed: ParsedEntry) -> Entry | None:
    """Ingest a single parsed entry. Returns None when required fields are missing.

    Post position is the unique identifier for a horse within a race; without it
    the row cannot be deduplicated and would create phantom entries. We refuse
    to fabricate a value (the legacy `or 0` default produced post-0 collisions).
    """
    if parsed.post_position is None:
        return None

    horse = _get_or_create_horse(session, parsed)
    race = _get_or_create_race(session, parsed)

    existing = (
        session.query(Entry)
        .filter_by(race_id=race.id, post_position=parsed.post_position)
        .first()
    )
    if existing:
        return existing

    entry = Entry(
        race_id=race.id,
        horse_id=horse.id,
        post_position=parsed.post_position,
        program_number=parsed.program_number,
        jockey=parsed.jockey,
        trainer=parsed.trainer,
        morning_line_odds=parsed.morning_line_odds,
        weight=parsed.weight,
        medication=parsed.medication,
        equipment=parsed.equipment,
        claiming_price=parsed.claiming_price_entry,
        bris_speed=parsed.bris_speed,
        bris_class_rating=parsed.bris_class_rating,
        bris_pace_e1=parsed.bris_pace_e1,
        bris_pace_e2=parsed.bris_pace_e2,
        bris_late_pace=parsed.bris_late_pace,
        running_style=parsed.running_style,
    )
    session.add(entry)
    session.flush()

    # Add past performances
    for pp in parsed.past_performances:
        pp_row = PastPerformance(
            entry_id=entry.id,
            pp_number=pp.pp_number,
            race_date=pp.race_date,
            track_code=pp.track_code,
            distance_yards=pp.distance_yards,
            surface=pp.surface,
            track_condition=pp.track_condition,
            race_type=pp.race_type,
            purse=pp.purse,
            claiming_price=pp.claiming_price,
            num_entrants=pp.num_entrants,
            finish_position=pp.finish_position,
            final_odds=pp.final_odds,
            beyer_speed=pp.beyer_speed,
            e1_pace=pp.e1_pace,
            e2_pace=pp.e2_pace,
            late_pace=pp.late_pace,
            position_1st_call=pp.position_1st_call,
            position_2nd_call=pp.position_2nd_call,
            position_stretch=pp.position_stretch,
            lengths_behind_1st=pp.lengths_behind_1st,
            lengths_behind_finish=pp.lengths_behind_finish,
            weight=pp.weight,
            final_time_seconds=pp.final_time_seconds,
        )
        session.add(pp_row)

    # Add workouts. A workout without distance or time is unusable; skip rather
    # than fabricate zeros that would corrupt workout-derived features.
    for wo in parsed.workouts:
        if wo.workout_date is None or wo.distance_furlongs is None or wo.time_seconds is None:
            continue
        workout = Workout(
            horse_id=horse.id,
            workout_date=wo.workout_date,
            track_code=wo.track_code,
            distance_furlongs=wo.distance_furlongs,
            time_seconds=wo.time_seconds,
            rank=wo.rank,
            total_workers=wo.total_workers,
        )
        session.add(workout)

    return entry


def ingest_from_path(db_url: str, input_path: Path) -> int:
    """Ingest all BRIS data from a path (file or directory) into the database."""
    from config.settings import DatabaseConfig, Settings

    settings = Settings(db=DatabaseConfig(url=db_url))
    engine = get_engine(settings)
    session = get_session(engine)

    count = 0
    skipped = 0
    try:
        if input_path.is_dir():
            entries = parse_bris_directory(input_path)
        else:
            entries = parse_bris_file(input_path)

        for parsed in entries:
            if not parsed.horse_name:
                skipped += 1
                continue
            entry = ingest_entry(session, parsed)
            if entry is None:
                skipped += 1
                continue
            count += 1
            if count % 100 == 0:
                session.commit()
                print(f"  Ingested {count} entries...")

        session.commit()
        print(f"Ingest complete: {count} entries ingested, {skipped} skipped (incomplete data)")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Ingest BRIS data into HorseGPT database")
    parser.add_argument("--db", default="sqlite:///horsegpt.db", help="Database URL")
    parser.add_argument("--input", required=True, help="Path to BRIS file or directory")
    args = parser.parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"Error: {input_path} does not exist", file=sys.stderr)
        sys.exit(1)

    ingest_from_path(args.db, input_path)


if __name__ == "__main__":
    main()
