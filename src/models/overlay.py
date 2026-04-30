"""Stage 2: Overlay detection — where odds meet predictions.

The Benter two-stage architecture:
  Stage 1: Fundamental model predicts finishing order from horse data ONLY.
            No odds, no market opinion. Pure performance analysis.
  Stage 2: THIS MODULE. Compare Stage 1 predictions to market odds.
            Find where the public is wrong. That's where the money is.

The key insight (Benter 1994, confirmed by every profitable CAW operation):
  "The more exotic the bet, the higher the advantage."

A horse your model gives 15% win probability but the public prices at 5%
(20/1 odds) is a 3x overlay. Put that horse in superfecta/trifecta combos
and the overlay MULTIPLIES across positions. A 3x overlay in the win
becomes a 9x overlay in an exacta.

This module:
  1. Takes Stage 1 predictions (odds-free finishing order probabilities)
  2. Takes current market odds
  3. Computes overlay for every horse (where model > market)
  4. Identifies value bets in win, exotic, and horizontal pools
  5. Flags capable longshots for exotic ticket inclusion
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np


@dataclass
class OverlayResult:
    """Overlay analysis for a single horse."""

    entry_index: int
    horse_name: str
    program_number: str
    model_prob: float  # Stage 1 fundamental probability
    market_prob: float  # Implied from odds
    overlay_pct: float  # (model/market - 1) * 100 — positive = value
    edge: float  # model_prob - market_prob (raw edge)
    is_value: bool  # overlay_pct > 0
    is_longshot: bool  # market odds >= 10/1
    is_overlay_longshot: bool  # longshot AND value


@dataclass
class RaceOverlay:
    """Complete overlay analysis for a race."""

    entries: list[OverlayResult]
    predicted_order: list[int]  # Entry indices sorted by model_prob descending
    market_order: list[int]  # Entry indices sorted by market_prob descending
    order_disagreement: int  # Number of position swaps between model vs market
    max_overlay_pct: float
    n_value_horses: int
    n_overlay_longshots: int
    exotic_multiplier: float  # Product of top-3 overlays — exotic value signal


def compute_race_overlay(
    model_probs: np.ndarray,
    market_odds: np.ndarray,
    horse_names: list[str],
    program_numbers: list[str],
    longshot_threshold: float = 10.0,
) -> RaceOverlay:
    """Compare Stage 1 model predictions to market odds.

    This is the core of Stage 2. The model already predicted finishing
    order using only horse data. Now we overlay the odds to find
    where the public is sleeping.

    Args:
        model_probs: Stage 1 win probabilities (sum to 1.0, no odds input).
        market_odds: Current decimal odds (e.g., 5.0 for 5/1).
        horse_names: Names for display.
        program_numbers: Program numbers for display.
        longshot_threshold: Minimum odds to qualify as longshot (default 10/1).

    Returns:
        RaceOverlay with per-horse overlay analysis.
    """
    n = len(model_probs)
    market_probs = 1.0 / (market_odds + 1.0)
    # Normalize to remove vig (overround)
    market_probs = market_probs / market_probs.sum()

    entries = []
    for i in range(n):
        mp = float(model_probs[i])
        mkp = float(market_probs[i])
        overlay_pct = (mp / mkp - 1.0) * 100 if mkp > 0 else 0.0
        edge = mp - mkp
        is_longshot = float(market_odds[i]) >= longshot_threshold
        is_value = overlay_pct > 0

        entries.append(OverlayResult(
            entry_index=i,
            horse_name=horse_names[i],
            program_number=program_numbers[i],
            model_prob=round(mp, 4),
            market_prob=round(mkp, 4),
            overlay_pct=round(overlay_pct, 1),
            edge=round(edge, 4),
            is_value=is_value,
            is_longshot=is_longshot,
            is_overlay_longshot=is_value and is_longshot,
        ))

    # Predicted vs market finishing order
    predicted_order = list(np.argsort(model_probs)[::-1])
    market_order = list(np.argsort(market_probs)[::-1])

    # Count position disagreements (how different is our opinion?)
    disagreement = sum(
        1 for i in range(n)
        if predicted_order[i] != market_order[i]
    )

    # Exotic multiplier: product of overlay ratios for model's top 3
    # This measures how much exotic value exists in this race.
    # A race where model top-3 are all overlays = massive exotic potential.
    top3_indices = predicted_order[:min(3, n)]
    top3_ratios = []
    for idx in top3_indices:
        ratio = float(model_probs[idx]) / float(market_probs[idx]) if market_probs[idx] > 0 else 1.0
        top3_ratios.append(max(ratio, 0.01))  # floor at 0.01 to avoid zero product
    exotic_mult = 1.0
    for r in top3_ratios:
        exotic_mult *= r

    n_value = sum(1 for e in entries if e.is_value)
    n_overlay_ls = sum(1 for e in entries if e.is_overlay_longshot)
    max_overlay = max(e.overlay_pct for e in entries) if entries else 0.0

    return RaceOverlay(
        entries=sorted(entries, key=lambda e: e.overlay_pct, reverse=True),
        predicted_order=predicted_order,
        market_order=market_order,
        order_disagreement=disagreement,
        max_overlay_pct=round(max_overlay, 1),
        n_value_horses=n_value,
        n_overlay_longshots=n_overlay_ls,
        exotic_multiplier=round(exotic_mult, 3),
    )


def find_exotic_value_horses(
    overlay: RaceOverlay,
    min_overlay_pct: float = 10.0,
    include_longshots: bool = True,
) -> list[OverlayResult]:
    """Filter to horses worth including in exotic tickets.

    These are the horses where our model disagrees with the public —
    the exact horses that make exotics profitable.

    Args:
        overlay: RaceOverlay from compute_race_overlay.
        min_overlay_pct: Minimum overlay percentage to include.
        include_longshots: Always include overlay longshots regardless of threshold.

    Returns:
        List of OverlayResult sorted by overlay descending.
    """
    result = []
    for e in overlay.entries:
        if e.overlay_pct >= min_overlay_pct:
            result.append(e)
        elif include_longshots and e.is_overlay_longshot:
            result.append(e)
    return result


def format_overlay_report(overlay: RaceOverlay) -> str:
    """Format overlay analysis as a readable report."""
    lines = [
        "=" * 55,
        "STAGE 2: OVERLAY ANALYSIS — Model vs Market",
        "=" * 55,
        "",
        f"  Model/Market disagreement: {overlay.order_disagreement} positions differ",
        f"  Value horses: {overlay.n_value_horses}",
        f"  Overlay longshots: {overlay.n_overlay_longshots}",
        f"  Exotic multiplier: {overlay.exotic_multiplier:.2f}x"
        + (" ** HIGH VALUE **" if overlay.exotic_multiplier > 1.5 else ""),
        "",
        f"  {'#':<4} {'Horse':<20} {'Model':>7} {'Market':>7} {'Overlay':>8} {'Edge':>7} {'Flag':<10}",
        "  " + "-" * 63,
    ]

    for e in overlay.entries:
        flag = ""
        if e.is_overlay_longshot:
            flag = "LS+VALUE"
        elif e.is_value:
            flag = "VALUE"
        elif e.is_longshot:
            flag = "LS"

        lines.append(
            f"  #{e.program_number:<3} {e.horse_name:<20} "
            f"{e.model_prob:>6.1%} {e.market_prob:>6.1%} "
            f"{e.overlay_pct:>+7.1f}% {e.edge:>+6.1%} {flag:<10}"
        )

    lines.append("")
    lines.append("  Predicted order: " + " > ".join(
        f"#{overlay.entries[i].program_number}"
        for i in overlay.predicted_order[:5]
    ))
    lines.append("  Market order:    " + " > ".join(
        f"#{overlay.entries[i].program_number}"
        for i in overlay.market_order[:5]
    ))

    return "\n".join(lines)
