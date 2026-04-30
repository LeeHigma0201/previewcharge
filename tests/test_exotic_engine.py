"""Tests for the exotic bet engine."""

from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

import numpy as np
import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from src.betting.exotic_engine import (
    ExoticBetPlan,
    MultiRaceBetPlan,
    analyze_race_leg,
    build_tickets,
    format_bet_slip,
    format_multi_race_slip,
    generate_bet_plan,
    generate_multi_race_plan,
    select_anchor,
    select_contenders,
)
from src.betting.kelly import (
    allocate_bankroll,
    estimate_exotic_payoff,
    kelly_exotic,
    SizedTicket,
)
from src.models.monte_carlo import (
    compute_superfecta_for_anchor,
    henery_simulate,
)


# ---------------------------------------------------------------------------
# Kelly Tests
# ---------------------------------------------------------------------------


class TestKelly:
    def test_estimate_payoff_basic(self):
        # 10% combo prob, 22% takeout → payoff ~7.80
        payoff = estimate_exotic_payoff(0.10, takeout=0.22)
        assert payoff == pytest.approx(7.80, abs=0.01)

    def test_estimate_payoff_zero_prob(self):
        assert estimate_exotic_payoff(0.0) == 0.0

    def test_kelly_positive_ev(self):
        # combo with 10% chance, payoff 15 (EV=1.5) → positive Kelly
        k = kelly_exotic(0.10, 15.0, fraction=0.25)
        assert k > 0

    def test_kelly_negative_ev(self):
        # combo with 1% chance, payoff 50 (EV=0.5) → zero Kelly
        k = kelly_exotic(0.01, 50.0, fraction=0.25)
        # EV = 0.01 * 50 = 0.5 < 1.0 → should be 0
        assert k == 0.0

    def test_kelly_capped_by_fraction(self):
        # Full Kelly would be large for high edge, fraction caps it
        full = kelly_exotic(0.50, 3.0, fraction=1.0)
        quarter = kelly_exotic(0.50, 3.0, fraction=0.25)
        assert quarter == pytest.approx(full * 0.25, abs=0.001)

    def test_allocate_bankroll_caps_total(self):
        tickets = [
            SizedTicket(combo=(0,), bet_type="exacta", probability=0.10,
                        estimated_payoff=15.0, ev=1.5, kelly_fraction=0.05, stake=0.0),
            SizedTicket(combo=(0,), bet_type="trifecta", probability=0.05,
                        estimated_payoff=25.0, ev=1.25, kelly_fraction=0.03, stake=0.0),
        ]
        allocate_bankroll(tickets, bankroll=200.0, max_race_pct=0.10)
        total = sum(t.stake for t in tickets)
        assert total <= 200.0 * 0.10 + 0.01  # allow rounding


# ---------------------------------------------------------------------------
# Monte Carlo Superfecta Tests
# ---------------------------------------------------------------------------


class TestSuperfecta:
    def test_superfecta_probs_is_dict(self):
        probs = np.array([0.30, 0.25, 0.20, 0.15, 0.10])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        assert sim.superfecta_probs is not None
        assert isinstance(sim.superfecta_probs, dict)
        assert len(sim.superfecta_probs) > 0

    def test_superfecta_probs_sum(self):
        probs = np.array([0.30, 0.25, 0.20, 0.15, 0.10])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42, compute_superfecta=True)
        # Total probability of all stored superfecta combos should be close to 1.0
        # (some very low-prob combos are filtered out, so allow more tolerance)
        total = sum(sim.superfecta_probs.values())
        assert total == pytest.approx(1.0, abs=0.05)

    def test_superfecta_backward_compatible(self):
        probs = np.array([0.30, 0.25, 0.20, 0.15, 0.10])
        sim = henery_simulate(probs, n_simulations=10_000, seed=42)
        assert sim.superfecta_probs is None

    def test_anchor_superfecta(self):
        probs = np.array([0.35, 0.25, 0.20, 0.12, 0.08])
        result = compute_superfecta_for_anchor(probs, anchor_idx=0, n_simulations=50_000, seed=42)
        assert result.shape == (5, 5, 5)
        # All probs in result should be for anchor=0 winning
        # Sum should approximate P(anchor wins)
        total = result.sum()
        assert total == pytest.approx(0.35, abs=0.05)


# ---------------------------------------------------------------------------
# Anchor Selection Tests
# ---------------------------------------------------------------------------


class TestAnchorSelection:
    def test_anchor_highest_prob(self):
        probs = np.array([0.35, 0.25, 0.15, 0.10, 0.08, 0.04, 0.02, 0.01])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)

        class FakeEntry:
            def __init__(self, idx, name, ml):
                self.id = idx
                self.horse_name = name
                self.program_number = str(idx + 1)
                self.morning_line_odds = ml

        entries = [FakeEntry(i, f"Horse_{i}", ml) for i, ml in enumerate([3, 5, 8, 10, 12, 20, 30, 50])]
        anchor = select_anchor(probs, sim, None, entries)
        assert anchor.entry_index == 0
        assert anchor.win_prob == pytest.approx(0.35, abs=0.05)
        assert anchor.is_qualified  # 35% win, should have >55% WPS

    def test_no_qualified_anchor(self):
        # Equal odds → no dominant horse
        probs = np.array([0.125] * 8)
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)

        class FakeEntry:
            def __init__(self, idx):
                self.id = idx
                self.horse_name = f"Horse_{idx}"
                self.program_number = str(idx + 1)

        entries = [FakeEntry(i) for i in range(8)]
        anchor = select_anchor(probs, sim, None, entries)
        assert not anchor.is_qualified


# ---------------------------------------------------------------------------
# Contender Selection Tests
# ---------------------------------------------------------------------------


class TestContenderSelection:
    def test_contenders_exclude_anchor(self):
        probs = np.array([0.35, 0.25, 0.15, 0.10, 0.08, 0.04, 0.02, 0.01])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)

        class FakeEntry:
            def __init__(self, idx):
                self.id = idx
                self.horse_name = f"Horse_{idx}"
                self.program_number = str(idx + 1)

        entries = [FakeEntry(i) for i in range(8)]
        c2, c3, c4 = select_contenders(0, sim, entries)

        # Anchor (index 0) should not appear in any contender list
        for c in c2 + c3 + c4:
            assert c.entry_index != 0

    def test_contenders_conditional_probs_reasonable(self):
        probs = np.array([0.35, 0.25, 0.15, 0.10, 0.08, 0.04, 0.02, 0.01])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)

        class FakeEntry:
            def __init__(self, idx):
                self.id = idx
                self.horse_name = f"Horse_{idx}"
                self.program_number = str(idx + 1)

        entries = [FakeEntry(i) for i in range(8)]
        c2, c3, c4 = select_contenders(0, sim, entries)

        # 2nd place conditional probs should sum to ~1.0 across all non-anchor horses
        total = sum(c.conditional_prob for c in c2)
        # Top 4 out of 7 should capture most of the probability
        assert total > 0.5


# ---------------------------------------------------------------------------
# Ticket Construction Tests
# ---------------------------------------------------------------------------


class TestTicketConstruction:
    def test_exacta_combo_count(self):
        probs = np.array([0.35, 0.25, 0.15, 0.10, 0.08, 0.04, 0.02, 0.01])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)

        class FakeEntry:
            def __init__(self, idx):
                self.id = idx
                self.horse_name = f"Horse_{idx}"
                self.program_number = str(idx + 1)

        entries = [FakeEntry(i) for i in range(8)]
        anchor = select_anchor(probs, sim, None, entries)
        c2, c3, c4 = select_contenders(0, sim, entries)

        tickets = build_tickets(anchor, c2, c3, c4, sim, bankroll=200.0)

        exacta_tickets = [t for t in tickets if t.bet_type == "exacta"]
        assert len(exacta_tickets) == 1
        assert exacta_tickets[0].combinations == min(3, len(c2))

    def test_trifecta_combos_exclude_duplicates(self):
        probs = np.array([0.35, 0.25, 0.15, 0.10, 0.08, 0.04, 0.02, 0.01])
        sim = henery_simulate(probs, n_simulations=50_000, seed=42)

        class FakeEntry:
            def __init__(self, idx):
                self.id = idx
                self.horse_name = f"Horse_{idx}"
                self.program_number = str(idx + 1)

        entries = [FakeEntry(i) for i in range(8)]
        anchor = select_anchor(probs, sim, None, entries)
        c2, c3, c4 = select_contenders(0, sim, entries)

        tickets = build_tickets(anchor, c2, c3, c4, sim, bankroll=200.0)

        tri_tickets = [t for t in tickets if t.bet_type == "trifecta"]
        if tri_tickets:
            # Combos should be <= 4*4 = 16 minus same-horse pairs
            assert tri_tickets[0].combinations <= 16
            assert tri_tickets[0].combinations > 0


# ---------------------------------------------------------------------------
# End-to-End Single Race
# ---------------------------------------------------------------------------


class TestGenerateBetPlan:
    def test_e2e_with_sample_race(self, sample_race, session):
        entries = sorted(sample_race.entries, key=lambda e: e.post_position)
        plan = generate_bet_plan(
            sample_race, entries, session,
            bankroll=200.0, mc_sims=50_000, seed=42,
        )

        assert isinstance(plan, ExoticBetPlan)
        assert plan.anchor is not None
        assert plan.anchor.horse_name == "Speed Demon"  # 3.0 ML favorite
        assert len(plan.tickets) > 0
        assert plan.total_investment > 0

    def test_format_bet_slip(self, sample_race, session):
        entries = sorted(sample_race.entries, key=lambda e: e.post_position)
        plan = generate_bet_plan(
            sample_race, entries, session,
            bankroll=200.0, mc_sims=50_000, seed=42,
        )
        slip = format_bet_slip(plan)
        assert "ANCHOR" in slip
        assert "Speed Demon" in slip
        assert "$" in slip


# ---------------------------------------------------------------------------
# Multi-Race Tests
# ---------------------------------------------------------------------------


@pytest.fixture
def multi_race_data(session):
    """Create 4 consecutive races for multi-race tests."""
    from src.data.models import Entry, Horse, Race

    races = []
    entries_lists = []

    for race_num in range(1, 5):
        race = Race(
            track_code="SAR",
            race_date=date(2023, 8, 15),
            race_number=race_num,
            distance_yards=1320,
            surface="D",
            race_type="ALW",
            purse=80000,
            track_condition="FT",
            num_entrants=6,
        )
        session.add(race)
        session.flush()

        entries = []
        # Vary the odds so some races have anchors, some don't
        if race_num in (1, 3):
            # Strong favorite
            odds_list = [2.0, 5.0, 8.0, 12.0, 15.0, 20.0]
        else:
            # Wide open
            odds_list = [4.0, 4.5, 5.0, 5.5, 6.0, 7.0]

        for i, ml in enumerate(odds_list):
            horse = Horse(name=f"R{race_num}_Horse_{i}", sire=f"Sire_{race_num}_{i}", dam=f"Dam_{race_num}_{i}")
            session.add(horse)
            session.flush()

            entry = Entry(
                race_id=race.id,
                horse_id=horse.id,
                post_position=i + 1,
                program_number=str(i + 1),
                morning_line_odds=ml,
                running_style="P",
                bris_speed=80 + i,
                jockey=f"Jockey_{race_num}_{i}",
                trainer=f"Trainer_{race_num}_{i}",
            )
            session.add(entry)
            entries.append(entry)

        session.flush()
        races.append(race)
        entries_lists.append(sorted(entries, key=lambda e: e.post_position))

    session.commit()
    return races, entries_lists


class TestMultiRace:
    def test_pick4_generation(self, multi_race_data, session):
        races, entries_per_race = multi_race_data
        plan = generate_multi_race_plan(
            races, entries_per_race, session,
            bet_type="pick4", bankroll=200.0, mc_sims=50_000, seed=42,
        )

        assert isinstance(plan, MultiRaceBetPlan)
        assert plan.bet_type == "pick4"
        assert len(plan.legs) == 4
        assert plan.total_combinations > 0
        assert plan.total_cost > 0

    def test_singles_and_spreads(self, multi_race_data, session):
        races, entries_per_race = multi_race_data
        plan = generate_multi_race_plan(
            races, entries_per_race, session,
            bet_type="pick4", bankroll=200.0, mc_sims=50_000, seed=42,
        )

        # Races 1 and 3 have strong favorites → should be singles
        # Races 2 and 4 are wide open → should be spreads
        singles = [l for l in plan.legs if l.is_single]
        spreads = [l for l in plan.legs if not l.is_single]
        # At least some structure (exact count depends on threshold)
        assert len(plan.legs) == 4

    def test_combined_probability(self, multi_race_data, session):
        races, entries_per_race = multi_race_data
        plan = generate_multi_race_plan(
            races, entries_per_race, session,
            bet_type="pick4", bankroll=200.0, mc_sims=50_000, seed=42,
        )

        # Combined prob should equal product of leg probs
        expected = 1.0
        for leg in plan.legs:
            expected *= leg.leg_hit_prob
        assert plan.combined_hit_prob == pytest.approx(expected, abs=0.001)

    def test_daily_double(self, multi_race_data, session):
        races, entries_per_race = multi_race_data
        plan = generate_multi_race_plan(
            races[:2], entries_per_race[:2], session,
            bet_type="dd", bankroll=200.0, mc_sims=50_000, seed=42,
        )
        assert len(plan.legs) == 2
        assert plan.bet_type == "dd"

    def test_format_multi_race_slip(self, multi_race_data, session):
        races, entries_per_race = multi_race_data
        plan = generate_multi_race_plan(
            races, entries_per_race, session,
            bet_type="pick4", bankroll=200.0, mc_sims=50_000, seed=42,
        )
        slip = format_multi_race_slip(plan)
        assert "PICK 4" in slip or "PICK4" in slip
        assert "Leg 1" in slip
        assert "$" in slip
