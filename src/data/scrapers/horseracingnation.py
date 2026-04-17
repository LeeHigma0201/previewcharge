"""Horse Racing Nation (HRN) entries scraper.

Scrapes the free public HRN entries page:
  https://entries.horseracingnation.com/entries-results/{slug}/{YYYY-MM-DD}

HRN's entries page is thin relative to Equibase/BRIS: for each horse we get
program number, post position, horse name, sire, trainer, jockey, and the
morning-line odds. Past performances, speed/pace figures, workouts, and
equipment are NOT on this page and must be filled in via a separate
prompt-driven fetch (see src/data/scrapers/prompt_specs.py).

Reuses the ScrapedCard/ScrapedRace/ScrapedHorse dataclasses and helper
functions from src/data/scrapers/equibase.py.
"""

from __future__ import annotations

import json
import re
from dataclasses import asdict
from datetime import date
from pathlib import Path

from src.data.scrapers.equibase import (
    HEADERS,
    ScrapedCard,
    ScrapedHorse,
    ScrapedRace,
    _fetch,
    _parse_distance_yards,
    _parse_ml_odds,
    _parse_purse,
    _require_deps,
)

try:
    import httpx
except ImportError:
    httpx = None  # type: ignore[assignment]

try:
    from selectolax.parser import HTMLParser, Node
except ImportError:
    HTMLParser = None  # type: ignore[assignment,misc]
    Node = None  # type: ignore[assignment,misc]


HRN_ENTRIES_BASE = "https://entries.horseracingnation.com/entries-results"

# HRN uses URL slugs (spaces → hyphens, lowercased). Many tracks share their
# Equibase code's common name, so we map from Equibase code → HRN slug.
TRACK_SLUGS: dict[str, str] = {
    "KEE": "keeneland",
    "SAR": "saratoga",
    "BEL": "belmont-at-the-big-a",
    "AQU": "aqueduct",
    "CD": "churchill-downs",
    "SA": "santa-anita",
    "GP": "gulfstream-park",
    "DMR": "del-mar",
    "PIM": "pimlico",
    "OP": "oaklawn-park",
    "LRL": "laurel-park",
    "MTH": "monmouth-park",
    "PRX": "parx-racing",
    "TAM": "tampa-bay-downs",
    "FG": "fair-grounds",
    "WO": "woodbine",
    "TP": "turfway-park",
    "ELP": "ellis-park",
    "RP": "remington-park",
    "LS": "lone-star-park",
    "HOU": "sam-houston-race-park",
    "GG": "golden-gate-fields",
    "HAW": "hawthorne",
    "IND": "indiana-grand",
    "PEN": "penn-national",
    "CT": "charles-town",
    "FL": "finger-lakes",
    "TUP": "turf-paradise",
    "SUN": "sunland-park",
    "MNR": "mountaineer",
    "PRM": "prairie-meadows",
    "LA": "los-alamitos-race-course",
    "AP": "arlington-park",
}


# Order matters: more-specific phrases must be checked before shorter ones
# (e.g. "starter allowance" before "allowance", "stakes" phrases before bare
# "allowance"). The classifier walks this list top-to-bottom.
RACE_TYPE_MAP: list[tuple[str, str]] = [
    ("maiden claiming", "MCL"),
    ("maiden special weight", "MSW"),
    ("maiden", "MSW"),
    ("starter allowance", "STR"),
    ("starter", "STR"),
    ("allowance optional claiming", "AOC"),
    ("optional claiming", "AOC"),
    ("allowance", "ALW"),
    ("claiming", "CLM"),
    ("handicap", "STK"),
    ("stakes", "STK"),
    # HRN abbreviates stakes names with a trailing " S." (e.g. "Baird Doubledogdare S.")
    (" s.", "STK"),
]


def resolve_hrn_slug(query: str) -> str | None:
    """Resolve a track name/alias/Equibase code to the HRN URL slug.

    Accepts full names ("Keeneland"), Equibase codes ("KEE"), or an
    already-formed slug ("keeneland"). Returns None if unknown.
    """
    q = query.strip()
    if not q:
        return None
    up = q.upper()
    if up in TRACK_SLUGS:
        return TRACK_SLUGS[up]
    low = q.lower()
    if low in TRACK_SLUGS.values():
        return low
    # Heuristic fallback: downcase + replace whitespace with hyphens.
    guess = re.sub(r"\s+", "-", low)
    return guess or None


def _classify_race_type(text: str) -> str:
    """Map race-distance-line text like 'Maiden Claiming' to our code."""
    low = text.lower()
    for phrase, code in RACE_TYPE_MAP:
        if phrase in low:
            return code
    return ""


def _classify_surface(text: str) -> str:
    """Return D/T/AW from free text."""
    low = text.lower()
    if "all weather" in low or "synthetic" in low or "tapeta" in low:
        return "AW"
    if "turf" in low:
        return "T"
    if "dirt" in low:
        return "D"
    return ""


def _extract_claiming_price(text: str) -> int | None:
    """Pull '$50,000' out of a distance line like '1 1/16M, Dirt, $50,000 Maiden Claiming'."""
    m = re.search(r"\$[\s]*([\d,]+)", text)
    if m:
        return int(m.group(1).replace(",", ""))
    return None


def _hrn_distance_yards(text: str) -> int | None:
    """HRN uses shorthand: '1 1/16M' (miles), '7f' (furlongs), '5 1/2F' (furlongs)."""
    if not text:
        return None
    s = text.strip().lower().rstrip(".")
    # Mixed "X Y/Z M" (miles)
    m = re.match(r"(\d+)\s+(\d+)/(\d+)\s*m\b", s)
    if m:
        miles = int(m.group(1)) + int(m.group(2)) / int(m.group(3))
        return int(miles * 1760)
    # Mixed "X Y/Z F" (furlongs)
    m = re.match(r"(\d+)\s+(\d+)/(\d+)\s*f\b", s)
    if m:
        furs = int(m.group(1)) + int(m.group(2)) / int(m.group(3))
        return int(furs * 220)
    # Plain furlongs: "7f", "5.5f"
    m = re.match(r"([\d.]+)\s*f\b", s)
    if m:
        return int(float(m.group(1)) * 220)
    # Plain miles: "1m", "1.0625m"
    m = re.match(r"([\d.]+)\s*m\b", s)
    if m:
        return int(float(m.group(1)) * 1760)
    # Fallback to long-form parser (handles "6 Furlongs", "1 1/8 Miles").
    return _parse_distance_yards(text)


def _clean_text(s: str | None) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()


def _first_p_text(node: "Node") -> str:
    p = node.css_first("p")
    return _clean_text(p.text()) if p else ""


def scrape_entries(
    track_code: str,
    race_date: date,
    output_dir: Path | None = None,
    html: str | None = None,
) -> ScrapedCard:
    """Scrape HRN entries for a track/date.

    Pass `html` to parse a pre-fetched page (useful for tests).
    """
    _require_deps()

    slug = resolve_hrn_slug(track_code)
    if not slug:
        raise ValueError(f"Unknown track for HRN slug: {track_code}")

    card = ScrapedCard(
        track_code=track_code.upper() if len(track_code) <= 4 else track_code,
        race_date=race_date.isoformat(),
    )

    if html is None:
        url = f"{HRN_ENTRIES_BASE}/{slug}/{race_date.isoformat()}"
        with httpx.Client(headers=HEADERS) as client:
            html = _fetch(url, client)

    if not html:
        return card

    tree = HTMLParser(html)
    _parse_entries_html(tree, card)

    if output_dir:
        output_dir.mkdir(parents=True, exist_ok=True)
        out_path = output_dir / f"{card.track_code}_{race_date.isoformat()}_hrn_entries.json"
        out_path.write_text(json.dumps(asdict(card), indent=2, default=str))

    return card


def _parse_entries_html(tree: "HTMLParser", card: ScrapedCard) -> None:
    """Parse HRN entries markup into ScrapedCard.

    Structure per race: <a class="race-header" id="race-N"> … </a>, followed by
    .race-distance / .race-restrictions / .race-purse blocks, then a
    <table class="table-entries"> with one row per horse. Each of these classes
    appears exactly once per race in document order, so we zip them by index.
    """
    headers = tree.css("a.race-header")
    dist_nodes = tree.css(".race-distance")
    restr_nodes = tree.css(".race-restrictions")
    purse_nodes = tree.css(".race-purse")
    tables = tree.css("table.table-entries")

    for idx, header in enumerate(headers):
        race = ScrapedRace(track_code=card.track_code, race_date=card.race_date)

        m = re.search(r"race-(\d+)", header.attributes.get("id") or "")
        if m:
            race.race_number = int(m.group(1))

        time_node = header.css_first("time.race-time")
        if time_node:
            race.post_time = _clean_text(time_node.text())

        if idx < len(dist_nodes):
            dist_text = _clean_text(dist_nodes[idx].text())
            race.distance = _extract_distance(dist_text)
            race.distance_yards = _hrn_distance_yards(race.distance)
            race.surface = _classify_surface(dist_text)
            race.race_type = _classify_race_type(dist_text)
            race.conditions = dist_text
        if idx < len(restr_nodes):
            restr = _clean_text(restr_nodes[idx].text())
            race.conditions = (
                (race.conditions + " | " + restr).strip(" |") if race.conditions else restr
            )
        if idx < len(purse_nodes):
            race.purse = _parse_purse(purse_nodes[idx].text())

        if idx < len(tables):
            _parse_entries_table(tables[idx], race)

        if race.race_number > 0:
            card.races.append(race)


def _extract_distance(text: str) -> str:
    """Extract the distance token from the distance line.

    '1 1/16M, Dirt, $50,000 Maiden Claiming' → '1 1/16M'
    '7f, Dirt, $85,000 Maiden Special Weight' → '7f'
    """
    # Take the first comma-delimited piece, stripped.
    first = text.split(",")[0].strip()
    return first


def _parse_entries_table(table: "Node", race: ScrapedRace) -> None:
    """Parse one HRN entries table into race.horses."""
    for row in table.css("tbody tr") or table.css("tr"):
        cells = row.css("td")
        if len(cells) < 4:
            continue  # header or separator row

        horse = ScrapedHorse()

        # Program number — stored on the image alt or in the data-label.
        prog_cell = cells[0]
        img = prog_cell.css_first("img")
        if img and (img.attributes.get("alt") or "").strip():
            horse.program_number = img.attributes["alt"].strip()
        else:
            # data-label is 'Program Number: 1A' — fish out the value.
            dl = prog_cell.attributes.get("data-label") or ""
            m = re.search(r":\s*(\S+)", dl)
            if m:
                horse.program_number = m.group(1)
            else:
                horse.program_number = _clean_text(prog_cell.text())

        # Post position — second cell, usually numeric.
        pp_text = _clean_text(cells[1].text())
        if not horse.program_number and pp_text:
            horse.program_number = pp_text

        # Horse / Sire cell — h4 > a.horse-link (name), and a <p> with sire.
        hs_cell = cells[2]
        name_node = hs_cell.css_first("a.horse-link") or hs_cell.css_first("h4")
        if name_node:
            horse.horse_name = _clean_text(name_node.text())
        # Capture the canonical HRN profile URL so prompt fetches can use it
        # directly (slugs may include numeric disambiguators like ``_2``).
        link = hs_cell.css_first("a.horse-link")
        if link:
            href = link.attributes.get("href") or ""
            if href:
                horse.horse_url = href
        # Sire is in a <p> sibling inside the same cell.
        sire = _first_p_text(hs_cell)
        if sire:
            horse.sire = sire

        # Trainer / Jockey cell — two <p> tags.
        tj_cell = cells[3]
        tj_ps = tj_cell.css("p")
        if len(tj_ps) >= 1:
            horse.trainer = _clean_text(tj_ps[0].text())
        if len(tj_ps) >= 2:
            horse.jockey = _clean_text(tj_ps[1].text())

        # Morning line is the last cell on HRN entries pages.
        ml_cell = cells[-1]
        ml_text = _first_p_text(ml_cell) or _clean_text(ml_cell.text())
        # HRN uses '9/2' etc.; equibase helper wants '9-2'. Normalize.
        normalized = ml_text.replace("/", "-")
        horse.morning_line_odds = ml_text
        horse.morning_line_decimal = _parse_ml_odds(normalized)

        if horse.horse_name:
            race.horses.append(horse)


def scrape_to_json(
    track_code: str,
    race_date: date,
    output_dir: Path,
) -> Path:
    """Convenience: scrape and write `<code>_<date>_hrn_entries.json`, return the path."""
    card = scrape_entries(track_code, race_date, output_dir=output_dir)
    out_path = output_dir / f"{card.track_code}_{race_date.isoformat()}_hrn_entries.json"
    return out_path
