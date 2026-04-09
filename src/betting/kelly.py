"""Kelly criterion sizing for exotic bets.

Exotic bets (exacta, trifecta, superfecta, pick N) require different
treatment than win bets because:
1. Payoffs are estimated from combo probability (no live pool data)
2. Multiple tickets on the same race are correlated — if the anchor
   loses, all keyed tickets lose. Total exposure must be capped as
   a single correlated bet, not summed individually.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class SizedTicket:
    """A ticket with Kelly-computed stake."""

    combo: tuple
    bet_type: str
    probability: float
    estimated_payoff: float
    ev: float
    kelly_fraction: float
    stake: float


def estimate_exotic_payoff(combo_prob: float, takeout: float = 0.22) -> float:
    """Estimate exotic payoff from combo probability.

    Without live pool data, assumes the pool is bet proportional to
    true probabilities. This overstates payoffs for favorites and
    understates for longshots — a known limitation.

    Returns estimated payoff per $1 wagered.
    """
    if combo_prob <= 0:
        return 0.0
    return (1.0 / combo_prob) * (1.0 - takeout)


def kelly_exotic(
    combo_prob: float,
    estimated_payoff: float,
    fraction: float = 0.25,
) -> float:
    """Calculate fractional Kelly stake for an exotic bet.

    Args:
        combo_prob: Probability of this exact combination hitting.
        estimated_payoff: Estimated payoff per $1 wagered.
        fraction: Kelly fraction (0.25 = quarter Kelly).

    Returns:
        Recommended stake as fraction of bankroll.
    """
    if estimated_payoff <= 0 or combo_prob <= 0:
        return 0.0
    b = estimated_payoff - 1.0  # net odds
    p = combo_prob
    q = 1.0 - p
    if b <= 0:
        return 0.0
    full_kelly = (b * p - q) / b
    return max(0.0, full_kelly * fraction)


def allocate_bankroll(
    tickets: list[SizedTicket],
    bankroll: float,
    max_race_pct: float = 0.10,
) -> list[SizedTicket]:
    """Allocate bankroll across correlated exotic tickets.

    All tickets keyed on the same anchor are correlated — if the
    anchor loses, they all lose. So total exposure is capped at
    max_race_pct of bankroll, then distributed by relative Kelly weight.

    Args:
        tickets: List of SizedTicket with kelly_fraction populated.
        bankroll: Total bankroll in dollars.
        max_race_pct: Maximum fraction of bankroll for one race (default 10%).

    Returns:
        Tickets with stake field populated.
    """
    if not tickets or bankroll <= 0:
        return tickets

    max_stake = bankroll * max_race_pct
    total_kelly = sum(t.kelly_fraction for t in tickets)

    if total_kelly <= 0:
        for t in tickets:
            t.stake = 0.0
        return tickets

    # Distribute proportionally, capped at max
    raw_total = total_kelly * bankroll
    scale = min(1.0, max_stake / raw_total) if raw_total > 0 else 0.0

    for t in tickets:
        t.stake = round(t.kelly_fraction * bankroll * scale, 2)

    return tickets
