"""Walk-forward temporal validation for HorseGPT models.

Horse racing is highly temporal — any model trained on future data
produces misleadingly optimistic results. Walk-forward validation
is non-negotiable.

The approach: train on races before date T, predict on races from
T to T+window, then slide forward. Never look ahead.
"""

from __future__ import annotations

from datetime import date, timedelta

import numpy as np
import pandas as pd

from src.evaluation.metrics import brier_score, delta_r_squared, simulated_roi
from src.models.base import BaseModel


def walk_forward_cv(
    model: BaseModel,
    feature_df: pd.DataFrame,
    feature_cols: list[str],
    min_train_days: int = 180,
    test_window_days: int = 30,
    step_days: int = 30,
) -> list[dict]:
    """Walk-forward cross-validation.

    Args:
        model: HorseGPT model to evaluate.
        feature_df: Feature matrix with race_date, finish_position, final_odds.
        feature_cols: List of feature column names.
        min_train_days: Minimum training history before first test.
        test_window_days: Size of each test window.
        step_days: Step size between windows.

    Returns:
        List of dicts with per-window metrics.
    """
    if "race_date" not in feature_df.columns:
        raise ValueError("feature_df must have 'race_date' column")

    df = feature_df.sort_values("race_date")
    min_date = df["race_date"].min()
    max_date = df["race_date"].max()

    results = []
    train_end = min_date + timedelta(days=min_train_days)

    while train_end + timedelta(days=test_window_days) <= max_date:
        test_end = train_end + timedelta(days=test_window_days)

        train_mask = df["race_date"] < train_end
        test_mask = (df["race_date"] >= train_end) & (df["race_date"] < test_end)

        train_df = df[train_mask]
        test_df = df[test_mask]

        if len(train_df) < 50 or len(test_df) < 10:
            train_end += timedelta(days=step_days)
            continue

        # Train
        X_train = train_df[feature_cols]
        y_train = (train_df["finish_position"] == 1).astype(int).values
        odds_train = train_df["final_odds"].values if "final_odds" in train_df.columns else None

        model.fit(X_train, y_train, odds_train)

        # Test — predict per race
        X_test = test_df[feature_cols]
        y_test = (test_df["finish_position"] == 1).astype(int).values
        odds_test = test_df["final_odds"].values if "final_odds" in test_df.columns else None

        y_pred = model.predict_proba(X_test, odds_test)

        # Metrics
        bs = brier_score(y_test, y_pred)
        market_probs = 1.0 / (odds_test + 1.0) if odds_test is not None else None
        dr2 = delta_r_squared(y_test, y_pred, market_probs) if market_probs is not None else None

        roi_result = simulated_roi(
            pd.DataFrame({
                "win_prob": y_pred,
                "final_odds": odds_test if odds_test is not None else np.ones(len(y_pred)),
                "finish_position": test_df["finish_position"].values,
            })
        )

        results.append({
            "train_end": train_end,
            "test_end": test_end,
            "train_size": len(train_df),
            "test_size": len(test_df),
            "brier_score": bs,
            "delta_r2": dr2,
            **roi_result,
        })

        train_end += timedelta(days=step_days)

    return results
