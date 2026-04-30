"""Race entropy — measures uncertainty of the win probability distribution.

Higher entropy = more open/uncertain race (good for spreading exotics).
Lower entropy = dominant favorite (good for singling in horizontals).

Used by the horizontal exotic sequencer to decide which legs to
spread vs single.
"""

from __future__ import annotations

import numpy as np


def race_entropy(win_probs: np.ndarray) -> float:
    """Shannon entropy of win probability distribution.

    Args:
        win_probs: Array of win probabilities (should sum to ~1.0).

    Returns:
        Entropy in bits. 0 = certainty, log2(n) = uniform.
    """
    p = win_probs[win_probs > 0]
    return float(-np.sum(p * np.log2(p)))


def max_entropy(n: int) -> float:
    """Maximum possible entropy for an n-horse field (uniform distribution)."""
    if n <= 1:
        return 0.0
    return float(np.log2(n))


def normalized_entropy(win_probs: np.ndarray) -> float:
    """Entropy normalized to [0, 1] range.

    0.0 = one horse is certain to win.
    1.0 = all horses equally likely.
    """
    n = len(win_probs)
    max_ent = max_entropy(n)
    if max_ent == 0:
        return 0.0
    return race_entropy(win_probs) / max_ent
