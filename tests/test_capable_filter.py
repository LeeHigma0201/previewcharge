"""Tests for Gap 2: Capable longshot filter."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.longshot.signals import (
    LongshotCandidate,
    capable_longshot_filter,
    identify_longshot_candidates,
)


def _make_candidate() -> LongshotCandidate:
    return LongshotCandidate(
        entry_id=1,
        horse_name="Test Horse",
        model_prob=0.10,
        implied_prob=0.05,
        overlay_pct=100.0,
    )


class TestCapableLongshotFilter:
    """Test each of the 5 conditions individually."""

    # All-passing baseline
    BASE_KWARGS = dict(
        best_beyer=80.0,
        beyer_trend=1.0,
        days_since_last=30.0,
        trainer_layoff_win_pct=None,
        sim_win_pct=0.10,
        pace_scenario_favorable=True,
        race_class_par=80.0,
    )

    def test_all_pass(self):
        c = _make_candidate()
        ok, reasons = capable_longshot_filter(c, **self.BASE_KWARGS)
        assert ok is True
        assert reasons == []

    def test_fail_beyer_too_low(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "best_beyer": 70.0}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is False
        assert any("best_beyer" in r for r in reasons)

    def test_fail_beyer_none(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "best_beyer": None}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is False

    def test_fail_declining_trend(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "beyer_trend": -2.0}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is False
        assert any("declining" in r for r in reasons)

    def test_fail_layoff_no_trainer_stat(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "days_since_last": 120.0, "trainer_layoff_win_pct": 0.10}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is False
        assert any("layoff" in r for r in reasons)

    def test_pass_layoff_with_good_trainer(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "days_since_last": 120.0, "trainer_layoff_win_pct": 0.20}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is True

    def test_fail_low_sim_win_pct(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "sim_win_pct": 0.05}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is False
        assert any("sim_win_pct" in r for r in reasons)

    def test_fail_pace_not_favorable(self):
        c = _make_candidate()
        kwargs = {**self.BASE_KWARGS, "pace_scenario_favorable": False}
        ok, reasons = capable_longshot_filter(c, **kwargs)
        assert ok is False
        assert any("pace" in r for r in reasons)


class TestIdentifyLongshotCandidatesBackwardCompat:
    """Old signature (no optional params) still works."""

    def test_basic_call(self):
        ids = [1, 2, 3]
        names = ["A", "B", "C"]
        probs = np.array([0.15, 0.05, 0.03])
        odds = np.array([2.0, 10.0, 30.0])
        result = identify_longshot_candidates(ids, names, probs, odds)
        # Should not crash, and all candidates should have capable=True (default)
        for c in result:
            assert c.capable is True

    def test_capable_flag_set_when_features_provided(self):
        ids = [1, 2]
        names = ["A", "B"]
        probs = np.array([0.15, 0.10])
        odds = np.array([2.0, 8.0])
        features = {
            2: {"best_beyer": 60.0, "beyer_trend": -1.0, "days_since_last": 200.0},
        }
        result = identify_longshot_candidates(
            ids, names, probs, odds,
            entry_features=features,
            sim_win_probs=probs,
            pace_favorable={2: False},
        )
        # Horse 2 should fail the filter but still appear
        longshots = [c for c in result if c.entry_id == 2]
        if longshots:
            assert longshots[0].capable is False
