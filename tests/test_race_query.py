"""Tests for the natural language race query parser."""

from datetime import date, timedelta

import pytest

from src.nlp.race_query import (
    ParsedRaceQuery,
    _extract_horse_name,
    _extract_race_number,
    _extract_track,
    _parse_date_from_text,
    parse_race_query,
)


class TestTrackExtraction:
    def test_full_name(self):
        code, name = _extract_track("Saratoga race 5")
        assert code == "SAR"

    def test_abbreviation(self):
        code, name = _extract_track("GP R7 today")
        assert code == "GP"

    def test_multi_word(self):
        code, name = _extract_track("Churchill Downs race 3")
        assert code == "CD"

    def test_named_race(self):
        code, name = _extract_track("who wins the Kentucky Derby")
        assert code == "CD"

    def test_case_insensitive(self):
        code, name = _extract_track("BELMONT race 1")
        assert code == "BEL"

    def test_unknown_track(self):
        code, name = _extract_track("some random text")
        assert code is None


class TestRaceNumberExtraction:
    def test_race_N(self):
        assert _extract_race_number("race 5") == 5

    def test_R_N(self):
        assert _extract_race_number("GP R7 today") == 7

    def test_ordinal(self):
        assert _extract_race_number("the 3rd race") == 3

    def test_hash(self):
        assert _extract_race_number("give me #8") == 8

    def test_ordinal_the(self):
        assert _extract_race_number("the 5th at Saratoga") == 5

    def test_no_race(self):
        assert _extract_race_number("just a horse name") is None


class TestDateExtraction:
    def test_today(self):
        assert _parse_date_from_text("SAR R5 today") == date.today()

    def test_tomorrow(self):
        assert _parse_date_from_text("tomorrow") == date.today() + timedelta(days=1)

    def test_month_day(self):
        d = _parse_date_from_text("March 22")
        assert d is not None
        assert d.month == 3
        assert d.day == 22

    def test_slash_date(self):
        d = _parse_date_from_text("3/22/2026")
        assert d == date(2026, 3, 22)

    def test_no_date(self):
        assert _parse_date_from_text("just some text") is None


class TestHorseExtraction:
    def test_quoted(self):
        assert _extract_horse_name('lookup "Flightline"') == "Flightline"

    def test_single_quoted(self):
        assert _extract_horse_name("find 'Justify'") == "Justify"


class TestFullParse:
    def test_standard_query(self):
        q = parse_race_query("Saratoga race 5 today")
        assert q.track_code == "SAR"
        assert q.race_number == 5
        assert q.race_date == date.today()
        assert q.confidence >= 0.7

    def test_abbreviated_query(self):
        q = parse_race_query("GP R7 tomorrow")
        assert q.track_code == "GP"
        assert q.race_number == 7
        assert q.race_date == date.today() + timedelta(days=1)

    def test_named_race(self):
        q = parse_race_query("who wins the Kentucky Derby")
        assert q.track_code == "CD"

    def test_minimal_query(self):
        q = parse_race_query("Belmont 3")
        assert q.track_code == "BEL"
        assert q.race_number == 3
        # Should default to today
        assert q.race_date == date.today()

    def test_empty_query(self):
        q = parse_race_query("")
        assert q.confidence == 0.0
