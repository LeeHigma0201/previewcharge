"""Ranked exotic bet combinations.

Given Monte Carlo simulation results, produces ranked lists of ALL
exacta, trifecta, and superfecta combinations sorted by probability.
Includes estimated payoff, EV, and a cutoff line for what's worth betting.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from src.betting.kelly import UNIT_COSTS, estimate_exotic_payoff


@dataclass
class RankedCombo:
    """A single exotic bet combination with probability and value metrics."""

    positions: tuple[int, ...]  # horse indices in finish order
    horse_names: tuple[str, ...]
    program_numbers: tuple[str, ...]
    probability: float
    estimated_payoff: float  # estimated payout if this combo hits
    unit_cost: float  # cost of this single ticket
    rank: int
    above_cutoff: bool  # True if probability > cutoff threshold


@dataclass
class RankedExoticList:
    """All combinations for one exotic type, ranked by probability."""

    bet_type: str  # "exacta", "trifecta", "superfecta"
    unit_cost: float
    combos: list[RankedCombo]
    cutoff_rank: int  # rank where combos drop below cutoff
    total_above_cutoff: int
    total_cost_above_cutoff: float


def rank_exactas(
    exacta_probs: np.ndarray,
    horse_names: list[str],
    program_numbers: list[str],
    takeout: float = 0.22,
    min_prob: float = 0.01,
    max_combos: int = 50,
) -> RankedExoticList:
    """Rank all exacta combinations by probability.

    Args:
        min_prob: Minimum probability cutoff. Combos below this are marked
                  below cutoff. Default 1% for exactas.
    """
    n = exacta_probs.shape[0]
    combos = []
    unit = UNIT_COSTS["exacta"]

    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            prob = float(exacta_probs[i, j])
            if prob <= 0:
                continue
            payoff = estimate_exotic_payoff(prob, takeout)

            combos.append(RankedCombo(
                positions=(i, j),
                horse_names=(horse_names[i], horse_names[j]),
                program_numbers=(program_numbers[i], program_numbers[j]),
                probability=prob,
                estimated_payoff=round(payoff, 2),
                unit_cost=unit,
                rank=0,
                above_cutoff=prob >= min_prob,
            ))

    combos.sort(key=lambda c: c.probability, reverse=True)
    combos = combos[:max_combos]

    cutoff_rank = len(combos)
    for i, c in enumerate(combos):
        c.rank = i + 1
        if not c.above_cutoff and cutoff_rank == len(combos):
            cutoff_rank = i + 1

    above = [c for c in combos if c.above_cutoff]

    return RankedExoticList(
        bet_type="exacta",
        unit_cost=unit,
        combos=combos,
        cutoff_rank=cutoff_rank,
        total_above_cutoff=len(above),
        total_cost_above_cutoff=round(len(above) * unit, 2),
    )


def rank_trifectas(
    trifecta_probs: np.ndarray,
    horse_names: list[str],
    program_numbers: list[str],
    takeout: float = 0.22,
    min_prob: float = 0.003,
    max_combos: int = 50,
) -> RankedExoticList:
    """Rank all trifecta combinations by probability.

    Args:
        min_prob: Minimum probability cutoff. Default 0.3% for trifectas.
    """
    n = trifecta_probs.shape[0]
    combos = []
    unit = UNIT_COSTS["trifecta"]

    for i in range(n):
        for j in range(n):
            if j == i:
                continue
            for k in range(n):
                if k == i or k == j:
                    continue
                prob = float(trifecta_probs[i, j, k])
                if prob <= 0:
                    continue
                payoff = estimate_exotic_payoff(prob, takeout)

                combos.append(RankedCombo(
                    positions=(i, j, k),
                    horse_names=(horse_names[i], horse_names[j], horse_names[k]),
                    program_numbers=(program_numbers[i], program_numbers[j], program_numbers[k]),
                    probability=prob,
                    estimated_payoff=round(payoff, 2),
                    unit_cost=unit,
                    rank=0,
                    above_cutoff=prob >= min_prob,
                ))

    combos.sort(key=lambda c: c.probability, reverse=True)
    combos = combos[:max_combos]

    cutoff_rank = len(combos)
    for i, c in enumerate(combos):
        c.rank = i + 1
        if not c.above_cutoff and cutoff_rank == len(combos):
            cutoff_rank = i + 1

    above = [c for c in combos if c.above_cutoff]

    return RankedExoticList(
        bet_type="trifecta",
        unit_cost=unit,
        combos=combos,
        cutoff_rank=cutoff_rank,
        total_above_cutoff=len(above),
        total_cost_above_cutoff=round(len(above) * unit, 2),
    )


def rank_superfectas(
    superfecta_probs: dict[tuple[int, ...], float],
    horse_names: list[str],
    program_numbers: list[str],
    takeout: float = 0.22,
    min_prob: float = 0.001,
    max_combos: int = 100,
) -> RankedExoticList:
    """Rank all superfecta combinations by probability.

    Args:
        superfecta_probs: Dict mapping (i, j, k, l) tuples to probabilities.
        min_prob: Minimum probability cutoff. Default 0.1% for superfectas.
        max_combos: Max combos to return (keeps memory bounded for large fields).
    """
    combos = []
    unit = UNIT_COSTS["superfecta"]

    for combo_key, prob in superfecta_probs.items():
        if prob <= 0:
            continue
        payoff = estimate_exotic_payoff(prob, takeout)
        c1, c2, c3, c4 = combo_key

        combos.append(RankedCombo(
            positions=combo_key,
            horse_names=(horse_names[c1], horse_names[c2],
                         horse_names[c3], horse_names[c4]),
            program_numbers=(program_numbers[c1], program_numbers[c2],
                             program_numbers[c3], program_numbers[c4]),
            probability=prob,
            estimated_payoff=round(payoff, 2),
            unit_cost=unit,
            rank=0,
            above_cutoff=prob >= min_prob,
        ))

    combos.sort(key=lambda c: c.probability, reverse=True)
    combos = combos[:max_combos]

    cutoff_rank = len(combos)
    for i, c in enumerate(combos):
        c.rank = i + 1
        if not c.above_cutoff and cutoff_rank == len(combos):
            cutoff_rank = i + 1

    above = [c for c in combos if c.above_cutoff]

    return RankedExoticList(
        bet_type="superfecta",
        unit_cost=unit,
        combos=combos,
        cutoff_rank=cutoff_rank,
        total_above_cutoff=len(above),
        total_cost_above_cutoff=round(len(above) * unit, 2),
    )
