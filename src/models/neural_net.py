"""PyTorch neural network with softmax-over-field output.

Stanford CS230 found that shallow networks (2 hidden layers, 60 units)
with well-engineered features outperformed deeper architectures —
feature engineering dominates model complexity in this domain.

The model takes all entries in a race simultaneously and produces
a probability distribution via softmax, ensuring probabilities sum to 1.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from src.models.base import BaseModel


class RaceFieldNN(BaseModel):
    """Neural network that predicts across the entire race field.

    Uses softmax output to produce a proper probability distribution
    over all horses in a race, rather than independent per-horse predictions.

    TODO: Full implementation in Phase 3.
    Architecture: 2 hidden layers, 64 units each, ReLU, dropout 0.3,
    softmax output over field.
    """

    def __init__(self, hidden_dim: int = 64, dropout: float = 0.3, lr: float = 1e-3):
        self.hidden_dim = hidden_dim
        self.dropout = dropout
        self.lr = lr
        self.model = None

    def fit(self, X: pd.DataFrame, y: np.ndarray, odds: np.ndarray | None = None) -> None:
        raise NotImplementedError(
            "RaceFieldNN: Phase 3. Use BenterLogisticModel or LightGBMModel for now."
        )

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        raise NotImplementedError("RaceFieldNN: Phase 3.")
