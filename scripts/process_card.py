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

Scoring approach:
  1. Market-implied probability from ML odds, normalized within race (strips takeout)
  2. CD track-bias post-position adjustment via cd-context defaults
  3. Trainer/jockey tier bonuses (top CD performers per cd-context.ts)
  4. Ability factor from BRIS Prime Power + last-3 Beyer (z-scored within field)
  5. Renormalized to sum to 1.0

EDGE GUARDRAILS (added 2026-05-02 after DeepSeek + Kimi adversarial reviews):
  The model is a market-shadow: scores are perturbations of normalized market
  probabilities. When the algo's top-2 = market's top-2 (by ML odds), the
  exacta-box "edge" is illusory — you're paying 22% takeout to bet two
  market-supported horses. We now compute a `chalk_overlap` bin (0/1/2) per
  race and downsize or PASS bet recommendations in the 2-overlap bin.

  Disabled by default (because reviewers correctly flagged them as overfits):
    - chalk-doubt pool-disparity penalty (set DISABLE_CHALK_DOUBT=False to re-enable)
    - intra-card style-bias override / Tweak B (pass --enable-tweak-b to re-enable)

  Use --strict to force PASS on 2-overlap races (no bet placed at all).

Usage: python3 scripts/process_card.py 2026-04-26 [--strict] [--enable-tweak-b] [--enable-chalk-doubt]
"""
import csv
import json
import math
import sys
from datetime import datetime
from pathlib import Path

# Edge-guardrail defaults. CLI flags override.
DISABLE_CHALK_DOUBT = True   # was active through 2026-04-30; demoted per algo-perf-summary meta-lesson + reviewer feedback
DISABLE_TWEAK_B = True       # intra-card style-bias override contaminates the algo (Kimi); off by default
STRICT_EDGE_MODE = False     # if True, PASS on 2-overlap races instead of downsizing

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
    "philip damato": 0.03,
    "thomas drury jr.": 0.03, "thomas drury": 0.03,
    "lauren robson": 0.03,
    # Added after R2 audit on 4-30 — Foley won R2 with She'z the Law (15/1 ML → 1.6 live).
    # Handoff doc explicitly flagged this gap.
    "gregory d. foley": 0.04, "greg foley": 0.04,
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


def _pool_disparity_factor(h: dict, live_odds_rank: int | None = None) -> tuple[float, float]:
    """Pool-disparity factor — secondary signal only after 2026-05-02 review.

    The W%-P% gap captures three signals at different price tiers:
      - Live odds top-3 + W%-P% < -5: PUBLIC CHALK DOUBT (gated by DISABLE_CHALK_DOUBT)
      - Live odds 5/1-12/1 + W%-P% < -3: SHARP WIN-BET → mild bonus ×1.05
      - Any tier + W%-P% > +1.5: SMART BOARD MONEY → mild bonus ×1.05

    Chalk-doubt was 4/4 in claiming/maiden/allowance on 2026-04-30 then 0/3 in
    stakes (R9 Lagynos, R10 Maximum Bourbon, R11 Cy Fair — all chalks won).
    DeepSeek + Kimi adversarial reviews flagged this as an N=7 overfit. Now
    OFF by default; controlled by module-level DISABLE_CHALK_DOUBT.

    Returns (gap_in_pct_points, multiplier).
    """
    wp = h.get("winPoolPct")
    pp = h.get("placePoolPct")
    if wp is None or pp is None:
        return (0.0, 1.0)
    gap = float(pp) - float(wp)
    live = h.get("mlOdds") or 99.0

    if gap > 1.5:
        bonus = 1.0 + min(0.05, 0.012 * gap)
        return (gap, bonus)

    if gap < -3.0:
        is_chalk = (live_odds_rank is not None and live_odds_rank <= 3) or (live <= 3.0)
        if is_chalk:
            if DISABLE_CHALK_DOUBT:
                return (gap, 1.0)
            penalty = max(0.7, 1.0 + 0.05 * gap)
            return (gap, penalty)
        if 4.5 <= live <= 13.0 and gap < -3.0:
            bonus = 1.0 + min(0.06, -0.010 * gap)
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

        # Pool disparity (4-for-4 today on chalk-doubt; new dual-mode for mid-price)
        pool_gap, pool_factor = _pool_disparity_factor(h, live_rank.get(idx))
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


def compute_chalk_overlap(scored: list, k: int = 2) -> dict:
    """Compute overlap between algo top-k and market top-k (by ML odds rank).

    Per DeepSeek + Kimi adversarial review (2026-05-02): the algo's "ordering edge"
    over the market is unfalsifiable in the 2-overlap bin (where algo top-k =
    market top-k). In that bin, the exacta box is just paying takeout to bet two
    market-supported horses. Bet recommendations should be downsized or skipped.

    Returns:
        overlap_count: 0/1/2 = how many of algo's top-k are also in market's top-k
        algo_topk: programs of algo top-k (highest score first)
        market_topk: programs of market top-k (lowest ML odds first)
        tier: "FULL_EDGE" | "PARTIAL_EDGE" | "CHALK_MATCH"
    """
    if len(scored) < k:
        return {"overlap_count": 0, "algo_topk": [], "market_topk": [], "tier": "FULL_EDGE"}
    algo_topk = [s["program"] for s in scored[:k]]
    by_ml = sorted(scored, key=lambda s: float(s.get("mlOdds") or 99.0))
    market_topk = [s["program"] for s in by_ml[:k]]
    overlap = len(set(algo_topk) & set(market_topk))
    if overlap >= k:
        tier = "CHALK_MATCH"
    elif overlap == 0:
        tier = "FULL_EDGE"
    else:
        tier = "PARTIAL_EDGE"
    return {
        "overlap_count": overlap,
        "algo_topk": algo_topk,
        "market_topk": market_topk,
        "tier": tier,
    }


def best_exotic_strategy(scored: list, race_type: str) -> dict:
    """Recommend an exotic bet structure based on score concentration.
    Returns the PRIMARY rec; alt structures are returned in `alternates`.

    EDGE GUARDRAIL: computes chalk_overlap and downsizes (or PASSes in --strict
    mode) when algo top-2 = market top-2. In that bin the algo has no
    demonstrable edge over the market — see DeepSeek + Kimi adversarial reviews
    2026-05-02.
    """
    overlap = compute_chalk_overlap(scored, k=2)
    n = len(scored)
    if n < 4:
        return {
            "recommendation": "PASS — too small a field for exotic",
            "structure": "PASS",
            "tickets": [],
            "unit_cost": 0,
            "total_cost": 0,
            "chalk_overlap": overlap,
            "edge_tier": overlap["tier"],
        }

    top_score = scored[0]["score"]
    top2 = sum(s["score"] for s in scored[:2])
    top3 = sum(s["score"] for s in scored[:3])
    top4 = sum(s["score"] for s in scored[:4])
    top5 = sum(s["score"] for s in scored[:5]) if n >= 5 else top4

    # Always offer a cheap exacta box as a baseline alternate
    ex_box_3 = {
        "structure": "Exacta 3-horse box",
        "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']} BOX"],
        "unit_cost": 1.00,
        "total_cost": 6.0,
        "hit_prob_est": top3 * 0.7,
    }

    # Decision rules — choose primary
    if top_score >= 0.34:
        # Dominant horse — key wheel beats a box
        primary = {
            "structure": "Trifecta key 1st OVER top 3",
            "tickets": [f"{scored[0]['program']} / {scored[1]['program']},{scored[2]['program']},{scored[3]['program']} / {scored[1]['program']},{scored[2]['program']},{scored[3]['program']}"],
            "unit_cost": 0.50,
            "total_cost": 3.0,  # 1×3×2 = 6 valid combos × $0.50
            "hit_prob_est": top_score * (top4 - top_score) / max(0.01, 1 - top_score),
            "rationale": f"#{scored[0]['program']} {scored[0]['name']} dominates at {top_score:.0%}. Single on top, spread under.",
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
        primary = {
            "structure": "Trifecta 3-horse box",
            "tickets": [f"{scored[0]['program']}-{scored[1]['program']}-{scored[2]['program']} BOX"],
            "unit_cost": 0.50,
            "total_cost": 3.0,
            "hit_prob_est": top3 * 0.55,
            "rationale": f"Top 3 cover {top3:.0%} — tri box at $0.50.",
            "alternates": [ex_box_3],
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

    # Apply edge guardrail based on chalk_overlap
    primary["chalk_overlap"] = overlap
    primary["edge_tier"] = overlap["tier"]
    if overlap["tier"] == "CHALK_MATCH":
        if STRICT_EDGE_MODE:
            return {
                "recommendation": "PASS — algo top-2 = market top-2; no edge to monetize",
                "structure": "PASS (CHALK MATCH)",
                "tickets": [],
                "unit_cost": 0,
                "total_cost": 0,
                "chalk_overlap": overlap,
                "edge_tier": "CHALK_MATCH",
                "rationale": (
                    f"Algo top-2 ({'-'.join(overlap['algo_topk'])}) = market top-2. "
                    "Paying 22% takeout on a market chalk box is negative-EV in expectation."
                ),
            }
        # Non-strict: downsize 50% and add warning
        if primary.get("unit_cost"):
            primary["unit_cost"] = round(primary["unit_cost"] / 2.0, 2)
        if primary.get("total_cost"):
            primary["total_cost"] = round(primary["total_cost"] / 2.0, 2)
        primary["rationale"] = (
            f"⚠️ CHALK MATCH (algo top-2 = market top-2): downsized 50%. "
            + primary.get("rationale", "")
        )
    elif overlap["tier"] == "PARTIAL_EDGE":
        primary["rationale"] = (
            f"PARTIAL EDGE (1 of algo top-2 not in market top-2): "
            + primary.get("rationale", "")
        )
    elif overlap["tier"] == "FULL_EDGE":
        primary["rationale"] = (
            f"FULL EDGE (neither algo top-2 in market top-2): "
            + primary.get("rationale", "")
        )
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
    # Aggregate edge-tier counts for the bankroll discipline header
    tier_counts = {"FULL_EDGE": 0, "PARTIAL_EDGE": 0, "CHALK_MATCH": 0, "PASS": 0}
    total_cost = 0.0
    for r in processed_races:
        ex = r.get("exotic") or {}
        tier = ex.get("edge_tier") or "PASS"
        tier_counts[tier] = tier_counts.get(tier, 0) + 1
        total_cost += float(ex.get("total_cost") or 0)

    lines = [
        f"# CD {date} — Algo Picks & Exotic Recommendations",
        "",
        f"_Generated {datetime.now().isoformat(timespec='seconds')} • BRIS-rich scoring + edge guardrails._",
        "",
        "Scoring inputs: ML odds (market anchor, takeout-stripped via field renorm), post position,",
        "runstyle, jockey/trainer tier, CD track-bias defaults, **Prime Power + best last-3 Beyer",
        "(z-scored within field)**, mud % (wet tracks).",
        "",
        "## Bankroll Discipline (edge-tier breakdown)",
        "",
        "| Tier | Meaning | Race count |",
        "|---|---|---|",
        f"| FULL EDGE | Algo top-2 has 0 horses in market top-2 | {tier_counts.get('FULL_EDGE', 0)} |",
        f"| PARTIAL EDGE | Algo top-2 has 1 horse in market top-2 | {tier_counts.get('PARTIAL_EDGE', 0)} |",
        f"| CHALK MATCH | Algo top-2 = market top-2 (downsized 50% / PASS in --strict) | {tier_counts.get('CHALK_MATCH', 0)} |",
        f"| PASS | Field too small or no recommendation | {tier_counts.get('PASS', 0)} |",
        "",
        f"**Total recommended outlay:** ${total_cost:.2f}",
        "",
        "_Edge tiers are computed from the algo's own scores vs. ML-odds rank._",
        "_2-overlap (CHALK MATCH) is the bin where the algo has no demonstrable edge over the market —_",
        "_per DeepSeek + Kimi adversarial reviews 2026-05-02. Recommendations are downsized in that bin._",
        "",
        "---",
        "",
    ]
    for r in processed_races:
        ex = r.get("exotic") or {}
        tier = ex.get("edge_tier") or "PASS"
        tier_label = {
            "FULL_EDGE": "[FULL EDGE]",
            "PARTIAL_EDGE": "[PARTIAL EDGE]",
            "CHALK_MATCH": "[CHALK MATCH — downsized]",
            "PASS": "[PASS]",
        }.get(tier, "[?]")
        overlap = ex.get("chalk_overlap") or {}
        algo_top2 = "-".join(overlap.get("algo_topk", [])) or "?"
        market_top2 = "-".join(overlap.get("market_topk", [])) or "?"

        lines.append(f"## R{r['raceNumber']} — {r['postTime']} • {r['distance']} {r['surface']} • ${r['purse']:,} • {r['raceType']}")
        if r.get("stakesName"):
            lines.append(f"**{r['stakesName']}**")
        lines.append(f"_{tier_label} • algo top-2: {algo_top2} • market top-2 (ML): {market_top2}_")
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
    """Compare algo top picks to actual results, stratified by chalk_overlap.

    The stratification is the falsification test the adversarial reviewers asked
    for: if positive ROI is concentrated in the 2-overlap (CHALK MATCH) bin, the
    algo is paying takeout to bet market chalk and has no proven edge. Real
    edge would show in the 0-overlap and 1-overlap bins.
    """
    res_by_race = {r["raceNumber"]: r for r in results.get("races", [])}
    lines = [
        f"# CD {date} — Backtest Report (stratified by chalk-overlap)",
        "",
        f"_Algo picks vs actual results from data/cd-{date}/results.json._",
        "_Stratification per DeepSeek + Kimi adversarial reviews 2026-05-02._",
        "",
        "| R | Tier | Algo #1 | Algo #2 | Winner | Top-1 | Top-3 | Algo top-2 | Mkt top-2 | Win $ | Box hit? |",
        "|---|---|---|---|---|---|---|---|---|---|---|",
    ]
    # Stratified totals
    bins = {"FULL_EDGE": [], "PARTIAL_EDGE": [], "CHALK_MATCH": []}
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

        ex = r.get("exotic") or {}
        overlap = ex.get("chalk_overlap") or compute_chalk_overlap(r["scored"], k=2)
        tier = overlap.get("tier", "FULL_EDGE")

        algo_top2_progs = overlap.get("algo_topk", [])
        market_top2_progs = overlap.get("market_topk", [])
        algo_top = [s["program"] for s in r["scored"][:3]]
        algo_top_names = [s["name"] for s in r["scored"][:3]]

        winner_prog = str(result.get("winner", {}).get("program", "?"))
        winner_name = result.get("winner", {}).get("name", "?")
        win_payout = result.get("winPayout") or result.get("winner", {}).get("winPayout") or 0

        # Determine if algo top-2 box "hit" (top 2 finishers in any order)
        # We need actual top-2 finish from results — finish order
        finish_order = result.get("finishOrder") or result.get("officialOrder") or []
        if not finish_order:
            # Fall back: if results format gives winner + place + show
            place_prog = str(result.get("place", {}).get("program", ""))
            finish_top2 = {winner_prog, place_prog} if place_prog else {winner_prog}
        else:
            finish_top2 = {str(p) for p in finish_order[:2]}
        algo_box_hit = finish_top2 == set(str(p) for p in algo_top2_progs)

        algo_hit = "Y" if winner_prog == str(algo_top[0]) else "-"
        top3_hit = "Y" if winner_prog in [str(p) for p in algo_top] else "-"

        if winner_prog == str(algo_top[0]):
            n_top1 += 1
            total_win_payout_if_bet += win_payout
        total_win_cost += 2.0
        if winner_prog in [str(p) for p in algo_top]:
            n_top3 += 1

        bins.setdefault(tier, []).append({
            "race": rn,
            "winner": winner_prog,
            "algo_top1_hit": winner_prog == str(algo_top[0]),
            "algo_top2_box_hit": algo_box_hit,
            "win_payout": float(win_payout) if win_payout else 0.0,
        })

        tier_short = {"FULL_EDGE": "FULL", "PARTIAL_EDGE": "PARTIAL", "CHALK_MATCH": "CHALK"}.get(tier, tier)
        lines.append(
            f"| {rn} | {tier_short} | #{algo_top[0]} {algo_top_names[0]} | "
            f"#{algo_top[1] if len(algo_top)>1 else ''} {algo_top_names[1] if len(algo_top_names)>1 else ''} | "
            f"#{winner_prog} {winner_name} | {algo_hit} | {top3_hit} | "
            f"{'-'.join(algo_top2_progs)} | {'-'.join(market_top2_progs)} | "
            f"${win_payout:.2f} | {'Y' if algo_box_hit else '-'} |"
        )

    lines.append("")
    if n_races > 0:
        net_pl = total_win_payout_if_bet - total_win_cost
        lines.append(f"**Top-1 hit rate**: {n_top1}/{n_races} = **{n_top1/n_races*100:.1f}%**")
        lines.append(f"**Top-3 hit rate**: {n_top3}/{n_races} = **{n_top3/n_races*100:.1f}%**")
        lines.append(f"**$2 WIN bet on top pick all card**: cost ${total_win_cost:.2f}, returned ${total_win_payout_if_bet:.2f}, net **${net_pl:+.2f}**")
        lines.append("")

    # Stratified attribution
    lines.append("## Edge attribution (stratified)")
    lines.append("")
    lines.append("| Tier | Races | Top-1 hits | Box hits | $2 EX BOX cost | Notes |")
    lines.append("|---|---|---|---|---|---|")
    for tier in ("FULL_EDGE", "PARTIAL_EDGE", "CHALK_MATCH"):
        rows = bins.get(tier, [])
        if not rows:
            lines.append(f"| {tier} | 0 | — | — | — | (no races in this bin) |")
            continue
        n = len(rows)
        h1 = sum(1 for r in rows if r["algo_top1_hit"])
        bh = sum(1 for r in rows if r["algo_top2_box_hit"])
        cost = n * 2.0
        note = ""
        if tier == "CHALK_MATCH" and bh:
            note = "Box hits in CHALK MATCH bin = riding market chalk, not edge"
        elif tier == "FULL_EDGE" and bh:
            note = "Box hits in FULL EDGE bin = real ordering edge"
        elif tier == "PARTIAL_EDGE" and bh:
            note = "Partial-edge wins = algo's marginal divergence from market"
        lines.append(f"| {tier} | {n} | {h1}/{n} | {bh}/{n} | ${cost:.2f} | {note} |")

    lines.append("")
    lines.append("**How to read this:** the edge-claim hypothesis is that the algo finds")
    lines.append("real ordering signal beyond the market. That signal would manifest as")
    lines.append("box hits in the FULL EDGE and PARTIAL EDGE bins. If box hits cluster in")
    lines.append("the CHALK MATCH bin, the algo is just paying takeout to bet two")
    lines.append("market-supported horses — no edge.")
    lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def main():
    global DISABLE_CHALK_DOUBT, DISABLE_TWEAK_B, STRICT_EDGE_MODE
    args = sys.argv[1:]
    if not args:
        print("Usage: python3 process_card.py YYYY-MM-DD [--strict] [--enable-tweak-b] [--enable-chalk-doubt]")
        print("  --strict             PASS on chalk-match races (default: downsize 50%)")
        print("  --enable-tweak-b     re-enable mid-card style-bias override (default: off)")
        print("  --enable-chalk-doubt re-enable pool-disparity chalk-doubt penalty (default: off)")
        sys.exit(1)
    date = None
    for a in args:
        if a == "--strict":
            STRICT_EDGE_MODE = True
        elif a == "--enable-tweak-b":
            DISABLE_TWEAK_B = False
        elif a == "--enable-chalk-doubt":
            DISABLE_CHALK_DOUBT = False
        elif not a.startswith("--"):
            date = a
    if date is None:
        print("ERROR: must provide YYYY-MM-DD argument")
        sys.exit(1)

    print(f"[flags] strict={STRICT_EDGE_MODE} chalk_doubt_disabled={DISABLE_CHALK_DOUBT} tweak_b_disabled={DISABLE_TWEAK_B}")

    repo = Path(__file__).resolve().parent.parent
    in_dir = repo / "data" / f"cd-{date}"
    in_path = in_dir / "raw-entries.json"
    if not in_path.exists():
        print(f"ERROR: {in_path} not found")
        sys.exit(2)
    raw = json.loads(in_path.read_text())
    track = raw.get("track", "CD")

    # Tweak B (intra-card style-bias override) — gated behind DISABLE_TWEAK_B.
    # Reviewers correctly identified mid-card hand-tuning as algo contamination
    # (Kimi 2026-05-02). Off by default; pass --enable-tweak-b to restore.
    res_path = in_dir / "results.json"
    today_override_active = False
    if not DISABLE_TWEAK_B and res_path.exists():
        try:
            res = json.loads(res_path.read_text(encoding="utf-8"))
            done = len(res.get("races", []))
            if done >= 4:
                today_override_active = True
                print(f"[bias] Tweak B ACTIVE (4+ races done; --enable-tweak-b override)")
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
