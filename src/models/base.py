"""Abstract base model interface for HorseGPT models."""

from __future__ import annotations

from abc import ABC, abstractmethod

import numpy as np
import pandas as pd


class BaseModel(ABC):
    """All HorseGPT models must implement this interface.

    Models receive a race's feature matrix and return win probabilities
    that sum to 1.0 across the field (softmax over race).
    """

    @abstractmethod
    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        """Train the model.

        Args:
            X: Feature matrix (entries × features). Grouped by race_id.
            y: Binary target (1 = winner, 0 = loser).
            odds: Public odds for each entry (used as offset by Benter model).
        """

    @abstractmethod
    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        """Predict win probabilities for a single race field.

        Args:
            X: Feature matrix for one race (entries × features).
            odds: Public odds for each entry.

        Returns:
            Array of probabilities summing to 1.0.
        """

    def predict_race(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> pd.Series:
        """Predict and return as a labeled Series."""
        probs = self.predict_proba(X, odds)
        return pd.Series(probs, index=X.index, name="win_prob")
