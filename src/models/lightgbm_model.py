"""LightGBM gradient boosting model.

Primary workhorse for tabular features. Handles 1,400+ BRIS fields
natively with built-in categorical support and missing value handling.

A 2025 study benchmarking 17 algorithms across 700,000+ races found
CatBoost/LightGBM achieved the lowest MAE for finish-time prediction.
The CodeWorks team found 0.7 LightGBM + 0.3 deep learning ensemble
produced higher profit than either model alone.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.base import BaseModel


class LightGBMModel(BaseModel):
    """LightGBM model with softmax normalization across race field."""

    def __init__(
        self,
        n_estimators: int = 500,
        learning_rate: float = 0.05,
        max_depth: int = 6,
        num_leaves: int = 31,
        min_child_samples: int = 20,
    ):
        self.params = {
            "n_estimators": n_estimators,
            "learning_rate": learning_rate,
            "max_depth": max_depth,
            "num_leaves": num_leaves,
            "min_child_samples": min_child_samples,
        }
        self.model = None
        self.feature_names: list[str] = []

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        import lightgbm as lgb

        self.feature_names = list(X.columns)
        X_train = X.fillna(-999)

        if odds is not None:
            from scipy.special import logit
            implied = np.clip(1.0 / (odds + 1.0), 0.01, 0.99)
            X_train = X_train.copy()
            X_train["odds_offset"] = logit(implied)

        self.model = lgb.LGBMClassifier(
            objective="binary",
            **self.params,
            verbose=-1,
        )
        self.model.fit(X_train, y)

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained.")

        X_pred = X[self.feature_names].fillna(-999).copy()
        if odds is not None:
            from scipy.special import logit
            implied = np.clip(1.0 / (odds + 1.0), 0.01, 0.99)
            X_pred["odds_offset"] = logit(implied)

        raw = self.model.predict_proba(X_pred)[:, 1]
        total = raw.sum()
        return raw / total if total > 0 else np.ones_like(raw) / len(raw)

    def feature_importance(self) -> pd.Series:
        if self.model is None:
            raise RuntimeError("Model not trained.")
        names = self.feature_names + (
            ["odds_offset"] if "odds_offset" not in self.feature_names else []
        )
        return pd.Series(
            self.model.feature_importances_,
            index=names[: len(self.model.feature_importances_)],
        ).sort_values(ascending=False)
