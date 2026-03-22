"""Tests for scraper utilities (no network calls)."""

import pytest

from src.data.scrapers.equibase import (
    _parse_distance_yards,
    _parse_ml_odds,
    _parse_purse,
    resolve_track,
)


class TestParseOdds:
    def test_fractional(self):
        assert _parse_ml_odds("5-2") == 2.5

    def test_even(self):
        assert _parse_ml_odds("1-1") == 1.0

    def test_longshot(self):
        assert _parse_ml_odds("30-1") == 30.0

    def test_decimal(self):
        assert _parse_ml_odds("8.5") == 8.5

    def test_empty(self):
        assert _parse_ml_odds("") is None

    def test_invalid(self):
        assert _parse_ml_odds("abc") is None


class TestParseDistance:
    def test_furlongs(self):
        assert _parse_distance_yards("6 Furlongs") == 1320

    def test_miles_fraction(self):
        assert _parse_distance_yards("1 1/8 Miles") == 1980

    def test_one_mile(self):
        assert _parse_distance_yards("1 Mile") == 1760

    def test_half_furlong(self):
        assert _parse_distance_yards("5.5 Furlongs") == 1210

    def test_empty(self):
        assert _parse_distance_yards("") is None


class TestParsePurse:
    def test_with_comma(self):
        assert _parse_purse("$75,000") == 75000

    def test_no_comma(self):
        assert _parse_purse("$5000") == 5000

    def test_no_dollar(self):
        assert _parse_purse("some text") is None


class TestResolveTrack:
    def test_full_name(self):
        assert resolve_track("saratoga") == "SAR"

    def test_code(self):
        assert resolve_track("SAR") == "SAR"

    def test_multi_word(self):
        assert resolve_track("churchill downs") == "CD"

    def test_unknown(self):
        assert resolve_track("nowhere") is None


class TestPromptBuilder:
    """Test prompt builder with in-memory DB."""

    def test_build_race_context_empty(self):
        """Test context building with a mock race."""
        from src.nlp.prompt_builder import _format_distance, _format_odds

        assert _format_distance(1320) == "6.0f"
        assert _format_distance(1760) == "1m"
        assert _format_distance(1980) == "1 1/8m"
        assert _format_distance(None) == "?"

        assert _format_odds(5.0) == "5-1"
        assert _format_odds(2.5) == "5-2"
        assert _format_odds(None) == "?"
