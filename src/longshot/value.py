"""Expected value calculation and Kelly staking for longshot bets.

Never use full Kelly — Benter warned that overestimating advantage
by 2x causes negative capital growth. Use fractional Kelly (25-50%)
and cap maximum stake at 1-2% of bankroll per longshot.

Longshot picks deploy primarily into exotic pools where multiplicative
advantages compound.
"""

from __future__ import annotations

import numpy as np

from src.longshot.signals import LongshotCandidate


def kelly_fraction(
    win_prob: float,
    odds: float,
    fraction: float = 0.25,
    takeout: float = 0.0,
) -> float:
    """Calculate fractional Kelly stake, adjusted for track takeout.

    Full Kelly: f* = ((1-τ)·b·p - q) / ((1-τ)·b)
    where b = net odds, p = win prob, q = 1 - p, τ = track takeout.

    Without takeout adjustment (τ=0.15-0.22 in North American racing),
    Kelly stakes are systematically too large and EV is overstated.

    Args:
        win_prob: Model's estimated win probability.
        odds: Decimal odds (e.g. 10.0 for 10/1).
        fraction: Kelly fraction (0.25 = quarter Kelly).
        takeout: Track takeout rate (0.17 = 17% typical win pool).

    Returns:
        Recommended stake as fraction of bankroll.
    """
    net_b = odds * (1.0 - takeout)
    p = win_prob
    q = 1.0 - p
    full_kelly = (net_b * p - q) / net_b if net_b > 0 else 0.0
    return max(0.0, full_kelly * fraction)


def expected_value(win_prob: float, odds: float, takeout: float = 0.0) -> float:
    """Calculate expected value of a $1 bet, net of track takeout.

    EV > 1.0 means positive expectation. Without takeout adjustment,
    EV is overstated by 15-22% for North American tracks.
    """
    net_payout = (odds + 1.0) * (1.0 - takeout)
    return win_prob * net_payout


def calculate_exotic_ev(
    combo_prob: float,
    payoff: float,
    cost: float = 1.0,
) -> float:
    """Calculate EV for an exotic bet (exacta, trifecta, etc.).

    Args:
        combo_prob: Probability of the exact finish order.
        payoff: Pool payoff for this combination.
        cost: Cost of the bet (typically $1 or $2).
    """
    return (combo_prob * payoff) / cost


def rank_value_plays(
    candidates: list[LongshotCandidate],
    bankroll: float,
    max_stake_pct: float = 0.02,
) -> list[dict]:
    """Rank and size longshot plays.

    Applies bankroll management rules:
    - Max 2% of bankroll per play
    - Fractional Kelly sizing
    - Signal score weighting

    Returns sorted list of recommended plays.
    """
    plays = []

    for c in candidates:
        if c.ev < 1.10:  # Minimum 10% edge
            continue

        stake_pct = min(c.recommended_stake_pct, max_stake_pct)
        stake_amount = bankroll * stake_pct

        plays.append({
            "horse_name": c.horse_name,
            "entry_id": c.entry_id,
            "model_prob": c.model_prob,
            "market_odds": 1.0 / c.implied_prob - 1.0 if c.implied_prob > 0 else 0,
            "overlay_pct": c.overlay_pct,
            "ev": c.ev,
            "signal_score": c.signal_score,
            "kelly_fraction": c.kelly_fraction,
            "stake_pct": stake_pct,
            "stake_amount": round(stake_amount, 2),
            "signals": [
                {"name": s.name, "detail": s.detail}
                for s in c.signals if s.active
            ],
        })

    return sorted(plays, key=lambda p: p["ev"], reverse=True)
