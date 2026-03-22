"""Natural language race query parser.

Extracts structured race lookup parameters from free-text input.
This is the "loaded prompt" engine — the user types plain English and
we parse it into a DB query, compute all features, and return a rich
context block that an LLM can reason over.

Examples of user inputs:
  "Saratoga race 5 tomorrow"
  "who wins the Kentucky Derby"
  "Belmont race 3 March 22"
  "GP R7 today"
  "Give me the 8th at Churchill"

The parser extracts: track, race_number, date, horse_name (optional).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta


@dataclass
class ParsedRaceQuery:
    """Structured result of parsing a natural language race query."""
    track_code: str | None = None
    track_name: str | None = None  # original text
    race_number: int | None = None
    race_date: date | None = None
    horse_name: str | None = None
    raw_query: str = ""
    confidence: float = 0.0  # 0-1 how confident the parse is


# ── Track name resolution ─────────────────────────────────────────────
# Import the comprehensive aliases from the scraper
from src.data.scrapers.equibase import TRACK_ALIASES

# Additional aliases for named races
NAMED_RACES: dict[str, tuple[str, int | None]] = {
    "kentucky derby": ("CD", None),
    "preakness": ("PIM", None),
    "belmont stakes": ("BEL", None),
    "breeders cup": ("SA", None),  # varies yearly
    "travers": ("SAR", None),
    "whitney": ("SAR", None),
    "haskell": ("MTH", None),
    "met mile": ("BEL", None),
    "metropolitan": ("BEL", None),
    "jockey club gold cup": ("BEL", None),
    "woodward": ("SAR", None),
    "pacific classic": ("DMR", None),
    "santa anita handicap": ("SA", None),
    "pegasus world cup": ("GP", None),
    "florida derby": ("GP", None),
    "wood memorial": ("AQU", None),
    "arkansas derby": ("OP", None),
    "blue grass": ("KEE", None),
    "santa anita derby": ("SA", None),
    "cigar mile": ("AQU", None),
}

# Date keywords
DATE_KEYWORDS: dict[str, int] = {
    "today": 0,
    "tomorrow": 1,
    "yesterday": -1,
    "saturday": None,  # handled specially
    "sunday": None,
    "friday": None,
    "thursday": None,
    "wednesday": None,
    "tuesday": None,
    "monday": None,
}

WEEKDAY_MAP: dict[str, int] = {
    "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
    "friday": 4, "saturday": 5, "sunday": 6,
}


def _resolve_weekday(name: str, reference: date | None = None) -> date:
    """Resolve 'saturday' etc. to the next occurrence of that weekday."""
    ref = reference or date.today()
    target = WEEKDAY_MAP[name.lower()]
    days_ahead = target - ref.weekday()
    if days_ahead <= 0:
        days_ahead += 7
    return ref + timedelta(days=days_ahead)


def _parse_date_from_text(text: str) -> date | None:
    """Try to extract a date from text."""
    text_lower = text.lower().strip()

    # Check keywords
    for keyword, offset in DATE_KEYWORDS.items():
        if keyword in text_lower:
            if offset is not None:
                return date.today() + timedelta(days=offset)
            if keyword in WEEKDAY_MAP:
                return _resolve_weekday(keyword)

    # Try explicit date patterns
    patterns = [
        (r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", "%m/%d/%Y"),
        (r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{2})", "%m/%d/%y"),
        (r"(\d{4})[/\-](\d{1,2})[/\-](\d{1,2})", "%Y-%m-%d"),
    ]
    for pattern, fmt in patterns:
        m = re.search(pattern, text)
        if m:
            try:
                return datetime.strptime(m.group(), fmt).date()
            except ValueError:
                continue

    # "March 22", "Mar 22", "3/22"
    month_names = {
        "jan": 1, "january": 1, "feb": 2, "february": 2, "mar": 3, "march": 3,
        "apr": 4, "april": 4, "may": 5, "jun": 6, "june": 6,
        "jul": 7, "july": 7, "aug": 8, "august": 8, "sep": 9, "september": 9,
        "oct": 10, "october": 10, "nov": 11, "november": 11, "dec": 12, "december": 12,
    }
    for month_str, month_num in month_names.items():
        m = re.search(rf"{month_str}\s+(\d{{1,2}})", text_lower)
        if m:
            day = int(m.group(1))
            year = date.today().year
            try:
                d = date(year, month_num, day)
                # If date is in the past by > 6 months, assume next year
                if (date.today() - d).days > 180:
                    d = date(year + 1, month_num, day)
                return d
            except ValueError:
                continue

    return None


def _extract_race_number(text: str) -> int | None:
    """Extract race number from text."""
    patterns = [
        r"[Rr](?:ace)?\s*#?\s*(\d{1,2})",       # "Race 5", "R5", "race #5"
        r"(\d{1,2})(?:st|nd|rd|th)\s+(?:race)?",  # "5th race", "3rd"
        r"the\s+(\d{1,2})(?:st|nd|rd|th)",         # "the 5th"
        r"#(\d{1,2})\b",                            # "#5"
        r"\b[A-Za-z]+\s+(\d{1,2})\s*$",            # "Belmont 3" (track + bare number)
    ]
    for pattern in patterns:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            n = int(m.group(1))
            if 1 <= n <= 15:  # reasonable race numbers
                return n
    return None


def _extract_track(text: str) -> tuple[str | None, str | None]:
    """Extract track code and original name from text.

    Returns (code, original_text).
    """
    text_lower = text.lower().strip()

    # Check for named races first (longest match)
    for name, (code, _) in sorted(NAMED_RACES.items(), key=lambda x: -len(x[0])):
        if name in text_lower:
            return code, name

    # Check track aliases (longest match first to avoid partial matches)
    for alias, code in sorted(TRACK_ALIASES.items(), key=lambda x: -len(x[0])):
        if alias in text_lower:
            return code, alias

    # Check for bare track codes (2-3 uppercase letters)
    m = re.search(r"\b([A-Z]{2,3})\b", text)
    if m:
        code = m.group(1)
        if code in TRACK_ALIASES.values() or code.lower() in TRACK_ALIASES:
            return code if code in TRACK_ALIASES.values() else TRACK_ALIASES[code.lower()], code

    return None, None


def _extract_horse_name(text: str) -> str | None:
    """Try to extract a horse name query from text."""
    # Look for quoted names
    m = re.search(r'"([^"]+)"', text)
    if m:
        return m.group(1)
    m = re.search(r"'([^']+)'", text)
    if m:
        return m.group(1)

    # Look for "horse X" or "about X" patterns
    m = re.search(r"(?:horse|about|lookup|find|search)\s+([A-Z][A-Za-z\s]+?)(?:\s+(?:at|in|from|race|today|tomorrow)|\s*$)", text)
    if m:
        name = m.group(1).strip()
        # Exclude track names
        if name.lower() not in TRACK_ALIASES:
            return name

    return None


def parse_race_query(text: str) -> ParsedRaceQuery:
    """Parse a natural language race query into structured parameters.

    Args:
        text: Free-text input like "Saratoga race 5 today"

    Returns:
        ParsedRaceQuery with extracted track, race number, date, etc.
    """
    query = ParsedRaceQuery(raw_query=text)

    # Extract components
    track_code, track_name = _extract_track(text)
    query.track_code = track_code
    query.track_name = track_name

    query.race_number = _extract_race_number(text)
    query.race_date = _parse_date_from_text(text)
    query.horse_name = _extract_horse_name(text)

    # Default date to today if not specified
    if query.race_date is None and (query.track_code or query.race_number):
        query.race_date = date.today()

    # Compute confidence
    score = 0.0
    if query.track_code:
        score += 0.4
    if query.race_number:
        score += 0.3
    if query.race_date:
        score += 0.2
    if query.horse_name:
        score += 0.1
    query.confidence = min(score, 1.0)

    return query
