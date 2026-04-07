"""Big Race Calendar — curated calendar of major stakes races.

Loads config/big_races.yaml and provides filtering, lookup, and
status management for the big race exotic betting pipeline.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, timedelta
from pathlib import Path

import yaml


@dataclass
class BigRace:
    """In-memory representation of a big race from the calendar."""

    name: str
    slug: str
    grade: str
    category: str
    track_code: str
    date: date
    race_number: int | None
    distance_yards: int
    surface: str
    purse: int
    conditions: str
    exotic_pools: list[str]
    status: str
    derby_points: int | None = None
    notes: str = ""

    @property
    def grade_numeric(self) -> int:
        """G1=1, G2=2, G3=3, Listed=4, ungraded=5."""
        return {"G1": 1, "G2": 2, "G3": 3}.get(self.grade, 5)

    @property
    def distance_furlongs(self) -> float:
        return self.distance_yards / 220.0

    @property
    def is_triple_crown(self) -> bool:
        return self.category == "triple_crown"

    @property
    def days_until(self) -> int:
        return (self.date - date.today()).days


class BigRaceCalendar:
    """Manager for the curated big race calendar."""

    def __init__(self, yaml_path: Path | None = None):
        if yaml_path is None:
            yaml_path = Path(__file__).resolve().parent.parent.parent / "config" / "big_races.yaml"
        self._yaml_path = yaml_path
        self.races: list[BigRace] = _load_calendar(yaml_path)

    def upcoming(
        self, from_date: date | None = None, days_ahead: int = 30
    ) -> list[BigRace]:
        """Return upcoming races within the window, sorted by date."""
        ref = from_date or date.today()
        cutoff = ref + timedelta(days=days_ahead)
        return sorted(
            [r for r in self.races if ref <= r.date <= cutoff and r.status != "complete"],
            key=lambda r: r.date,
        )

    def next_race(self, from_date: date | None = None) -> BigRace | None:
        """Return the single next upcoming race."""
        ref = from_date or date.today()
        future = sorted(
            [r for r in self.races if r.date >= ref and r.status != "complete"],
            key=lambda r: r.date,
        )
        return future[0] if future else None

    def by_category(self, category: str) -> list[BigRace]:
        """Filter by category (e.g. 'triple_crown')."""
        return sorted(
            [r for r in self.races if r.category == category],
            key=lambda r: r.date,
        )

    def by_track(self, track_code: str) -> list[BigRace]:
        """Filter by track code."""
        return sorted(
            [r for r in self.races if r.track_code == track_code],
            key=lambda r: r.date,
        )

    def by_grade(self, grade: str) -> list[BigRace]:
        """Filter by grade (e.g. 'G1')."""
        return sorted(
            [r for r in self.races if r.grade == grade],
            key=lambda r: r.date,
        )

    def get_by_slug(self, slug: str) -> BigRace | None:
        """Lookup a specific race by slug."""
        for race in self.races:
            if race.slug == slug:
                return race
        return None

    def update_status(self, slug: str, new_status: str) -> None:
        """Update a race's status and persist back to YAML."""
        valid = {"upcoming", "field_set", "predictions_ready", "complete"}
        if new_status not in valid:
            raise ValueError(f"Invalid status '{new_status}'. Must be one of {valid}")

        race = self.get_by_slug(slug)
        if race is None:
            raise KeyError(f"No race found with slug '{slug}'")
        race.status = new_status

        # Persist to YAML
        _save_calendar(self._yaml_path, self.races)

    def resolve_named_race(self, name: str) -> BigRace | None:
        """Fuzzy-match a race name to a calendar entry.

        Matches if the query appears as a substring of the race name
        (case-insensitive). Returns the closest upcoming match.
        Requires at least 3 characters to avoid false matches.
        """
        name_lower = name.lower().strip()
        if len(name_lower) < 3:
            return None
        matches = []
        for race in self.races:
            race_name_lower = race.name.lower()
            slug_lower = race.slug.lower()
            if (
                name_lower in race_name_lower
                or name_lower in slug_lower
                or race_name_lower in name_lower
            ):
                matches.append(race)

        if not matches:
            return None
        # Prefer upcoming races
        upcoming = [r for r in matches if r.status != "complete"]
        if upcoming:
            return min(upcoming, key=lambda r: r.date)
        return min(matches, key=lambda r: r.date)

    def triple_crown(self) -> list[BigRace]:
        """Return Triple Crown races in order."""
        return self.by_category("triple_crown")

    def __len__(self) -> int:
        return len(self.races)

    def __repr__(self) -> str:
        return f"BigRaceCalendar({len(self.races)} races)"


def _load_calendar(yaml_path: Path) -> list[BigRace]:
    """Parse big_races.yaml into BigRace dataclass instances."""
    if not yaml_path.exists():
        return []

    with open(yaml_path) as f:
        data = yaml.safe_load(f) or {}

    races = []
    for entry in data.get("big_races", []):
        race_date = entry.get("date")
        if isinstance(race_date, str):
            race_date = date.fromisoformat(race_date)

        races.append(
            BigRace(
                name=entry["name"],
                slug=entry["slug"],
                grade=entry.get("grade", ""),
                category=entry.get("category", ""),
                track_code=entry.get("track_code", ""),
                date=race_date,
                race_number=entry.get("race_number"),
                distance_yards=entry.get("distance_yards", 0),
                surface=entry.get("surface", "D"),
                purse=entry.get("purse", 0),
                conditions=entry.get("conditions", ""),
                exotic_pools=entry.get("exotic_pools", []),
                status=entry.get("status", "upcoming"),
                derby_points=entry.get("derby_points"),
                notes=entry.get("notes", ""),
            )
        )

    return sorted(races, key=lambda r: r.date)


def _save_calendar(yaml_path: Path, races: list[BigRace]) -> None:
    """Persist race list back to YAML."""
    entries = []
    for race in sorted(races, key=lambda r: r.date):
        entry: dict = {
            "name": race.name,
            "slug": race.slug,
            "grade": race.grade,
            "category": race.category,
            "track_code": race.track_code,
            "date": race.date.isoformat(),
            "race_number": race.race_number,
            "distance_yards": race.distance_yards,
            "surface": race.surface,
            "purse": race.purse,
            "conditions": race.conditions,
            "exotic_pools": race.exotic_pools,
            "status": race.status,
            "derby_points": race.derby_points,
            "notes": race.notes,
        }
        entries.append(entry)

    with open(yaml_path, "w") as f:
        yaml.dump({"big_races": entries}, f, default_flow_style=False, sort_keys=False)
