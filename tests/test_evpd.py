"""Tests for Gap 7: Per-combo EVPD."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.longshot.value import compute_exotic_evpd
from src.models.monte_carlo import henery_simulate


def _make_sim_and_odds():
    """Create a standard sim + odds pair for testing."""
    probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
    sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
    odds = np.array([2.33, 3.0, 4.0, 5.67, 9.0])
    takeout = {"exacta": 0.19, "trifecta": 0.235, "superfecta": 0.25}
    return sim, odds, takeout


class TestComputeExoticEvpd:
    def test_all_evpd_positive(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        for exotic_type, combos in result.items():
            for combo in combos:
                assert combo["evpd"] > 0, f"{exotic_type} combo {combo['combo']} has evpd <= 0"

    def test_max_20_per_type(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        for exotic_type, combos in result.items():
            assert len(combos) <= 20

    def test_has_all_three_types(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        assert "exacta" in result
        assert "trifecta" in result
        assert "superfecta" in result

    def test_exactas_non_empty(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        assert len(result["exacta"]) > 0

    def test_trifectas_non_empty(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        assert len(result["trifecta"]) > 0

    def test_superfecta_empty_without_compute(self):
        """No superfecta data → empty superfecta list."""
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        odds = np.array([2.33, 3.0, 4.0, 5.67, 9.0])
        takeout = {"exacta": 0.19, "trifecta": 0.235, "superfecta": 0.25}
        result = compute_exotic_evpd(sim, odds, takeout)
        assert result["superfecta"] == []

    def test_higher_takeout_lowers_evpd(self):
        """Higher takeout should produce lower EVPD values."""
        sim, odds, _ = _make_sim_and_odds()
        low_takeout = {"exacta": 0.10, "trifecta": 0.10, "superfecta": 0.10}
        high_takeout = {"exacta": 0.30, "trifecta": 0.30, "superfecta": 0.30}

        low_result = compute_exotic_evpd(sim, odds, low_takeout)
        high_result = compute_exotic_evpd(sim, odds, high_takeout)

        # Top exacta EVPD should be higher with lower takeout
        if low_result["exacta"] and high_result["exacta"]:
            assert low_result["exacta"][0]["evpd"] > high_result["exacta"][0]["evpd"]

    def test_combos_sorted_by_evpd_descending(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        for exotic_type, combos in result.items():
            for i in range(len(combos) - 1):
                assert combos[i]["evpd"] >= combos[i + 1]["evpd"]

    def test_combo_dict_has_required_keys(self):
        sim, odds, takeout = _make_sim_and_odds()
        result = compute_exotic_evpd(sim, odds, takeout)
        required_keys = {"combo", "sim_prob", "implied_prob", "estimated_payoff", "evpd"}
        for combos in result.values():
            for combo in combos:
                assert required_keys.issubset(combo.keys())
