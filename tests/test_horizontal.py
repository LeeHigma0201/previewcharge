"""Tests for Gap 6: Horizontal exotic sequencer."""

from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.models.horizontal import build_horizontal_ticket
from src.models.monte_carlo import henery_simulate


def _make_sims(n_legs: int, seed_start: int = 0) -> list:
    """Create SimulationResults for testing."""
    return [
        henery_simulate(
            np.array([0.3, 0.25, 0.2, 0.15, 0.1]),
            n_simulations=10_000,
            seed=seed_start + i,
        )
        for i in range(n_legs)
    ]


class TestHorizontalTicket:
    def test_cost_matches_combos_times_base_bet(self):
        sims = _make_sims(4)
        ticket = build_horizontal_ticket(sims, "pick4", budget=200.0, base_bet=0.50)
        expected_combos = 1
        for leg in ticket.legs:
            expected_combos *= len(leg)
        assert ticket.cost == pytest.approx(expected_combos * 0.50, abs=0.01)

    def test_budget_constraint_respected(self):
        sims = _make_sims(6)
        ticket = build_horizontal_ticket(sims, "pick6", budget=10.0, base_bet=0.20)
        assert ticket.cost <= 10.0 + 0.01

    def test_alert_entries_always_included(self):
        sims = _make_sims(2)
        # Alert horse index 4 (lowest prob) in leg 0
        alerts = [[4], []]
        ticket = build_horizontal_ticket(
            sims, "daily_double", budget=50.0, base_bet=1.0, alert_entries=alerts
        )
        assert 4 in ticket.legs[0]

    def test_daily_double_has_2_legs(self):
        sims = _make_sims(2)
        ticket = build_horizontal_ticket(sims, "daily_double", budget=50.0)
        assert len(ticket.legs) == 2

    def test_pick4_has_4_legs(self):
        sims = _make_sims(4)
        ticket = build_horizontal_ticket(sims, "pick4", budget=100.0)
        assert len(ticket.legs) == 4

    def test_ces_is_positive(self):
        sims = _make_sims(3)
        ticket = build_horizontal_ticket(sims, "pick3", budget=50.0)
        assert ticket.ces > 0

    def test_coverage_prob_positive(self):
        sims = _make_sims(4)
        ticket = build_horizontal_ticket(sims, "pick4", budget=100.0)
        assert ticket.coverage_prob > 0

    def test_wrong_leg_count_raises(self):
        sims = _make_sims(3)
        with pytest.raises(ValueError, match="requires 4 legs"):
            build_horizontal_ticket(sims, "pick4", budget=100.0)

    def test_unknown_bet_type_raises(self):
        sims = _make_sims(2)
        with pytest.raises(ValueError, match="Unknown bet_type"):
            build_horizontal_ticket(sims, "pick99", budget=100.0)

    def test_dominant_favorite_gets_fewer_selections(self):
        """A race with a dominant favorite should use fewer selections."""
        # Very low entropy (dominant fav)
        dom_sim = henery_simulate(np.array([0.8, 0.1, 0.05, 0.03, 0.02]), seed=99, n_simulations=10_000)
        # High entropy (open race)
        open_sim = henery_simulate(np.array([0.22, 0.21, 0.20, 0.19, 0.18]), seed=100, n_simulations=10_000)

        ticket = build_horizontal_ticket(
            [dom_sim, open_sim], "daily_double", budget=50.0
        )
        # Dominant race should have fewer selections than open race
        assert len(ticket.legs[0]) <= len(ticket.legs[1])
