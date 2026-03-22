"""Probability calibration for HorseGPT models.

Calibration is critical at the tails (0-15% probability range)
where longshots live. Standard models are least accurate here.

Phase 2: Implement isotonic regression and Platt scaling.
"""

from __future__ import annotations

import numpy as np


def calibration_bins(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    n_bins: int = 20,
) -> dict[str, np.ndarray]:
    """Compute calibration data in probability bins.

    Returns dict with bin_centers, bin_true_rates, bin_counts
    for plotting calibration curves.
    """
    bin_edges = np.linspace(0, 1, n_bins + 1)
    bin_centers = (bin_edges[:-1] + bin_edges[1:]) / 2
    bin_true_rates = np.zeros(n_bins)
    bin_counts = np.zeros(n_bins)

    for i in range(n_bins):
        mask = (y_pred >= bin_edges[i]) & (y_pred < bin_edges[i + 1])
        if mask.sum() > 0:
            bin_true_rates[i] = y_true[mask].mean()
            bin_counts[i] = mask.sum()

    return {
        "bin_centers": bin_centers,
        "bin_true_rates": bin_true_rates,
        "bin_counts": bin_counts,
    }


def apply_isotonic_calibration(
    y_true: np.ndarray, y_pred: np.ndarray, y_new: np.ndarray
) -> np.ndarray:
    """Apply isotonic regression calibration.

    TODO (Phase 2): Full implementation with sklearn IsotonicRegression.
    """
    from sklearn.isotonic import IsotonicRegression

    ir = IsotonicRegression(out_of_bounds="clip")
    ir.fit(y_pred, y_true)
    return ir.predict(y_new)
