"""Equibase public page scraper for entries and results.

Scrapes the free public-facing Equibase pages:
  - Entries:  equibase.com/static/entry/{track}/{date}.html
  - Results:  equibase.com/static/chart/pdf.html (chart PDFs)
  - Scratches: equibase.com/premium/eqbScratches.cfm

Outputs compact JSON records matching our ParsedEntry schema so the same
ingest pipeline can load scraped data into the DB.

Requirements: pip install httpx selectolax (both lightweight, no Selenium)
"""

from __future__ import annotations

import json
import re
import time
from dataclasses import asdict, dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterator

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]

try:
    from selectolax.parser import HTMLParser
except ImportError:
    HTMLParser = None  # type: ignore[assignment,misc]

# ── Track code mappings ────────────────────────────────────────────────
# Equibase uses 3-letter codes; map common aliases
TRACK_ALIASES: dict[str, str] = {
    "saratoga": "SAR", "belmont": "BEL", "aqueduct": "AQU",
    "churchill": "CD", "churchill downs": "CD", "keeneland": "KEE",
    "santa anita": "SA", "gulfstream": "GP", "gulfstream park": "GP",
    "del mar": "DMR", "pimlico": "PIM", "oaklawn": "OP",
    "oaklawn park": "OP", "laurel": "LRL", "laurel park": "LRL",
    "monmouth": "MTH", "monmouth park": "MTH", "parx": "PRX",
    "tampa bay": "TAM", "tampa bay downs": "TAM", "fair grounds": "FG",
    "woodbine": "WO", "los alamitos": "LA", "turfway": "TP",
    "turfway park": "TP", "penn national": "PEN", "charles town": "CT",
    "finger lakes": "FL", "suffolk": "SUF", "suffolk downs": "SUF",
    "golden gate": "GG", "golden gate fields": "GG", "ellis park": "ELP",
    "remington": "RP", "remington park": "RP", "lone star": "LS",
    "sam houston": "HOU", "turf paradise": "TUP", "sunland": "SUN",
    "sunland park": "SUN", "mountaineer": "MNR", "prairie meadows": "PRM",
    "hawthorne": "HAW", "arlington": "AP", "indiana grand": "IND",
    "sar": "SAR", "bel": "BEL", "aqu": "AQU", "cd": "CD",
    "kee": "KEE", "sa": "SA", "gp": "GP", "dmr": "DMR",
    "pim": "PIM", "op": "OP", "lrl": "LRL", "mth": "MTH",
}

EQUIBASE_BASE = "https://www.equibase.com"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; HorseGPT/3.14; research)",
    "Accept": "text/html",
}
REQUEST_DELAY = 1.5  # seconds between requests, be respectful


@dataclass
class ScrapedHorse:
    """Compact representation of one horse entry from a public entries page."""
    program_number: str = ""
    horse_name: str = ""
    jockey: str = ""
    trainer: str = ""
    weight: int | None = None
    morning_line_odds: str = ""  # raw string like "5-2", "8-1"
    morning_line_decimal: float | None = None
    medication: str = ""
    equipment: str = ""
    sire: str = ""
    dam: str = ""
    dam_sire: str = ""
    sex_age: str = ""  # e.g. "C3" = colt, 3yo
    color: str = ""
    owner: str = ""


@dataclass
class ScrapedRace:
    """One race from a public entries/results page."""
    track_code: str = ""
    race_date: str = ""  # ISO format
    race_number: int = 0
    distance: str = ""  # raw text "6 Furlongs", "1 1/16 Miles"
    distance_yards: int | None = None
    surface: str = ""  # "Dirt", "Turf", "AW"
    race_type: str = ""
    purse: int | None = None
    conditions: str = ""
    post_time: str = ""
    horses: list[ScrapedHorse] = field(default_factory=list)
    # Result fields (filled from results pages)
    results_order: list[str] = field(default_factory=list)  # horse names in finish order
    win_payoff: float | None = None
    place_payoff: float | None = None
    show_payoff: float | None = None
    exacta_payoff: float | None = None
    trifecta_payoff: float | None = None


@dataclass
class ScrapedCard:
    """Full card for a track/date."""
    track_code: str = ""
    race_date: str = ""
    races: list[ScrapedRace] = field(default_factory=list)


def _require_deps() -> None:
    if httpx is None:
        raise ImportError("pip install httpx  (lightweight HTTP client)")
    if HTMLParser is None:
        raise ImportError("pip install selectolax  (fast HTML parser)")


def _parse_ml_odds(raw: str) -> float | None:
    """Convert morning line string to decimal odds. '5-2' → 2.5, '8-1' → 8.0."""
    raw = raw.strip()
    if not raw:
        return None
    m = re.match(r"(\d+)-(\d+)", raw)
    if m:
        num, den = int(m.group(1)), int(m.group(2))
        return num / den if den > 0 else None
    try:
        return float(raw)
    except ValueError:
        return None


def _parse_distance_yards(text: str) -> int | None:
    """Convert distance text to yards. '6 Furlongs' → 1320."""
    text = text.lower().strip()
    # Furlongs
    m = re.search(r"([\d.]+)\s*furlong", text)
    if m:
        return int(float(m.group(1)) * 220)
    # Miles with fractions
    m = re.match(r"(\d+)\s+(\d+)/(\d+)\s*mile", text)
    if m:
        miles = int(m.group(1)) + int(m.group(2)) / int(m.group(3))
        return int(miles * 1760)
    # Plain miles
    m = re.search(r"([\d.]+)\s*mile", text)
    if m:
        return int(float(m.group(1)) * 1760)
    return None


def _parse_purse(text: str) -> int | None:
    """Extract purse amount from text like '$75,000'."""
    m = re.search(r"\$[\s]*([\d,]+)", text)
    if m:
        return int(m.group(1).replace(",", ""))
    return None


def _fetch(url: str, client: httpx.Client) -> str:
    """Fetch URL with rate limiting and retries."""
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


# ── Entries page scraper ───────────────────────────────────────────────

def scrape_entries(
    track_code: str,
    race_date: date,
    output_dir: Path | None = None,
) -> ScrapedCard:
    """Scrape entries for a track/date from Equibase public entries page.

    Returns a ScrapedCard with all races and horses.
    Optionally saves compact JSON to output_dir.
    """
    _require_deps()

    track = track_code.upper()
    date_str = race_date.strftime("%m/%d/%Y")
    # Equibase URL pattern updated April 2026: {TRACK}{MMDDYY}USA-EQB.html
    mmddyy = race_date.strftime("%m%d%y")
    url = f"{EQUIBASE_BASE}/static/entry/{track}{mmddyy}USA-EQB.html"

    card = ScrapedCard(track_code=track, race_date=race_date.isoformat())

    with httpx.Client() as client:
        html = _fetch(url, client)

    if not html:
        return card

    tree = HTMLParser(html)
    _parse_entries_html(tree, card)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{track}_{race_date.isoformat()}_entries.json"
        out_path.write_text(json.dumps(asdict(card), indent=2, default=str))

    return card


def _parse_entries_html(tree: HTMLParser, card: ScrapedCard) -> None:
    """Parse Equibase entries HTML into ScrapedCard.

    Equibase entries pages have a consistent structure:
    - Race headers in <div class="race-header"> or <h2> tags
    - Horse rows in <table> or structured <div> elements

    This parser is resilient to minor layout changes.
    """
    # Look for race blocks — Equibase uses various class names
    race_blocks = (
        tree.css("div.race-header, div.raceHeader, div.entry-race, h2.race")
        or tree.css("div[class*='race']")
    )

    # Fallback: parse the entire page looking for race number patterns
    body = tree.css_first("body")
    if not body:
        return

    text = body.text()
    # Split by race number patterns
    race_chunks = re.split(r"(?=Race\s+\d+)", text, flags=re.IGNORECASE)

    for chunk in race_chunks:
        if not chunk.strip():
            continue

        race_match = re.match(r"Race\s+(\d+)", chunk, re.IGNORECASE)
        if not race_match:
            continue

        race = ScrapedRace(
            track_code=card.track_code,
            race_date=card.race_date,
            race_number=int(race_match.group(1)),
        )

        # Extract distance
        dist_match = re.search(
            r"(\d[\d\s/]*(?:Furlong|Mile|Yard)s?)", chunk, re.IGNORECASE
        )
        if dist_match:
            race.distance = dist_match.group(1).strip()
            race.distance_yards = _parse_distance_yards(race.distance)

        # Surface
        for surf in ["Dirt", "Turf", "All Weather", "Synthetic", "Inner Turf"]:
            if surf.lower() in chunk.lower():
                race.surface = surf[0] if surf != "Inner Turf" else "IT"
                break

        # Purse
        purse_match = re.search(r"Purse:?\s*\$[\s]*([\d,]+)", chunk, re.IGNORECASE)
        if purse_match:
            race.purse = int(purse_match.group(1).replace(",", ""))

        # Race type
        for rtype in ["Stakes", "Allowance", "Maiden Special", "Maiden Claiming",
                       "Claiming", "Optional Claiming", "Starter"]:
            if rtype.lower() in chunk.lower():
                type_map = {
                    "stakes": "STK", "allowance": "ALW",
                    "maiden special": "MSW", "maiden claiming": "MCL",
                    "claiming": "CLM", "optional claiming": "AOC",
                    "starter": "STR",
                }
                race.race_type = type_map.get(rtype.lower(), rtype[:3].upper())
                break

        # Extract horse lines — look for patterns like "1  HorseName  JockeyName  TrainerName  5-2"
        horse_lines = re.findall(
            r"(\d{1,2}[A-Z]?)\s+([A-Z][A-Za-z'\s\-\.]+?)\s+"
            r"(?:([A-Z][a-z]+[\s,A-Za-z\-\.]*?)\s+)?"
            r"(?:([A-Z][a-z]+[\s,A-Za-z\-\.]*?)\s+)?"
            r"(\d+-\d+|\d+\.?\d*)\s*$",
            chunk, re.MULTILINE,
        )

        for parts in horse_lines:
            horse = ScrapedHorse(
                program_number=parts[0].strip(),
                horse_name=parts[1].strip(),
                jockey=parts[2].strip() if len(parts) > 2 else "",
                trainer=parts[3].strip() if len(parts) > 3 else "",
                morning_line_odds=parts[4].strip() if len(parts) > 4 else "",
            )
            horse.morning_line_decimal = _parse_ml_odds(horse.morning_line_odds)
            race.horses.append(horse)

        if race.race_number > 0:
            card.races.append(race)


# ── Results page scraper ───────────────────────────────────────────────

def scrape_results(
    track_code: str,
    race_date: date,
    output_dir: Path | None = None,
) -> ScrapedCard:
    """Scrape results for a track/date from Equibase public results page."""
    _require_deps()

    track = track_code.upper()
    # Equibase URL pattern updated April 2026
    mmddyy = race_date.strftime("%m%d%y")
    url = f"{EQUIBASE_BASE}/static/chart/{track}{mmddyy}USA-EQB.html"

    card = ScrapedCard(track_code=track, race_date=race_date.isoformat())

    with httpx.Client() as client:
        html = _fetch(url, client)

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

            # Extract finish order — look for numbered finish lines
            finish_pattern = re.findall(
                r"(\d{1,2})\s+([A-Z][A-Za-z'\s\-\.]+?)(?:\s+\d)", chunk
            )
            race.results_order = [name.strip() for _, name in finish_pattern]

            # Payoffs
            win_match = re.search(r"Win[:\s]*\$?([\d.]+)", chunk, re.IGNORECASE)
            if win_match:
                race.win_payoff = float(win_match.group(1))

            card.races.append(race)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{track}_{race_date.isoformat()}_results.json"
        out_path.write_text(json.dumps(asdict(card), indent=2, default=str))

    return card


# ── Bulk operations ────────────────────────────────────────────────────

def scrape_date_range(
    track_code: str,
    start_date: date,
    end_date: date,
    output_dir: Path,
    include_results: bool = True,
) -> list[ScrapedCard]:
    """Scrape entries (and optionally results) for a date range."""
    from datetime import timedelta

    cards = []
    current = start_date
    while current <= end_date:
        try:
            card = scrape_entries(track_code, current, output_dir)
            if card.races:
                cards.append(card)
                if include_results:
                    results = scrape_results(track_code, current, output_dir)
                    if results.races:
                        cards.append(results)
        except Exception as e:
            print(f"  Skip {track_code} {current}: {e}")
        current += timedelta(days=1)
    return cards


def resolve_track(query: str) -> str | None:
    """Resolve a track name/alias to its code. Returns None if unknown."""
    q = query.strip().lower()
    if q in TRACK_ALIASES:
        return TRACK_ALIASES[q]
    # Check if it's already a valid code (2-3 uppercase chars)
    if re.match(r"^[A-Z]{2,3}$", query.strip()):
        return query.strip().upper()
    return None
