"""Tests for Gap 1: Superfecta probabilities (dict format + top4_probs)."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models.monte_carlo import find_value_exotics, henery_simulate


class TestTop4Probs:
    def test_top4_probs_exists(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)
        assert hasattr(sim, "top4_probs")
        assert sim.top4_probs.shape == (5,)

    def test_top4_probs_gte_show_probs(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)
        # Top-4 probability >= show (top-3) probability for every horse
        for i in range(len(probs)):
            assert sim.top4_probs[i] >= sim.show_probs[i] - 0.01  # small tolerance

    def test_top4_probs_lte_one(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)
        for i in range(len(probs)):
            assert sim.top4_probs[i] <= 1.0 + 0.001

    def test_top4_probs_small_field(self):
        """Fields with < 4 horses should have zeroed top4_probs."""
        probs = np.array([0.5, 0.3, 0.2])
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        assert np.all(sim.top4_probs == 0.0)


class TestSuperfectaDict:
    def test_is_dict_type(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        assert isinstance(sim.superfecta_probs, dict)

    def test_keys_are_4_tuples(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        for key in sim.superfecta_probs:
            assert len(key) == 4
            assert len(set(key)) == 4  # all distinct indices

    def test_keys_indices_in_range(self):
        n = 5
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        for combo in sim.superfecta_probs:
            assert all(0 <= idx < n for idx in combo)

    def test_values_sum_to_approx_one(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        total = sum(sim.superfecta_probs.values())
        # Some low-prob combos are filtered, so allow tolerance
        assert total == pytest.approx(1.0, abs=0.05)

    def test_only_significant_combos_kept(self):
        """Only combos with prob > 1/n^4 should be in the dict."""
        n = 5
        threshold = 1.0 / (n ** 4)
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        for prob in sim.superfecta_probs.values():
            assert prob > threshold

    def test_none_when_not_computed(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        assert sim.superfecta_probs is None


class TestFindValueExoticsSuperfecta:
    def test_handles_4_tuples(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        # Create pool payoffs with a 4-tuple (superfecta)
        pool = {(0, 1, 2, 3): 500.0}
        results = find_value_exotics(sim, pool_payoffs=pool, min_ev=0.0)
        assert len(results) > 0
        assert results[0]["combo"] == (0, 1, 2, 3)

    def test_skips_4_tuples_without_superfecta(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        pool = {(0, 1, 2, 3): 500.0}
        results = find_value_exotics(sim, pool_payoffs=pool, min_ev=0.0)
        assert len(results) == 0
