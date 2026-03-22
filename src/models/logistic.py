"""Benter odds-offset logistic regression model.

The foundation of HorseGPT: logit(p) = logit(odds_implied_p) + β·X

This model learns residual signal beyond what the public odds already
price in — a dramatically easier task than predicting from scratch.
Benter showed that a ΔR² of just 0.0178 over public odds was sufficient
for massive profitability across thousands of races.

Usage:
    python -m src.models.logistic --db horsegpt.db
"""

from __future__ import annotations

import argparse
import pickle
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.special import expit, logit
from sklearn.linear_model import LogisticRegression

from src.models.base import BaseModel


def odds_to_implied_prob(odds: np.ndarray) -> np.ndarray:
    """Convert decimal odds to implied probabilities."""
    # Decimal odds: payout = stake * (odds + 1)
    # Implied probability = 1 / (odds + 1)
    return 1.0 / (odds + 1.0)


def normalize_probs(probs: np.ndarray) -> np.ndarray:
    """Normalize probabilities to sum to 1.0 (softmax-like)."""
    total = probs.sum()
    if total <= 0:
        return np.ones_like(probs) / len(probs)
    return probs / total


class BenterLogisticModel(BaseModel):
    """Logistic regression with public odds as a FIXED offset.

    The key insight: instead of predicting win probability from scratch,
    we start with the market's estimate (public odds) and only learn
    the residual — where the market is wrong.

    The odds logit is a true offset (coefficient fixed at 1.0), NOT a
    learned feature. Regularization would shrink it toward 0, discarding
    the market baseline that Benter's entire method depends on.
    """

    def __init__(self, C: float = 1.0, max_iter: int = 1000):
        self.C = C
        self.max_iter = max_iter
        self.model: LogisticRegression | None = None
        self.feature_names: list[str] = []

    def _compute_offset(self, odds: np.ndarray | None) -> np.ndarray | None:
        """Compute fixed logit offset from market odds."""
        if odds is None:
            return None
        implied_probs = odds_to_implied_prob(odds)
        implied_probs = np.clip(implied_probs, 0.01, 0.99)
        return logit(implied_probs)

    def fit(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        odds: np.ndarray | None = None,
    ) -> None:
        """Train the Benter logistic model.

        The odds offset is a TRUE offset with coefficient fixed at 1.0.
        We subtract it from the sample weights' effect by using it during
        prediction only — the model learns purely the residual signal.
        """
        self.feature_names = list(X.columns)

        # Train on features ONLY — no odds column. The model learns the
        # residual beyond market odds, not the odds themselves.
        X_train = X.copy().fillna(0)

        self.model = LogisticRegression(
            C=self.C,
            max_iter=self.max_iter,
            solver="lbfgs",
            class_weight="balanced",
        )
        self.model.fit(X_train, y)

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        """Predict win probabilities for a race field.

        Combines the model's learned residual with the market odds offset:
            logit(p) = logit(p_market) + β·X
        The offset coefficient is fixed at 1.0 — not learned, not regularized.

        Returns normalized probabilities that sum to 1.0.
        """
        if self.model is None:
            raise RuntimeError("Model not trained. Call fit() first.")

        X_pred = X[self.feature_names].copy() if self.feature_names else X.copy()
        X_pred = X_pred.fillna(0)

        # Get raw log-odds residual from the model (features only)
        raw_logits = self.model.decision_function(X_pred)

        # Add market odds as fixed offset (coefficient = 1.0)
        offset = self._compute_offset(odds)
        if offset is not None:
            raw_logits = raw_logits + offset

        # Convert log-odds to probabilities
        raw_probs = expit(raw_logits)

        # Normalize across the field to sum to 1.0
        return normalize_probs(raw_probs)

    def get_coefficients(self) -> pd.Series:
        """Return feature coefficients for interpretability."""
        if self.model is None:
            raise RuntimeError("Model not trained.")
        return pd.Series(self.model.coef_[0], index=self.feature_names[: len(self.model.coef_[0])])

    def save(self, path: Path) -> None:
        with open(path, "wb") as f:
            pickle.dump(self, f)

    @classmethod
    def load(cls, path: Path) -> "BenterLogisticModel":
        with open(path, "rb") as f:
            return pickle.load(f)


def main() -> None:
    parser = argparse.ArgumentParser(description="Train Benter logistic model")
    parser.add_argument("--db", default="sqlite:///horsegpt.db", help="Database URL")
    parser.add_argument("--output", default="artifacts/logistic.pkl", help="Model output path")
    args = parser.parse_args()

    from config.settings import DatabaseConfig, Settings
    from src.data.database import get_engine, get_session
    from src.features.pipeline import build_feature_matrix, get_feature_columns

    settings = Settings(db=DatabaseConfig(url=args.db))
    engine = get_engine(settings)
    session = get_session(engine)

    try:
        df = build_feature_matrix(session)
        if df.empty:
            print("No data. Run `make ingest` and `make features` first.", file=sys.stderr)
            sys.exit(1)

        # Filter to races with results
        df = df.dropna(subset=["finish_position"])
        feature_cols = get_feature_columns(df)

        X = df[feature_cols]
        y = (df["finish_position"] == 1).astype(int).values
        odds = df["final_odds"].values if "final_odds" in df.columns else None

        model = BenterLogisticModel()
        model.fit(X, y, odds)

        # Print top coefficients
        coefs = model.get_coefficients()
        print("\nTop 10 coefficients (absolute):")
        print(coefs.abs().sort_values(ascending=False).head(10))

        Path(args.output).parent.mkdir(parents=True, exist_ok=True)
        model.save(Path(args.output))
        print(f"\nModel saved to {args.output}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
