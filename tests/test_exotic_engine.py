"""Tests for the exotic betting engine and superfecta Monte Carlo extension."""

import numpy as np
import pytest

from src.models.exotic_engine import ExoticEngine
from src.models.monte_carlo import SimulationResult, henery_simulate


@pytest.fixture
def small_field_probs():
    """6-horse field with a clear favorite."""
    return np.array([0.35, 0.20, 0.15, 0.12, 0.10, 0.08])


@pytest.fixture
def sim_result(small_field_probs):
    """Simulation result for a 6-horse field."""
    return henery_simulate(small_field_probs, n_simulations=50_000, seed=42)


@pytest.fixture
def sim_with_super(small_field_probs):
    """Simulation result with superfecta computed."""
    return henery_simulate(
        small_field_probs,
        n_simulations=50_000,
        seed=42,
        superfecta=True,
        superfecta_threshold=0.001,
    )


@pytest.fixture
def horse_names():
    return ["Favorite", "Contender", "MidPack", "Longshot1", "Longshot2", "Longshot3"]


@pytest.fixture
def ml_odds():
    return [1.86, 4.0, 5.67, 7.33, 9.0, 11.5]


class TestHenerySimulateSuperfecta:
    def test_superfecta_default_off(self, sim_result):
        assert sim_result.superfecta_probs is None

    def test_superfecta_computed(self, sim_with_super):
        assert sim_with_super.superfecta_probs is not None
        assert len(sim_with_super.superfecta_probs) > 0

    def test_superfecta_keys_are_4tuples(self, sim_with_super):
        for key in sim_with_super.superfecta_probs:
            assert len(key) == 4
            assert len(set(key)) == 4  # all different horses

    def test_superfecta_probs_positive(self, sim_with_super):
        for prob in sim_with_super.superfecta_probs.values():
            assert prob > 0

    def test_superfecta_probs_sum_less_than_one(self, sim_with_super):
        total = sum(sim_with_super.superfecta_probs.values())
        # Should sum close to 1.0 (may be slightly less due to threshold pruning)
        assert total <= 1.01
        assert total > 0.5  # should capture most of the probability mass

    def test_win_probs_sum_to_one(self, sim_with_super):
        assert abs(sim_with_super.win_probs.sum() - 1.0) < 0.02

    def test_favorite_has_highest_win_prob(self, sim_with_super):
        assert np.argmax(sim_with_super.win_probs) == 0

    def test_backward_compatible(self, sim_result):
        """SimulationResult without superfecta still works."""
        assert sim_result.win_probs is not None
        assert sim_result.exacta_probs is not None
        assert sim_result.trifecta_probs is not None
        assert sim_result.finish_matrix is not None


class TestExoticEngine:
    def test_exacta_tickets(self, sim_result, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_result,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
            bankroll=1000.0,
        )
        bets = engine.generate_exacta_tickets()
        # Should produce at least some bets if there are EV overlays
        # (may be empty if no combos exceed min_ev, which is fine)
        for bet in bets:
            assert bet.bet_type == "exacta"
            assert bet.cost > 0
            assert len(bet.combinations) > 0
            for combo in bet.combinations:
                assert len(combo) == 2

    def test_trifecta_tickets(self, sim_result, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_result,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
            bankroll=1000.0,
        )
        bets = engine.generate_trifecta_tickets()
        for bet in bets:
            assert bet.bet_type == "trifecta"
            assert bet.cost > 0
            for combo in bet.combinations:
                assert len(combo) == 3

    def test_superfecta_tickets(self, sim_with_super, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_with_super,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
            bankroll=1000.0,
        )
        bets = engine.generate_superfecta_tickets()
        for bet in bets:
            assert bet.bet_type == "superfecta"
            assert bet.cost > 0
            for combo in bet.combinations:
                assert len(combo) == 4
                assert len(set(combo)) == 4  # all different

    def test_superfecta_no_sim_returns_empty(self, sim_result, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_result,  # no superfecta probs
            horse_names=horse_names,
            morning_line_odds=ml_odds,
        )
        bets = engine.generate_superfecta_tickets()
        assert bets == []

    def test_full_recommendation(self, sim_with_super, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_with_super,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
            bankroll=1000.0,
        )
        rec = engine.full_recommendation(race_slug="test", race_name="Test Race")
        assert rec.race_slug == "test"
        assert rec.race_name == "Test Race"
        assert rec.bankroll == 1000.0
        assert len(rec.win_probs) == 6
        assert len(rec.market_probs) == 6
        assert rec.total_cost >= 0

    def test_print_report(self, sim_with_super, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_with_super,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
        )
        report = engine.print_report()
        assert "Horse" in report
        assert "Model" in report
        assert "EXACTA" in report
        assert "TRIFECTA" in report
        assert "SUPERFECTA" in report

    def test_budget_constraint(self, sim_result, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_result,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
            bankroll=100.0,
        )
        bets = engine.generate_exacta_tickets(max_cost=10.0)
        for bet in bets:
            assert bet.cost <= 10.0 + 2.0  # base cost tolerance

    def test_ticket_format(self, sim_result, horse_names, ml_odds):
        engine = ExoticEngine(
            sim=sim_result,
            horse_names=horse_names,
            morning_line_odds=ml_odds,
        )
        ticket = engine._format_ticket("exacta", [(0, 1), (0, 2)])
        assert "EXACTA" in ticket


class TestExoticEngineEdgeCases:
    def test_three_horse_field(self):
        probs = np.array([0.5, 0.3, 0.2])
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        engine = ExoticEngine(
            sim=sim,
            horse_names=["Horse1", "Horse2", "Horse3"],
            morning_line_odds=[1.0, 2.33, 4.0],
        )
        bets = engine.generate_exacta_tickets()
        for bet in bets:
            assert all(len(c) == 2 for c in bet.combinations)

    def test_equal_probs(self):
        probs = np.array([0.125] * 8)
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        engine = ExoticEngine(
            sim=sim,
            horse_names=[f"Horse{i}" for i in range(8)],
            morning_line_odds=[7.0] * 8,
        )
        rec = engine.full_recommendation()
        # Should still produce a valid recommendation
        assert rec.total_cost >= 0
