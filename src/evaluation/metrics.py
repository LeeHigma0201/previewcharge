"""Evaluation metrics for HorseGPT models.

Brier score and ROI are the primary metrics — not raw accuracy.
A 25%-accurate model identifying undervalued horses can profit,
while a 40%-accurate model backing low-odds favorites loses money.
"""

from __future__ import annotations

import numpy as np
import pandas as pd


def brier_score(y_true: np.ndarray, y_pred: np.ndarray) -> float:
    """Brier score — primary calibration metric.

    Lower is better. Measures how well predicted probabilities
    match actual outcomes. Range [0, 1].
    """
    return float(np.mean((y_pred - y_true) ** 2))


def log_loss(y_true: np.ndarray, y_pred: np.ndarray, eps: float = 1e-15) -> float:
    """Log loss (cross-entropy)."""
    y_pred = np.clip(y_pred, eps, 1 - eps)
    return float(-np.mean(y_true * np.log(y_pred) + (1 - y_true) * np.log(1 - y_pred)))


def delta_r_squared(
    y_true: np.ndarray,
    model_probs: np.ndarray,
    market_probs: np.ndarray,
) -> float:
    """ΔR² over public odds — Benter's key metric.

    Measures how much additional information the model provides
    beyond what the market already prices in. Even ΔR² = 0.0178
    was sufficient for massive profitability.
    """
    ss_market = np.sum((y_true - market_probs) ** 2)
    ss_model = np.sum((y_true - model_probs) ** 2)

    if ss_market == 0:
        return 0.0
    return float(1 - ss_model / ss_market)


def simulated_roi(
    predictions: pd.DataFrame,
    stake: float = 2.0,
    min_edge: float = 0.05,
) -> dict[str, float]:
    """Simulate ROI from flat-stake betting on model selections.

    Args:
        predictions: DataFrame with columns: win_prob, final_odds, finish_position.
        stake: Bet amount per selection.
        min_edge: Minimum model probability edge over market to trigger a bet.

    Returns:
        Dict with roi, total_wagered, total_returned, num_bets, win_rate.
    """
    df = predictions.copy()
    df["implied_prob"] = 1.0 / (df["final_odds"] + 1.0)
    df["edge"] = df["win_prob"] - df["implied_prob"]

    # Only bet when we have sufficient edge
    bets = df[df["edge"] >= min_edge]

    if bets.empty:
        return {
            "roi": 0.0,
            "total_wagered": 0.0,
            "total_returned": 0.0,
            "num_bets": 0,
            "win_rate": 0.0,
        }

    total_wagered = len(bets) * stake
    winners = bets[bets["finish_position"] == 1]
    total_returned = float((winners["final_odds"] * stake + stake).sum())
    num_wins = len(winners)

    return {
        "roi": (total_returned - total_wagered) / total_wagered if total_wagered > 0 else 0.0,
        "total_wagered": total_wagered,
        "total_returned": total_returned,
        "num_bets": len(bets),
        "win_rate": num_wins / len(bets) if len(bets) > 0 else 0.0,
    }


def accuracy_at_k(y_true: np.ndarray, y_pred: np.ndarray, k: int = 1) -> float:
    """Top-k accuracy: was the winner in the model's top k picks?"""
    top_k_indices = np.argsort(y_pred)[-k:]
    winner_idx = np.argmax(y_true)
    return float(winner_idx in top_k_indices)
