"""Build a per-horse spreadsheet with value-or-prompt cells.

For every Race in the DB, produce a DataFrame where:
  - rows are entries (horses in that race);
  - identifier columns are always filled (race number, PP, horse, sire, etc.);
  - feature columns are filled with a numeric value if computable from
    available data, or with a ``PROMPT[spec|horse]`` string if the raw
    inputs haven't been fetched yet.

This wraps the existing feature engine (``compute_race_features``) without
modifying it: we compute raw per-entry feature dicts, detect nulls, render
prompt strings for null cells, then z-score only the numeric cells.
"""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from src.data.models import Entry, Race
from src.data.scrapers.prompt_specs import (
    FEATURE_TO_SPEC,
    horse_slug,
    render_prompt,
)
from src.features.core import (
    _compute_pace_interactions,
    _compute_pace_scenario,
    compute_entry_features,
)
from src.features.jt_stats_cache import JtStatsCache

# Column groups
IDENTIFIER_COLS = [
    "race_number",
    "post_time",
    "distance",
    "surface",
    "race_type",
    "purse",
    "program_number",
    "pp",
    "horse_name",
    "sire",
    "dam",
    "dam_sire",
    "age",
    "sex",
    "jockey",
    "trainer",
    "morning_line_odds_raw",
    "ml_odds_decimal",
]

# Feature columns (76 total), in a stable order for the CSV.
FEATURE_COLS = [
    # Speed (5)
    "best_beyer", "avg_beyer", "last_beyer", "beyer_trend", "beyer_stdev",
    # Pace (12)
    "avg_e1_pace", "avg_e2_pace", "avg_late_pace", "last_e1_pace", "last_late_pace",
    "style_E", "style_EP", "style_P", "style_S", "style_C",
    "pace_velocity_change", "early_late_ratio",
    # Class (6)
    "current_purse", "avg_past_purse", "class_change_pct", "claiming_price_ratio",
    "race_type_encoded", "is_class_drop",
    # Form (11)
    "days_since_last", "log_days_since_last",
    "is_quick_turnaround", "is_optimal_rest", "is_freshening", "is_extended_layoff",
    "win_rate_last_5", "win_rate_last_10", "avg_finish_pos",
    "improvement_last_3", "top3_rate_last_5",
    # Jockey/Trainer (10)
    "jockey_win_pct", "jockey_roi", "jockey_starts", "jockey_top3_pct", "jockey_avg_odds",
    "trainer_win_pct", "trainer_roi", "trainer_starts", "trainer_top3_pct", "trainer_avg_odds",
    # Post (5)
    "post_position", "post_position_pct", "is_outside",
    "is_outside_dirt_sprint", "is_inside_turf",
    # Distance/Surface (5)
    "distance_exp_pct", "surface_exp_pct", "is_surface_switch",
    "distance_change_yards", "is_route_to_sprint",
    # Odds (4)
    "morning_line_odds", "ml_implied_prob", "log_ml_odds", "is_ml_favorite",
    # Equipment (4)
    "has_blinkers", "first_time_blinkers", "blinkers_off", "has_lasix",
    # Trip shape (5)
    "avg_pos_1st_call", "avg_pos_stretch", "avg_pos_gain", "avg_late_gain",
    "troubled_trip_rate",
    # Pace scenario (5)
    "n_early_speed", "n_closers", "speed_horse_pct",
    "pace_scenario_hot", "pace_scenario_soft",
    # Pace interactions (4)
    "lone_speed", "style_x_hot_pace", "style_x_soft_pace", "pace_pressure",
]

# Features we never prompt for: they're pure functions of today's race data
# (post position, odds, surface, distance) which HRN always provides.
NEVER_PROMPT: set[str] = {
    "post_position", "post_position_pct", "is_outside",
    "is_outside_dirt_sprint", "is_inside_turf",
    "morning_line_odds", "ml_implied_prob", "log_ml_odds", "is_ml_favorite",
    "current_purse", "race_type_encoded",
}

# Pace-scenario features are field-level: a prompt only makes sense for running
# styles (on each entry). The scenario columns are then derived.
PROVENANCE_COLS = ["data_source", "n_pps_fetched", "n_workouts_fetched", "unresolved_specs"]


def _prompt_context_for(
    entry: Entry, race: Race, horse_urls: dict[str, str] | None = None
) -> dict[str, Any]:
    """Build a dict usable by render_prompt() for horse-centric specs."""
    horse = entry.horse
    name = horse.name if horse else ""
    sire = horse.sire if horse and horse.sire else ""
    fallback_slug = horse_slug(name)
    url = (horse_urls or {}).get(name) or f"https://www.horseracingnation.com/horse/{fallback_slug}"
    return {
        "horse_name": name,
        "sire": sire or "unknown",
        "track_code": race.track_code,
        "race_number": race.race_number,
        "race_date": race.race_date.isoformat() if race.race_date else "",
        "horse_query": name.replace(" ", "+"),
        "horse_slug": fallback_slug,
        "horse_url": url,
    }


def _jt_context_for(entry: Entry, role: str) -> dict[str, Any]:
    """Build a dict for the jockey/trainer spec."""
    name = entry.jockey if role == "jockey" else entry.trainer
    name = name or ""
    return {
        "role": role,
        "role_param": "Jockey" if role == "jockey" else "Trainer",
        "person_name": name,
        "person_query": name.replace(" ", "+"),
    }


def _build_raw_feature_rows(
    race: Race,
    session: Session,
    jt_cache: JtStatsCache | None = None,
) -> list[dict[str, Any]]:
    """Compute unscaled per-entry feature dicts, including field-level scenario.

    If ``jt_cache`` is provided, it overrides any null jockey/trainer feature
    values returned by ``compute_jockey_trainer_features`` — useful when the
    DB has no prior entries but we have meet-level stats on file.
    """
    pace_scenario = _compute_pace_scenario(race)
    rows: list[dict[str, Any]] = []
    for entry in race.entries:
        feats = compute_entry_features(entry, race, session)
        if jt_cache is not None:
            override = jt_cache.features_for(entry.jockey, entry.trainer)
            for k, v in override.items():
                if feats.get(k) is None and v is not None:
                    feats[k] = v
        feats.update(pace_scenario)
        feats.update(_compute_pace_interactions(entry, pace_scenario))
        feats["__entry_id"] = entry.id
        rows.append(feats)
    return rows


def _z_score_column(values: pd.Series) -> pd.Series:
    """Z-score a numeric series, leaving None entries as-is (NaN).

    Only populated cells contribute to mean/std; empty cells pass through.
    """
    numeric = pd.to_numeric(values, errors="coerce")
    std = numeric.std(skipna=True)
    if pd.isna(std) or std == 0:
        # Constant (or single non-null) column: return zeros where populated, NaN elsewhere.
        return numeric.where(numeric.isna(), 0.0)
    return (numeric - numeric.mean(skipna=True)) / std


def build_race_matrix(
    race: Race,
    session: Session,
    horse_urls: dict[str, str] | None = None,
    jt_cache: JtStatsCache | None = None,
) -> pd.DataFrame:
    """Build the value-or-prompt matrix for one race.

    Returns a DataFrame whose rows are entries (in post-position order) and
    whose columns are IDENTIFIER_COLS + FEATURE_COLS + PROVENANCE_COLS. Cells
    that lack underlying data contain a PROMPT[...] string; cells that have
    data contain the z-scored numeric value (within this race's field).

    ``horse_urls`` maps horse name → canonical HRN profile URL.
    ``jt_cache`` optionally supplies meet-level jockey/trainer stats that
    fill the 10 jockey_/trainer_ features when DB has no prior history.
    """
    # Sort entries by post_position so the CSV reads top-to-bottom by PP.
    entries = sorted(race.entries, key=lambda e: e.post_position or 0)
    if not entries:
        return pd.DataFrame(columns=IDENTIFIER_COLS + FEATURE_COLS + PROVENANCE_COLS)

    raw_rows = _build_raw_feature_rows(race, session, jt_cache=jt_cache)
    raw_by_id = {r["__entry_id"]: r for r in raw_rows}

    ident_rows: list[dict[str, Any]] = []
    feature_values: list[dict[str, float | None]] = []
    prompt_placeholders: list[dict[str, str | None]] = []
    provenance: list[dict[str, Any]] = []

    for entry in entries:
        horse = entry.horse
        ident = {
            "race_number": int(race.race_number) if race.race_number is not None else None,
            "post_time": getattr(race, "post_time", "") or "",
            "distance": getattr(race, "distance", "") or _distance_short(race.distance_yards),
            "surface": race.surface,
            "race_type": race.race_type,
            "purse": int(race.purse) if race.purse is not None else None,
            "program_number": entry.program_number,
            # post_position is emitted via FEATURE_COLS (raw, never-z-scored);
            # keep an identifier alias so the spreadsheet reads naturally.
            "pp": int(entry.post_position) if entry.post_position is not None else None,
            "horse_name": horse.name if horse else "",
            "sire": horse.sire if horse and horse.sire else "",
            "dam": horse.dam if horse and horse.dam else "",
            "dam_sire": horse.dam_sire if horse and horse.dam_sire else "",
            "age": (race.race_date.year - horse.birth_year) if horse and horse.birth_year and race.race_date else None,
            "sex": horse.sex if horse and horse.sex else "",
            "jockey": entry.jockey or "",
            "trainer": entry.trainer or "",
            "morning_line_odds_raw": _ml_to_fraction(entry.morning_line_odds),
            "ml_odds_decimal": entry.morning_line_odds,
        }
        ident_rows.append(ident)

        raw = raw_by_id.get(entry.id, {})
        vals: dict[str, float | None] = {}
        prompts: dict[str, str | None] = {}
        unresolved: set[str] = set()
        for col in FEATURE_COLS:
            v = raw.get(col)
            if v is None or (isinstance(v, float) and np.isnan(v)):
                vals[col] = None
                if col in NEVER_PROMPT:
                    prompts[col] = None  # no prompt exists for this column
                else:
                    spec_id = FEATURE_TO_SPEC.get(col)
                    if spec_id == "jt_stats":
                        role = "jockey" if col.startswith("jockey_") else "trainer"
                        ctx = _jt_context_for(entry, role)
                        if not ctx["person_name"]:
                            prompts[col] = None  # no person name, no prompt
                        else:
                            prompts[col] = render_prompt("jt_stats", **ctx)
                            unresolved.add(f"{spec_id}:{role}")
                    elif spec_id is not None:
                        ctx = _prompt_context_for(entry, race, horse_urls)
                        prompts[col] = render_prompt(spec_id, **ctx)
                        unresolved.add(spec_id)
                    else:
                        prompts[col] = None
            else:
                vals[col] = float(v)
                prompts[col] = None
        feature_values.append(vals)
        prompt_placeholders.append(prompts)

        n_pps = len(entry.past_performances or [])
        n_workouts = len(entry.horse.workouts) if entry.horse else 0
        source = "hrn"
        if n_pps or n_workouts:
            source = "mixed"
        provenance.append({
            "data_source": source,
            "n_pps_fetched": n_pps,
            "n_workouts_fetched": n_workouts,
            "unresolved_specs": ",".join(sorted(unresolved)) if unresolved else "",
        })

    # Build frames.
    ident_df = pd.DataFrame(ident_rows)
    val_df = pd.DataFrame(feature_values, columns=FEATURE_COLS)
    prompt_df = pd.DataFrame(prompt_placeholders, columns=FEATURE_COLS)

    # Z-score populated cells within this race field. Never-prompt columns
    # (post, odds) retain their raw values so downstream tools see real numbers.
    z_df = pd.DataFrame(index=val_df.index, columns=FEATURE_COLS, dtype=object)
    for col in FEATURE_COLS:
        if col in NEVER_PROMPT:
            z_df[col] = val_df[col]
        else:
            z_df[col] = _z_score_column(val_df[col])

    # Merge: numeric value where present, else prompt string where available.
    merged = z_df.copy()
    for col in FEATURE_COLS:
        mask_na = merged[col].isna() if merged[col].dtype.kind == "f" else merged[col].apply(
            lambda x: x is None or (isinstance(x, float) and np.isnan(x))
        )
        prompts = prompt_df[col]
        merged[col] = merged[col].where(~mask_na, prompts)

    prov_df = pd.DataFrame(provenance)
    out = pd.concat(
        [ident_df.reset_index(drop=True), merged.reset_index(drop=True), prov_df.reset_index(drop=True)],
        axis=1,
    )
    return out


def build_card_matrix(
    races: list[Race],
    session: Session,
    horse_urls: dict[str, str] | None = None,
    jt_cache: JtStatsCache | None = None,
) -> pd.DataFrame:
    """Build one combined matrix for a list of races (typically a full card)."""
    frames: list[pd.DataFrame] = []
    for race in sorted(races, key=lambda r: r.race_number):
        frames.append(build_race_matrix(race, session, horse_urls=horse_urls, jt_cache=jt_cache))
    if not frames:
        return pd.DataFrame(columns=IDENTIFIER_COLS + FEATURE_COLS + PROVENANCE_COLS)
    return pd.concat(frames, ignore_index=True)


# ── small helpers ─────────────────────────────────────────────────────


def _distance_short(yards: int | None) -> str:
    if not yards:
        return ""
    if yards < 1760:
        return f"{yards/220:g}f"
    miles = yards / 1760
    if abs(miles - round(miles)) < 0.01:
        return f"{int(round(miles))}m"
    return f"{miles:.2f}m"


def _ml_to_fraction(decimal: float | None) -> str:
    """Render 2.5 → '5-2', 8.0 → '8-1'."""
    if decimal is None:
        return ""
    # Simple fractional renderer for the common morning-line denominators.
    for den in (1, 2, 5):
        num = decimal * den
        if abs(num - round(num)) < 0.05:
            n = int(round(num))
            return f"{n}-{den}"
    return f"{decimal:.2f}"
