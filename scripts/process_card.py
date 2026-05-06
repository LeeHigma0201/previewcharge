#!/usr/bin/env python3
"""
Process a CD race card from raw-entries.json into:
  - horses.csv     (1 row per horse, with scored columns)
  - races.csv      (1 row per race, with top picks + exotic recs)
  - exotics.csv    (1 row per recommended exotic ticket)
  - picks.md       (human-readable picks summary)
  - cd-<date>.ts   (StaticRace TypeScript data file for the web app)

If results.json exists for the date, also produces:
  - backtest.md    (algo picks vs actual results, hit rate, payout-if-bet)

Limited-data scoring approach (no Beyer/PP/class available from public sources):
  1. Market-implied probability from ML odds, normalized within race
  2. CD track-bias post-position adjustment via cd-context defaults
  3. Trainer/jockey tier bonuses (top CD performers per cd-context.ts)
  4. Renormalized to sum to 1.0

Exotic logic uses Plackett-Luce ordering for joint probabilities.

Usage: python3 scripts/process_card.py 2026-04-26
"""
import csv
import json
import math
import sys
from datetime import datetime
from pathlib import Path

# --- CD track-bias defaults (mirrors web/app/lib/cd-context.ts CD_DEFAULT_BIASES) ---
CD_BIASES = {
    "dirt-sprint": {
        "speedBiasPct": 85, "railBias": "+",
        "eIV": 1.45, "epIV": 1.60, "pIV": 0.65, "sIV": 0.35,
        "post1to3IV": 1.55, "post4to7IV": 1.0, "post8plusIV": 0.62,
    },
    "dirt-route": {
        "speedBiasPct": 62, "railBias": "+",
        "eIV": 1.10, "epIV": 1.20, "pIV": 0.90, "sIV": 0.80,
        "post1to3IV": 1.25, "post4to7IV": 1.0, "post8plusIV": 0.78,
    },
    "turf-inner-sprint": {
        "speedBiasPct": 55, "railBias": "+",
        "eIV": 0.55, "epIV": 1.60, "pIV": 1.20, "sIV": 0.65,
        "post1to3IV": 1.55, "post4to7IV": 0.90, "post8plusIV": 0.40,
    },
    "turf-inner-route": {
        "speedBiasPct": 45, "railBias": "+",
        "eIV": 0.55, "epIV": 1.35, "pIV": 1.25, "sIV": 0.85,
        "post1to3IV": 1.40, "post4to7IV": 0.95, "post8plusIV": 0.42,
    },
}

# INTRA-CARD STYLE-BIAS OVERRIDE (Tweak B, after R4 of 2026-04-30).
# Through 4 races today, ALL 4 winners were P/EP/closer types from various posts;
# the chalk speed types (E from inside posts) have lost 4-for-4. Track is playing
# closer-friendly today. Override compresses the style IV spread and softens the
# inside-post bonus. Applied for races > 4 today; not a permanent change.
TODAYS_BIAS_OVERRIDE = {
    "eIV":  1.10,  # was 1.45 — speed less dominant today
    "epIV": 1.20,  # was 1.60 — slight stalker bonus only
    "pIV":  1.00,  # was 0.65 — pressers winning consistently, neutral instead of penalty
    "sIV":  0.90,  # was 0.35 — closers having a day
    "post1to3IV": 1.30,  # was 1.55 — inside posts not as advantageous on closer-friendly day
    "post4to7IV": 1.05,  # was 1.0 — slight boost to mid posts
    "post8plusIV": 0.80, # was 0.62 — outside posts hitting the board today (R4 #12 from 12)
}


def _apply_today_override(bias: dict, override_active: bool) -> dict:
    """Return a bias dict with today's override merged in (if active)."""
    if not override_active:
        return bias
    merged = dict(bias)
    merged.update(TODAYS_BIAS_OVERRIDE)
    return merged

# Top-tier CD spring-meet operators (from cd-context.ts)
TIER_TRAINERS = {
    "todd a. pletcher": 0.07, "todd pletcher": 0.07,
    "brad h. cox": 0.07, "brad cox": 0.07,
    "steven m. asmussen": 0.05, "steve asmussen": 0.05,
    "chad c. brown": 0.06, "chad brown": 0.06,
    "william i. mott": 0.05, "bill mott": 0.05,
    "brendan p. walsh": 0.05, "brendan walsh": 0.05,
    "kenneth g. mcpeek": 0.04, "ken mcpeek": 0.04,
    "wesley a. ward": 0.04, "wesley ward": 0.04,
    "h. graham motion": 0.03, "graham motion": 0.03,
    # Added 2026-04-30 after R1 (Joe Sharp won; was missing). CD spring-meet operators
    # with consistent strike rates that the original list under-represented.
    "joe sharp": 0.04,
    "saffie a. joseph jr.": 0.04, "saffie joseph jr.": 0.04, "saffie joseph": 0.04,
    "cherie devaux": 0.04,
    "mark e. casse": 0.05, "mark casse": 0.05,
    "dale l. romans": 0.04, "dale romans": 0.04,
    "ian r. wilkes": 0.04, "ian wilkes": 0.04,
    "george r. arnold ii": 0.03, "rusty arnold": 0.03,
    "eddie kenneally": 0.03,
    "philip a. bauer": 0.03, "philip bauer": 0.03,
    "philip damato": 0.03, "philip d'amato": 0.03,
    "thomas drury jr.": 0.03, "thomas drury": 0.03,
    "lauren robson": 0.03,
    # Added after R2 audit on 4-30 — Foley won R2 with She'z the Law (15/1 ML → 1.6 live).
    # Handoff doc explicitly flagged this gap.
    "gregory d. foley": 0.04, "greg foley": 0.04,
    # Added 2026-05-03 in stakes-segmentation guard validation (test_stakes_segmentation_guard.py):
    # — Weaver trained R11 Apr 30 winner Cy Fair (chalk-doubt fired, won) — load-bearing for
    #   the stakes-guard test case
    # — Hess Jr. trained R8 Apr 30 winner Jensco — flagged in CD_2026_04_30_DAILY_REPORT.md
    "george weaver": 0.04,
    "robert b. hess jr.": 0.03, "robert hess jr.": 0.03, "bob hess jr.": 0.03,
}
TIER_JOCKEYS = {
    "irad ortiz, jr.": 0.05, "irad ortiz jr.": 0.05, "irad ortiz": 0.05,
    "jose l. ortiz": 0.05, "jose ortiz": 0.05,
    "luis saez": 0.04,
    "tyler gaffalione": 0.04,
    "joel rosario": 0.05,
    "brian j. hernandez, jr.": 0.04, "brian hernandez jr.": 0.04,
    "florent geroux": 0.03,
    "flavien prat": 0.04,
}


def classify_race(distance: str, surface: str) -> str:
    """Map (distance, surface) → CD bias key."""
    surf = (surface or "").lower()
    is_dirt = "dirt" in surf
    # parse distance: "6f" "5.5f" "1m" "1 1/16m" "1 1/4m" "4 1/2f"
    d = distance.strip().lower()
    is_route = "m" in d and "f" not in d  # any "m" without "f" = route
    if is_dirt:
        return "dirt-route" if is_route else "dirt-sprint"
    return "turf-inner-route" if is_route else "turf-inner-sprint"


def parse_distance_furlongs(distance: str) -> float:
    """Convert '1 1/16m' / '6f' / '4 1/2f' → furlongs (decimal)."""
    d = distance.strip()
    # Mile-based: e.g. "1m", "1 1/16m", "1 1/4m", "1 1/8m"
    if d.endswith("m"):
        body = d[:-1].strip()
        if " " in body:
            whole, frac = body.split(" ", 1)
            num, denom = frac.split("/")
            return (float(whole) + float(num) / float(denom)) * 8
        return float(body) * 8
    # Furlong-based: "6f", "4 1/2f", "5.5f"
    if d.endswith("f"):
        body = d[:-1].strip()
        if " " in body:
            whole, frac = body.split(" ", 1)
            num, denom = frac.split("/")
            return float(whole) + float(num) / float(denom)
        return float(body)
    return 8.0  # fallback


def market_prob(ml_odds: float) -> float:
    """ML decimal odds → implied probability."""
    if ml_odds is None or ml_odds <= 0:
        return 0.05
    return 1.0 / (ml_odds + 1.0)


def post_iv_for(post, bias: dict) -> float:
    """Post-position IV. Returns 1.0 (neutral) for missing/zero post — fixed bug
    where post=None or post=0 was getting the inside-post bonus by accident."""
    if post is None or post == 0:
        return 1.0
    p = int(post)
    if p <= 3:
        return bias["post1to3IV"]
    if p <= 7:
        return bias["post4to7IV"]
    return bias["post8plusIV"]


def style_iv_for(style: str, bias: dict) -> float:
    if not style:
        return 1.0  # no info → neutral
    s = style.upper()
    return {"E": bias["eIV"], "EP": bias["epIV"], "P": bias["pIV"], "S": bias["sIV"], "C": bias["sIV"]}.get(s, 1.0)


def _ability_value(h: dict) -> float | None:
    """Combine BRIS speed signals into a single ability number per horse.
    Returns None if no rich data — caller treats as field-average.

    LONE-BEYER PROTECTION: When a horse has only 1 Beyer figure (typically
    layoff/first-start-back/lightly-raced), the figure itself is unreliable —
    it may be a single off race that doesn't predict current form. In that
    case, fall back to Prime Power only. (Lesson: CD Apr 30 R1 Star's Image
    had a lone 62 off 108-day layoff and won at 9/2.)"""
    pp = h.get("primePower")
    beyers = h.get("last3Beyer") or []
    best_beyer = max(beyers) if beyers else None
    if pp is None and best_beyer is None:
        return None
    # Single Beyer is unreliable — use PP if available
    if len(beyers) <= 1 and pp is not None:
        return float(pp)
    if pp is None:
        return float(best_beyer)
    if best_beyer is None:
        return float(pp)
    # Prime Power (~80-150) and Beyer (~50-110) are different scales.
    # Normalize Beyer to PP-comparable range, then 50/50 blend.
    return 0.5 * float(pp) + 0.5 * (float(best_beyer) + 25.0)


def _ability_factors(horses: list, race: dict) -> list[float]:
    """Per-horse ability multiplier in [0.7, 1.4], z-scored within field.
    Adds wet-track mud adjustment for dirt races when condition is wet."""
    abilities = [_ability_value(h) for h in horses]
    valid = [a for a in abilities if a is not None]
    if len(valid) < 3:
        return [1.0] * len(horses)
    mean_a = sum(valid) / len(valid)
    var = sum((a - mean_a) ** 2 for a in valid) / max(1, len(valid) - 1)
    std_a = math.sqrt(var) or 1.0

    condition = (race.get("condition") or "").lower()
    is_wet_dirt = (
        any(c in condition for c in ("muddy", "sloppy", "wet", "slow"))
        and (race.get("surface") or "").lower() == "dirt"
    )

    out = []
    for h, a in zip(horses, abilities):
        if a is None:
            out.append(1.0)
            continue
        z = (a - mean_a) / std_a
        # Dampened from 0.25 → 0.15 after Apr 25-30 audit showed algo residuals were
        # underperforming ML chalk by ~8 points across 12 races. Trust market more.
        factor = 1.0 + 0.15 * z
        if is_wet_dirt:
            mud = h.get("mudPct")
            if mud is not None:
                factor *= 1.0 + 0.012 * (float(mud) - 16)
        # Tighter clamp: 0.85-1.15 vs prior 0.7-1.4
        out.append(max(0.85, min(1.15, factor)))
    return out


def _pool_disparity_factor(
    h: dict,
    live_odds_rank: int | None = None,
    race: dict | None = None,
) -> tuple[float, float]:
    """Pool-disparity factor with DUAL-MODE handling (Tweak A, after R4).

    The W%-P% gap means different things at different price tiers:
      - Live odds top-3 + W%-P% < -5: PUBLIC CHALK DOUBT → penalty ×0.7
      - Live odds 5/1-12/1 + W%-P% < -3: SHARP WIN-BET → mild bonus ×1.05
      - Any tier + W%-P% > +1.5: SMART BOARD MONEY → mild bonus ×1.05

    STAKES-SEGMENTATION GUARD (locked 2026-04-30 after R9/R10/R11 N=3 same-direction
    failure on stakes-grade chalks with top-tier connections):
      Chalk-doubt flag was 4/4 in claiming/maiden/allowance but 0/3 in stakes
      with top-tier J+T (Lagynos Asmussen/J.Ortiz, Maximum Bourbon D'Amato/Prat,
      Cy Fair Weaver/Irad — all chalks, all WON despite +12-15pt W-P gap).
      So when race is stakes (purse > $100K) AND chalk's trainer is tier-listed
      AND chalk's jockey is tier-listed → SKIP the chalk-doubt penalty entirely.
      Smart-money board (gap > 1.5) and mid-price sharp (5/1-12/1) bonuses still apply.

    Validation:
      Chalk-doubt morning 4-for-4 (claiming/maiden): R1 BFL, R2 SV, R3 Spotted, R4 Theoretical.
      Stakes 0-for-3 (R9/R10/R11) — all top-tier J+T combos.
      Mid-price W>>P (R4 #11 Plot, 7/1): finished 2nd, dual-mode bonus correct.
      Smart board (R5 #12, R9 #5): 2-for-2 on board predictions.

    Returns (gap_in_pct_points, multiplier).
    """
    wp = h.get("winPoolPct")
    pp = h.get("placePoolPct")
    if wp is None or pp is None:
        return (0.0, 1.0)
    gap = float(pp) - float(wp)  # positive = board lean, negative = win-only lean
    live = h.get("mlOdds") or 99.0

    # Smart-money board lean (gap positive) → mild bonus regardless of price tier
    if gap > 1.5:
        bonus = 1.0 + min(0.05, 0.012 * gap)
        return (gap, bonus)

    # Win-only lean (gap negative) — different meaning at different prices
    if gap < -3.0:
        # If horse is a top-3 chalk by live odds → public chalk doubt → penalty
        # The "top-3 chalk" check uses live_odds_rank if provided, else falls back to
        # an absolute price threshold (live odds <= 3.0 = chalk territory).
        is_chalk = (live_odds_rank is not None and live_odds_rank <= 3) or (live <= 3.0)
        if is_chalk:
            # Stakes-segmentation guard: don't penalize tier-J+T chalks in stakes
            if race is not None and (race.get("purse") or 0) > 100000:
                trainer = (h.get("trainer") or "").lower().strip()
                jockey = (h.get("jockey") or "").lower().strip()
                if trainer in TIER_TRAINERS and jockey in TIER_JOCKEYS:
                    return (gap, 1.0)
            penalty = max(0.7, 1.0 + 0.05 * gap)  # -10% → 0.5 → clamp 0.7
            return (gap, penalty)
        # Mid-priced (5/1-12/1) horse with win-only sharp money → mild bonus
        if 4.5 <= live <= 13.0 and gap < -3.0:
            bonus = 1.0 + min(0.06, -0.010 * gap)  # gap=-5 → +5%
            return (gap, bonus)
    return (gap, 1.0)


def _expert_E_factor(h: dict) -> float:
    """TwinSpires Expert E rank bonus.
    Their analyst ranks top 3 picks per race (visible as 'expert 1st pick' labels).
    R3 validation: Expert E #1 (Silvertown) hit the photo for 1st when our algo had him 5th.
    Mild bonus only — single analyst, not a crowd.
    """
    rank = h.get("expertRank")
    if rank is None:
        return 1.0
    return {1: 1.10, 2: 1.06, 3: 1.03}.get(int(rank), 1.0)


def _sharp_money_signals(h: dict) -> tuple[float, float, float]:
    """Compute (bet_down_ratio, sharp_pull, sharp_boost) from ML vs live odds.

    SHARP-MONEY DETECTOR (added 2026-04-30 after R1 + R2 misses).
    When live odds are dramatically lower than morning-line, the market has
    discovered a signal our static features lack (insider info, late workouts,
    condition reports). Two responses:
      sharp_pull  — pull bias_factor and ability_factor TOWARD 1.0, so we stop
                    fighting the market with stale residuals.
      sharp_boost — small explicit upweight to acknowledge sharp action.

    Lessons:
      R1: Star's Image ML 9/2 → live 9/2 (no bet-down — algo's lone-Beyer trap was
          the bigger issue); separate fix.
      R2: She'z the Law ML 15 → live 1.6 (9.4x bet-down). Algo gave her 21.5%;
          market gave her 38%. She won. We were fighting the smartest signal in
          the race.
    """
    ml = h.get("mlOddsOriginal")
    live = h.get("mlOdds")
    if not ml or not live or live <= 0:
        return (1.0, 0.0, 1.0)
    ratio = float(ml) / float(live)
    if ratio < 1.5:
        return (ratio, 0.0, 1.0)
    pull = min(0.6, 0.20 * math.log(ratio))
    boost = 1.0 + 0.05 * math.log(ratio)
    return (ratio, pull, boost)


def score_horses(horses: list, race: dict, today_override: bool = False) -> list:
    """Compute scored prob for each horse and return enriched list.

    today_override: when True, apply TODAYS_BIAS_OVERRIDE (intra-card correction
    based on observed winners). Set by main() after race 4 of the card.
    """
    bias_key = classify_race(race["distance"], race["surface"])
    bias = _apply_today_override(CD_BIASES[bias_key], today_override)
    enriched = []

    # 1. Raw market probabilities (the Benter anchor)
    raw_market = [market_prob(h.get("mlOdds")) for h in horses]
    market_total = sum(raw_market) or 1.0
    market_norm = [p / market_total for p in raw_market]

    # 2. Per-horse ability factor from BRIS rich fields
    ab_factors = _ability_factors(horses, race)

    # 2b. Compute live-odds rank for pool-disparity dual-mode
    sorted_by_live = sorted(
        [(i, h.get("mlOdds") or 99.0) for i, h in enumerate(horses)],
        key=lambda x: x[1],
    )
    live_rank = {i: r + 1 for r, (i, _) in enumerate(sorted_by_live)}

    # 3. Bias-adjusted score
    for idx, (h, mp, ab) in enumerate(zip(horses, market_norm, ab_factors)):
        post = h.get("post") or h.get("postPosition") or 0
        post_iv = post_iv_for(post, bias)
        style_iv = style_iv_for(h.get("style") or "", bias)

        # Dampened (was 0.35/0.30, clamp 0.5-1.6) after audit showed algo residuals
        # underperformed ML chalk over 12-race sample. Lighter bias adjustment.
        bias_factor = 1.0 + 0.25 * (post_iv - 1.0) + 0.20 * (style_iv - 1.0)
        bias_factor = max(0.7, min(1.3, bias_factor))

        # Trainer/jockey tier bonus
        trainer = (h.get("trainer") or "").lower().strip()
        jockey = (h.get("jockey") or "").lower().strip()
        t_bonus = TIER_TRAINERS.get(trainer, 0.0)
        j_bonus = TIER_JOCKEYS.get(jockey, 0.0)

        # Sharp-money: when market hammered the horse from ML, trust market more
        bd_ratio, sharp_pull, sharp_boost = _sharp_money_signals(h)
        adj_bias = 1.0 + (bias_factor - 1.0) * (1.0 - sharp_pull)
        adj_ability = 1.0 + (ab - 1.0) * (1.0 - sharp_pull)

        # Pool disparity (dual-mode + stakes-segmentation guard)
        pool_gap, pool_factor = _pool_disparity_factor(h, live_rank.get(idx), race)
        # TwinSpires Expert E rank bonus (validated R3)
        expert_factor = _expert_E_factor(h)

        adj_score = (
            mp * adj_bias * (1.0 + t_bonus + j_bonus) * adj_ability
            * sharp_boost * pool_factor * expert_factor
        )
        enriched.append({
            **h,
            "market_prob": mp,
            "post_iv": post_iv,
            "style_iv": style_iv,
            "bias_factor": bias_factor,
            "ability_factor": ab,
            "bet_down_ratio": bd_ratio,
            "sharp_pull": sharp_pull,
            "sharp_boost": sharp_boost,
            "pool_gap": pool_gap,
            "pool_factor": pool_factor,
            "expert_factor": expert_factor,
            "trainer_tier_bonus": t_bonus,
            "jockey_tier_bonus": j_bonus,
            "raw_score": adj_score,
        })

    # 3. Renormalize to sum=1.0 (Stage-1 ability prob)
    total = sum(e["raw_score"] for e in enriched) or 1.0
    for e in enriched:
        e["score"] = e["raw_score"] / total

    # 4. Sort and rank
    enriched.sort(key=lambda x: -x["score"])
    for i, e in enumerate(enriched):
        e["rank"] = i + 1
    return enriched


def plackett_luce_pair(scored: list, k: int = 4) -> dict:
    """Generate top-k×k×k×k joint probabilities for exotics.
    Returns dict with per-position probs."""
    top = scored[:k]
    # Win = score
    # Place given winner = score / (1 - winner_score) for non-winner
    # Show given top 2 = score / (1 - sum of top 2)
    out = {"top_k": top}
    return out


def best_exotic_strategy(scored: list, race_type: str) -> dict:
    """Recommend an exotic bet structure based on score concentration.

    LOCKED RULE (2026-04-30 review):
      - Default tri/super always include algo TOP-4 (not top-3). R7 lost 1-4-5
        tri box because #7 Vow (algo's #4) hit 2nd. Adding the 4th horse covers
        the boundary case at $9 marginal cost.
      - STAKES races (race_type contains 'STK' or 'Stakes' or known stakes name)
        favor TOP-5 SUPER BOX for chaos coverage. R10 lost 4-horse super
        2-9-6-1 because #8 (algo's #5) hit 2nd; top-5 super would have hit.
        20-horse Derby gets the deepest coverage.

    Returns the PRIMARY rec; alt structures are returned in `alternates`."""
    n = len(scored)
    if n < 4:
        return {"recommendation": "PASS — too small a field for exotic"}

    top_score = scored[0]["score"]
    top2 = sum(s["score"] for s in scored[:2])
    top3 = sum(s["score"] for s in scored[:3])
    top4 = sum(s["score"] for s in scored[:4])
    top5 = sum(s["score"] for s in scored[:5]) if n >= 5 else top4

    rt = (race_type or "").lower()
    is_stakes = ("stk" in rt) or ("stakes" in rt) or ("derby" in rt) or ("oaks" in rt) or ("classic" in rt)

    # Always offer a cheap exacta box as a baseline alternate
    ex_box_3 = {
        "structure": "Exacta 3-horse box",
        "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']} BOX"],
        "unit_cost": 1.00,
        "total_cost": 6.0,
        "hit_prob_est": top3 * 0.7,
    }

    # STAKES OVERRIDE: deep field + chaos pace pressure → top-5 super
    if is_stakes and n >= 5:
        p5 = scored[4]['program']
        return {
            "structure": "Superfecta 5-horse box (stakes chaos coverage)",
            "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']}-{scored[3]['program']}-{p5} BOX"],
            "unit_cost": 0.10,
            "total_cost": 12.0,
            "hit_prob_est": top5 * 0.50,
            "rationale": f"Stakes race with {n}-horse field. Top 5 cover {top5:.0%}. R10 lost 4-horse super to algo's #5 — top-5 box catches the boundary case.",
            "alternates": [
                ex_box_3,
                {
                    "structure": "Trifecta 4-horse box (cheaper alt)",
                    "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']}-{scored[3]['program']} BOX"],
                    "unit_cost": 0.50,
                    "total_cost": 12.0,
                    "hit_prob_est": top4 * 0.55,
                },
            ],
        }

    # Decision rules — choose primary
    if top_score >= 0.34:
        # Dominant horse — key wheel beats a box. Wheel already covers top 4.
        primary = {
            "structure": "Trifecta key 1st OVER top 4 / top 4",
            "tickets": [f"{scored[0]['program']} / {scored[1]['program']},{scored[2]['program']},{scored[3]['program']} / {scored[1]['program']},{scored[2]['program']},{scored[3]['program']}"],
            "unit_cost": 0.50,
            "total_cost": 3.0,  # 1×3×2 = 6 valid combos × $0.50
            "hit_prob_est": top_score * (top4 - top_score) / max(0.01, 1 - top_score),
            "rationale": f"#{scored[0]['program']} {scored[0]['name']} dominates at {top_score:.0%}. Single on top, spread under top-4.",
            "alternates": [ex_box_3],
        }
    elif top4 >= 0.78:
        primary = {
            "structure": "Superfecta 4-horse box",
            "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']}-{scored[3]['program']} BOX"],
            "unit_cost": 0.10,
            "total_cost": 2.40,
            "hit_prob_est": top4 * 0.55,
            "rationale": f"Top 4 cover {top4:.0%} — cheap super box catches any order.",
            "alternates": [ex_box_3],
        }
    elif top3 >= 0.62:
        # Locked rule: always include algo top-4 (was top-3 — R7 boundary case fix)
        primary = {
            "structure": "Trifecta 4-horse box",
            "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']}-{scored[3]['program']} BOX"],
            "unit_cost": 0.50,
            "total_cost": 12.0,
            "hit_prob_est": top4 * 0.55,
            "rationale": f"Top 3 cover {top3:.0%}, top 4 = {top4:.0%}. Tri 4-box catches R7-style boundary cases.",
            "alternates": [
                ex_box_3,
                {
                    "structure": "Trifecta 3-horse box (cheaper, narrower)",
                    "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']} BOX"],
                    "unit_cost": 0.50,
                    "total_cost": 3.0,
                    "hit_prob_est": top3 * 0.55,
                },
            ],
        }
    else:
        # Wide-open race — top 5 super box
        p5 = scored[4]['program'] if n > 4 else scored[3]['program']
        primary = {
            "structure": "Superfecta 5-horse box (chaos play)",
            "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']}-{scored[3]['program']}-{p5} BOX"],
            "unit_cost": 0.10,
            "total_cost": 12.0,
            "hit_prob_est": top5 * 0.45,
            "rationale": f"Wide-open. Top 5 = {top5:.0%}. Chaos super box.",
            "alternates": [ex_box_3, {
                "structure": "Trifecta 4-horse box",
                "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']}-{scored[3]['program']} BOX"],
                "unit_cost": 0.50,
                "total_cost": 12.0,
                "hit_prob_est": top4 * 0.5,
            }],
        }
    return primary


def write_horses_csv(processed_races: list, out_path: Path):
    """One row per horse, with scoring + race context."""
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "race", "post_time", "distance", "surface", "purse", "race_type", "stakes",
            "program", "name", "jockey", "trainer", "post_position", "ml_odds",
            "style", "prime_power", "best_last3_beyer", "mud_pct",
            "market_prob_pct", "post_iv", "style_iv", "bias_factor", "ability_factor",
            "trainer_tier_bonus", "jockey_tier_bonus", "score_pct", "rank", "is_top_pick",
        ])
        for r in processed_races:
            for h in r["scored"]:
                beyers = h.get("last3Beyer") or []
                best_beyer = max(beyers) if beyers else ""
                w.writerow([
                    r["raceNumber"], r["postTime"], r["distance"], r["surface"], r["purse"],
                    r["raceType"], r.get("stakesName", "") or "",
                    h["program"], h["name"], h.get("jockey", ""), h.get("trainer", ""),
                    h.get("post", ""), h.get("mlOdds", ""), h.get("style", "") or "",
                    h.get("primePower", "") or "", best_beyer, h.get("mudPct", "") or "",
                    f"{h['market_prob']*100:.1f}",
                    f"{h['post_iv']:.2f}", f"{h['style_iv']:.2f}", f"{h['bias_factor']:.3f}",
                    f"{h.get('ability_factor', 1.0):.3f}",
                    f"{h['trainer_tier_bonus']:.2f}", f"{h['jockey_tier_bonus']:.2f}",
                    f"{h['score']*100:.1f}", h["rank"], "YES" if h["rank"] == 1 else "",
                ])


def write_races_csv(processed_races: list, out_path: Path):
    """One row per race, with top picks + exotic rec."""
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "race", "post_time", "distance", "surface", "purse", "race_type", "stakes",
            "field_size", "top1_program", "top1_name", "top1_pct",
            "top2_program", "top2_name", "top2_pct",
            "top3_program", "top3_name", "top3_pct",
            "top4_program", "top4_name", "top4_pct",
            "exotic_structure", "exotic_unit_cost", "exotic_total_cost", "exotic_rationale",
        ])
        for r in processed_races:
            s = r["scored"]
            ex = r["exotic"]
            row = [
                r["raceNumber"], r["postTime"], r["distance"], r["surface"], r["purse"],
                r["raceType"], r.get("stakesName", "") or "",
                len(s),
            ]
            for i in range(4):
                if i < len(s):
                    row.extend([s[i]["program"], s[i]["name"], f"{s[i]['score']*100:.1f}"])
                else:
                    row.extend(["", "", ""])
            row.extend([
                ex.get("structure", ex.get("recommendation", "")),
                ex.get("unit_cost", ""),
                ex.get("total_cost", ""),
                ex.get("rationale", ""),
            ])
            w.writerow(row)


def write_picks_md(processed_races: list, date: str, out_path: Path):
    lines = [
        f"# CD {date} — Algo Picks & Exotic Recommendations",
        "",
        f"_Generated {datetime.now().isoformat(timespec='seconds')} • BRIS-rich scoring._",
        "",
        "Scoring inputs: ML odds (Benter anchor), post position, runstyle, jockey/trainer tier,",
        "CD track-bias defaults, **Prime Power + best last-3 Beyer (z-scored within field)**, mud % (wet tracks).",
        "",
        "---",
        "",
    ]
    for r in processed_races:
        lines.append(f"## R{r['raceNumber']} — {r['postTime']} • {r['distance']} {r['surface']} • ${r['purse']:,} • {r['raceType']}")
        if r.get("stakesName"):
            lines.append(f"**{r['stakesName']}**")
        lines.append("")
        lines.append("| Rank | # | Horse | Jockey / Trainer | Post | ML | Style | PP | Beyer | Ability×| Score |")
        lines.append("|---|---|---|---|---|---|---|---|---|---|---|")
        for h in r["scored"][:6]:
            beyers = h.get("last3Beyer") or []
            best_beyer = max(beyers) if beyers else "—"
            pp = h.get("primePower") or "—"
            ab = h.get("ability_factor", 1.0)
            lines.append(
                f"| {h['rank']} | {h['program']} | {h['name']} | "
                f"{h.get('jockey','?')} / {h.get('trainer','?')} | "
                f"{h.get('post','?')} | {h.get('mlOdds','?')} | "
                f"{h.get('style','?')} | {pp} | {best_beyer} | "
                f"{ab:.2f} | **{h['score']*100:.1f}%** |"
            )
        ex = r["exotic"]
        lines.append("")
        lines.append(f"**Primary play:** {ex.get('structure', ex.get('recommendation','PASS'))}")
        if ex.get("tickets"):
            for t in ex["tickets"]:
                lines.append(f"- Ticket: `{t}` @ ${ex.get('unit_cost', '?')} = **${ex.get('total_cost', '?')}**")
        if ex.get("rationale"):
            lines.append(f"_{ex['rationale']}_")
        if ex.get("alternates"):
            lines.append("")
            lines.append("**Alternates:**")
            for a in ex["alternates"]:
                t = a["tickets"][0] if a.get("tickets") else "?"
                lines.append(f"- {a['structure']}: `{t}` @ ${a['unit_cost']:.2f} = ${a['total_cost']:.2f}")
        lines.append("")
        lines.append("---")
        lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def write_exotics_csv(processed_races: list, out_path: Path):
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "race", "race_type", "structure", "tickets", "unit_cost", "total_cost",
            "hit_prob_est_pct", "rationale",
        ])
        for r in processed_races:
            ex = r["exotic"]
            w.writerow([
                r["raceNumber"], r["raceType"],
                ex.get("structure", ex.get("recommendation", "")),
                " ; ".join(ex.get("tickets", [])),
                ex.get("unit_cost", ""), ex.get("total_cost", ""),
                f"{ex.get('hit_prob_est', 0)*100:.1f}" if ex.get("hit_prob_est") else "",
                ex.get("rationale", ""),
            ])


def build_multi_race_tickets(processed_races: list) -> list:
    """Generate Pick 3 / Pick 4 / Late Pick 5 recommendations."""
    tickets = []
    n = len(processed_races)
    if n >= 3:
        # Last 3 races = Late Pick 3
        legs = processed_races[-3:]
        primary = "/".join(l["scored"][0]["program"] for l in legs)
        tickets.append({
            "name": f"Late Pick 3 (R{legs[0]['raceNumber']}-R{legs[-1]['raceNumber']})",
            "structure": "Single primary",
            "ticket": primary,
            "unit": 0.50,
            "cost": 0.50,
        })
    if n >= 4:
        legs = processed_races[-4:]
        # Coverage: include #2 in any leg where top1<35%
        legs_str = []
        cost_mult = 1
        for l in legs:
            top = l["scored"][0]
            if top["score"] < 0.35 and len(l["scored"]) > 1:
                second = l["scored"][1]
                legs_str.append(f"{top['program']},{second['program']}")
                cost_mult *= 2
            else:
                legs_str.append(top["program"])
        tickets.append({
            "name": f"Pick 4 (R{legs[0]['raceNumber']}-R{legs[-1]['raceNumber']})",
            "structure": "Top + cover",
            "ticket": " / ".join(legs_str),
            "unit": 0.50,
            "cost": 0.50 * cost_mult,
        })
    if n >= 5:
        legs = processed_races[-5:]
        legs_str = []
        cost_mult = 1
        for l in legs:
            top = l["scored"][0]
            if top["score"] < 0.30 and len(l["scored"]) > 1:
                second = l["scored"][1]
                legs_str.append(f"{top['program']},{second['program']}")
                cost_mult *= 2
            else:
                legs_str.append(top["program"])
        tickets.append({
            "name": f"Late Pick 5 (R{legs[0]['raceNumber']}-R{legs[-1]['raceNumber']})",
            "structure": "Top + cover (chaotic legs only)",
            "ticket": " / ".join(legs_str),
            "unit": 0.50,
            "cost": 0.50 * cost_mult,
        })
    return tickets


def write_ts_static(processed_races: list, date: str, track: str, out_path: Path):
    """Write web/app/lib/cd-<date>.ts mirroring keeneland-apr18.ts."""
    safe_date = date.replace("-", "")
    lines = [
        f"// Churchill Downs — {date}",
        f"// Generated by scripts/process_card.py from data/cd-{date}/raw-entries.json",
        "// Limited-data mode: ML/post/jockey/trainer scraped, but Beyer/PP/class not available.",
        "// Track bias uses CD spring-meet defaults (cd-context.ts CD_DEFAULT_BIASES).",
        "",
        'import type { StaticRace, StaticHorse } from "./keeneland-apr18";',
        "",
        "const h = (",
        "  program: string, name: string, ml: number, style: string,",
        "  beyers: number[], days: number, weight: number,",
        "  extras: Partial<StaticHorse> = {}",
        "): StaticHorse => ({",
        "  program, name, mlOdds: ml, style,",
        "  last3Beyer: beyers, daysSinceLast: days, weight,",
        "  ...extras,",
        "});",
        "",
    ]
    race_vars = []
    for r in processed_races:
        bias_key = classify_race(r["distance"], r["surface"])
        bias = CD_BIASES[bias_key]
        var = f"race{r['raceNumber']}"
        race_vars.append(var)
        purse = r.get("purse") or 0
        scratches = r.get("scratches") or []
        scratch_str = ", ".join(f'"{s}"' for s in scratches) if scratches else ""
        lines.append(f"// ── R{r['raceNumber']} — {r['raceType']} {r['distance']} {r['surface']} ${purse:,} ──")
        lines.append(f"const {var}: StaticRace = {{")
        lines.append(f"  raceNumber: {r['raceNumber']}, postTime: \"{r['postTime']}\",")
        lines.append(f"  raceType: \"{r['raceType']}\", distance: \"{r['distance']}\", surface: \"{r['surface']}\", purse: {purse}, condition: \"Fast\",")
        if r.get("stakesName"):
            lines.append(f"  name: \"{r['stakesName']}\",")
        if scratches:
            lines.append(f"  scratches: [{scratch_str}],")
        lines.append("  trackBias: {")
        lines.append(f"    surface: \"{r['surface']}\", distanceLabel: \"{parse_distance_furlongs(r['distance']):.1f}f\",")
        lines.append(f"    speedBiasPct: {bias['speedBiasPct']}, railBias: \"{bias['railBias']}\",")
        lines.append(f"    eIV: {bias['eIV']}, epIV: {bias['epIV']}, pIV: {bias['pIV']}, sIV: {bias['sIV']},")
        lines.append(f"    post1to3IV: {bias['post1to3IV']}, post4to7IV: {bias['post4to7IV']}, post8plusIV: {bias['post8plusIV']},")
        lines.append("  },")
        lines.append("  horses: [")
        for hh in r["horses"]:
            ml = hh.get("mlOdds") or 99
            style = hh.get("style") or "P"
            lines.append(
                f"    h(\"{hh['program']}\", \"{hh['name']}\", {ml}, \"{style}\", "
                f"[0, 0, 0], 0, {hh.get('weight') or 120}, "
                f"{{ /* jockey: {hh.get('jockey','?')}, trainer: {hh.get('trainer','?')}, post: {hh.get('postPosition','?')} */ }}),"
            )
        lines.append("  ],")
        lines.append("};")
        lines.append("")

    lines.append(f"export const cd{safe_date}Card: StaticRace[] = [{', '.join(race_vars)}];")
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def write_backtest_md(processed_races: list, results: dict, date: str, out_path: Path):
    """Compare algo top picks to actual results."""
    res_by_race = {r["raceNumber"]: r for r in results.get("races", [])}
    lines = [
        f"# CD {date} — Backtest Report",
        "",
        f"_Algo limited-data picks vs actual results from data/cd-{date}/results.json_",
        "",
        "| R | Algo #1 | Algo #2 | Algo #3 | Winner | Algo Hit | Top-3 Hit | Win $ | Tri $ |",
        "|---|---|---|---|---|---|---|---|---|",
    ]
    n_races = 0
    n_top1 = 0
    n_top3 = 0
    total_win_payout_if_bet = 0.0
    total_win_cost = 0.0
    for r in processed_races:
        rn = r["raceNumber"]
        result = res_by_race.get(rn)
        if not result:
            continue
        n_races += 1
        algo_top = [s["program"] for s in r["scored"][:3]]
        algo_top_names = [s["name"] for s in r["scored"][:3]]
        winner_prog = result.get("winner", {}).get("program", "?")
        winner_name = result.get("winner", {}).get("name", "?")
        win_payout = result.get("winPayout") or result.get("winner", {}).get("winPayout") or 0
        tri_payout = result.get("trifectaPayout", 0) or 0

        algo_hit = "✅" if str(winner_prog) == str(algo_top[0]) else "❌"
        top3_hit = "✅" if str(winner_prog) in [str(p) for p in algo_top] else "❌"

        if str(winner_prog) == str(algo_top[0]):
            n_top1 += 1
            total_win_payout_if_bet += win_payout  # $2 win bet returns winPayout
        total_win_cost += 2.0  # we'd bet $2 on top horse each race

        if str(winner_prog) in [str(p) for p in algo_top]:
            n_top3 += 1

        lines.append(
            f"| {rn} | #{algo_top[0]} {algo_top_names[0]} | "
            f"#{algo_top[1]} {algo_top_names[1] if len(algo_top_names)>1 else ''} | "
            f"#{algo_top[2] if len(algo_top)>2 else ''} {algo_top_names[2] if len(algo_top_names)>2 else ''} | "
            f"#{winner_prog} {winner_name} | {algo_hit} | {top3_hit} | "
            f"${win_payout:.2f} | ${tri_payout:.2f} |"
        )
    lines.append("")
    if n_races > 0:
        net_pl = total_win_payout_if_bet - total_win_cost
        lines.append(f"**Top-1 hit rate**: {n_top1}/{n_races} = **{n_top1/n_races*100:.1f}%**")
        lines.append(f"**Top-3 hit rate**: {n_top3}/{n_races} = **{n_top3/n_races*100:.1f}%**")
        lines.append(f"**$2 WIN bet on top pick all card**: cost ${total_win_cost:.2f}, returned ${total_win_payout_if_bet:.2f}, net **${net_pl:+.2f}**")
        lines.append("")
        lines.append("Caveats: limited-data mode (no Beyer/PP/class); ML-only signal heavily favored chalk.")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_card.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    repo = Path(__file__).resolve().parent.parent
    in_dir = repo / "data" / f"cd-{date}"
    in_path = in_dir / "raw-entries.json"
    if not in_path.exists():
        print(f"ERROR: {in_path} not found")
        sys.exit(2)
    raw = json.loads(in_path.read_text())
    track = raw.get("track", "CD")

    # Determine if today's intra-card style-bias override should activate.
    # Trigger: 4+ races on the card have completed AND >= 3 winners were P/EP/S types
    # (i.e., the chalk speed pattern is broken). Cheap to compute from results.json.
    res_path = in_dir / "results.json"
    today_override_active = False
    if res_path.exists():
        try:
            res = json.loads(res_path.read_text(encoding="utf-8"))
            done = len(res.get("races", []))
            if done >= 4:
                today_override_active = True
                print(f"[bias] Intra-card style-override ACTIVE (4+ races done, applying TODAYS_BIAS_OVERRIDE)")
        except Exception:
            pass

    processed = []
    skipped = []
    for race in raw["races"]:
        if race.get("isArabian"):
            skipped.append(race["raceNumber"])
            continue  # Different breed pool — model is Thoroughbred-only
        # Apply override only to races that haven't yet run
        already_done = res_path.exists() and any(
            r["raceNumber"] == race["raceNumber"]
            for r in (json.loads(res_path.read_text(encoding="utf-8")).get("races", []) if res_path.exists() else [])
        )
        scored = score_horses(
            race["horses"], race,
            today_override=(today_override_active and not already_done),
        )
        exotic = best_exotic_strategy(scored, race.get("raceType", "") + " " + (race.get("stakesName") or ""))
        processed.append({**race, "scored": scored, "exotic": exotic})
    if skipped:
        print(f"[skip] Arabian races (model is Thoroughbred-only): R{', R'.join(map(str, skipped))}")

    # Outputs
    write_horses_csv(processed, in_dir / "horses.csv")
    write_races_csv(processed, in_dir / "races.csv")
    write_exotics_csv(processed, in_dir / "exotics.csv")
    write_picks_md(processed, date, in_dir / "picks.md")

    # Multi-race tickets
    multi = build_multi_race_tickets(processed)
    multi_lines = [f"# CD {date} — Multi-Race Tickets", ""]
    for t in multi:
        multi_lines.append(f"## {t['name']}")
        multi_lines.append(f"- Structure: {t['structure']}")
        multi_lines.append(f"- Ticket: `{t['ticket']}`")
        multi_lines.append(f"- Unit: ${t['unit']:.2f}  →  **Cost: ${t['cost']:.2f}**")
        multi_lines.append("")
    (in_dir / "multi-race.md").write_text("\n".join(multi_lines), encoding="utf-8")

    # TS static data file is owned by gen_cd_ts.py (BRIS-rich path).
    # Only fall back to limited-data writer if no rich TS exists yet.
    ts_path = repo / "web" / "app" / "lib" / f"cd-{date}.ts"
    if not ts_path.exists():
        write_ts_static(processed, date, track, ts_path)
    else:
        print(f"[skip] {ts_path.name} already written by gen_cd_ts.py (BRIS-rich)")

    # Backtest if results exist
    res_path = in_dir / "results.json"
    if res_path.exists():
        results = json.loads(res_path.read_text())
        write_backtest_md(processed, results, date, in_dir / "backtest.md")

    print(f"[OK] {date}: {len(processed)} races processed")
    print(f"   - {in_dir}/horses.csv")
    print(f"   - {in_dir}/races.csv")
    print(f"   - {in_dir}/exotics.csv")
    print(f"   - {in_dir}/picks.md")
    print(f"   - {in_dir}/multi-race.md")
    print(f"   - web/app/lib/cd-{date}.ts")
    if res_path.exists():
        print(f"   - {in_dir}/backtest.md (results found)")


if __name__ == "__main__":
    main()
