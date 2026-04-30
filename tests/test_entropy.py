"""Tests for Gap 5: Race entropy."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models.entropy import max_entropy, normalized_entropy, race_entropy
from src.models.monte_carlo import henery_simulate


class TestRaceEntropy:
    def test_certainty_is_zero(self):
        """One horse certain to win → entropy = 0."""
        probs = np.array([1.0, 0.0, 0.0])
        assert race_entropy(probs) == pytest.approx(0.0, abs=1e-10)

    def test_uniform_is_log2_n(self):
        """Equal probs → entropy = log2(n)."""
        probs = np.array([0.25, 0.25, 0.25, 0.25])
        assert race_entropy(probs) == pytest.approx(2.0, abs=1e-10)

    def test_binary_equal(self):
        probs = np.array([0.5, 0.5])
        assert race_entropy(probs) == pytest.approx(1.0, abs=1e-10)

    def test_entropy_increases_with_uncertainty(self):
        certain = race_entropy(np.array([0.9, 0.05, 0.05]))
        uncertain = race_entropy(np.array([0.4, 0.35, 0.25]))
        assert uncertain > certain


class TestMaxEntropy:
    def test_single_horse(self):
        assert max_entropy(1) == 0.0

    def test_two_horses(self):
        assert max_entropy(2) == pytest.approx(1.0)

    def test_eight_horses(self):
        assert max_entropy(8) == pytest.approx(3.0, abs=0.001)


class TestNormalizedEntropy:
    def test_range_zero_to_one(self):
        # Near certainty
        assert normalized_entropy(np.array([0.99, 0.005, 0.005])) < 0.2

        # Uniform
        assert normalized_entropy(np.array([0.25, 0.25, 0.25, 0.25])) == pytest.approx(1.0)

    def test_single_horse(self):
        assert normalized_entropy(np.array([1.0])) == 0.0


class TestSimulationResultEntropy:
    def test_entropy_property(self):
        probs = np.array([0.3, 0.25, 0.2, 0.15, 0.1])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)
        ent = sim.entropy
        assert ent > 0
        assert ent <= np.log2(5) + 0.01  # can't exceed max entropy

    def test_dominant_favorite_lower_entropy(self):
        dom = henery_simulate(np.array([0.7, 0.15, 0.1, 0.05]), seed=42)
        open_race = henery_simulate(np.array([0.28, 0.26, 0.24, 0.22]), seed=42)
        assert dom.entropy < open_race.entropy
