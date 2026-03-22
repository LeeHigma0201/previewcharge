"""Ensemble model combining multiple HorseGPT models.

Phase 1: Weighted averaging in LOG-ODDS space (0.7 LightGBM + 0.3 logistic).
Phase 3: Stacking meta-learner (logistic regression on model outputs).

Log-odds averaging preserves the multiplicative structure of odds ratios.
Linear averaging in probability space compresses longshot signals because
small probabilities are compressed relative to log-odds — a 4x overlay
detected by one model gets diluted to ~2x after linear averaging.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from scipy.special import logit, softmax

from src.models.base import BaseModel


class WeightedEnsemble(BaseModel):
    """Combine multiple models via weighted averaging in log-odds space.

    Uses the logarithmic opinion pool:
        logit(p_ens) = Σ w_m · logit(p_m)
    This is the coherent Bayesian combination for models operating in
    log-odds space, and preserves longshot overlay signals.
    """

    def __init__(self, models: dict[str, BaseModel], weights: dict[str, float]):
        self.models = models
        self.weights = weights
        total = sum(weights.values())
        self.weights = {k: v / total for k, v in weights.items()}

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        for name, model in self.models.items():
            print(f"Training {name}...")
            model.fit(X, y, odds)

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        combined_logits = np.zeros(len(X))
        for name, model in self.models.items():
            probs = model.predict_proba(X, odds)
            probs = np.clip(probs, 1e-6, 1 - 1e-6)
            combined_logits += self.weights.get(name, 0.0) * logit(probs)

        # Softmax normalization (correct for discrete choice)
        return softmax(combined_logits)


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
