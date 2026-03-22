"""Convert scraped JSON data into ParsedEntry objects for DB ingestion.

Bridge between the scrapers (which output ScrapedCard JSON) and the
existing ingest pipeline (which consumes ParsedEntry objects).
"""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
from typing import Iterator

from src.data.bris_parser import ParsedEntry, ParsedPP, ParsedWorkout
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
