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
class ExoticConfig:
    """Configuration for the big race exotic betting engine."""

    default_bankroll: float = 1000.0
    superfecta_base_cost: float = 0.10  # $0.10 supers
    trifecta_base_cost: float = 1.0  # $1 trifectas
    exacta_base_cost: float = 2.0  # $2 exactas
    bankroll_allocation: dict[str, float] = field(
        default_factory=lambda: {
            "trifecta": 0.40,
            "exacta": 0.25,
            "superfecta": 0.20,
            "win_place": 0.15,
        }
    )
    big_race_mc_iterations: int = 200_000  # higher sim count for big races
    superfecta_prob_threshold: float = 0.0005  # prune combos below this


@dataclass
class Settings:
    db: DatabaseConfig = field(default_factory=DatabaseConfig)
    model: ModelConfig = field(default_factory=ModelConfig)
    features: FeatureConfig = field(default_factory=FeatureConfig)
    exotic: ExoticConfig = field(default_factory=ExoticConfig)
    data_dir: Path = Path("data/bris")
    tracks: dict = field(default_factory=dict)

    @classmethod
    def load(cls, tracks_path: Path = Path("config/tracks.yaml")) -> "Settings":
        s = cls()
        if tracks_path.exists():
            with open(tracks_path) as f:
                s.tracks = yaml.safe_load(f) or {}
        return s
