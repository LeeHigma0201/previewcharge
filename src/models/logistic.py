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
from scipy.special import logit, softmax
import statsmodels.api as sm
from statsmodels.genmod.families import Binomial

from src.models.base import BaseModel


def odds_to_implied_prob(odds: np.ndarray) -> np.ndarray:
    """Convert decimal odds to implied probabilities."""
    return 1.0 / (odds + 1.0)


def normalize_probs(probs: np.ndarray) -> np.ndarray:
    """Normalize probabilities to sum to 1.0 (softmax-like)."""
    total = probs.sum()
    if total <= 0:
        return np.ones_like(probs) / len(probs)
    return probs / total


class BenterLogisticModel(BaseModel):
    """Conditional logit with public odds as a FIXED offset.

    Implements Benter's (1994) formulation exactly:
        logit(p_i) = logit(q_i) + β·x_i

    where q_i is the market-implied probability. The offset logit(q_i)
    has coefficient fixed at 1.0 — the GLM offset parameter ensures it
    enters the log-likelihood during training without being regularized.

    No class_weight balancing: the odds offset handles the base rate,
    and balanced weights destroy probability calibration that Kelly
    sizing depends on.
    """

    def __init__(self, alpha: float = 1.0, max_iter: int = 100):
        self.alpha = alpha  # L2 regularization strength
        self.max_iter = max_iter
        self._params: np.ndarray | None = None
        self.feature_names: list[str] = []

    def _compute_offset(self, odds: np.ndarray | None) -> np.ndarray:
        """Compute fixed logit offset from market odds."""
        if odds is None:
            return np.zeros(1)
        implied_probs = odds_to_implied_prob(odds)
        implied_probs = np.clip(implied_probs, 0.01, 0.99)
        return logit(implied_probs)

    def fit(
        self,
        X: pd.DataFrame,
        y: np.ndarray,
        odds: np.ndarray | None = None,
    ) -> None:
        """Train with GLM offset — the offset enters the log-likelihood
        during optimization, so coefficients are estimated correctly."""
        self.feature_names = list(X.columns)
        X_train = sm.add_constant(X.fillna(0).values.astype(float))
        offset = self._compute_offset(odds) if odds is not None else np.zeros(len(y))

        model = sm.GLM(
            y.astype(float),
            X_train,
            family=Binomial(),
            offset=offset,
        )
        result = model.fit_regularized(
            alpha=self.alpha,
            L1_wt=0.0,  # pure L2
            maxiter=self.max_iter,
        )
        self._params = result.params

    def predict_proba(
        self, X: pd.DataFrame, odds: np.ndarray | None = None
    ) -> np.ndarray:
        """Predict using conditional logit with softmax normalization.

        Softmax is the correct normalization for a discrete-choice model:
            p_i = exp(v_i) / Σ_j exp(v_j)
        where v_i = logit(q_i) + β·x_i.

        Sigmoid-then-rescale compresses the distribution toward uniformity
        because sigmoid saturates; softmax preserves the full dynamic range.
        """
        if self._params is None:
            raise RuntimeError("Model not trained. Call fit() first.")

        X_pred = X[self.feature_names].copy() if self.feature_names else X.copy()
        X_pred = sm.add_constant(X_pred.fillna(0).values.astype(float))

        # Linear predictor: β·x (residual signal from features)
        raw_logits = X_pred @ self._params

        # Add market odds as fixed offset (coefficient = 1.0)
        offset = self._compute_offset(odds) if odds is not None else np.zeros(len(X))
        v = raw_logits + offset

        # Softmax normalization (correct for conditional logit / discrete choice)
        return softmax(v)

    def get_coefficients(self) -> pd.Series:
        """Return feature coefficients for interpretability."""
        if self._params is None:
            raise RuntimeError("Model not trained.")
        names = ["const"] + self.feature_names
        return pd.Series(self._params, index=names[: len(self._params)])

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
