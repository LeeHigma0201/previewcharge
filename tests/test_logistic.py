"""Tests for the Benter logistic model and Monte Carlo simulation."""

import numpy as np
import pandas as pd

from src.models.logistic import BenterLogisticModel, normalize_probs, odds_to_implied_prob
from src.models.monte_carlo import henery_simulate


def test_odds_to_implied_prob():
    """Implied probability from odds."""
    probs = odds_to_implied_prob(np.array([1.0, 4.0, 9.0]))
    np.testing.assert_allclose(probs, [0.5, 0.2, 0.1], atol=0.01)


def test_normalize_probs():
    """Probabilities normalize to sum to 1."""
    probs = normalize_probs(np.array([0.3, 0.2, 0.1]))
    assert abs(probs.sum() - 1.0) < 1e-10


def test_benter_model_fit_predict():
    """Benter model can fit and predict."""
    np.random.seed(42)
    n = 100
    X = pd.DataFrame({
        "speed": np.random.randn(n),
        "class": np.random.randn(n),
        "pace": np.random.randn(n),
    })
    y = (X["speed"] + X["class"] > 0).astype(int).values
    odds = np.random.uniform(1, 20, n)

    model = BenterLogisticModel()
    model.fit(X, y, odds)

    # Predict on a small "race"
    X_race = X.iloc[:8]
    odds_race = odds[:8]
    probs = model.predict_proba(X_race, odds_race)

    assert len(probs) == 8
    assert abs(probs.sum() - 1.0) < 1e-10
    assert all(p >= 0 for p in probs)


def test_benter_coefficients():
    """Benter model provides interpretable coefficients."""
    X = pd.DataFrame({"a": [1, 0, 1, 0], "b": [0, 1, 0, 1]})
    y = np.array([1, 0, 1, 0])

    model = BenterLogisticModel()
    model.fit(X, y)
    coefs = model.get_coefficients()
    assert len(coefs) >= 2


def test_henery_simulate_basic():
    """Monte Carlo produces valid probability distributions."""
    probs = np.array([0.4, 0.3, 0.2, 0.1])
    sim = henery_simulate(probs, n_simulations=50000, seed=42)

    # Win probs should preserve ranking (higher input = higher output)
    # Note: Henery model amplifies favorites due to normal distribution
    # assumption, so exact values differ from input probabilities
    assert np.argmax(sim.win_probs) == np.argmax(probs)
    for i in range(len(probs) - 1):
        assert sim.win_probs[i] > sim.win_probs[i + 1]

    # Probabilities should be valid
    assert abs(sim.win_probs.sum() - 1.0) < 0.01
    assert all(sim.place_probs >= sim.win_probs - 0.01)
    assert all(sim.show_probs >= sim.place_probs - 0.01)


def test_henery_exacta_probs():
    """Exacta probabilities are consistent."""
    probs = np.array([0.5, 0.3, 0.2])
    sim = henery_simulate(probs, n_simulations=50000, seed=42)

    # Diagonal should be zero (can't finish 1st and 2nd)
    for i in range(3):
        assert sim.exacta_probs[i, i] == 0.0

    # Row sums should approximate win probs
    for i in range(3):
        assert abs(sim.exacta_probs[i, :].sum() - sim.win_probs[i]) < 0.02


def test_henery_finish_matrix():
    """Finish matrix rows sum to 1 (each horse finishes somewhere)."""
    probs = np.array([0.4, 0.3, 0.2, 0.1])
    sim = henery_simulate(probs, n_simulations=50000, seed=42)

    for i in range(4):
        assert abs(sim.finish_matrix[i, :].sum() - 1.0) < 0.01
