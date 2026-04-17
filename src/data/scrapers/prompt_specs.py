"""Declarative catalog of fetch-prompt specs for filling missing feature data.

When the HRN scrape leaves a feature cell null (e.g. no Beyer figures, no
jockey stats), the matrix builder substitutes a rendered prompt string. Each
prompt belongs to a named *spec* that describes:
  - what raw inputs a subagent should fetch,
  - which URL(s) to try first,
  - the exact JSON schema the subagent must return.

Three specs cover the gaps:
  - ``equibase_pps``       — up to 10 past performances per horse
  - ``equibase_workouts``  — recent workouts + entry-level details (equipment,
                             medication, weight, running style)
  - ``jt_stats``           — jockey/trainer meet-level stats (one spec per
                             unique person, shared across horses)

A single fetch unlocks many downstream feature cells, so we emit one task per
(horse, spec) — not one per cell.
"""

from __future__ import annotations

from dataclasses import dataclass

# Mapping from feature-name → spec id. When a feature is null in a computed
# matrix, the cell gets filled with a PROMPT[...] rendered from this spec.
FEATURE_TO_SPEC: dict[str, str] = {
    # Speed (Beyer) features come from past performances.
    "best_beyer": "equibase_pps",
    "avg_beyer": "equibase_pps",
    "last_beyer": "equibase_pps",
    "beyer_trend": "equibase_pps",
    "beyer_stdev": "equibase_pps",
    # Pace figures also live in past performances.
    "avg_e1_pace": "equibase_pps",
    "avg_e2_pace": "equibase_pps",
    "avg_late_pace": "equibase_pps",
    "last_e1_pace": "equibase_pps",
    "last_late_pace": "equibase_pps",
    "pace_velocity_change": "equibase_pps",
    "early_late_ratio": "equibase_pps",
    # Class (past purses, claiming history).
    "avg_past_purse": "equibase_pps",
    "class_change_pct": "equibase_pps",
    "claiming_price_ratio": "equibase_pps",
    "is_class_drop": "equibase_pps",
    # Form cycle (finishes, dates, trend).
    "days_since_last": "equibase_pps",
    "log_days_since_last": "equibase_pps",
    "is_quick_turnaround": "equibase_pps",
    "is_optimal_rest": "equibase_pps",
    "is_freshening": "equibase_pps",
    "is_extended_layoff": "equibase_pps",
    "win_rate_last_5": "equibase_pps",
    "win_rate_last_10": "equibase_pps",
    "avg_finish_pos": "equibase_pps",
    "improvement_last_3": "equibase_pps",
    "top3_rate_last_5": "equibase_pps",
    # Distance / surface history.
    "distance_exp_pct": "equibase_pps",
    "surface_exp_pct": "equibase_pps",
    "is_surface_switch": "equibase_pps",
    "distance_change_yards": "equibase_pps",
    "is_route_to_sprint": "equibase_pps",
    # Trip shape (position calls).
    "avg_pos_1st_call": "equibase_pps",
    "avg_pos_stretch": "equibase_pps",
    "avg_pos_gain": "equibase_pps",
    "avg_late_gain": "equibase_pps",
    "troubled_trip_rate": "equibase_pps",
    # Equipment / medication — per-entry detail (workouts spec doubles as
    # "horse profile today" since Equibase's entry page lists both).
    "has_blinkers": "equibase_workouts",
    "first_time_blinkers": "equibase_workouts",
    "blinkers_off": "equibase_workouts",
    "has_lasix": "equibase_workouts",
    # Pace running-style (E/EP/P/S/C) drives pace-scenario + interactions.
    "style_E": "equibase_workouts",
    "style_EP": "equibase_workouts",
    "style_P": "equibase_workouts",
    "style_S": "equibase_workouts",
    "style_C": "equibase_workouts",
    "n_early_speed": "equibase_workouts",
    "n_closers": "equibase_workouts",
    "speed_horse_pct": "equibase_workouts",
    "pace_scenario_hot": "equibase_workouts",
    "pace_scenario_soft": "equibase_workouts",
    "lone_speed": "equibase_workouts",
    "style_x_hot_pace": "equibase_workouts",
    "style_x_soft_pace": "equibase_workouts",
    "pace_pressure": "equibase_workouts",
    # Jockey/trainer stats — one unique task per person (deduped at dispatch).
    # roi and avg_odds are aux metrics rarely available from free public pages;
    # leave them unmapped so they stay NaN when no prior DB history exists.
    "jockey_win_pct": "jt_stats",
    "jockey_starts": "jt_stats",
    "jockey_top3_pct": "jt_stats",
    "trainer_win_pct": "jt_stats",
    "trainer_starts": "jt_stats",
    "trainer_top3_pct": "jt_stats",
}


@dataclass(frozen=True)
class PromptSpec:
    """One kind of fetch-prompt, with template and expected JSON schema."""

    id: str
    target_columns: tuple[str, ...]  # features this spec unlocks
    template: str                    # rendered via .format(**ctx)
    schema: str                      # JSON schema (prose) the subagent must return


EQUIBASE_PPS_SPEC = PromptSpec(
    id="equibase_pps",
    target_columns=tuple(
        k for k, v in FEATURE_TO_SPEC.items() if v == "equibase_pps"
    ),
    template=(
        "You are filling raw past-performance data for horse {horse_name} "
        "(sire: {sire}) running in {track_code} Race {race_number} on {race_date}. "
        "Fetch the most recent up-to-10 past performances.\n"
        "\n"
        "Primary source: the horse's HRN profile page:\n"
        "  {horse_url}\n"
        "Parse the ‘Past Performance Race History’ / results section.\n"
        "Backup: search Equibase by horse name at\n"
        "  https://www.equibase.com/profiles/Results.cfm?type=Horse&searchString={horse_query}\n"
        "and follow into the horse profile.\n"
        "\n"
        "Use the sire to disambiguate if two horses share a name.\n"
        "\n"
        "{schema}\n"
        "\n"
        "Return ONLY valid JSON. If the horse cannot be found on either source, "
        "return {{\"status\": \"not_found\", \"horse_name\": \"{horse_name}\"}}."
    ),
    schema=(
        "Expected JSON shape:\n"
        "{\n"
        '  "status": "ok",\n'
        '  "horse_name": "<exact name>",\n'
        '  "pps": [\n'
        "    {\n"
        '      "race_date": "YYYY-MM-DD",\n'
        '      "track_code": "SAR",\n'
        '      "distance_yards": 1320,\n'
        '      "surface": "D|T|AW",\n'
        '      "track_condition": "FT|GD|SY|...",\n'
        '      "race_type": "MSW|MCL|ALW|AOC|CLM|STK|STR",\n'
        '      "purse": 75000,\n'
        '      "claiming_price": null,\n'
        '      "num_entrants": 10,\n'
        '      "finish_position": 2,\n'
        '      "final_odds": 4.5,\n'
        '      "beyer_speed": 92,\n'
        '      "e1_pace": 95,\n'
        '      "e2_pace": 94,\n'
        '      "late_pace": 88,\n'
        '      "position_1st_call": 3,\n'
        '      "position_2nd_call": 2,\n'
        '      "position_stretch": 2,\n'
        '      "lengths_behind_1st": 1.5,\n'
        '      "lengths_behind_finish": 0.25,\n'
        '      "weight": 120,\n'
        '      "final_time_seconds": 70.42\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Up to 10 entries in chronological order (most recent first). Any field "
        "that is not visible may be omitted or null."
    ),
)


EQUIBASE_WORKOUTS_SPEC = PromptSpec(
    id="equibase_workouts",
    target_columns=tuple(
        k for k, v in FEATURE_TO_SPEC.items() if v == "equibase_workouts"
    ),
    template=(
        "You are filling the entry-day profile for horse {horse_name} "
        "(sire: {sire}) in {track_code} Race {race_number} on {race_date}. "
        "Collect today's equipment/medication, running style, weight, and up "
        "to 12 most recent workouts.\n"
        "\n"
        "Primary: HRN horse profile at {horse_url}.\n"
        "Backup: Equibase at\n"
        "  https://www.equibase.com/profiles/Results.cfm?searchString={horse_query}\n"
        "\n"
        "{schema}\n"
        "\n"
        "Return ONLY valid JSON."
    ),
    schema=(
        "Expected JSON shape:\n"
        "{\n"
        '  "status": "ok",\n'
        '  "horse_name": "<exact name>",\n'
        '  "weight": 120,\n'
        '  "medication": "L",\n'
        '  "equipment": "b",\n'
        '  "running_style": "E|EP|P|S|C",\n'
        '  "dam": "<mare name>",\n'
        '  "dam_sire": "<stallion>",\n'
        '  "birth_year": 2022,\n'
        '  "sex": "F|C|G|M|H",\n'
        '  "workouts": [\n'
        "    {\n"
        '      "workout_date": "YYYY-MM-DD",\n'
        '      "track_code": "KEE",\n'
        '      "distance_furlongs": 4.0,\n'
        '      "time_seconds": 48.6,\n'
        '      "rank": 2,\n'
        '      "total_workers": 18,\n'
        '      "surface": "D|T|AW"\n'
        "    }\n"
        "  ]\n"
        "}\n"
        "Omit fields that aren't visible. Running style is often shown on the\n"
        "horse's profile or inferred from past pace figures (E=front-runner, C=deep closer)."
    ),
)


JT_STATS_SPEC = PromptSpec(
    id="jt_stats",
    target_columns=tuple(
        k for k, v in FEATURE_TO_SPEC.items() if v == "jt_stats"
    ),
    template=(
        "Fetch meet-level statistics for {role} {person_name} "
        "for the current Keeneland spring meet (or the most recent 60 days if "
        "a meet boundary is unclear).\n"
        "\n"
        "Primary: Equibase people pages.\n"
        "  https://www.equibase.com/profiles/Results.cfm?type={role_param}&searchString={person_query}\n"
        "Fall back to HRN's leaderboard pages under horseracingnation.com.\n"
        "\n"
        "{schema}\n"
        "\n"
        "Return ONLY valid JSON."
    ),
    schema=(
        "Expected JSON shape:\n"
        "{\n"
        '  "status": "ok",\n'
        '  "role": "jockey|trainer",\n'
        '  "name": "<exact name>",\n'
        '  "starts": 145,\n'
        '  "wins": 36,\n'
        '  "seconds": 24,\n'
        '  "thirds": 18,\n'
        '  "win_pct": 0.248,\n'
        '  "top3_pct": 0.538,\n'
        '  "roi": 0.04,\n'
        '  "avg_odds": 4.2\n'
        "}"
    ),
)


SPECS: dict[str, PromptSpec] = {
    s.id: s for s in (EQUIBASE_PPS_SPEC, EQUIBASE_WORKOUTS_SPEC, JT_STATS_SPEC)
}


def render_prompt(spec_id: str, **ctx: object) -> str:
    """Render a spec's template against a context dict.

    Required context keys vary by spec:
      - equibase_pps / equibase_workouts: horse_name, sire, track_code,
        race_number, race_date, horse_query, horse_slug
      - jt_stats: role ('jockey'|'trainer'), person_name, person_query,
        role_param (equibase 'Jockey' or 'Trainer')
    """
    spec = SPECS[spec_id]
    rendered = spec.template.format(schema=spec.schema, **ctx)
    # Prefix with PROMPT[<spec>|<who>] so cells are recognizable in the CSV.
    label = _short_label(spec_id, ctx)
    return f"PROMPT[{spec_id}|{label}]:\n{rendered}"


def _short_label(spec_id: str, ctx: dict[str, object]) -> str:
    if spec_id == "jt_stats":
        return str(ctx.get("person_name") or "?")
    return str(ctx.get("horse_name") or "?")


def horse_slug(name: str) -> str:
    """Approximate an HRN-style horse URL slug from a display name."""
    import re as _re
    s = name.strip()
    s = _re.sub(r"[^A-Za-z0-9]+", "_", s)
    return s.strip("_")
