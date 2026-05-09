"""Validate the stakes-segmentation guard added in commit c5f0329.

The locked rule from Apr 30 review: the chalk-doubt pool-disparity flag
went 4-for-4 in claiming/maiden/allowance and 0-for-3 in stakes with
top-tier J+T (R9 Lagynos, R10 Maximum Bourbon, R11 Cy Fair). The fix:
when race is stakes (purse > $100K) AND chalk's trainer in TIER_TRAINERS
AND chalk's jockey in TIER_JOCKEYS, skip the chalk-doubt penalty.

These tests reproduce the three Apr 30 failure cases and confirm the
guard fires correctly. Also confirms the guard does NOT fire in:
  - non-stakes races (purse <= $100K)
  - stakes races with non-tier connections
  - smart-money board signals (gap > 1.5) — unaffected
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from scripts.process_card import _pool_disparity_factor, TIER_TRAINERS, TIER_JOCKEYS


# Apr 30 failure cases that motivated the guard
def _r9_lagynos():
    """R9 Opening Verse S. G3, $350K. Asmussen + J. Ortiz on chalk #8 Lagynos.
    Flag fired (W-P +12pt gap). Lagynos won."""
    return {
        "trainer": "Steven M. Asmussen",
        "jockey": "Jose L. Ortiz",
        "mlOdds": 1.2,  # 6/5 chalk
        "winPoolPct": 35.2,
        "placePoolPct": 23.2,
    }


def _r10_max_bourbon():
    """R10 St. Matthews O.S., $200K. D'Amato + Prat on chalk #9 Maximum Bourbon.
    Flag fired (W-P +5.8pt + W-S +7.9pt compound). Won."""
    return {
        "trainer": "Philip D'Amato",
        "jockey": "Flavien Prat",
        "mlOdds": 2.0,  # 2/1
        "winPoolPct": 27.0,
        "placePoolPct": 21.2,
    }


def _r11_cy_fair():
    """R11 Mamzelle S. G3, $300K. Weaver + Irad on chalk #5 Cy Fair.
    Flag fired hardest of day (W-P +14.9pt). Won."""
    return {
        "trainer": "George Weaver",
        "jockey": "Irad Ortiz, Jr.",
        "mlOdds": 0.5,  # 1/2 heavy chalk
        "winPoolPct": 53.1,
        "placePoolPct": 38.2,
    }


# Tier membership preconditions — verify our test fixtures match the registry
def test_tier_membership_preconditions():
    """Apr 30 failure cases all involve tier-listed J+T."""
    assert "steven m. asmussen" in TIER_TRAINERS
    assert "jose l. ortiz" in TIER_JOCKEYS
    assert "philip d'amato" in TIER_TRAINERS or "philip damato" in TIER_TRAINERS
    assert "flavien prat" in TIER_JOCKEYS
    assert "irad ortiz, jr." in TIER_JOCKEYS or "irad ortiz jr." in TIER_JOCKEYS


def test_stakes_guard_fires_r9_lagynos():
    """R9 Lagynos: stakes-guard should skip chalk-doubt penalty."""
    h = _r9_lagynos()
    race_stakes = {"purse": 350000}

    # With race info → guard fires → multiplier 1.0 (skipped)
    gap_with, mult_with = _pool_disparity_factor(h, live_odds_rank=1, race=race_stakes)
    assert mult_with == 1.0, f"R9 stakes-guard should skip, got mult={mult_with}"

    # Without race info → falls back to old behavior → penalty applied
    gap_without, mult_without = _pool_disparity_factor(h, live_odds_rank=1)
    assert mult_without < 1.0, f"R9 without race should penalize, got mult={mult_without}"
    assert mult_without >= 0.7, "Penalty should clamp at 0.7"


def test_stakes_guard_fires_r10_max_bourbon():
    """R10 Maximum Bourbon: stakes-guard should skip chalk-doubt penalty."""
    h = _r10_max_bourbon()
    race_stakes = {"purse": 200000}

    gap, mult = _pool_disparity_factor(h, live_odds_rank=1, race=race_stakes)
    assert mult == 1.0, f"R10 stakes-guard should skip, got mult={mult}"


def test_stakes_guard_fires_r11_cy_fair():
    """R11 Cy Fair: stakes-guard should skip even on heaviest chalk-doubt fire."""
    h = _r11_cy_fair()
    race_stakes = {"purse": 300000}

    gap, mult = _pool_disparity_factor(h, live_odds_rank=1, race=race_stakes)
    assert mult == 1.0, f"R11 stakes-guard should skip, got mult={mult}"


def test_guard_does_NOT_fire_in_non_stakes():
    """Non-stakes races (purse <= $100K) should still apply the chalk-doubt penalty."""
    h = _r9_lagynos()
    race_claiming = {"purse": 50000}  # claiming race

    gap, mult = _pool_disparity_factor(h, live_odds_rank=1, race=race_claiming)
    assert mult < 1.0, f"Non-stakes should penalize, got mult={mult}"


def test_guard_does_NOT_fire_for_non_tier_connections():
    """Stakes race but with non-tier J+T should still apply penalty."""
    h = {
        "trainer": "Some Random Trainer",
        "jockey": "Some Random Jockey",
        "mlOdds": 1.5,
        "winPoolPct": 35.0,
        "placePoolPct": 23.0,
    }
    race_stakes = {"purse": 200000}

    gap, mult = _pool_disparity_factor(h, live_odds_rank=1, race=race_stakes)
    assert mult < 1.0, f"Non-tier connections in stakes should still penalize, got mult={mult}"


def test_smart_money_board_unaffected_by_guard():
    """Smart-money board signal (gap > 1.5) is a BONUS — guard should not affect it."""
    h = {
        "trainer": "Steven M. Asmussen",
        "jockey": "Jose L. Ortiz",
        "mlOdds": 6.0,  # not chalk
        "winPoolPct": 8.0,
        "placePoolPct": 12.0,  # gap = +4 (board lean)
    }
    race_stakes = {"purse": 350000}

    gap, mult = _pool_disparity_factor(h, live_odds_rank=4, race=race_stakes)
    assert mult > 1.0, f"Smart-money board should bonus, got mult={mult}"
    assert gap > 1.5


def test_mid_price_sharp_money_unaffected_by_guard():
    """Mid-priced (5/1-12/1) sharp-money signal should still bonus even in stakes with tier J+T."""
    h = {
        "trainer": "Steven M. Asmussen",
        "jockey": "Jose L. Ortiz",
        "mlOdds": 7.0,  # mid-price 7/1
        "winPoolPct": 18.0,
        "placePoolPct": 12.0,  # gap = -6 (sharp win bet)
    }
    race_stakes = {"purse": 350000}

    gap, mult = _pool_disparity_factor(h, live_odds_rank=3, race=race_stakes)
    # Mid-price branch: bonus since not in chalk territory (rank>3)
    # Note: live_odds_rank=3 IS chalk territory in the function (<=3) — let me adjust
    # Use rank=4 to ensure it's not classified as chalk
    gap2, mult2 = _pool_disparity_factor(h, live_odds_rank=4, race=race_stakes)
    # rank 4 + mid-price + win-only lean (gap < -3) → mid-price sharp branch → bonus
    assert mult2 > 1.0, f"Mid-price sharp money bonus should fire, got mult={mult2}"


if __name__ == "__main__":
    test_tier_membership_preconditions()
    test_stakes_guard_fires_r9_lagynos()
    test_stakes_guard_fires_r10_max_bourbon()
    test_stakes_guard_fires_r11_cy_fair()
    test_guard_does_NOT_fire_in_non_stakes()
    test_guard_does_NOT_fire_for_non_tier_connections()
    test_smart_money_board_unaffected_by_guard()
    test_mid_price_sharp_money_unaffected_by_guard()
    print("✓ All 8 stakes-segmentation guard tests passed")
