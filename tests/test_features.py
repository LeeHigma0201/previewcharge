"""Tests for feature engineering."""

import numpy as np

from src.features.core import (
    compute_entry_features,
    compute_race_features,
    compute_speed_features,
)
from src.data.models import PastPerformance


def test_speed_features_with_data():
    """Speed features compute correctly from past performances."""
    pps = [
        PastPerformance(pp_number=1, beyer_speed=90),
        PastPerformance(pp_number=2, beyer_speed=85),
        PastPerformance(pp_number=3, beyer_speed=88),
    ]
    feats = compute_speed_features(pps)
    assert feats["best_beyer"] == 90.0
    assert feats["last_beyer"] == 90.0
    assert abs(feats["avg_beyer"] - 87.67) < 0.1
    assert feats["beyer_trend"] is not None


def test_speed_features_empty():
    """Speed features handle no past performances."""
    feats = compute_speed_features([])
    assert feats["best_beyer"] is None
    assert feats["avg_beyer"] is None


def test_race_features_shape(sample_race, session):
    """Feature matrix has correct dimensions."""
    df = compute_race_features(sample_race, session)
    assert len(df) == 8  # 8 entries
    assert "finish_position" in df.columns
    assert "final_odds" in df.columns


def test_race_features_z_scored(sample_race, session):
    """Numeric features are z-scored within the race."""
    df = compute_race_features(sample_race, session)
    # Z-scored columns should have mean ~0 and std ~1
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    exclude = {"finish_position", "final_odds"}
    for col in numeric_cols:
        if col not in exclude and df[col].std() > 0:
            assert abs(df[col].mean()) < 0.1, f"{col} not centered"
