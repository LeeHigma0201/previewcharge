"""Convert scraped JSON data into ParsedEntry objects for DB ingestion.

Bridge between the scrapers (which output ScrapedCard JSON) and the
existing ingest pipeline (which consumes ParsedEntry objects).
"""

from __future__ import annotations

import json
from datetime import date, datetime
from pathlib import Path
from typing import Any, Iterator

from sqlalchemy.orm import Session

from src.data.bris_parser import ParsedEntry, ParsedPP, ParsedWorkout
from src.data.models import Entry, Horse, PastPerformance, Workout
from src.data.scrapers.equibase import ScrapedCard, ScrapedHorse, ScrapedRace


def scraped_to_parsed(card: ScrapedCard) -> Iterator[ParsedEntry]:
    """Convert a ScrapedCard to ParsedEntry objects for the ingest pipeline."""
    for race in card.races:
        race_date = None
        if race.race_date:
            try:
                race_date = datetime.fromisoformat(race.race_date).date()
            except ValueError:
                pass

        for horse in race.horses:
            entry = ParsedEntry(
                track_code=race.track_code or card.track_code,
                race_date=race_date,
                race_number=race.race_number,
                distance_yards=race.distance_yards,
                surface=race.surface or "D",
                race_type=race.race_type,
                purse=race.purse,
                race_class=race.conditions or race.race_type,
                track_condition=None,
                num_entrants=len(race.horses),
                post_position=_safe_int(horse.program_number),
                program_number=horse.program_number,
                horse_name=horse.horse_name,
                jockey=horse.jockey or None,
                trainer=horse.trainer or None,
                morning_line_odds=horse.morning_line_decimal,
                weight=horse.weight,
                medication=horse.medication or None,
                equipment=horse.equipment or None,
                sire=horse.sire or None,
                dam=horse.dam or None,
                dam_sire=horse.dam_sire or None,
                sex=horse.sex_age[:1] if horse.sex_age else None,
            )
            yield entry


def _safe_int(val: str) -> int | None:
    """Extract integer from program number like '5', '1A'."""
    if not val:
        return None
    digits = "".join(c for c in val if c.isdigit())
    return int(digits) if digits else None


def ingest_scraped_directory(db_url: str, scraped_dir: Path) -> int:
    """Ingest all scraped JSON files from a directory into the database."""
    from src.data.ingest import ingest_entry

    from config.settings import DatabaseConfig, Settings
    from src.data.database import get_engine, get_session

    settings = Settings(db=DatabaseConfig(url=db_url))
    engine = get_engine(settings)
    session = get_session(engine)

    count = 0
    try:
        for json_file in sorted(scraped_dir.glob("*.json")):
            data = json.loads(json_file.read_text())
            card = _dict_to_card(data)

            for parsed in scraped_to_parsed(card):
                if parsed.horse_name:
                    ingest_entry(session, parsed)
                    count += 1
                    if count % 50 == 0:
                        session.commit()

        session.commit()
        print(f"Ingested {count} entries from scraped data")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()

    return count


def apply_partial_update(
    session: Session,
    horse_name: str,
    payload: dict[str, Any],
    kind: str,
) -> int:
    """Apply a subagent fetch result to the DB.

    ``kind`` controls routing:
      - ``"pps"``: payload has ``pps: [...]``; insert/replace PastPerformance
        rows on all entries for this horse that don't already have PPs.
      - ``"workouts"``: payload has ``workouts: [...]`` plus optional
        ``weight`` / ``medication`` / ``equipment`` / ``running_style`` /
        ``dam`` / ``dam_sire`` / ``birth_year`` / ``sex``. Workouts attach
        to the horse; the scalar fields update the horse and its entries.

    Returns the number of rows affected (inserted + updated).
    """
    if not horse_name:
        return 0
    horse = session.query(Horse).filter_by(name=horse_name).first()
    if horse is None:
        return 0

    affected = 0
    if kind == "pps":
        pps_data = payload.get("pps") or []
        # Attach PPs to every entry for this horse that currently has none.
        for entry in session.query(Entry).filter_by(horse_id=horse.id).all():
            if entry.past_performances:
                continue
            for i, pp in enumerate(pps_data[:10], start=1):
                row = PastPerformance(
                    entry_id=entry.id,
                    pp_number=i,
                    race_date=_to_date(pp.get("race_date")),
                    track_code=pp.get("track_code"),
                    distance_yards=_to_int(pp.get("distance_yards")),
                    surface=pp.get("surface"),
                    track_condition=pp.get("track_condition"),
                    race_type=pp.get("race_type"),
                    purse=_to_int(pp.get("purse")),
                    claiming_price=_to_int(pp.get("claiming_price")),
                    num_entrants=_to_int(pp.get("num_entrants")),
                    finish_position=_to_int(pp.get("finish_position")),
                    final_odds=_to_float(pp.get("final_odds")),
                    beyer_speed=_to_int(pp.get("beyer_speed")),
                    e1_pace=_to_int(pp.get("e1_pace")),
                    e2_pace=_to_int(pp.get("e2_pace")),
                    late_pace=_to_int(pp.get("late_pace")),
                    position_1st_call=_to_int(pp.get("position_1st_call")),
                    position_2nd_call=_to_int(pp.get("position_2nd_call")),
                    position_stretch=_to_int(pp.get("position_stretch")),
                    lengths_behind_1st=_to_float(pp.get("lengths_behind_1st")),
                    lengths_behind_finish=_to_float(pp.get("lengths_behind_finish")),
                    weight=_to_int(pp.get("weight")),
                    final_time_seconds=_to_float(pp.get("final_time_seconds")),
                )
                session.add(row)
                affected += 1

    elif kind == "workouts":
        workouts_data = payload.get("workouts") or []
        existing_dates = {w.workout_date for w in horse.workouts}
        for wo in workouts_data[:12]:
            d = _to_date(wo.get("workout_date"))
            if d is None or d in existing_dates:
                continue
            row = Workout(
                horse_id=horse.id,
                workout_date=d,
                track_code=wo.get("track_code") or "",
                distance_furlongs=_to_float(wo.get("distance_furlongs")) or 0.0,
                time_seconds=_to_float(wo.get("time_seconds")) or 0.0,
                rank=_to_int(wo.get("rank")),
                total_workers=_to_int(wo.get("total_workers")),
                surface=wo.get("surface"),
            )
            session.add(row)
            affected += 1

        # Horse-level fields.
        for field_, value in [
            ("dam", payload.get("dam")),
            ("dam_sire", payload.get("dam_sire")),
            ("birth_year", _to_int(payload.get("birth_year"))),
            ("sex", payload.get("sex")),
        ]:
            if value and not getattr(horse, field_, None):
                setattr(horse, field_, value)
                affected += 1

        # Entry-level fields (apply to all entries for this horse).
        entry_updates = {
            "weight": _to_int(payload.get("weight")),
            "medication": payload.get("medication"),
            "equipment": payload.get("equipment"),
            "running_style": payload.get("running_style"),
        }
        for entry in session.query(Entry).filter_by(horse_id=horse.id).all():
            for f, v in entry_updates.items():
                if v is not None and getattr(entry, f, None) in (None, ""):
                    setattr(entry, f, v)
                    affected += 1

    return affected


def _to_int(v: Any) -> int | None:
    if v is None or v == "":
        return None
    try:
        return int(v)
    except (ValueError, TypeError):
        return None


def _to_float(v: Any) -> float | None:
    if v is None or v == "":
        return None
    try:
        return float(v)
    except (ValueError, TypeError):
        return None


def _to_date(v: Any) -> date | None:
    if not v:
        return None
    if isinstance(v, date):
        return v
    try:
        return datetime.fromisoformat(str(v)).date()
    except ValueError:
        return None


def _dict_to_card(data: dict) -> ScrapedCard:
    """Reconstruct a ScrapedCard from a JSON dict."""
    card = ScrapedCard(
        track_code=data.get("track_code", ""),
        race_date=data.get("race_date", ""),
    )
    for race_data in data.get("races", []):
        race = ScrapedRace(
            track_code=race_data.get("track_code", card.track_code),
            race_date=race_data.get("race_date", card.race_date),
            race_number=race_data.get("race_number", 0),
            distance=race_data.get("distance", ""),
            distance_yards=race_data.get("distance_yards"),
            surface=race_data.get("surface", ""),
            race_type=race_data.get("race_type", ""),
            purse=race_data.get("purse"),
            conditions=race_data.get("conditions", ""),
            post_time=race_data.get("post_time", ""),
        )
        for h_data in race_data.get("horses", []):
            horse = ScrapedHorse(
                program_number=h_data.get("program_number", ""),
                horse_name=h_data.get("horse_name", ""),
                jockey=h_data.get("jockey", ""),
                trainer=h_data.get("trainer", ""),
                weight=h_data.get("weight"),
                morning_line_odds=h_data.get("morning_line_odds", ""),
                morning_line_decimal=h_data.get("morning_line_decimal"),
                medication=h_data.get("medication", ""),
                equipment=h_data.get("equipment", ""),
                sire=h_data.get("sire", ""),
                dam=h_data.get("dam", ""),
                dam_sire=h_data.get("dam_sire", ""),
                sex_age=h_data.get("sex_age", ""),
            )
            race.horses.append(horse)
        card.races.append(race)
    return card
