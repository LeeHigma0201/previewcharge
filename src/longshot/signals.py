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
    capable: bool = True


def capable_longshot_filter(
    candidate: LongshotCandidate,
    best_beyer: float | None,
    beyer_trend: float | None,
    days_since_last: float | None,
    trainer_layoff_win_pct: float | None,
    sim_win_pct: float,
    pace_scenario_favorable: bool,
    race_class_par: float = 80.0,
) -> tuple[bool, list[str]]:
    """5-point filter for capable longshots. All 5 must pass.

    Returns:
        Tuple of (is_capable, list of failure reasons).
    """
    failures: list[str] = []

    # 1. Has run a competitive figure
    if best_beyer is None or best_beyer < race_class_par - 5:
        failures.append(
            f"best_beyer {best_beyer} < par-5 ({race_class_par - 5})"
        )

    # 2. Not declining
    if beyer_trend is None or beyer_trend < 0:
        failures.append(f"beyer_trend {beyer_trend} < 0 (declining)")

    # 3. Recent activity or trainer overcomes layoff
    if days_since_last is not None and days_since_last > 90:
        if trainer_layoff_win_pct is None or trainer_layoff_win_pct < 0.15:
            failures.append(
                f"layoff {days_since_last:.0f}d with trainer_layoff_win_pct "
                f"{trainer_layoff_win_pct} < 0.15"
            )
    elif days_since_last is None:
        failures.append("days_since_last unknown")

    # 4. Monte Carlo gives real chance
    if sim_win_pct < 0.08:
        failures.append(f"sim_win_pct {sim_win_pct:.3f} < 0.08")

    # 5. Pace scenario matches running style
    if not pace_scenario_favorable:
        failures.append("pace_scenario not favorable")

    return len(failures) == 0, failures


def identify_longshot_candidates(
    entry_ids: list[int],
    horse_names: list[str],
    model_probs: np.ndarray,
    market_odds: np.ndarray,
    min_odds: float = 5.0,
    min_overlay_ev: float = 1.10,
    takeout: float = 0.17,
    entry_features: dict[int, dict] | None = None,
    sim_win_probs: np.ndarray | None = None,
    pace_favorable: dict[int, bool] | None = None,
    race_class_par: float = 80.0,
    trainer_layoff_win_pcts: dict[int, float] | None = None,
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

        candidate = LongshotCandidate(
            entry_id=entry_ids[i],
            horse_name=horse_names[i],
            model_prob=model_probs[i],
            implied_prob=implied_probs[i],
            overlay_pct=overlay_pct,
            ev=ev,
            kelly_fraction=kelly,
            recommended_stake_pct=kelly * 0.25,  # Fractional Kelly (25%)
        )

        # Run capable longshot filter if feature data is available
        if entry_features is not None:
            feats = entry_features.get(entry_ids[i], {})
            swp = float(sim_win_probs[i]) if sim_win_probs is not None else 0.0
            pf = (pace_favorable or {}).get(entry_ids[i], False)
            tlwp = (trainer_layoff_win_pcts or {}).get(entry_ids[i])

            is_capable, reasons = capable_longshot_filter(
                candidate,
                best_beyer=feats.get("best_beyer"),
                beyer_trend=feats.get("beyer_trend"),
                days_since_last=feats.get("days_since_last"),
                trainer_layoff_win_pct=tlwp,
                sim_win_pct=swp,
                pace_scenario_favorable=pf,
                race_class_par=race_class_par,
            )
            candidate.capable = is_capable
            if not is_capable:
                candidate.signals.append(LongshotSignal(
                    name="capable_filter",
                    weight=0.0,
                    active=False,
                    detail=f"Failed: {'; '.join(reasons)}",
                ))

        candidates.append(candidate)

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
