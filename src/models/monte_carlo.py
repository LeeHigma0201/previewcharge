"""Monte Carlo simulation using the Henery (normal) model.

Converts win probabilities into full finish-order distributions for
exotic bet pricing (exacta, trifecta, Pick 3, etc.).

The Henery model (1981) assumes normally distributed running times,
which fits empirical data better than the Harville (exponential) model.
Harville overestimates favorites in top-3 positions; Henery corrects this.

Key insight from Benter: exotic bets amplify probability advantages
multiplicatively. Two horses with 10% model-vs-public advantage can
produce 30%+ advantage on exacta/trifecta wagers.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np
from scipy.stats import norm


@dataclass
class SimulationResult:
    """Results from Monte Carlo simulation."""

    win_probs: np.ndarray  # P(horse i wins)
    place_probs: np.ndarray  # P(horse i finishes top 2)
    show_probs: np.ndarray  # P(horse i finishes top 3)
    exacta_probs: np.ndarray  # P(horse i wins, horse j places) — shape (n, n)
    trifecta_probs: np.ndarray  # P(i, j, k) — shape (n, n, n)
    finish_matrix: np.ndarray  # P(horse i finishes in position j) — shape (n, n)
    superfecta_probs: np.ndarray | None = None  # P(i, j, k, l) — shape (n, n, n, n)


def henery_simulate(
    win_probs: np.ndarray,
    n_simulations: int = 100_000,
    seed: int | None = None,
    compute_superfecta: bool = False,
) -> SimulationResult:
    """Run Monte Carlo simulation using the Henery (normal) model.

    Args:
        win_probs: Array of win probabilities (must sum to 1.0).
        n_simulations: Number of simulations (100k = ~1s for 12-horse field).
        seed: Random seed for reproducibility.
        compute_superfecta: If True, compute 4D superfecta probability tensor.

    Returns:
        SimulationResult with full finish-order distributions.
    """
    rng = np.random.default_rng(seed)
    n_horses = len(win_probs)

    # Ensure valid probabilities
    win_probs = np.clip(win_probs, 1e-6, 1.0)
    win_probs = win_probs / win_probs.sum()

    # Convert win probs to ability scores via probit (inverse normal CDF).
    # Henery (1981) assumes normally-distributed finishing times, so the
    # correct transform is Φ⁻¹(p), not logit. Logit has heavier tails
    # (~1.7x scale factor) which overestimates separation between horses
    # at the extremes, distorting exotic bet pricing.
    abilities = norm.ppf(win_probs)

    # Henery model: simulate normally distributed "finishing times"
    # time_i = -ability_i + noise_i, noise ~ N(0, 1)
    noise = rng.standard_normal((n_simulations, n_horses))
    times = -abilities[np.newaxis, :] + noise

    # Rank horses by simulated times (lower = better)
    rankings = np.argsort(times, axis=1)  # shape: (n_sims, n_horses)

    # Build finish matrix: P(horse i finishes in position j)
    finish_matrix = np.zeros((n_horses, n_horses))
    for pos in range(n_horses):
        for horse in range(n_horses):
            finish_matrix[horse, pos] = np.mean(rankings[:, pos] == horse)

    # Win/place/show probabilities
    win_probs_sim = finish_matrix[:, 0]
    place_probs = finish_matrix[:, 0] + finish_matrix[:, 1]
    show_probs = finish_matrix[:, 0] + finish_matrix[:, 1] + finish_matrix[:, 2]

    # Exacta: P(horse i wins AND horse j places)
    exacta_probs = np.zeros((n_horses, n_horses))
    winners = rankings[:, 0]
    runners_up = rankings[:, 1]
    for i in range(n_horses):
        for j in range(n_horses):
            if i != j:
                exacta_probs[i, j] = np.mean((winners == i) & (runners_up == j))

    # Trifecta: P(i first, j second, k third)
    trifecta_probs = np.zeros((n_horses, n_horses, n_horses))
    thirds = rankings[:, 2]
    for i in range(n_horses):
        mask_i = winners == i
        for j in range(n_horses):
            if j == i:
                continue
            mask_ij = mask_i & (runners_up == j)
            for k in range(n_horses):
                if k == i or k == j:
                    continue
                trifecta_probs[i, j, k] = np.mean(mask_ij & (thirds == k))

    # Superfecta: P(i first, j second, k third, l fourth)
    superfecta_probs = None
    if compute_superfecta and n_horses >= 4:
        fourths = rankings[:, 3]
        superfecta_probs = np.zeros((n_horses, n_horses, n_horses, n_horses))
        for i in range(n_horses):
            mask_i = winners == i
            for j in range(n_horses):
                if j == i:
                    continue
                mask_ij = mask_i & (runners_up == j)
                for k in range(n_horses):
                    if k == i or k == j:
                        continue
                    mask_ijk = mask_ij & (thirds == k)
                    for l in range(n_horses):
                        if l == i or l == j or l == k:
                            continue
                        superfecta_probs[i, j, k, l] = np.mean(
                            mask_ijk & (fourths == l)
                        )

    return SimulationResult(
        win_probs=win_probs_sim,
        place_probs=place_probs,
        show_probs=show_probs,
        exacta_probs=exacta_probs,
        trifecta_probs=trifecta_probs,
        finish_matrix=finish_matrix,
        superfecta_probs=superfecta_probs,
    )


def compute_superfecta_for_anchor(
    win_probs: np.ndarray,
    anchor_idx: int,
    n_simulations: int = 100_000,
    seed: int | None = None,
) -> np.ndarray:
    """Compute superfecta probs only for combinations where anchor wins.

    Much faster than full 4D tensor — O(n^3) instead of O(n^4).
    Returns shape (n, n, n) where result[j, k, l] = P(anchor 1st, j 2nd, k 3rd, l 4th).
    """
    rng = np.random.default_rng(seed)
    n_horses = len(win_probs)
    win_probs = np.clip(win_probs, 1e-6, 1.0)
    win_probs = win_probs / win_probs.sum()

    abilities = norm.ppf(win_probs)
    noise = rng.standard_normal((n_simulations, n_horses))
    times = -abilities[np.newaxis, :] + noise
    rankings = np.argsort(times, axis=1)

    winners = rankings[:, 0]
    runners_up = rankings[:, 1]
    thirds = rankings[:, 2]
    fourths = rankings[:, 3]

    mask_anchor = winners == anchor_idx
    result = np.zeros((n_horses, n_horses, n_horses))
    for j in range(n_horses):
        if j == anchor_idx:
            continue
        mask_j = mask_anchor & (runners_up == j)
        for k in range(n_horses):
            if k == anchor_idx or k == j:
                continue
            mask_jk = mask_j & (thirds == k)
            for l in range(n_horses):
                if l == anchor_idx or l == j or l == k:
                    continue
                result[j, k, l] = np.mean(mask_jk & (fourths == l))

    return result


def discounted_harville(
    win_probs: np.ndarray,
    discount_place: float = 0.85,
    discount_show: float = 0.80,
) -> tuple[np.ndarray, np.ndarray]:
    """Discounted Harville model (Ziemba et al.) for cross-validation.

    Standard Harville assumes conditional independence of finish positions
    given abilities (exponential model). This overestimates favorites in
    place/show. The discount factors (Stern 1990, Lo & Bacon-Shone 1994)
    dampen the favorite bias by raising probabilities to a power < 1
    when computing conditional probabilities.

    Returns:
        Tuple of (place_probs, show_probs).
    """
    n = len(win_probs)
    place_probs = np.zeros(n)
    show_probs = np.zeros(n)

    # Place probability: P(i finishes top 2) = sum over all possible winners j
    # P(j wins) * P(i second | j wins)
    # where P(i second | j wins) = p_i^d / sum_{k != j} p_k^d
    for i in range(n):
        for j in range(n):
            if j == i:
                # If i wins, i is automatically in top 2
                place_probs[i] += win_probs[j]
            else:
                # P(j wins) * P(i places | j won)
                denom = sum(win_probs[k] ** discount_place for k in range(n) if k != j)
                if denom > 0:
                    place_probs[i] += win_probs[j] * (win_probs[i] ** discount_place) / denom

    # Show probability: P(i finishes top 3) = sum over all (winner, second) pairs
    for i in range(n):
        for j in range(n):
            # j wins
            denom_2nd = sum(win_probs[k] ** discount_place for k in range(n) if k != j)
            if denom_2nd <= 0:
                continue
            for m in range(n):
                if m == j:
                    continue
                # m finishes second given j won
                p_m_second = win_probs[j] * (win_probs[m] ** discount_place) / denom_2nd

                if i == j or i == m:
                    # i is already in top 2
                    show_probs[i] += p_m_second
                else:
                    # P(i third | j won, m second)
                    denom_3rd = sum(
                        win_probs[k] ** discount_show for k in range(n) if k != j and k != m
                    )
                    if denom_3rd > 0:
                        show_probs[i] += p_m_second * (win_probs[i] ** discount_show) / denom_3rd

    # Normalize to correct number of placers
    if place_probs.sum() > 0:
        place_probs = place_probs / place_probs.sum() * min(2.0, n)
    if show_probs.sum() > 0:
        show_probs = show_probs / show_probs.sum() * min(3.0, n)

    return place_probs, show_probs


def find_value_exotics(
    sim: SimulationResult,
    pool_payoffs: dict[tuple, float] | None = None,
    min_ev: float = 1.10,
) -> list[dict]:
    """Find exotic bets where model probability implies EV > min_ev.

    Args:
        sim: SimulationResult from henery_simulate.
        pool_payoffs: Dict mapping (finish order tuple) to pool payoff amount.
                      e.g. {(3, 7): 45.60} means 3-7 exacta pays $45.60.
        min_ev: Minimum expected value threshold (1.10 = 10% edge).

    Returns:
        List of value bets with EV, probability, and suggested stake.
    """
    if pool_payoffs is None:
        return []

    value_bets = []
    for combo, payoff in pool_payoffs.items():
        if len(combo) == 2:
            i, j = combo
            prob = sim.exacta_probs[i, j]
        elif len(combo) == 3:
            i, j, k = combo
            prob = sim.trifecta_probs[i, j, k]
        else:
            continue

        ev = prob * payoff
        if ev > min_ev:
            value_bets.append({
                "combo": combo,
                "probability": prob,
                "payoff": payoff,
                "ev": ev,
                "overlay_pct": (ev - 1.0) * 100,
            })

    return sorted(value_bets, key=lambda x: x["ev"], reverse=True)
