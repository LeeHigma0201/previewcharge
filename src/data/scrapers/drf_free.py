"""DRF (Daily Racing Form) free data scraper.

Scrapes publicly available data from DRF's free pages:
  - Today's entries: drf.com/entries
  - Race results: drf.com/results
  - Scratches & changes

Outputs the same ScrapedCard format as the Equibase scraper for
unified ingestion.

Requirements: pip install httpx selectolax
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import asdict
from datetime import date
from pathlib import Path

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]

try:
    from selectolax.parser import HTMLParser
except ImportError:
    HTMLParser = None  # type: ignore[assignment,misc]

from src.data.scrapers.equibase import (
    HEADERS,
    REQUEST_DELAY,
    ScrapedCard,
    ScrapedHorse,
    ScrapedRace,
    _parse_distance_yards,
    _parse_ml_odds,
    _require_deps,
)

DRF_BASE = "https://www.drf.com"


def _fetch_drf(path: str) -> str:
    """Fetch a DRF page."""
    _require_deps()
    url = f"{DRF_BASE}{path}"
    with httpx.Client() as client:
        for attempt in range(3):
            try:
                resp = client.get(url, headers=HEADERS, timeout=15.0, follow_redirects=True)
                resp.raise_for_status()
                time.sleep(REQUEST_DELAY)
                return resp.text
            except (httpx.HTTPError, httpx.TimeoutException):
                if attempt < 2:
                    time.sleep(2 ** (attempt + 1))
                else:
                    raise
    return ""


def scrape_drf_entries(
    track_code: str,
    race_date: date,
    output_dir: Path | None = None,
) -> ScrapedCard:
    """Scrape entries from DRF free entries page."""
    _require_deps()

    track = track_code.upper()
    date_str = race_date.strftime("%Y-%m-%d")
    path = f"/entries/{track}/{date_str}"

    card = ScrapedCard(track_code=track, race_date=race_date.isoformat())

    html = _fetch_drf(path)
    if not html:
        return card

    tree = HTMLParser(html)

    # DRF uses JSON-LD or embedded data objects for entries
    # Try to find embedded race data in script tags
    for script in tree.css("script"):
        text = script.text() or ""
        if '"races"' in text or '"entries"' in text:
            # Try to extract JSON data
            json_match = re.search(r"\{.*\"races\".*\}", text, re.DOTALL)
            if json_match:
                try:
                    data = json.loads(json_match.group())
                    _parse_drf_json(data, card)
                    break
                except json.JSONDecodeError:
                    continue

    # Fallback: parse HTML structure
    if not card.races:
        body = tree.css_first("body")
        if body:
            _parse_drf_html(body.text(), card)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{track}_{race_date.isoformat()}_drf_entries.json"
        out_path.write_text(json.dumps(asdict(card), indent=2, default=str))

    return card


def _parse_drf_json(data: dict, card: ScrapedCard) -> None:
    """Parse DRF embedded JSON race data."""
    races = data.get("races", [])
    for race_data in races:
        race = ScrapedRace(
            track_code=card.track_code,
            race_date=card.race_date,
            race_number=race_data.get("raceNumber", 0),
            distance=race_data.get("distance", ""),
            surface=race_data.get("surface", "")[0:1] if race_data.get("surface") else "",
            race_type=race_data.get("raceType", ""),
            purse=race_data.get("purse"),
            conditions=race_data.get("conditions", ""),
            post_time=race_data.get("postTime", ""),
        )
        if race.distance:
            race.distance_yards = _parse_distance_yards(race.distance)

        for entry in race_data.get("entries", []):
            horse = ScrapedHorse(
                program_number=str(entry.get("programNumber", "")),
                horse_name=entry.get("horseName", ""),
                jockey=entry.get("jockey", ""),
                trainer=entry.get("trainer", ""),
                weight=entry.get("weight"),
                morning_line_odds=str(entry.get("morningLine", "")),
                medication=entry.get("medication", ""),
                equipment=entry.get("equipment", ""),
                sire=entry.get("sire", ""),
                dam=entry.get("dam", ""),
                dam_sire=entry.get("damSire", ""),
            )
            horse.morning_line_decimal = _parse_ml_odds(horse.morning_line_odds)
            race.horses.append(horse)

        card.races.append(race)


def _parse_drf_html(text: str, card: ScrapedCard) -> None:
    """Fallback HTML text parser for DRF entries."""
    race_chunks = re.split(r"(?=Race\s+\d+)", text, flags=re.IGNORECASE)

    for chunk in race_chunks:
        race_match = re.match(r"Race\s+(\d+)", chunk, re.IGNORECASE)
        if not race_match:
            continue

        race = ScrapedRace(
            track_code=card.track_code,
            race_date=card.race_date,
            race_number=int(race_match.group(1)),
        )

        # Distance
        dist_match = re.search(
            r"(\d[\d\s/]*(?:Furlong|Mile|Yard)s?)", chunk, re.IGNORECASE
        )
        if dist_match:
            race.distance = dist_match.group(1).strip()
            race.distance_yards = _parse_distance_yards(race.distance)

        # Surface
        for surf_name, code in [("Dirt", "D"), ("Turf", "T"), ("All Weather", "AW")]:
            if surf_name.lower() in chunk.lower():
                race.surface = code
                break

        # Purse
        purse_match = re.search(r"\$[\s]*([\d,]+)", chunk)
        if purse_match:
            race.purse = int(purse_match.group(1).replace(",", ""))

        card.races.append(race)


def scrape_drf_results(
    track_code: str,
    race_date: date,
    output_dir: Path | None = None,
) -> ScrapedCard:
    """Scrape results from DRF free results page."""
    _require_deps()

    track = track_code.upper()
    date_str = race_date.strftime("%Y-%m-%d")
    path = f"/results/{track}/{date_str}"

    card = ScrapedCard(track_code=track, race_date=race_date.isoformat())

    html = _fetch_drf(path)
    if not html:
        return card

    tree = HTMLParser(html)
    body = tree.css_first("body")
    if body:
        text = body.text()
        race_chunks = re.split(r"(?=Race\s+\d+)", text, flags=re.IGNORECASE)

        for chunk in race_chunks:
            race_match = re.match(r"Race\s+(\d+)", chunk, re.IGNORECASE)
            if not race_match:
                continue

            race = ScrapedRace(
                track_code=track,
                race_date=race_date.isoformat(),
                race_number=int(race_match.group(1)),
            )

            # Extract payoffs
            win_match = re.search(r"Win[:\s]*\$?([\d.]+)", chunk, re.IGNORECASE)
            if win_match:
                race.win_payoff = float(win_match.group(1))

            card.races.append(race)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{track}_{race_date.isoformat()}_drf_results.json"
        out_path.write_text(json.dumps(asdict(card), indent=2, default=str))

    return card
