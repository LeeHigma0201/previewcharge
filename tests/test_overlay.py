"""Tests for Stage 2: Overlay detection (model vs market)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models.overlay import (
    compute_race_overlay,
    find_exotic_value_horses,
    format_overlay_report,
)


def _make_overlay():
    """Standard test setup: model disagrees with market."""
    # Stage 1 model output (no odds used)
    model_probs = np.array([0.30, 0.25, 0.20, 0.10, 0.08, 0.04, 0.02, 0.01])
    # Market odds — public has different opinion
    market_odds = np.array([3.0, 5.0, 4.0, 8.0, 6.0, 10.0, 20.0, 50.0])
    names = [f"Horse_{i}" for i in range(8)]
    programs = [str(i + 1) for i in range(8)]
    return compute_race_overlay(model_probs, market_odds, names, programs)


class TestComputeRaceOverlay:
    def test_entries_exist(self):
        overlay = _make_overlay()
        assert len(overlay.entries) == 8

    def test_model_probs_preserved(self):
        overlay = _make_overlay()
        probs = {e.entry_index: e.model_prob for e in overlay.entries}
        assert probs[0] == 0.30

    def test_overlay_positive_means_value(self):
        overlay = _make_overlay()
        for e in overlay.entries:
            if e.overlay_pct > 0:
                assert e.is_value is True
            else:
                assert e.is_value is False

    def test_at_least_one_value_horse(self):
        overlay = _make_overlay()
        assert overlay.n_value_horses > 0

    def test_predicted_order_is_by_model_prob(self):
        overlay = _make_overlay()
        # First in predicted order should be the highest model prob horse
        assert overlay.predicted_order[0] == 0  # Horse 0 has 0.30

    def test_market_order_is_by_market_prob(self):
        overlay = _make_overlay()
        # Market favorite is the one with lowest odds
        # odds = [3, 5, 4, 8, 6, 10, 20, 50] => horse 0 is fav (3.0)
        assert overlay.market_order[0] == 0

    def test_order_disagreement_counted(self):
        overlay = _make_overlay()
        assert overlay.order_disagreement >= 0
        assert overlay.order_disagreement <= 8

    def test_exotic_multiplier_calculated(self):
        overlay = _make_overlay()
        assert overlay.exotic_multiplier > 0

    def test_entries_sorted_by_overlay_descending(self):
        overlay = _make_overlay()
        for i in range(len(overlay.entries) - 1):
            assert overlay.entries[i].overlay_pct >= overlay.entries[i + 1].overlay_pct

    def test_longshot_flagged_correctly(self):
        overlay = _make_overlay()
        # Horse 6 has odds 20.0, horse 7 has 50.0 => both longshots (>=10)
        longshots = {e.entry_index for e in overlay.entries if e.is_longshot}
        assert 5 in longshots  # 10.0 odds
        assert 6 in longshots  # 20.0 odds
        assert 7 in longshots  # 50.0 odds

    def test_overlay_longshot_requires_both_conditions(self):
        overlay = _make_overlay()
        for e in overlay.entries:
            if e.is_overlay_longshot:
                assert e.is_longshot
                assert e.is_value

    def test_edge_is_model_minus_market(self):
        overlay = _make_overlay()
        for e in overlay.entries:
            expected_edge = e.model_prob - e.market_prob
            assert abs(e.edge - expected_edge) < 0.001


class TestFindExoticValueHorses:
    def test_filters_by_overlay_threshold(self):
        overlay = _make_overlay()
        value = find_exotic_value_horses(overlay, min_overlay_pct=20.0)
        for e in value:
            assert e.overlay_pct >= 20.0 or e.is_overlay_longshot

    def test_returns_subset(self):
        overlay = _make_overlay()
        value = find_exotic_value_horses(overlay, min_overlay_pct=50.0)
        assert len(value) <= len(overlay.entries)


class TestFormatOverlayReport:
    def test_report_contains_key_sections(self):
        overlay = _make_overlay()
        report = format_overlay_report(overlay)
        assert "OVERLAY ANALYSIS" in report
        assert "Model" in report
        assert "Market" in report
        assert "Predicted order" in report

    def test_report_shows_all_horses(self):
        overlay = _make_overlay()
        report = format_overlay_report(overlay)
        for i in range(1, 9):
            assert f"#{i}" in report


class TestOddsFreeStage1:
    """Verify that Stage 1 features do NOT include odds."""

    def test_entry_features_have_no_odds(self, sample_race, session):
        from src.features.core import compute_entry_features

        entry = sample_race.entries[0]
        features = compute_entry_features(entry, sample_race, session)
        # These odds features should NOT be in Stage 1
        assert "morning_line_odds" not in features
        assert "ml_implied_prob" not in features
        assert "log_ml_odds" not in features
        assert "is_ml_favorite" not in features

    def test_race_features_have_no_odds(self, sample_race, session):
        from src.features.core import compute_race_features

        df = compute_race_features(sample_race, session)
        assert "morning_line_odds" not in df.columns
        assert "ml_implied_prob" not in df.columns
        assert "log_ml_odds" not in df.columns
        assert "is_ml_favorite" not in df.columns

    def test_odds_features_still_accessible_separately(self, sample_race, session):
        from src.features.core import compute_odds_features

        entry = sample_race.entries[0]
        odds_feats = compute_odds_features(entry)
        assert "morning_line_odds" in odds_feats
        assert odds_feats["morning_line_odds"] == 3.0  # Speed Demon ML
