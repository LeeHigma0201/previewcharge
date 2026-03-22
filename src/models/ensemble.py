"""Ensemble model combining multiple HorseGPT models.

Phase 1: Weighted averaging (0.7 LightGBM + 0.3 logistic).
Phase 3: Stacking meta-learner (logistic regression on model outputs).
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.base import BaseModel


class WeightedEnsemble(BaseModel):
    """Combine multiple models via weighted averaging."""

    def __init__(self, models: dict[str, BaseModel], weights: dict[str, float]):
        self.models = models
        self.weights = weights
        # Normalize weights
        total = sum(weights.values())
        self.weights = {k: v / total for k, v in weights.items()}

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        for name, model in self.models.items():
            print(f"Training {name}...")
            model.fit(X, y, odds)

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        combined = np.zeros(len(X))
        for name, model in self.models.items():
            probs = model.predict_proba(X, odds)
            combined += self.weights.get(name, 0.0) * probs

        # Normalize to sum to 1.0
        total = combined.sum()
        if total > 0:
            combined /= total
        return combined


class StackingEnsemble(BaseModel):
    """Phase 3: Stacking meta-learner.

    Base models produce predictions, then a logistic regression
    meta-learner combines them. Trained via walk-forward CV to
    prevent data leakage.

    TODO: Implement in Phase 3.
    """

    def __init__(self, base_models: dict[str, BaseModel]):
        self.base_models = base_models
        self.meta_model = None

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        raise NotImplementedError("StackingEnsemble: Phase 3")

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        raise NotImplementedError("StackingEnsemble: Phase 3")
