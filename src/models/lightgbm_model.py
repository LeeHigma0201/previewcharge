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
    """LightGBM model with softmax normalization across race field.

    Uses native NaN handling (not -999 sentinel), early stopping to prevent
    overfitting on noisy racing data, and regularization tuned for ~50
    features with high noise.
    """

    def __init__(
        self,
        n_estimators: int = 1000,
        learning_rate: float = 0.02,
        max_depth: int = 5,
        num_leaves: int = 15,
        min_child_samples: int = 50,
        lambda_l1: float = 1.0,
        lambda_l2: float = 5.0,
        min_gain_to_split: float = 0.1,
        colsample_bytree: float = 0.7,
        subsample: float = 0.8,
        subsample_freq: int = 1,
        is_unbalance: bool = True,
        early_stopping_rounds: int = 50,
    ):
        self.params = {
            "n_estimators": n_estimators,
            "learning_rate": learning_rate,
            "max_depth": max_depth,
            "num_leaves": num_leaves,
            "min_child_samples": min_child_samples,
            "reg_alpha": lambda_l1,
            "reg_lambda": lambda_l2,
            "min_split_gain": min_gain_to_split,
            "colsample_bytree": colsample_bytree,
            "subsample": subsample,
            "subsample_freq": subsample_freq,
            "is_unbalance": is_unbalance,
        }
        self.early_stopping_rounds = early_stopping_rounds
        self.model = None
        self.feature_names: list[str] = []

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        import lightgbm as lgb

        self.feature_names = list(X.columns)
        # Let LightGBM handle NaN natively — it learns optimal split
        # direction for missing values at each node, which is better
        # than the -999 sentinel that wasted tree splits.
        X_train = X.copy()

        if odds is not None:
            from scipy.special import logit
            implied = np.clip(1.0 / (odds + 1.0), 0.01, 0.99)
            X_train["odds_offset"] = logit(implied)

        self.model = lgb.LGBMClassifier(
            objective="binary",
            **self.params,
            verbose=-1,
        )

        # Early stopping with 20% holdout to prevent overfitting
        from sklearn.model_selection import train_test_split
        if len(X_train) > 100:
            X_tr, X_val, y_tr, y_val = train_test_split(
                X_train, y, test_size=0.2, stratify=y, random_state=42,
            )
            self.model.fit(
                X_tr, y_tr,
                eval_set=[(X_val, y_val)],
                callbacks=[lgb.early_stopping(self.early_stopping_rounds, verbose=False)],
            )
        else:
            self.model.fit(X_train, y)

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        if self.model is None:
            raise RuntimeError("Model not trained.")

        X_pred = X[self.feature_names].copy()
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
