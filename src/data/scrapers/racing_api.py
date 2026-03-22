"""The Racing API client — free tier for UK/Irish/HK racing.

https://theracingapi.com — JSON REST API designed for ML developers.
Free tier: 100 requests/day, covers today's cards + results.

This client fetches race cards, results, and horse form in compact JSON
that maps directly to our DB schema.
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import asdict
from datetime import date
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]

from src.data.scrapers.equibase import (
    ScrapedCard,
    ScrapedHorse,
    ScrapedRace,
    _parse_distance_yards,
    _parse_ml_odds,
)

API_BASE = "https://api.theracingapi.com/v1"


def _get_headers() -> dict[str, str]:
    """Get API headers. Reads key from RACING_API_KEY env var."""
    key = os.environ.get("RACING_API_KEY", "")
    return {
        "Authorization": f"Bearer {key}" if key else "",
        "Accept": "application/json",
    }


def _api_get(path: str) -> dict | list | None:
    """Make an API GET request with rate limiting."""
    if httpx is None:
        raise ImportError("pip install httpx")

    url = f"{API_BASE}{path}"
    with httpx.Client() as client:
        for attempt in range(3):
            try:
                resp = client.get(url, headers=_get_headers(), timeout=15.0)
                if resp.status_code == 429:
                    time.sleep(5)
                    continue
                resp.raise_for_status()
                time.sleep(0.5)  # rate limit
                return resp.json()
            except (httpx.HTTPError, httpx.TimeoutException):
                if attempt < 2:
                    time.sleep(2 ** (attempt + 1))
                else:
                    raise
    return None


def fetch_racecards(race_date: date | None = None) -> list[ScrapedCard]:
    """Fetch all racecards for a date (default: today)."""
    date_str = (race_date or date.today()).isoformat()
    data = _api_get(f"/racecards?date={date_str}")
    if not data or not isinstance(data, dict):
        return []

    cards_by_course: dict[str, ScrapedCard] = {}

    for race_data in data.get("racecards", data.get("races", [])):
        course = race_data.get("course", "UNK")
        course_code = course[:3].upper()

        if course_code not in cards_by_course:
            cards_by_course[course_code] = ScrapedCard(
                track_code=course_code, race_date=date_str
            )

        card = cards_by_course[course_code]
        race = ScrapedRace(
            track_code=course_code,
            race_date=date_str,
            race_number=race_data.get("race_number", len(card.races) + 1),
            distance=race_data.get("distance", ""),
            surface=race_data.get("going", "")[:1],
            race_type=race_data.get("race_class", ""),
            purse=race_data.get("prize", None),
            conditions=race_data.get("conditions", ""),
            post_time=race_data.get("off_time", ""),
        )
        if race.distance:
            race.distance_yards = _parse_distance_yards(race.distance)

        for runner in race_data.get("runners", []):
            horse = ScrapedHorse(
                program_number=str(runner.get("cloth", "")),
                horse_name=runner.get("horse", ""),
                jockey=runner.get("jockey", ""),
                trainer=runner.get("trainer", ""),
                morning_line_odds=str(runner.get("odds", "")),
                sire=runner.get("sire", ""),
                dam=runner.get("dam", ""),
                dam_sire=runner.get("damsire", ""),
                sex_age=runner.get("sex_age", ""),
            )
            horse.morning_line_decimal = _parse_ml_odds(horse.morning_line_odds)
            if runner.get("weight_lbs"):
                horse.weight = runner["weight_lbs"]
            race.horses.append(horse)

        card.races.append(race)

    return list(cards_by_course.values())


def fetch_horse_form(horse_name: str, limit: int = 10) -> list[dict]:
    """Fetch recent form for a horse by name."""
    data = _api_get(f"/horses/search?name={horse_name}&limit={limit}")
    if not data or not isinstance(data, dict):
        return []
    return data.get("results", data.get("horses", []))


def save_cards(cards: list[ScrapedCard], output_dir: Path) -> None:
    """Save scraped cards as compact JSON."""
    output_dir.mkdir(parents=True, exist_ok=True)
    for card in cards:
        out_path = output_dir / f"{card.track_code}_{card.race_date}_api.json"
        out_path.write_text(json.dumps(asdict(card), indent=2, default=str))
