"""Tests for the Horse Racing Nation scraper.

Uses a checked-in HTML fixture so no network access is required.
"""

from __future__ import annotations

from datetime import date
from pathlib import Path

import pytest

from src.data.scrapers.horseracingnation import (
    _classify_race_type,
    _classify_surface,
    _extract_distance,
    _hrn_distance_yards,
    resolve_hrn_slug,
    scrape_entries,
)

FIXTURE = Path(__file__).parent / "fixtures" / "hrn_keeneland_2026-04-17.html"


@pytest.fixture(scope="module")
def hrn_card():
    if not FIXTURE.exists():
        pytest.skip(f"HRN fixture missing: {FIXTURE}")
    html = FIXTURE.read_text()
    return scrape_entries("KEE", date(2026, 4, 17), html=html)


class TestResolveSlug:
    def test_equibase_code(self):
        assert resolve_hrn_slug("KEE") == "keeneland"

    def test_lowercase_slug(self):
        assert resolve_hrn_slug("keeneland") == "keeneland"

    def test_unknown_is_slugified(self):
        assert resolve_hrn_slug("Fake Track") == "fake-track"

    def test_empty(self):
        assert resolve_hrn_slug("") is None


class TestDistanceParser:
    def test_miles_shorthand(self):
        assert _hrn_distance_yards("1 1/16M") == 1870

    def test_furlongs_shorthand(self):
        assert _hrn_distance_yards("7F") == 1540

    def test_half_furlong(self):
        assert _hrn_distance_yards("5 1/2F") == 1210

    def test_whole_mile(self):
        assert _hrn_distance_yards("1M") == 1760

    def test_falls_back_to_longform(self):
        assert _hrn_distance_yards("6 Furlongs") == 1320


class TestSurfaceAndType:
    def test_turf(self):
        assert _classify_surface("5 1/2F, Turf, Allowance") == "T"

    def test_dirt(self):
        assert _classify_surface("7F, Dirt, Maiden") == "D"

    def test_stakes_abbrev(self):
        assert _classify_race_type("1 1/16M, Dirt, Baird Doubledogdare S.") == "STK"

    def test_starter_beats_allowance(self):
        assert _classify_race_type("Starter Allowance") == "STR"

    def test_allowance(self):
        assert _classify_race_type("5 1/2F, Turf, Allowance") == "ALW"

    def test_maiden_claiming(self):
        assert _classify_race_type("1 1/16M, Dirt, $50,000 Maiden Claiming") == "MCL"


class TestExtractDistance:
    def test_first_token(self):
        assert _extract_distance("1 1/16M, Dirt, Maiden Claiming") == "1 1/16M"

    def test_no_comma(self):
        assert _extract_distance("7F") == "7F"


class TestCardParse:
    def test_ten_races(self, hrn_card):
        assert len(hrn_card.races) == 10

    def test_race_numbers_sequential(self, hrn_card):
        assert [r.race_number for r in hrn_card.races] == list(range(1, 11))

    def test_race_one_details(self, hrn_card):
        r1 = hrn_card.races[0]
        assert r1.distance_yards == 1870
        assert r1.surface == "D"
        assert r1.race_type == "MCL"
        assert r1.purse == 55000
        assert r1.post_time == "1:00 PM"
        assert len(r1.horses) == 7

    def test_race_one_favorite(self, hrn_card):
        # Starwood is the 7/5 or 2/1 morning-line favorite in R1.
        r1 = hrn_card.races[0]
        starwood = next(h for h in r1.horses if h.horse_name == "Starwood")
        assert starwood.sire == "Quality Road"
        assert starwood.trainer == "Brad H. Cox"
        assert starwood.jockey == "Irad Ortiz, Jr."
        assert starwood.morning_line_decimal == 2.0

    def test_big_stakes_race_parses(self, hrn_card):
        # R9 is the Baird Doubledogdare Stakes — tests stakes-abbrev detection.
        r9 = hrn_card.races[8]
        assert r9.race_type == "STK"
        assert r9.purse == 400000
        assert len(r9.horses) == 8

    def test_turf_race_surface(self, hrn_card):
        r5 = hrn_card.races[4]
        assert r5.surface == "T"
        assert r5.distance_yards == 1210

    def test_all_horses_have_names(self, hrn_card):
        for race in hrn_card.races:
            for h in race.horses:
                assert h.horse_name

    def test_ml_decimals_parsed(self, hrn_card):
        for race in hrn_card.races:
            for h in race.horses:
                assert h.morning_line_decimal is not None, h.horse_name
