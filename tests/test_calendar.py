"""Tests for BigRaceCalendar and big_races.yaml."""

import tempfile
from datetime import date
from pathlib import Path

import pytest
import yaml

from src.races.calendar import BigRace, BigRaceCalendar, _load_calendar


@pytest.fixture
def sample_yaml(tmp_path):
    """Create a minimal big_races.yaml for testing."""
    data = {
        "big_races": [
            {
                "name": "Test Derby",
                "slug": "test-derby-2026",
                "grade": "G1",
                "category": "triple_crown",
                "track_code": "CD",
                "date": "2026-05-02",
                "race_number": None,
                "distance_yards": 2200,
                "surface": "D",
                "purse": 3000000,
                "conditions": "3yo",
                "exotic_pools": ["exacta", "trifecta", "superfecta"],
                "status": "upcoming",
                "derby_points": None,
                "notes": "Test race",
            },
            {
                "name": "Test Preakness",
                "slug": "test-preakness-2026",
                "grade": "G1",
                "category": "triple_crown",
                "track_code": "LRL",
                "date": "2026-05-16",
                "race_number": None,
                "distance_yards": 2090,
                "surface": "D",
                "purse": 1750000,
                "conditions": "3yo",
                "exotic_pools": ["exacta", "trifecta"],
                "status": "upcoming",
                "derby_points": None,
                "notes": "",
            },
            {
                "name": "Test Stakes",
                "slug": "test-stakes-2026",
                "grade": "G2",
                "category": "championship",
                "track_code": "SAR",
                "date": "2026-06-06",
                "race_number": None,
                "distance_yards": 1760,
                "surface": "T",
                "purse": 500000,
                "conditions": "4yo+",
                "exotic_pools": ["exacta", "trifecta"],
                "status": "upcoming",
                "derby_points": None,
                "notes": "",
            },
            {
                "name": "Past Race",
                "slug": "past-race-2026",
                "grade": "G3",
                "category": "derby_prep",
                "track_code": "KEE",
                "date": "2026-03-01",
                "race_number": None,
                "distance_yards": 1870,
                "surface": "D",
                "purse": 400000,
                "conditions": "3yo",
                "exotic_pools": ["exacta"],
                "status": "complete",
                "derby_points": 100,
                "notes": "",
            },
        ]
    }
    yaml_path = tmp_path / "big_races.yaml"
    with open(yaml_path, "w") as f:
        yaml.dump(data, f)
    return yaml_path


@pytest.fixture
def calendar(sample_yaml):
    return BigRaceCalendar(yaml_path=sample_yaml)


class TestBigRace:
    def test_grade_numeric(self):
        race = BigRace(
            name="Test", slug="test", grade="G1", category="",
            track_code="CD", date=date(2026, 5, 2), race_number=None,
            distance_yards=2200, surface="D", purse=0, conditions="",
            exotic_pools=[], status="upcoming",
        )
        assert race.grade_numeric == 1

    def test_distance_furlongs(self):
        race = BigRace(
            name="Test", slug="test", grade="G1", category="",
            track_code="CD", date=date(2026, 5, 2), race_number=None,
            distance_yards=2200, surface="D", purse=0, conditions="",
            exotic_pools=[], status="upcoming",
        )
        assert race.distance_furlongs == 10.0

    def test_is_triple_crown(self):
        race = BigRace(
            name="Test", slug="test", grade="G1", category="triple_crown",
            track_code="CD", date=date(2026, 5, 2), race_number=None,
            distance_yards=2200, surface="D", purse=0, conditions="",
            exotic_pools=[], status="upcoming",
        )
        assert race.is_triple_crown is True


class TestCalendarLoading:
    def test_load_races(self, calendar):
        assert len(calendar) == 4

    def test_races_sorted_by_date(self, calendar):
        dates = [r.date for r in calendar.races]
        assert dates == sorted(dates)

    def test_empty_file(self, tmp_path):
        yaml_path = tmp_path / "empty.yaml"
        yaml_path.write_text("")
        cal = BigRaceCalendar(yaml_path=yaml_path)
        assert len(cal) == 0

    def test_missing_file(self, tmp_path):
        cal = BigRaceCalendar(yaml_path=tmp_path / "nonexistent.yaml")
        assert len(cal) == 0


class TestCalendarFiltering:
    def test_upcoming(self, calendar):
        # From a date before all races, all upcoming should appear
        races = calendar.upcoming(from_date=date(2026, 1, 1), days_ahead=365)
        # Past race is "complete", so excluded
        assert len(races) == 3

    def test_upcoming_with_window(self, calendar):
        races = calendar.upcoming(from_date=date(2026, 5, 1), days_ahead=7)
        slugs = [r.slug for r in races]
        assert "test-derby-2026" in slugs
        assert "test-stakes-2026" not in slugs  # too far out

    def test_next_race(self, calendar):
        race = calendar.next_race(from_date=date(2026, 1, 1))
        assert race is not None
        assert race.slug == "test-derby-2026"

    def test_by_category(self, calendar):
        triple = calendar.by_category("triple_crown")
        assert len(triple) == 2

    def test_by_track(self, calendar):
        cd = calendar.by_track("CD")
        assert len(cd) == 1
        assert cd[0].name == "Test Derby"

    def test_by_grade(self, calendar):
        g1 = calendar.by_grade("G1")
        assert len(g1) == 2

    def test_triple_crown(self, calendar):
        tc = calendar.triple_crown()
        assert len(tc) == 2
        assert tc[0].date < tc[1].date


class TestCalendarLookup:
    def test_get_by_slug(self, calendar):
        race = calendar.get_by_slug("test-derby-2026")
        assert race is not None
        assert race.name == "Test Derby"

    def test_get_by_slug_not_found(self, calendar):
        assert calendar.get_by_slug("nonexistent") is None

    def test_resolve_named_race(self, calendar):
        race = calendar.resolve_named_race("derby")
        assert race is not None
        assert race.slug == "test-derby-2026"

    def test_resolve_named_race_preakness(self, calendar):
        race = calendar.resolve_named_race("preakness")
        assert race is not None
        assert race.track_code == "LRL"

    def test_resolve_named_race_not_found(self, calendar):
        assert calendar.resolve_named_race("nonexistent xyz") is None


class TestCalendarStatusUpdate:
    def test_update_status(self, calendar):
        calendar.update_status("test-derby-2026", "field_set")
        race = calendar.get_by_slug("test-derby-2026")
        assert race.status == "field_set"

    def test_update_status_persists(self, calendar, sample_yaml):
        calendar.update_status("test-derby-2026", "predictions_ready")
        # Reload from disk
        cal2 = BigRaceCalendar(yaml_path=sample_yaml)
        race = cal2.get_by_slug("test-derby-2026")
        assert race.status == "predictions_ready"

    def test_update_status_invalid(self, calendar):
        with pytest.raises(ValueError):
            calendar.update_status("test-derby-2026", "invalid_status")

    def test_update_status_not_found(self, calendar):
        with pytest.raises(KeyError):
            calendar.update_status("nonexistent", "upcoming")


class TestProductionCalendar:
    """Test the actual config/big_races.yaml file."""

    def test_production_calendar_loads(self):
        cal = BigRaceCalendar()
        assert len(cal) > 0

    def test_triple_crown_races_exist(self):
        cal = BigRaceCalendar()
        tc = cal.triple_crown()
        names = [r.name for r in tc]
        assert "Kentucky Derby" in names
        assert "Preakness Stakes" in names
        assert "Belmont Stakes" in names

    def test_preakness_at_laurel(self):
        cal = BigRaceCalendar()
        race = cal.resolve_named_race("preakness")
        assert race is not None
        assert race.track_code == "LRL"

    def test_belmont_at_saratoga(self):
        cal = BigRaceCalendar()
        race = cal.resolve_named_race("belmont stakes")
        assert race is not None
        assert race.track_code == "SAR"

    def test_all_races_have_required_fields(self):
        cal = BigRaceCalendar()
        for race in cal.races:
            assert race.name
            assert race.slug
            assert race.grade
            assert race.track_code
            assert race.date
            assert race.distance_yards > 0
            assert race.surface in ("D", "T", "AW")
            assert race.purse > 0
