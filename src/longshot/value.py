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
from src.models.monte_carlo import SimulationResult


def kelly_fraction(
    win_prob: float,
    odds: float,
    fraction: float = 0.25,
    takeout: float = 0.17,
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


def expected_value(win_prob: float, odds: float, takeout: float = 0.17) -> float:
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


def compute_exotic_evpd(
    sim: SimulationResult,
    odds: np.ndarray,
    takeout: dict[str, float],
) -> dict[str, list[dict]]:
    """Compute Expected Value Per Dollar for each exotic combo.

    Uses odds-based approximation to estimate payoffs:
    - combo_implied_prob derived from individual horse implied probs
    - estimated_payoff = (1 / combo_implied_prob) * (1 - takeout)
    - evpd = sim_prob * estimated_payoff

    Args:
        sim: SimulationResult from henery_simulate.
        odds: Market odds array (decimal format, e.g. 5.0 for 5/1).
        takeout: Dict mapping exotic type to takeout rate,
                 e.g. {"exacta": 0.19, "trifecta": 0.235, "superfecta": 0.25}.

    Returns:
        Dict with keys "exacta", "trifecta", "superfecta", each mapping
        to a list of top-20 combos sorted by EVPD descending.
    """
    n = len(odds)
    # Normalize implied probs (remove vig)
    raw_implied = 1.0 / (odds + 1.0)
    implied = raw_implied / raw_implied.sum()

    results: dict[str, list[dict]] = {
        "exacta": [],
        "trifecta": [],
        "superfecta": [],
    }

    # Exacta EVPD
    exacta_takeout = takeout.get("exacta", 0.19)
    exacta_combos = []
    for i in range(n):
        for j in range(n):
            if i == j:
                continue
            sim_prob = float(sim.exacta_probs[i, j])
            if sim_prob <= 0:
                continue
            # Conditional implied prob: P(i wins) * P(j 2nd | i wins)
            cond_j = implied[j] / (1.0 - implied[i]) if implied[i] < 1.0 else 0.0
            combo_implied = float(implied[i]) * cond_j
            if combo_implied <= 0:
                continue
            est_payoff = (1.0 / combo_implied) * (1.0 - exacta_takeout)
            evpd = sim_prob * est_payoff
            exacta_combos.append({
                "combo": (i, j),
                "sim_prob": round(sim_prob, 6),
                "implied_prob": round(combo_implied, 6),
                "estimated_payoff": round(est_payoff, 2),
                "evpd": round(evpd, 4),
            })
    exacta_combos.sort(key=lambda x: x["evpd"], reverse=True)
    results["exacta"] = exacta_combos[:20]

    # Trifecta EVPD
    trifecta_takeout = takeout.get("trifecta", 0.235)
    trifecta_combos = []
    for i in range(n):
        for j in range(n):
            if j == i:
                continue
            for k in range(n):
                if k == i or k == j:
                    continue
                sim_prob = float(sim.trifecta_probs[i, j, k])
                if sim_prob <= 0:
                    continue
                # Conditional chain: P(i) * P(j|i) * P(k|i,j)
                denom_j = 1.0 - implied[i]
                denom_k = 1.0 - implied[i] - implied[j]
                if denom_j <= 0 or denom_k <= 0:
                    continue
                combo_implied = float(implied[i]) * (implied[j] / denom_j) * (implied[k] / denom_k)
                if combo_implied <= 0:
                    continue
                est_payoff = (1.0 / combo_implied) * (1.0 - trifecta_takeout)
                evpd = sim_prob * est_payoff
                trifecta_combos.append({
                    "combo": (i, j, k),
                    "sim_prob": round(sim_prob, 6),
                    "implied_prob": round(combo_implied, 6),
                    "estimated_payoff": round(est_payoff, 2),
                    "evpd": round(evpd, 4),
                })
    trifecta_combos.sort(key=lambda x: x["evpd"], reverse=True)
    results["trifecta"] = trifecta_combos[:20]

    # Superfecta EVPD
    if sim.superfecta_probs:
        super_takeout = takeout.get("superfecta", 0.25)
        super_combos = []
        for combo_key, sim_prob in sim.superfecta_probs.items():
            if sim_prob <= 0:
                continue
            i, j, k, m = combo_key
            denom_j = 1.0 - implied[i]
            denom_k = 1.0 - implied[i] - implied[j]
            denom_m = 1.0 - implied[i] - implied[j] - implied[k]
            if denom_j <= 0 or denom_k <= 0 or denom_m <= 0:
                continue
            combo_implied = (
                float(implied[i])
                * (implied[j] / denom_j)
                * (implied[k] / denom_k)
                * (implied[m] / denom_m)
            )
            if combo_implied <= 0:
                continue
            est_payoff = (1.0 / combo_implied) * (1.0 - super_takeout)
            evpd = sim_prob * est_payoff
            super_combos.append({
                "combo": combo_key,
                "sim_prob": round(sim_prob, 6),
                "implied_prob": round(combo_implied, 6),
                "estimated_payoff": round(est_payoff, 2),
                "evpd": round(evpd, 4),
            })
        super_combos.sort(key=lambda x: x["evpd"], reverse=True)
        results["superfecta"] = super_combos[:20]

    return results
