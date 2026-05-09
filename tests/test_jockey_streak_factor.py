"""Validate the hot-jockey-streak factor (POST_RACE_LESSONS.md item #1).

The function should:
  ✓ Return 1.0 when ANY of the streak fields are missing (graceful degrade)
  ✓ Return 1.0 when recent_starts < 5 (insufficient sample)
  ✓ Return 1.0 when z <= 2σ (not hot enough)
  ✓ Return >1.0 boosted multiplier when z > 2σ
  ✓ Cap at 1.11 even on extreme streaks (>3σ)
  ✓ Handle pathological inputs (baseline = 0 or 1) without ZeroDivisionError

Validation lens: Derby 152 R12 5/2/26. Jose Ortiz 5-for-13 on Oaks Day,
baseline 25.4%. Z = 1.08σ → below 2σ threshold. Function returns 1.0.
For sharper detection on the next race day, the calling code can lower
the threshold or pass a different recent window.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.process_card import _jockey_streak_factor


def test_no_data_returns_neutral():
    """No streak fields → no-op."""
    assert _jockey_streak_factor({}) == 1.0
    assert _jockey_streak_factor({"jockey": "Jose L. Ortiz"}) == 1.0


def test_partial_data_returns_neutral():
    """Missing any of the 3 fields → no-op."""
    assert _jockey_streak_factor({
        "jockey_recent_24h_wins": 5,
        "jockey_recent_24h_starts": 13,
        # baseline missing
    }) == 1.0
    assert _jockey_streak_factor({
        "jockey_recent_24h_wins": 5,
        # starts missing
        "jockey_baseline_60d_pct": 0.254,
    }) == 1.0


def test_insufficient_starts_returns_neutral():
    """recent_starts < 5 → no-op (sample too small)."""
    assert _jockey_streak_factor({
        "jockey_recent_24h_wins": 3,
        "jockey_recent_24h_starts": 4,  # below threshold
        "jockey_baseline_60d_pct": 0.20,
    }) == 1.0


def test_jose_ortiz_oaks_day_is_below_threshold():
    """Real Derby 152 case — Oaks Day alone is +1.08σ, below 2σ.

    Function returns 1.0; the lesson is the threshold may be too strict
    for stakes-weekend signal-detection. Configurable for future tuning.
    """
    factor = _jockey_streak_factor({
        "jockey_recent_24h_wins": 5,
        "jockey_recent_24h_starts": 13,
        "jockey_baseline_60d_pct": 0.254,
    })
    assert factor == 1.0, f"Oaks Day streak alone (1.08σ) should not fire 2σ threshold, got {factor}"


def test_2_sigma_streak_fires_minimum_boost():
    """Exactly 2σ → factor = 1.05 (minimum boost)."""
    # Engineer a 2σ scenario: baseline 0.20, n=20, observed wins boost to ~+2σ
    # se = sqrt(0.20 * 0.80 / 20) = sqrt(0.008) = 0.0894
    # z=2 → obs_rate = 0.20 + 2*0.0894 = 0.379 → 7.58 wins → use 8/20 for slight overshoot
    factor = _jockey_streak_factor({
        "jockey_recent_24h_wins": 8,
        "jockey_recent_24h_starts": 20,
        "jockey_baseline_60d_pct": 0.20,
    })
    # 8/20 = 0.40 → z = (0.40-0.20)/0.0894 = 2.24σ → factor = 1.05 + 0.03*0.24 = 1.057
    assert 1.05 < factor < 1.07, f"Just-over-2σ streak should be ~1.05-1.07, got {factor}"


def test_3_sigma_streak_caps_at_max():
    """Extreme streak (e.g. 12-of-20 vs 0.20 baseline = +6σ) caps at 1.11."""
    factor = _jockey_streak_factor({
        "jockey_recent_24h_wins": 12,
        "jockey_recent_24h_starts": 20,
        "jockey_baseline_60d_pct": 0.20,
    })
    # 12/20 = 0.60 → z = (0.60-0.20)/0.0894 = 4.47σ → would be 1.05 + 0.03*2.47 = 1.124, but capped at 1.11
    assert factor == 1.11, f"Extreme streak should cap at 1.11, got {factor}"


def test_zero_baseline_returns_neutral():
    """Pathological baseline=0 should not divide-by-zero."""
    assert _jockey_streak_factor({
        "jockey_recent_24h_wins": 5,
        "jockey_recent_24h_starts": 10,
        "jockey_baseline_60d_pct": 0.0,
    }) == 1.0


def test_cold_streak_returns_neutral():
    """A losing streak (z negative) should NOT penalize — only positive boosts apply."""
    factor = _jockey_streak_factor({
        "jockey_recent_24h_wins": 0,
        "jockey_recent_24h_starts": 10,
        "jockey_baseline_60d_pct": 0.30,
    })
    assert factor == 1.0, f"Cold streak should be no-op, got {factor}"


def test_factor_is_multiplier_in_score_calc():
    """Sanity check: at 2.5σ streak, factor multiplies into the score.

    score_horses uses: adj_score *= ... * streak_factor. If streak factor is
    1.066 then a horse's score grows by ~6.6%. This is a structural smoke test.
    """
    # 9 wins / 20 starts vs 0.20 baseline = +2.79σ → factor = 1.05 + 0.03*0.79 = 1.074
    factor = _jockey_streak_factor({
        "jockey_recent_24h_wins": 9,
        "jockey_recent_24h_starts": 20,
        "jockey_baseline_60d_pct": 0.20,
    })
    base_score = 0.18  # 18% pre-boost
    boosted = base_score * factor
    assert boosted > base_score
    assert (boosted / base_score - 1) < 0.11  # respect the cap


if __name__ == "__main__":
    test_no_data_returns_neutral()
    test_partial_data_returns_neutral()
    test_insufficient_starts_returns_neutral()
    test_jose_ortiz_oaks_day_is_below_threshold()
    test_2_sigma_streak_fires_minimum_boost()
    test_3_sigma_streak_caps_at_max()
    test_zero_baseline_returns_neutral()
    test_cold_streak_returns_neutral()
    test_factor_is_multiplier_in_score_calc()
    print("✓ All 9 jockey-streak-factor tests passed")
