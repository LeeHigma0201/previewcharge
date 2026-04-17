"""Tests for the value-or-prompt matrix builder."""

from __future__ import annotations

import math

import pandas as pd
import pytest

from src.data.models import Entry, Horse, PastPerformance, Race
from src.data.scrapers.prompt_specs import FEATURE_TO_SPEC, render_prompt, SPECS
from src.features.prompt_matrix import (
    FEATURE_COLS,
    NEVER_PROMPT,
    build_race_matrix,
)


class TestFeatureSpecMap:
    def test_all_prompt_columns_have_spec(self):
        # Every feature column is either in NEVER_PROMPT or maps to a spec.
        missing = [c for c in FEATURE_COLS if c not in NEVER_PROMPT and c not in FEATURE_TO_SPEC]
        assert missing == [], f"Features without a spec mapping: {missing}"

    def test_specs_exist(self):
        for spec_id in set(FEATURE_TO_SPEC.values()):
            assert spec_id in SPECS, f"Unknown spec id: {spec_id}"


class TestRenderPrompt:
    def test_pps_prompt_has_horse_name(self):
        rendered = render_prompt(
            "equibase_pps",
            horse_name="Secretariat",
            sire="Bold Ruler",
            track_code="KEE",
            race_number=9,
            race_date="2026-04-17",
            horse_query="Secretariat",
            horse_slug="Secretariat",
            horse_url="https://www.horseracingnation.com/horse/Secretariat",
        )
        assert "Secretariat" in rendered
        assert "Bold Ruler" in rendered
        assert rendered.startswith("PROMPT[equibase_pps|Secretariat]")

    def test_jt_stats_prompt_has_role(self):
        rendered = render_prompt(
            "jt_stats",
            role="jockey",
            role_param="Jockey",
            person_name="Irad Ortiz, Jr.",
            person_query="Irad+Ortiz,+Jr.",
        )
        assert "jockey" in rendered.lower()
        assert "Irad Ortiz, Jr." in rendered


class TestRaceMatrix:
    def test_builds_matrix_from_sample_race(self, sample_race, session):
        df = build_race_matrix(sample_race, session)
        assert len(df) == 8
        # Always-filled identifiers.
        assert all(df["horse_name"] != "")
        assert all(df["post_position"].notna())
        # Post/odds features never become prompts — they're pure race-day data.
        for col in ("post_position", "morning_line_odds", "ml_implied_prob"):
            for v in df[col]:
                assert not (isinstance(v, str) and v.startswith("PROMPT["))

    def test_prompts_appear_for_missing_data(self, session):
        # Build a minimal race with one horse and NO past performances.
        from datetime import date as _date
        race = Race(
            track_code="KEE",
            race_date=_date(2026, 4, 17),
            race_number=1,
            distance_yards=1870,
            surface="D",
            race_type="MCL",
            purse=55000,
            num_entrants=1,
        )
        session.add(race)
        session.flush()
        horse = Horse(name="Olympic Star", sire="Midshipman")
        session.add(horse)
        session.flush()
        entry = Entry(
            race_id=race.id,
            horse_id=horse.id,
            post_position=1,
            program_number="1",
            jockey="James Graham",
            trainer="Lindsay Schultz",
            morning_line_odds=4.5,
        )
        session.add(entry)
        session.commit()

        df = build_race_matrix(race, session)
        assert len(df) == 1
        row = df.iloc[0]
        # No PPs → best_beyer should be a prompt.
        assert isinstance(row["best_beyer"], str)
        assert row["best_beyer"].startswith("PROMPT[equibase_pps|")
        # ML odds we KNOW from HRN — must be numeric.
        assert isinstance(row["morning_line_odds"], (int, float))
        # jockey_win_pct should be a prompt (needs jt_stats).
        assert isinstance(row["jockey_win_pct"], str)
        assert "jt_stats" in row["jockey_win_pct"]
        # Unresolved specs should flag both sources.
        assert "equibase_pps" in row["unresolved_specs"]
        assert "jt_stats:jockey" in row["unresolved_specs"]
        assert "jt_stats:trainer" in row["unresolved_specs"]

    def test_zscoring_populated_cells(self, sample_race, session):
        # After sample fixtures populate Beyer figures for all 8 horses,
        # best_beyer values should be z-scored and roughly centered near 0.
        df = build_race_matrix(sample_race, session)
        beyers = [v for v in df["best_beyer"] if isinstance(v, (int, float))]
        assert len(beyers) == 8
        mean = sum(beyers) / len(beyers)
        assert abs(mean) < 1e-6, f"Z-scored best_beyer mean should be ~0, got {mean}"
