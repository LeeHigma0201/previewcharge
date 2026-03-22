"""Central configuration for HorseGPT v3.14."""

from dataclasses import dataclass, field
from pathlib import Path

import yaml


@dataclass
class DatabaseConfig:
    url: str = "sqlite:///horsegpt.db"


@dataclass
class ModelConfig:
    ensemble_weights: dict[str, float] = field(
        default_factory=lambda: {"lightgbm": 0.7, "logistic": 0.3}
    )
    monte_carlo_iterations: int = 100_000
    walk_forward_min_days: int = 180
    kelly_fraction: float = 0.25
    min_overlay_ev: float = 1.10  # 10% edge minimum for longshot bets
    win_pool_takeout: float = 0.17  # NA typical win pool takeout (15-22%)
    exotic_pool_takeout: float = 0.22  # NA typical exotic pool takeout


@dataclass
class FeatureConfig:
    lookback_races: int = 10
    z_score_within_field: bool = True


@dataclass
class Settings:
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    features: FeatureConfig = field(default_factory=FeatureConfig)
    data_dir: Path = Path("data/bris")
    tracks: dict = field(default_factory=dict)

    @classmethod
    def load(cls, tracks_path: Path = Path("config/tracks.yaml")) -> "Settings":
        s = cls()
        if tracks_path.exists():
            with open(tracks_path) as f:
                s.tracks = yaml.safe_load(f) or {}
        return s
