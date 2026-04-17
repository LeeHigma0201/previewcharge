"""File-based jockey/trainer stats cache.

Used when `compute_jockey_trainer_features` has no prior DB history (e.g. a
fresh card with no historical entries). The cache is loaded from JSON (see
``data/analysis/*_meet_stats.json``) and keyed by jockey/trainer name. The
matrix builder can pass a cache instance into feature computation; the
override returns the same feature dict shape as the DB path.
"""

from __future__ import annotations

import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Any


@dataclass(frozen=True)
class PersonStats:
    starts: int | None = None
    wins: int | None = None
    win_pct: float | None = None
    itm_pct: float | None = None
    roi: float | None = None
    avg_odds: float | None = None

    @property
    def top3_pct(self) -> float | None:
        return self.itm_pct


class JtStatsCache:
    def __init__(self, jockeys: dict[str, PersonStats], trainers: dict[str, PersonStats]):
        self.jockeys = jockeys
        self.trainers = trainers

    @classmethod
    def from_json(cls, path: Path) -> "JtStatsCache":
        data = json.loads(Path(path).read_text())
        return cls(
            jockeys={k: _to_stats(v) for k, v in (data.get("jockeys") or {}).items()},
            trainers={k: _to_stats(v) for k, v in (data.get("trainers") or {}).items()},
        )

    @classmethod
    def empty(cls) -> "JtStatsCache":
        return cls({}, {})

    def jockey(self, name: str | None) -> PersonStats | None:
        if not name:
            return None
        return self.jockeys.get(name) or self.jockeys.get(_normalize(name))

    def trainer(self, name: str | None) -> PersonStats | None:
        if not name:
            return None
        return self.trainers.get(name) or self.trainers.get(_normalize(name))

    def features_for(self, jockey_name: str | None, trainer_name: str | None) -> dict[str, float | None]:
        """Return a 10-key dict matching compute_jockey_trainer_features's output."""
        out: dict[str, float | None] = {}
        for role, name in (("jockey", jockey_name), ("trainer", trainer_name)):
            stats = self.jockey(name) if role == "jockey" else self.trainer(name)
            for suffix in ("win_pct", "roi", "starts", "top3_pct", "avg_odds"):
                val = getattr(stats, suffix) if stats else None
                if suffix == "starts" and val is not None:
                    val = float(val)
                out[f"{role}_{suffix}"] = val
        return out


def _to_stats(d: dict[str, Any]) -> PersonStats:
    def _f(k: str) -> float | None:
        v = d.get(k)
        if v is None:
            return None
        try:
            f = float(v)
            return None if math.isnan(f) else f
        except (TypeError, ValueError):
            return None

    def _i(k: str) -> int | None:
        v = d.get(k)
        if v is None:
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None

    return PersonStats(
        starts=_i("starts"),
        wins=_i("wins"),
        win_pct=_f("win_pct"),
        itm_pct=_f("itm_pct"),
        roi=_f("roi"),
        avg_odds=_f("avg_odds"),
    )


def _normalize(name: str) -> str:
    return " ".join(name.strip().split())
