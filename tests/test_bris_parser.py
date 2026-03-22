"""Tests for BRIS file parser."""

import csv
import tempfile
from pathlib import Path

from src.data.bris_parser import ParsedEntry, _safe_date, _safe_float, _safe_int, parse_bris_file


def test_safe_int():
    assert _safe_int("42") == 42
    assert _safe_int("  42  ") == 42
    assert _safe_int("") is None
    assert _safe_int("abc") is None


def test_safe_float():
    assert _safe_float("3.14") == 3.14
    assert _safe_float("  3.14  ") == 3.14
    assert _safe_float("") is None
    assert _safe_float("abc") is None


def test_safe_date():
    d = _safe_date("01/15/2023")
    assert d is not None
    assert d.year == 2023
    assert d.month == 1
    assert d.day == 15

    d2 = _safe_date("20230115")
    assert d2 is not None
    assert d2.year == 2023

    assert _safe_date("") is None
    assert _safe_date("0") is None


def test_parse_bris_file_empty():
    """Parsing an empty file yields no entries."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as f:
        f.write("")
        path = Path(f.name)

    entries = list(parse_bris_file(path))
    assert entries == []
    path.unlink()


def test_parse_bris_file_minimal():
    """Parse a minimal BRIS-like CSV row."""
    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False, newline="") as f:
        writer = csv.writer(f)
        # Create a row with enough columns for basic fields
        row = [""] * 1500
        row[0] = "SAR"  # track
        row[1] = "08/15/2023"  # date
        row[2] = "5"  # race number
        row[3] = "3"  # post position
        row[4] = "3"  # program number
        row[5] = "1320"  # distance yards
        row[6] = "Test Horse"  # horse name
        row[7] = "D"  # surface
        row[8] = "ALW"  # race type
        writer.writerow(row)
        path = Path(f.name)

    entries = list(parse_bris_file(path))
    assert len(entries) == 1
    assert entries[0].track_code == "SAR"
    assert entries[0].horse_name == "Test Horse"
    assert entries[0].post_position == 3
    path.unlink()
