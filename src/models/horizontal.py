"""Horizontal exotic ticket construction (DD, Pick 3/4/5/6).

Uses race entropy to decide which legs to spread vs single.
Low-entropy races get 1-2 selections (single), high-entropy races
get 3-5 selections (spread). Capable longshot alerts are always
included in their leg's selections.

Complements the anchor-based approach in exotic_engine.py —
this module makes decisions based on field uncertainty rather
than anchor qualification.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import prod

import numpy as np

from src.models.entropy import normalized_entropy
from src.models.monte_carlo import SimulationResult


BET_TYPE_LEGS = {
    "daily_double": 2,
    "pick3": 3,
    "pick4": 4,
    "pick5": 5,
    "pick6": 6,
}


@dataclass
class HorizontalTicket:
    """A constructed horizontal exotic bet ticket."""

    bet_type: str  # "daily_double", "pick3", "pick4", "pick5", "pick6"
    legs: list[list[int]]  # List of horse indices per leg
    cost: float
    coverage_prob: float  # Sum of sim probabilities covered
    ces: float  # Coverage Efficiency Score = coverage_prob / cost


def build_horizontal_ticket(
    sims: list[SimulationResult],
    bet_type: str,
    budget: float,
    base_bet: float = 0.50,
    alert_entries: list[list[int]] | None = None,
) -> HorizontalTicket:
    """Build a horizontal exotic ticket using entropy-based leg sizing.

    Args:
        sims: SimulationResult per race leg.
        bet_type: One of "daily_double", "pick3", "pick4", "pick5", "pick6".
        budget: Maximum total ticket cost.
        base_bet: Cost per combination (e.g. $0.50 for pick 4).
        alert_entries: Capable longshot indices per leg to always include.

    Returns:
        HorizontalTicket with optimized legs fitting within budget.
    """
    expected_legs = BET_TYPE_LEGS.get(bet_type)
    if expected_legs is None:
        raise ValueError(f"Unknown bet_type: {bet_type}")
    if len(sims) != expected_legs:
        raise ValueError(
            f"{bet_type} requires {expected_legs} legs, got {len(sims)}"
        )

    if alert_entries is None:
        alert_entries = [[] for _ in sims]

    # Build initial selections per leg based on entropy
    legs: list[list[int]] = []
    for i, sim in enumerate(sims):
        norm_ent = normalized_entropy(sim.win_probs)
        ranked = list(np.argsort(sim.win_probs)[::-1])

        if norm_ent < 0.6:
            # Low entropy — single: top 1-2 horses
            n_select = 2 if norm_ent >= 0.4 else 1
        else:
            # High entropy — spread: 3-5 horses
            if norm_ent >= 0.9:
                n_select = 5
            elif norm_ent >= 0.75:
                n_select = 4
            else:
                n_select = 3

        # Start with top selections by probability
        selected = ranked[:n_select]

        # Always include alert entries (capable longshots)
        for alert_idx in alert_entries[i]:
            if alert_idx not in selected:
                selected.append(alert_idx)

        legs.append(selected)

    # Trim to fit budget: iteratively remove lowest-prob horse from widest leg
    while _total_combos(legs) * base_bet > budget and any(len(leg) > 1 for leg in legs):
        # Find widest leg (most selections)
        widest_idx = max(range(len(legs)), key=lambda j: len(legs[j]))
        if len(legs[widest_idx]) <= 1:
            break

        # Remove lowest-prob horse from the widest leg (preserve alerts)
        leg = legs[widest_idx]
        sim = sims[widest_idx]
        alerts_set = set(alert_entries[widest_idx])

        # Find removable candidates (not alerts, not the only selection)
        removable = [
            (idx, float(sim.win_probs[idx]))
            for idx in leg
            if idx not in alerts_set
        ]
        if not removable:
            break

        # Remove the one with lowest probability
        removable.sort(key=lambda x: x[1])
        legs[widest_idx] = [idx for idx in leg if idx != removable[0][0]]

    total_combos = _total_combos(legs)
    cost = total_combos * base_bet

    # Compute coverage probability
    coverage_prob = _compute_coverage_prob(legs, sims)
    ces = coverage_prob / cost if cost > 0 else 0.0

    return HorizontalTicket(
        bet_type=bet_type,
        legs=legs,
        cost=round(cost, 2),
        coverage_prob=round(coverage_prob, 6),
        ces=round(ces, 6),
    )


def _total_combos(legs: list[list[int]]) -> int:
    """Total number of combinations across all legs."""
    if not legs:
        return 0
    return prod(len(leg) for leg in legs)


def _compute_coverage_prob(
    legs: list[list[int]], sims: list[SimulationResult]
) -> float:
    """Sum of probability mass covered by the ticket.

    For each leg, coverage = sum of win_probs for selected horses.
    Total coverage = product across legs (assuming independence).
    """
    leg_probs = []
    for leg, sim in zip(legs, sims):
        leg_prob = sum(float(sim.win_probs[idx]) for idx in leg)
        leg_probs.append(leg_prob)
    return prod(leg_probs)
