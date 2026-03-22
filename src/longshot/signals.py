"""Longshot signal stack framework.

The favorite-longshot bias is one of the most documented anomalies
in financial markets. Snowberg & Wolfers (5.6M races, 1992-2001)
showed 100/1+ longshots yield -61% returns, while 1/1 favorites
lose only -5% to -15%. The bias is driven by probability misperception,
not risk-love — meaning it represents genuine mispricing.

4-layer architecture:
  Layer 1: Base probability model (Benter odds-offset)
  Layer 2: Longshot flag engine (overlay detection)
  Layer 3: Angle signal aggregation (8-10 binary/weighted signals)
  Layer 4: Value assessment and staking (EV, Kelly fraction)
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np


@dataclass
class LongshotSignal:
    """A single signal that may indicate longshot value."""

    name: str
    weight: float  # Signal importance weight
    active: bool  # Whether this signal fires for this horse
    detail: str = ""  # Human-readable explanation


@dataclass
class LongshotCandidate:
    """A horse flagged as a potential longshot play."""

    entry_id: int
    horse_name: str
    model_prob: float
    implied_prob: float
    overlay_pct: float
    signals: list[LongshotSignal] = field(default_factory=list)
    signal_score: float = 0.0
    ev: float = 0.0
    kelly_fraction: float = 0.0
    recommended_stake_pct: float = 0.0


def identify_longshot_candidates(
    entry_ids: list[int],
    horse_names: list[str],
    model_probs: np.ndarray,
    market_odds: np.ndarray,
    min_odds: float = 5.0,
    min_overlay_ev: float = 1.10,
    takeout: float = 0.17,
) -> list[LongshotCandidate]:
    """Layer 2: Flag horses where model sees more value than the market.

    Args:
        entry_ids: Database entry IDs.
        horse_names: Horse names for display.
        model_probs: Model-predicted win probabilities.
        market_odds: Public odds (decimal).
        min_odds: Minimum odds to consider as longshot (default 5/1).
        min_overlay_ev: Minimum EV threshold (1.10 = 10% edge).

    Returns:
        List of LongshotCandidate objects, sorted by overlay.
    """
    candidates = []
    implied_probs = 1.0 / (market_odds + 1.0)

    for i in range(len(entry_ids)):
        if market_odds[i] < min_odds:
            continue

        overlay = model_probs[i] / (implied_probs[i] + 1e-10)
        if overlay < min_overlay_ev:
            continue

        ev = model_probs[i] * (market_odds[i] + 1.0) * (1.0 - takeout)
        overlay_pct = (overlay - 1.0) * 100

        # Kelly criterion adjusted for track takeout:
        # f* = ((1-τ)·b·p - q) / ((1-τ)·b)
        net_b = market_odds[i] * (1.0 - takeout)
        p = model_probs[i]
        q = 1 - p
        kelly = (net_b * p - q) / net_b if net_b > 0 else 0
        kelly = max(0, kelly)

        candidates.append(LongshotCandidate(
            entry_id=entry_ids[i],
            horse_name=horse_names[i],
            model_prob=model_probs[i],
            implied_prob=implied_probs[i],
            overlay_pct=overlay_pct,
            ev=ev,
            kelly_fraction=kelly,
            recommended_stake_pct=kelly * 0.25,  # Fractional Kelly (25%)
        ))

    return sorted(candidates, key=lambda c: c.overlay_pct, reverse=True)


def compute_signal_score(candidate: LongshotCandidate) -> float:
    """Layer 3: Aggregate signal scores for a longshot candidate."""
    if not candidate.signals:
        return 0.0

    total_weight = sum(s.weight for s in candidate.signals)
    if total_weight == 0:
        return 0.0

    active_weight = sum(s.weight for s in candidate.signals if s.active)
    return active_weight / total_weight
