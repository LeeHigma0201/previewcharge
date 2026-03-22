"""Builds the "loaded prompt" — all metrics behind a natural language race query.

When the user types "Saratoga race 5 today", this module:
1. Parses the query (via race_query.py)
2. Looks up the race in the DB (or scrapes if not found)
3. Computes all 50 features for each horse
4. Formats everything into a compact structured context block

The output is a self-contained prompt that an LLM can reason over
without needing any additional context or tool calls.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session, joinedload

from src.data.models import Entry, Horse, PastPerformance, Race
from src.features.core import compute_entry_features, compute_race_features
from src.nlp.race_query import ParsedRaceQuery, parse_race_query


def lookup_race(session: Session, query: ParsedRaceQuery) -> Race | None:
    """Find a race in the DB matching the parsed query."""
    q = session.query(Race).options(
        joinedload(Race.entries)
        .joinedload(Entry.past_performances),
        joinedload(Race.entries)
        .joinedload(Entry.horse),
    )

    if query.track_code:
        q = q.filter(Race.track_code == query.track_code)
    if query.race_number:
        q = q.filter(Race.race_number == query.race_number)
    if query.race_date:
        q = q.filter(Race.race_date == query.race_date)

    return q.first()


def lookup_horse(session: Session, name: str) -> list[Entry]:
    """Find all entries for a horse by name."""
    horse = session.query(Horse).filter(
        Horse.name.ilike(f"%{name}%")
    ).first()
    if not horse:
        return []
    return (
        session.query(Entry)
        .filter(Entry.horse_id == horse.id)
        .options(
            joinedload(Entry.race),
            joinedload(Entry.past_performances),
        )
        .order_by(Entry.id.desc())
        .limit(20)
        .all()
    )


def _format_distance(yards: int | None) -> str:
    """Convert yards to human-readable distance."""
    if not yards:
        return "?"
    furlongs = yards / 220
    if furlongs < 8:
        return f"{furlongs:.1f}f"
    miles = yards / 1760
    # Express as fraction
    fractions = {
        1.0: "1m", 1.0625: "1 1/16m", 1.125: "1 1/8m",
        1.1875: "1 3/16m", 1.25: "1 1/4m", 1.375: "1 3/8m",
        1.5: "1 1/2m", 1.625: "1 5/8m", 1.75: "1 3/4m", 2.0: "2m",
    }
    closest = min(fractions.keys(), key=lambda x: abs(x - miles))
    if abs(closest - miles) < 0.05:
        return fractions[closest]
    return f"{miles:.2f}m"


def _format_odds(odds: float | None) -> str:
    """Format decimal odds to fractional string."""
    if odds is None:
        return "?"
    if odds < 1:
        return f"{int(odds * 10)}-10"
    if odds == int(odds):
        return f"{int(odds)}-1"
    # Common fractions
    for num, den in [(1, 2), (1, 5), (2, 5), (3, 5), (4, 5),
                      (3, 2), (5, 2), (7, 2), (9, 2)]:
        if abs(odds - num / den) < 0.01:
            return f"{num}-{den}"
    return f"{odds:.1f}-1"


def _pp_summary(pp: PastPerformance) -> str:
    """One-line past performance summary."""
    parts = []
    if pp.race_date:
        parts.append(pp.race_date.strftime("%m/%d"))
    if pp.track_code:
        parts.append(pp.track_code)
    if pp.distance_yards:
        parts.append(_format_distance(pp.distance_yards))
    if pp.surface:
        parts.append(pp.surface)
    if pp.finish_position and pp.num_entrants:
        parts.append(f"{pp.finish_position}/{pp.num_entrants}")
    elif pp.finish_position:
        parts.append(f"#{pp.finish_position}")
    if pp.beyer_speed:
        parts.append(f"BSF:{pp.beyer_speed}")
    if pp.e1_pace:
        parts.append(f"E1:{pp.e1_pace}")
    if pp.late_pace:
        parts.append(f"LP:{pp.late_pace}")
    if pp.final_odds is not None:
        parts.append(f"@{pp.final_odds:.1f}")
    return " | ".join(parts)


def build_race_context(
    race: Race,
    features_df: pd.DataFrame | None = None,
    session: Session | None = None,
) -> str:
    """Build compact structured context for a race.

    Returns a text block containing all metrics for every horse,
    designed to be injected into an LLM prompt.
    """
    lines = []

    # Race header
    surface_map = {"D": "Dirt", "T": "Turf", "AW": "AW", "IT": "Inner Turf"}
    surface_name = surface_map.get(race.surface, race.surface)
    lines.append(f"## {race.track_code} Race {race.race_number} — "
                 f"{race.race_date} — {_format_distance(race.distance_yards)} "
                 f"{surface_name}")
    lines.append(f"Type: {race.race_type or '?'} | "
                 f"Purse: ${race.purse:,}" if race.purse else "Purse: ?")
    if race.track_condition:
        lines.append(f"Condition: {race.track_condition}")
    if race.num_entrants:
        lines.append(f"Field: {race.num_entrants} entrants")
    lines.append("")

    # Sort entries by post position
    entries = sorted(race.entries, key=lambda e: e.post_position)

    for entry in entries:
        horse = entry.horse if entry.horse else None
        horse_name = horse.name if horse else "?"

        # Entry header
        lines.append(f"### #{entry.program_number} {horse_name} "
                      f"(PP{entry.post_position})")

        # Key info line
        info_parts = []
        if entry.jockey:
            info_parts.append(f"J: {entry.jockey}")
        if entry.trainer:
            info_parts.append(f"T: {entry.trainer}")
        if entry.morning_line_odds is not None:
            info_parts.append(f"ML: {_format_odds(entry.morning_line_odds)}")
        if entry.weight:
            info_parts.append(f"Wt: {entry.weight}")
        if entry.medication:
            info_parts.append(f"Med: {entry.medication}")
        if entry.equipment:
            info_parts.append(f"Eq: {entry.equipment}")
        if entry.running_style:
            info_parts.append(f"Style: {entry.running_style}")
        lines.append(" | ".join(info_parts))

        # Pedigree
        if horse and (horse.sire or horse.dam):
            ped_parts = []
            if horse.sire:
                ped_parts.append(f"Sire: {horse.sire}")
            if horse.dam:
                ped_parts.append(f"Dam: {horse.dam}")
            if horse.dam_sire:
                ped_parts.append(f"Damsire: {horse.dam_sire}")
            lines.append(" | ".join(ped_parts))

        # BRIS figures
        fig_parts = []
        if entry.bris_speed:
            fig_parts.append(f"Speed: {entry.bris_speed}")
        if entry.bris_class_rating:
            fig_parts.append(f"Class: {entry.bris_class_rating}")
        if entry.bris_pace_e1:
            fig_parts.append(f"E1: {entry.bris_pace_e1}")
        if entry.bris_pace_e2:
            fig_parts.append(f"E2: {entry.bris_pace_e2}")
        if entry.bris_late_pace:
            fig_parts.append(f"LP: {entry.bris_late_pace}")
        if fig_parts:
            lines.append(f"BRIS: {' | '.join(fig_parts)}")

        # Features (if computed)
        if features_df is not None and entry.id in features_df.index:
            feat_row = features_df.loc[entry.id]
            key_feats = {}
            for col in feat_row.index:
                val = feat_row[col]
                if pd.notna(val) and col not in {"race_id", "race_date",
                                                   "finish_position", "final_odds"}:
                    key_feats[col] = round(float(val), 2)

            if key_feats:
                # Group by category for readability
                speed_keys = [k for k in key_feats if "beyer" in k or "speed" in k]
                pace_keys = [k for k in key_feats if "pace" in k or "e1" in k or "e2" in k
                             or "late" in k or "style" in k]
                class_keys = [k for k in key_feats if "class" in k or "purse" in k
                              or "claim" in k or "type" in k]
                form_keys = [k for k in key_feats if "days" in k or "win_rate" in k
                             or "finish" in k or "improve" in k or "top3" in k]
                conn_keys = [k for k in key_feats if "jockey" in k or "trainer" in k]

                def _fmt_group(name: str, keys: list[str]) -> str | None:
                    vals = {k: key_feats[k] for k in keys if k in key_feats}
                    if not vals:
                        return None
                    pairs = [f"{k}={v}" for k, v in vals.items()]
                    return f"  {name}: {', '.join(pairs)}"

                for label, keys in [("Speed", speed_keys), ("Pace", pace_keys),
                                     ("Class", class_keys), ("Form", form_keys),
                                     ("Connections", conn_keys)]:
                    line = _fmt_group(label, keys)
                    if line:
                        lines.append(line)

                # Any remaining features
                shown = set(speed_keys + pace_keys + class_keys + form_keys + conn_keys)
                remaining = {k: v for k, v in key_feats.items() if k not in shown}
                if remaining:
                    pairs = [f"{k}={v}" for k, v in remaining.items()]
                    lines.append(f"  Other: {', '.join(pairs)}")

        # Past performances (compact)
        pps = sorted(entry.past_performances, key=lambda p: p.pp_number)
        if pps:
            lines.append(f"  PPs ({len(pps)} races):")
            for pp in pps[:5]:  # show last 5
                lines.append(f"    {_pp_summary(pp)}")
            if len(pps) > 5:
                lines.append(f"    ... +{len(pps) - 5} more")

        lines.append("")

    return "\n".join(lines)


def build_horse_context(entries: list[Entry]) -> str:
    """Build context for a horse lookup (across multiple races)."""
    if not entries:
        return "No entries found for this horse."

    horse = entries[0].horse
    lines = []
    lines.append(f"## {horse.name}")
    ped = []
    if horse.sire:
        ped.append(f"Sire: {horse.sire}")
    if horse.dam:
        ped.append(f"Dam: {horse.dam}")
    if horse.dam_sire:
        ped.append(f"Damsire: {horse.dam_sire}")
    if horse.sex:
        ped.append(f"Sex: {horse.sex}")
    if horse.birth_year:
        ped.append(f"Born: {horse.birth_year}")
    if ped:
        lines.append(" | ".join(ped))
    lines.append("")

    lines.append(f"### Race History ({len(entries)} starts)")
    for entry in entries:
        race = entry.race
        if not race:
            continue
        result = ""
        if entry.finish_position:
            result = f"→ #{entry.finish_position}"
            if entry.beyer_speed:
                result += f" BSF:{entry.beyer_speed}"
        lines.append(
            f"  {race.race_date} {race.track_code} R{race.race_number} "
            f"{_format_distance(race.distance_yards)} {race.surface} "
            f"{race.race_type or ''} "
            f"PP{entry.post_position} "
            f"@{_format_odds(entry.morning_line_odds)} "
            f"{result}"
        )

    return "\n".join(lines)


def build_loaded_prompt(
    user_input: str,
    session: Session,
    include_features: bool = True,
) -> dict[str, Any]:
    """The main entry point: natural language in, loaded prompt out.

    Args:
        user_input: Free text race query from user
        session: SQLAlchemy session
        include_features: Whether to compute and include the 50 core features

    Returns:
        Dict with:
          - "query": ParsedRaceQuery (what we understood)
          - "context": str (the full formatted context block)
          - "race": Race | None (the DB object)
          - "features_df": DataFrame | None
          - "prompt": str (suggested system prompt for LLM analysis)
    """
    query = parse_race_query(user_input)

    result: dict[str, Any] = {
        "query": query,
        "context": "",
        "race": None,
        "features_df": None,
        "prompt": "",
    }

    # Horse lookup mode
    if query.horse_name and not query.race_number:
        entries = lookup_horse(session, query.horse_name)
        if entries:
            result["context"] = build_horse_context(entries)
            result["prompt"] = _build_horse_prompt(query, result["context"])
            return result

    # Race lookup mode
    race = lookup_race(session, query)
    if not race:
        result["context"] = (
            f"No race found for: {user_input}\n"
            f"Parsed as: track={query.track_code}, "
            f"race={query.race_number}, date={query.race_date}\n"
            f"Try: 'SAR Race 5 today' or scrape data first with:\n"
            f"  python -m src.data.scrapers.equibase {query.track_code or 'SAR'} "
            f"{(query.race_date or date.today()).isoformat()}"
        )
        result["prompt"] = result["context"]
        return result

    result["race"] = race

    # Compute features
    features_df = None
    if include_features:
        features_df = compute_race_features(race, session)
        result["features_df"] = features_df

    # Build context
    context = build_race_context(race, features_df, session)
    result["context"] = context

    # Build the full LLM prompt
    result["prompt"] = _build_analysis_prompt(query, context)

    return result


def _build_analysis_prompt(query: ParsedRaceQuery, context: str) -> str:
    """Build the system prompt for LLM race analysis."""
    return f"""You are HorseGPT, an expert horse racing handicapper and analyst.
You have been given complete data for a race including past performances,
speed figures, pace analysis, class metrics, jockey/trainer stats, and
50 engineered features for each horse.

All features are z-scored within the field (0 = field average, +1 = one
standard deviation above average). Use these relative values to compare
horses within this specific race.

ANALYSIS FRAMEWORK:
1. PACE SCENARIO: Identify likely pace shape (hot/honest/slow). Who has
   early speed? Is there a lone front-runner or contested pace?
2. SPEED: Who has the highest recent figures? Are they improving or declining?
3. CLASS: Any class droppers with back-speed? Any horses stepping up too far?
4. CONNECTIONS: Trainer/jockey angles — hot combos, surface/distance specialists?
5. VALUE: Compare your estimated win probability to the morning line.
   Flag any overlays (your prob > ML implied prob by 20%+).
6. LONGSHOT SIGNALS: Class drop + pace advantage + trainer pattern = potential bomb.

Respond with:
- Top 3 contenders with brief reasoning
- Key exacta/trifecta combos
- Any longshot alerts (15-1 or higher with an angle)
- Suggested bet structure (win/place/exotic)

RACE DATA:
{context}

User asked: "{query.raw_query}"
"""


def _build_horse_prompt(query: ParsedRaceQuery, context: str) -> str:
    """Build the system prompt for horse lookup analysis."""
    return f"""You are HorseGPT, an expert horse racing handicapper.
You have been given the complete race history for a horse.

Analyze:
1. Current form cycle (improving/peak/declining/bouncing)
2. Surface and distance preferences
3. Class level and trajectory
4. Key speed figures and trends
5. Notable performances or patterns

HORSE DATA:
{context}

User asked: "{query.raw_query}"
"""
