"""BRIS Single File format parser.

BRIS files are comma-delimited with 1,430+ fields per line, one line per entry.
Field positions are fixed. This parser maps the most important fields and
yields ParsedEntry dataclass instances for clean separation from DB logic.

Reference: BRIS DRF format specification.
"""

from __future__ import annotations

import csv
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path
from typing import Iterator


def _safe_int(val: str) -> int | None:
    try:
        return int(val.strip()) if val.strip() else None
    except (ValueError, TypeError):
        return None


def _safe_float(val: str) -> float | None:
    try:
        return float(val.strip()) if val.strip() else None
    except (ValueError, TypeError):
        return None


def _safe_date(val: str) -> date | None:
    val = val.strip()
    if not val or val == "0":
        return None
    try:
        return datetime.strptime(val, "%m/%d/%Y").date()
    except ValueError:
        try:
            return datetime.strptime(val, "%Y%m%d").date()
        except ValueError:
            return None


def _safe_str(val: str) -> str | None:
    val = val.strip()
    return val if val else None


# ──────────────────────────────────────────────────────────────────────
# BRIS field positions (0-indexed column numbers)
# These positions follow the BRIS DRF Single File specification.
# Phase 1 maps ~100 key fields from the 1,430+ available.
# ──────────────────────────────────────────────────────────────────────

# Today's race header fields
RACE_FIELDS = {
    "track_code": (0, _safe_str),
    "race_date": (1, _safe_date),
    "race_number": (2, _safe_int),
    "distance_yards": (5, _safe_int),
    "surface": (7, _safe_str),
    "race_type": (8, _safe_str),
    "purse": (11, _safe_int),
    "race_class": (12, _safe_str),
    "claiming_price": (13, _safe_int),
    "track_condition": (14, _safe_str),
    "num_entrants": (9, _safe_int),
}

# Today's entry fields
ENTRY_FIELDS = {
    "post_position": (3, _safe_int),
    "program_number": (4, _safe_str),
    "horse_name": (6, _safe_str),
    "jockey": (32, _safe_str),
    "trainer": (29, _safe_str),
    "morning_line_odds": (43, _safe_float),
    "weight": (27, _safe_int),
    "medication": (30, _safe_str),
    "equipment": (31, _safe_str),
    "claiming_price_entry": (13, _safe_int),
    # BRIS figures
    "bris_speed": (210, _safe_int),
    "bris_class_rating": (211, _safe_int),
    "bris_pace_e1": (212, _safe_int),
    "bris_pace_e2": (213, _safe_int),
    "bris_late_pace": (214, _safe_int),
    "running_style": (209, _safe_str),
    # Pedigree
    "sire": (15, _safe_str),
    "dam": (17, _safe_str),
    "dam_sire": (19, _safe_str),
    "birth_year": (22, _safe_int),
    "sex": (21, _safe_str),
}

# Past performance block: each PP has a fixed-width block of fields.
# PP1 starts at column 255. Each PP block is ~100 columns wide, 10 PPs.
PP_BLOCK_START = 255
PP_BLOCK_WIDTH = 100
PP_COUNT = 10

# Offsets within each PP block
PP_OFFSETS = {
    "pp_race_date": (0, _safe_date),
    "pp_track_code": (2, _safe_str),
    "pp_distance_yards": (4, _safe_int),
    "pp_surface": (5, _safe_str),
    "pp_track_condition": (6, _safe_str),
    "pp_race_type": (8, _safe_str),
    "pp_purse": (10, _safe_int),
    "pp_claiming_price": (11, _safe_int),
    "pp_num_entrants": (9, _safe_int),
    "pp_finish_position": (15, _safe_int),
    "pp_final_odds": (20, _safe_float),
    "pp_beyer_speed": (18, _safe_int),
    "pp_e1_pace": (50, _safe_int),
    "pp_e2_pace": (51, _safe_int),
    "pp_late_pace": (52, _safe_int),
    "pp_position_1st": (25, _safe_int),
    "pp_position_2nd": (26, _safe_int),
    "pp_position_stretch": (28, _safe_int),
    "pp_lengths_behind_1st": (30, _safe_float),
    "pp_lengths_behind_finish": (35, _safe_float),
    "pp_weight": (22, _safe_int),
    "pp_final_time": (16, _safe_float),
}

# Workout fields — up to 12 workouts, starting around column 1255
WORKOUT_BLOCK_START = 1255
WORKOUT_BLOCK_WIDTH = 8
WORKOUT_COUNT = 12

WORKOUT_OFFSETS = {
    "wo_date": (0, _safe_date),
    "wo_track": (1, _safe_str),
    "wo_distance_furlongs": (2, _safe_float),
    "wo_time_seconds": (3, _safe_float),
    "wo_rank": (5, _safe_int),
    "wo_total_workers": (6, _safe_int),
}


@dataclass
class ParsedPP:
    pp_number: int
    race_date: date | None = None
    track_code: str | None = None
    distance_yards: int | None = None
    surface: str | None = None
    track_condition: str | None = None
    race_type: str | None = None
    purse: int | None = None
    claiming_price: int | None = None
    num_entrants: int | None = None
    finish_position: int | None = None
    final_odds: float | None = None
    beyer_speed: int | None = None
    e1_pace: int | None = None
    e2_pace: int | None = None
    late_pace: int | None = None
    position_1st_call: int | None = None
    position_2nd_call: int | None = None
    position_stretch: int | None = None
    lengths_behind_1st: float | None = None
    lengths_behind_finish: float | None = None
    weight: int | None = None
    final_time_seconds: float | None = None


@dataclass
class ParsedWorkout:
    workout_date: date | None = None
    track_code: str | None = None
    distance_furlongs: float | None = None
    time_seconds: float | None = None
    rank: int | None = None
    total_workers: int | None = None


@dataclass
class ParsedEntry:
    # Race info
    track_code: str | None = None
    race_date: date | None = None
    race_number: int | None = None
    distance_yards: int | None = None
    surface: str | None = None
    race_type: str | None = None
    purse: int | None = None
    race_class: str | None = None
    claiming_price_race: int | None = None
    track_condition: str | None = None
    num_entrants: int | None = None

    # Entry info
    post_position: int | None = None
    program_number: str | None = None
    horse_name: str | None = None
    jockey: str | None = None
    trainer: str | None = None
    morning_line_odds: float | None = None
    weight: int | None = None
    medication: str | None = None
    equipment: str | None = None
    claiming_price_entry: int | None = None

    # BRIS figures
    bris_speed: int | None = None
    bris_class_rating: int | None = None
    bris_pace_e1: int | None = None
    bris_pace_e2: int | None = None
    bris_late_pace: int | None = None
    running_style: str | None = None

    # Pedigree
    sire: str | None = None
    dam: str | None = None
    dam_sire: str | None = None
    birth_year: int | None = None
    sex: str | None = None

    # Past performances and workouts
    past_performances: list[ParsedPP] = field(default_factory=list)
    workouts: list[ParsedWorkout] = field(default_factory=list)


def _parse_row(cols: list[str]) -> ParsedEntry:
    """Parse a single BRIS CSV row into a ParsedEntry."""
    entry = ParsedEntry()

    # Race fields
    for attr, (col_idx, converter) in RACE_FIELDS.items():
        if col_idx < len(cols):
            setattr(entry, attr if attr != "claiming_price" else "claiming_price_race",
                    converter(cols[col_idx]))

    # Entry fields
    for attr, (col_idx, converter) in ENTRY_FIELDS.items():
        if col_idx < len(cols):
            setattr(entry, attr, converter(cols[col_idx]))

    # Past performances
    for pp_num in range(PP_COUNT):
        pp = ParsedPP(pp_number=pp_num + 1)
        base = PP_BLOCK_START + pp_num * PP_BLOCK_WIDTH
        has_data = False

        for attr, (offset, converter) in PP_OFFSETS.items():
            col_idx = base + offset
            if col_idx < len(cols):
                clean_attr = attr.replace("pp_", "")
                # Map field names to dataclass attributes
                attr_map = {
                    "race_date": "race_date",
                    "track_code": "track_code",
                    "distance_yards": "distance_yards",
                    "surface": "surface",
                    "track_condition": "track_condition",
                    "race_type": "race_type",
                    "purse": "purse",
                    "claiming_price": "claiming_price",
                    "num_entrants": "num_entrants",
                    "finish_position": "finish_position",
                    "final_odds": "final_odds",
                    "beyer_speed": "beyer_speed",
                    "e1_pace": "e1_pace",
                    "e2_pace": "e2_pace",
                    "late_pace": "late_pace",
                    "position_1st": "position_1st_call",
                    "position_2nd": "position_2nd_call",
                    "position_stretch": "position_stretch",
                    "lengths_behind_1st": "lengths_behind_1st",
                    "lengths_behind_finish": "lengths_behind_finish",
                    "weight": "weight",
                    "final_time": "final_time_seconds",
                }
                target_attr = attr_map.get(clean_attr, clean_attr)
                val = converter(cols[col_idx])
                if val is not None:
                    has_data = True
                setattr(pp, target_attr, val)

        if has_data:
            entry.past_performances.append(pp)

    # Workouts
    for wo_num in range(WORKOUT_COUNT):
        base = WORKOUT_BLOCK_START + wo_num * WORKOUT_BLOCK_WIDTH
        wo = ParsedWorkout()
        has_data = False

        for attr, (offset, converter) in WORKOUT_OFFSETS.items():
            col_idx = base + offset
            if col_idx < len(cols):
                clean_attr = attr.replace("wo_", "")
                attr_map = {
                    "date": "workout_date",
                    "track": "track_code",
                    "distance_furlongs": "distance_furlongs",
                    "time_seconds": "time_seconds",
                    "rank": "rank",
                    "total_workers": "total_workers",
                }
                target_attr = attr_map.get(clean_attr, clean_attr)
                val = converter(cols[col_idx])
                if val is not None:
                    has_data = True
                setattr(wo, target_attr, val)

        if has_data:
            entry.workouts.append(wo)

    return entry


def parse_bris_file(filepath: Path) -> Iterator[ParsedEntry]:
    """Parse a BRIS single file and yield ParsedEntry objects."""
    with open(filepath, newline="", encoding="latin-1") as f:
        reader = csv.reader(f)
        for row in reader:
            if not row:
                continue
            yield _parse_row(row)


def parse_bris_directory(directory: Path) -> Iterator[ParsedEntry]:
    """Parse all BRIS files in a directory."""
    for filepath in sorted(directory.glob("*.csv")):
        yield from parse_bris_file(filepath)
    # Also check for .DRF extension
    for filepath in sorted(directory.glob("*.DRF")):
        yield from parse_bris_file(filepath)
