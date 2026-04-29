#!/usr/bin/env python3
"""
Stage 1 sandbox scorer for Churchill Downs cards.

Architecture (Jason's two-stage spec):
  Stage 1 (this script): pure-data ability model. NO market odds input.
    Inputs:  raw-entries.json (race structure, horse names) + horse-pps.json
             (past performances scraped from HRN/equivalent)
    Output:  modelProb per horse, top-5 ranked by data alone.

  Stage 2 (separate): exit sandbox, compare modelProb to ML/live odds, find
    edges, price exotic tickets via Harville/Plackett-Luce joint probabilities.

This script computes features per horse:
  speedZ        - z-score of mean of last 3 Beyer in similar conditions
  distance_fit  - has the horse run AND been competitive at today's distance?
  form_trend    - slope of last 3 Beyers (positive = improving)
  layoff_adj    - penalty for long layoffs, class-aware (Apr 18 Keeneland fix)
  class_signal  - trainer / jockey tier bonuses from cd-context.ts

Composite weights vary by race profile (marathon weights distance heavier than
sprints; MSW for 2yo can't use speed since horses are first-time-starters).

Output: data/cd-{date}/sandbox-picks.md (analog to picks.md but Stage 1 only)
        data/cd-{date}/sandbox-scores.json (machine-readable for stage 2)

Usage: python3 scripts/sandbox_score.py 2026-04-29
"""
from __future__ import annotations

import json
import math
import statistics
import sys
from datetime import datetime
from pathlib import Path

# ─── Configuration ────────────────────────────────────────────────────────────

# Race-profile-specific feature weights. Marathons weight distance heavily;
# sprints weight raw speed; turf races weight pace/post heavily.
WEIGHTS_BY_PROFILE = {
    "marathon": {  # 1.5m+ dirt or turf
        "speedZ": 0.25,
        "distance_fit": 0.40,
        "form_trend": 0.20,
        "class_signal": 0.15,
    },
    "route": {  # 1m to 1 7/16m
        "speedZ": 0.35,
        "distance_fit": 0.20,
        "form_trend": 0.20,
        "class_signal": 0.25,
    },
    "sprint": {  # under 1m
        "speedZ": 0.45,
        "distance_fit": 0.15,
        "form_trend": 0.20,
        "class_signal": 0.20,
    },
    "msw_2yo": {  # 2yo Maiden Special Weight — debut-heavy
        "speedZ": 0.10,
        "distance_fit": 0.10,
        "form_trend": 0.10,
        "class_signal": 0.70,  # all signal is in trainer/jockey/sire
    },
}

# Top CD spring-meet trainers + jockeys (mirrors cd-context.ts but we own the
# weights here so we can tune). Bonus = 0.0 to 1.0.
TRAINER_TIER = {
    "todd a. pletcher": 0.55, "todd pletcher": 0.55,
    "brad h. cox": 0.55, "brad cox": 0.55,
    "chad c. brown": 0.55, "chad brown": 0.55,
    "william i. mott": 0.50, "bill mott": 0.50,
    "steven m. asmussen": 0.45, "steve asmussen": 0.45,
    "brendan p. walsh": 0.45, "brendan walsh": 0.45,
    "wesley a. ward": 0.45, "wesley ward": 0.45,
    "h. graham motion": 0.40, "graham motion": 0.40,
    "kenneth g. mcpeek": 0.40, "ken mcpeek": 0.40,
    "michael j. maker": 0.40,
    "saffie a. joseph, jr.": 0.35,
    "ian r. wilkes": 0.35,
    "mark e. casse": 0.35,
    "joe sharp": 0.35,
    "rodolphe brisset": 0.30,
    "philip a. bauer": 0.30,
    "d. whitworth beckman": 0.30,
    "albert m. stall, jr.": 0.30,
    "norm w. casse": 0.30,
}

# Trainer specialties — extra bonus for race profile match
TRAINER_SPECIALTY = {
    "william i. mott": {"marathon": 0.20, "route": 0.10},  # Mott marathons
    "brad h. cox": {"route": 0.15},                          # Cox dirt routes
    "chad c. brown": {"turf_route": 0.20},                   # Brown turf
    "wesley a. ward": {"sprint_2yo": 0.30, "msw_2yo": 0.30},# Ward 2yo speed
    "todd a. pletcher": {"msw_2yo": 0.20, "stakes": 0.10},
    "michael j. maker": {"turf_route": 0.15, "claiming": 0.10},
}

JOCKEY_TIER = {
    "irad ortiz, jr.": 0.50, "irad ortiz jr.": 0.50, "irad ortiz": 0.50,
    "jose l. ortiz": 0.45, "jose ortiz": 0.45,
    "luis saez": 0.45,
    "tyler gaffalione": 0.45,
    "joel rosario": 0.45,
    "flavien prat": 0.45,
    "john r. velazquez": 0.40,
    "brian joseph hernandez, jr.": 0.40, "brian hernandez jr.": 0.40,
    "florent geroux": 0.35,
    "junior alvarado": 0.35,
    "javier castellano": 0.35,
    "juan j. hernandez": 0.30,
}


# ─── Race profile classification ──────────────────────────────────────────────

def parse_furlongs(distance: str) -> float:
    """Convert '1 1/16m' / '6f' / '4 1/2f' / '1m' → furlongs (decimal)."""
    d = distance.strip()
    if d.endswith("m") or d.endswith("M"):
        body = d[:-1].strip()
        if " " in body:  # mixed fraction "1 1/16"
            whole, frac = body.split(" ", 1)
            num, denom = frac.split("/")
            return (float(whole) + float(num) / float(denom)) * 8
        return float(body) * 8
    if d.endswith("f") or d.endswith("F"):
        body = d[:-1].strip()
        if " " in body:
            whole, frac = body.split(" ", 1)
            num, denom = frac.split("/")
            return float(whole) + float(num) / float(denom)
        return float(body)
    return 8.0


def classify_profile(race: dict) -> str:
    """Map race → weight profile key."""
    furlongs = parse_furlongs(race["distance"])
    race_type = (race.get("raceType", "") + " " + race.get("stakesName", "")).lower()
    is_2yo = ("2yo" in race_type or "2-year-old" in race_type
              or "juvenile" in race_type)

    if "msw" in race_type and is_2yo:
        return "msw_2yo"
    if furlongs >= 12:  # 1.5m+
        return "marathon"
    if furlongs >= 8:
        return "route"
    return "sprint"


# ─── Feature extraction ───────────────────────────────────────────────────────

def safe_mean(xs: list[float | None]) -> float | None:
    vals = [x for x in xs if x is not None and not (isinstance(x, float) and math.isnan(x))]
    return statistics.mean(vals) if vals else None


def extract_beyers(pps: list[dict], n: int = 3, surface_filter: str | None = None,
                   min_furlongs: float | None = None) -> list[float]:
    """Pull last-N Beyer figures, optionally filtered by surface or distance."""
    out: list[float] = []
    for pp in pps:
        if pp.get("beyer") is None:
            continue
        if surface_filter and (pp.get("surface", "").lower() != surface_filter.lower()):
            continue
        if min_furlongs is not None:
            pp_dist = parse_furlongs(pp.get("distance", "8f"))
            if pp_dist < min_furlongs:
                continue
        out.append(float(pp["beyer"]))
        if len(out) >= n:
            break
    return out


def speed_z_score(horse_pps: dict, race: dict, field_beyers: list[float]) -> float:
    """Z-score of horse's mean last-3 Beyer vs the field mean / std dev.

    For marathons, prefer route-distance Beyers (filter min 8f).
    """
    profile = classify_profile(race)
    pps = horse_pps.get("past_performances", [])

    # Pick Beyer pool by profile
    if profile == "marathon":
        beyers = extract_beyers(pps, n=3, min_furlongs=10.0)
        if len(beyers) < 2:  # fall back to all
            beyers = extract_beyers(pps, n=3)
    elif profile == "sprint":
        beyers = extract_beyers(pps, n=3, surface_filter=None)
        # For sprints we don't filter by distance (faster Beyers count)
    else:
        beyers = extract_beyers(pps, n=3)

    if not beyers:
        return 0.0  # no signal — neutral

    horse_mean = statistics.mean(beyers)
    if not field_beyers or len(field_beyers) < 2:
        return 0.0

    field_mean = statistics.mean(field_beyers)
    field_std = statistics.stdev(field_beyers) if len(field_beyers) > 1 else 5.0
    field_std = max(field_std, 3.0)  # floor — avoid divide-by-tiny

    return (horse_mean - field_mean) / field_std


def distance_fit(horse_pps: dict, race: dict) -> float:
    """How well does the horse's PP profile match today's distance?

    +1.0  has won at this distance + surface
    +0.7  has competed (top 3) at this distance
    +0.4  has competed within 1 furlong of this distance
    +0.0  unknown / no PPs
    -0.5  never run within 2 furlongs of this distance
    -1.0  way out of comfort zone (sprinter at marathon, etc.)
    """
    pps = horse_pps.get("past_performances", [])
    if not pps:
        return 0.0

    target_furl = parse_furlongs(race["distance"])
    target_surface = race.get("surface", "Dirt").lower()

    has_won = False
    has_top3 = False
    has_competed_close = False
    has_competed_within_2f = False
    max_furl_competed = 0.0

    for pp in pps:
        pp_furl = parse_furlongs(pp.get("distance", "8f"))
        max_furl_competed = max(max_furl_competed, pp_furl)
        pp_surface = pp.get("surface", "").lower()

        # Surface gate: only count same-surface starts for fit, but track if
        # horse has gone the distance on any surface as a fallback signal.
        same_surface = target_surface[:3] in pp_surface[:3]

        dist_gap = abs(pp_furl - target_furl)

        if dist_gap <= 0.5 and same_surface:
            has_competed_close = True
            if pp.get("finish") == 1:
                has_won = True
            elif (pp.get("finish") or 99) <= 3:
                has_top3 = True
        elif dist_gap <= 1.0 and same_surface:
            has_competed_close = True
        elif dist_gap <= 2.0 and same_surface:
            has_competed_within_2f = True

    # Marathon-specific: never run within 2 furlongs of 1.5m → big penalty
    if target_furl >= 12 and max_furl_competed < target_furl - 2:
        return -1.0

    if has_won:
        return 1.0
    if has_top3:
        return 0.7
    if has_competed_close:
        return 0.4
    if has_competed_within_2f:
        return 0.0
    return -0.5


def form_trend(horse_pps: dict) -> float:
    """Slope of last-3 Beyer figures normalized to [-1, +1].

    Positive = improving, negative = declining. Captures form cycle.
    """
    pps = horse_pps.get("past_performances", [])
    beyers = extract_beyers(pps, n=3)
    if len(beyers) < 2:
        # Use finish positions as fallback signal
        finishes = [pp.get("finish") for pp in pps[:3]
                    if pp.get("finish") is not None]
        if len(finishes) < 2:
            return 0.0
        # Win recently? bonus. Bad recently? penalty.
        last = finishes[0]
        if last == 1:
            return 0.7
        if last <= 3:
            return 0.3
        if last >= 7:
            return -0.4
        return 0.0

    # Beyer slope: last vs earlier (PPs are in reverse chronological order)
    if len(beyers) == 2:
        slope = beyers[0] - beyers[1]
    else:
        slope = beyers[0] - statistics.mean(beyers[1:])

    return max(-1.0, min(1.0, slope / 15.0))  # 15 Beyer points = full ±1


def layoff_adjustment(horse_pps: dict, race: dict) -> float:
    """Penalty for long layoffs, class-aware.

    Apr 18 Keeneland learning: layoff penalty halves if peak Beyer ≥ 82.
    """
    pps = horse_pps.get("past_performances", [])
    if not pps:
        return 0.0

    last_pp = pps[0]
    last_date_str = last_pp.get("date")
    if not last_date_str:
        return 0.0

    try:
        last_date = datetime.fromisoformat(last_date_str)
    except ValueError:
        return 0.0

    today = datetime.fromisoformat(race.get("date", "2026-04-29"))
    days_off = (today - last_date).days

    # Form cycle adjustments
    base_adj = 0.0
    if days_off <= 14:
        base_adj = -0.10  # too quick turnaround
    elif days_off <= 35:
        base_adj = +0.10  # optimal rest
    elif days_off <= 60:
        base_adj = 0.0    # neutral
    elif days_off <= 90:
        base_adj = -0.20
    else:
        base_adj = -0.40  # extended layoff

    # Class-aware: if peak Beyer ≥ 82, halve the penalty (peak class survives)
    if base_adj < 0:
        career_best = horse_pps.get("career_best_beyer") or 0
        if career_best >= 82:
            base_adj = base_adj * 0.5

    return base_adj


def class_signal(horse_pps: dict, horse: dict, race: dict) -> float:
    """Trainer + jockey tier bonus, with race-profile specialty boost."""
    profile = classify_profile(race)
    trainer = (horse.get("trainer", "") or "").lower().strip()
    jockey = (horse.get("jockey", "") or "").lower().strip()

    t_base = TRAINER_TIER.get(trainer, 0.0)
    j_base = JOCKEY_TIER.get(jockey, 0.0)

    # Specialty bonus
    surface = race.get("surface", "").lower()
    is_turf = "turf" in surface
    is_stakes = ("stakes" in race.get("raceType", "").lower())

    spec_key = profile
    if is_turf and "route" in profile:
        spec_key = "turf_route"
    elif is_stakes:
        spec_key = "stakes"

    specialty = TRAINER_SPECIALTY.get(trainer, {}).get(spec_key, 0.0)
    if profile == "msw_2yo" and trainer == "wesley a. ward":
        specialty = max(specialty, 0.30)

    # Composite (each 0-1 contribution → mapped to ~[-0.2, +1.0])
    raw = t_base + j_base + specialty
    return max(-0.5, min(1.5, raw)) - 0.4  # center near zero


# ─── Composite scoring + softmax ──────────────────────────────────────────────

def score_horse(horse: dict, horse_pps: dict, race: dict,
                field_beyers: list[float]) -> dict:
    """Compute all features + composite score for one horse."""
    profile = classify_profile(race)
    weights = WEIGHTS_BY_PROFILE[profile]

    f_speed = speed_z_score(horse_pps, race, field_beyers)
    f_dist = distance_fit(horse_pps, race)
    f_form = form_trend(horse_pps)
    f_class = class_signal(horse_pps, horse, race)
    f_layoff = layoff_adjustment(horse_pps, race)

    composite = (
        weights["speedZ"] * f_speed
        + weights["distance_fit"] * f_dist
        + weights["form_trend"] * f_form
        + weights["class_signal"] * f_class
        + 0.10 * f_layoff  # additive — not a profile-tuned weight
    )

    return {
        "program": horse.get("program"),
        "name": horse.get("name"),
        "trainer": horse.get("trainer"),
        "jockey": horse.get("jockey"),
        "post_position": horse.get("postPosition"),
        "ml_odds": horse.get("mlOdds"),
        "n_pps": len(horse_pps.get("past_performances", [])),
        "career_best_beyer": horse_pps.get("career_best_beyer"),
        "features": {
            "speedZ": round(f_speed, 3),
            "distance_fit": round(f_dist, 3),
            "form_trend": round(f_form, 3),
            "class_signal": round(f_class, 3),
            "layoff_adj": round(f_layoff, 3),
        },
        "composite": round(composite, 4),
        "profile": profile,
    }


def softmax(scores: list[float], beta: float = 2.5) -> list[float]:
    """Stable softmax with temperature beta."""
    max_s = max(scores)
    exps = [math.exp(beta * (s - max_s)) for s in scores]
    total = sum(exps)
    return [e / total for e in exps]


def score_race(race: dict, horse_pps: dict) -> dict:
    """Score every horse in a race; return ranked output with modelProb."""
    horses = race.get("horses", [])
    if not horses:
        return {**race, "scored": [], "field_beyers": []}

    # Build field beyer pool — used for z-scoring speed
    field_beyers: list[float] = []
    for h in horses:
        pps = horse_pps.get(h["name"], {}).get("past_performances", [])
        bs = extract_beyers(pps, n=3)
        if bs:
            field_beyers.append(statistics.mean(bs))

    # Score
    scored = []
    for h in horses:
        h_pps = horse_pps.get(h["name"], {})
        scored.append(score_horse(h, h_pps, race, field_beyers))

    # Softmax → modelProb
    composites = [s["composite"] for s in scored]
    probs = softmax(composites, beta=2.5)
    for s, p in zip(scored, probs):
        s["model_prob"] = round(p, 4)

    # Add market prob (Stage 2 input — computed but not used for Stage 1)
    raw_market = [1.0 / (s["ml_odds"] + 1.0) if s["ml_odds"] else 0.05
                  for s in scored]
    market_total = sum(raw_market) or 1.0
    for s, raw in zip(scored, raw_market):
        s["market_prob"] = round(raw / market_total, 4)
        s["edge"] = round(s["model_prob"] - s["market_prob"], 4)

    # Sort by model_prob (Stage 1 ranking)
    scored.sort(key=lambda x: -x["model_prob"])
    for i, s in enumerate(scored):
        s["model_rank"] = i + 1

    return {**race, "scored": scored, "field_beyers": field_beyers}


# ─── Harville exotic pricing ──────────────────────────────────────────────────

def harville_top3_probs(scored: list[dict]) -> list[tuple]:
    """Return all 1-2-3 orderings with joint probabilities (top 6 horses only).

    P(1=i) = p[i]
    P(2=j | 1=i) = p[j] / (1 - p[i])
    P(3=k | 1,2) = p[k] / (1 - p[i] - p[j])
    """
    top = scored[:6]  # cap to avoid combinatoric blowup
    out = []
    for i in range(len(top)):
        for j in range(len(top)):
            if j == i:
                continue
            for k in range(len(top)):
                if k == i or k == j:
                    continue
                pi = top[i]["model_prob"]
                pj = top[j]["model_prob"]
                pk = top[k]["model_prob"]
                p_first = pi
                denom2 = 1 - pi
                if denom2 <= 0:
                    continue
                p_second = pj / denom2
                denom3 = 1 - pi - pj
                if denom3 <= 0:
                    continue
                p_third = pk / denom3
                joint = p_first * p_second * p_third
                out.append((top[i]["program"], top[j]["program"],
                            top[k]["program"], joint))
    out.sort(key=lambda x: -x[3])
    return out


def recommend_exotic(scored: list[dict]) -> dict:
    """Stage 1 exotic recommendation based on edge concentration.

    Logic:
    - If single horse has edge > +5%, key it on top
    - If 2-3 horses cluster with positive edge, box them
    - If race is wide-open or full of fades, pass on win, look at exotic chaos
    """
    n = len(scored)
    if n < 4:
        return {"recommendation": "PASS — small field"}

    edges = sorted([s for s in scored], key=lambda x: -x["edge"])
    top_edge = edges[0]
    top_3_edge = sum(e["edge"] for e in edges[:3])

    primary = None
    if top_edge["edge"] >= 0.05:
        # Key the value horse over top model picks
        top_model = scored[:4]
        unders = [s["program"] for s in top_model
                  if s["program"] != top_edge["program"]][:3]
        primary = {
            "structure": f"Trifecta key #{top_edge['program']} 1st OVER top 3 model",
            "key_horse": f"#{top_edge['program']} {top_edge['name']}",
            "key_horse_edge_pct": round(top_edge["edge"] * 100, 1),
            "tickets": [f"{top_edge['program']} / {','.join(unders)} / {','.join(unders)}"],
            "unit_cost": 0.50,
            "total_cost": round(0.50 * len(unders) * (len(unders) - 1), 2),
            "rationale": (
                f"Stage 1 says #{top_edge['program']} {top_edge['name']} is "
                f"{round(top_edge['edge']*100,1)}% overlay vs market. "
                f"Key in 1st position over the model's top 3 finishers."
            ),
        }
    elif top_3_edge >= 0.08:
        # Multiple-overlay race: box the value horses
        boxers = [e["program"] for e in edges[:3]]
        primary = {
            "structure": "Trifecta 3-horse box (multiple overlay)",
            "tickets": [f"{'-'.join(boxers)} BOX"],
            "unit_cost": 0.50,
            "total_cost": 3.0,
            "rationale": (
                f"Three positive-edge horses cluster: "
                f"{', '.join('#' + e['program'] + ' ' + e['name'][:15] for e in edges[:3])}. "
                f"Stage 1 says market is wrong on multiple fronts."
            ),
        }
    else:
        # Stage 1 agrees with market — chaos super or pass
        primary = {
            "structure": "Superfecta 4-horse box (Stage 1 agrees with market)",
            "tickets": [f"{'-'.join(s['program'] for s in scored[:4])} BOX"],
            "unit_cost": 0.10,
            "total_cost": 2.40,
            "rationale": "No material model-vs-market edges. Stage 1 model agrees with chalk.",
        }

    # Always add Harville top-3 probabilities
    h3 = harville_top3_probs(scored)
    primary["top_5_harville"] = [
        {"order": f"{a}-{b}-{c}", "joint_prob_pct": round(p * 100, 2)}
        for a, b, c, p in h3[:5]
    ]

    return primary


# ─── Output writers ───────────────────────────────────────────────────────────

def write_sandbox_picks_md(processed: list[dict], date: str, out_path: Path):
    lines = [
        f"# CD {date} — Stage 1 SANDBOX picks",
        "",
        f"_Generated {datetime.now().isoformat(timespec='seconds')}._",
        "",
        "**No market data input.** Pure Stage 1 pure-data ability scoring.",
        "Edge column compares to ML for diagnostic purposes only — used for Stage 2.",
        "",
        "Composite weights vary by race profile (marathon/route/sprint/msw_2yo).",
        "",
        "---",
        "",
    ]
    for r in processed:
        post = r.get("postTime", "?")
        purse = r.get("purse", 0)
        rt = r.get("raceType", "")
        stakes = r.get("stakesName", "")
        profile = classify_profile(r)
        lines.append(
            f"## R{r['raceNumber']} — {post} • {r['distance']} {r['surface']} • "
            f"${purse:,} • {rt} _(profile: {profile})_"
        )
        if stakes:
            lines.append(f"**{stakes}**")
        lines.append("")
        lines.append("| Stage1 | # | Horse | T/J | speedZ | distFit | form | class | "
                     "Composite | Stage1 % | Mkt % | **Edge** |")
        lines.append("|---|---|---|---|---|---|---|---|---|---|---|---|")
        for s in r["scored"][:8]:
            f = s["features"]
            edge = s["edge"]
            edge_marker = "✅" if edge > 0.05 else ("🔻" if edge < -0.05 else "")
            lines.append(
                f"| {s['model_rank']} | {s['program']} | {s['name']} | "
                f"{(s['trainer'] or '?')[:14]}/{(s['jockey'] or '?')[:14]} | "
                f"{f['speedZ']:+.2f} | {f['distance_fit']:+.2f} | "
                f"{f['form_trend']:+.2f} | {f['class_signal']:+.2f} | "
                f"{s['composite']:+.3f} | "
                f"**{s['model_prob']*100:.1f}%** | "
                f"{s['market_prob']*100:.1f}% | "
                f"**{edge*100:+.1f}** {edge_marker} |"
            )
        # Exotic rec
        ex = recommend_exotic(r["scored"])
        lines.append("")
        lines.append(f"**Stage 1 exotic rec:** {ex.get('structure','?')}")
        if ex.get("tickets"):
            for t in ex["tickets"]:
                lines.append(f"- Ticket: `{t}` @ ${ex.get('unit_cost')} = "
                             f"**${ex.get('total_cost')}**")
        if ex.get("rationale"):
            lines.append(f"_{ex['rationale']}_")
        if ex.get("top_5_harville"):
            lines.append("")
            lines.append("**Top 5 Harville top-3 orderings:**")
            for h in ex["top_5_harville"]:
                lines.append(f"- {h['order']} → {h['joint_prob_pct']}%")
        lines.append("")
        lines.append("---")
        lines.append("")
    out_path.write_text("\n".join(lines), encoding="utf-8")


def write_sandbox_scores_json(processed: list[dict], date: str, out_path: Path):
    """Machine-readable scores file for Stage 2 / pattern analysis."""
    payload = {
        "date": date,
        "generated_at": datetime.now().isoformat(),
        "races": [
            {
                "race_number": r["raceNumber"],
                "post_time": r.get("postTime"),
                "distance": r["distance"],
                "surface": r["surface"],
                "race_type": r.get("raceType"),
                "stakes_name": r.get("stakesName"),
                "profile": classify_profile(r),
                "field_size": len(r.get("horses", [])),
                "scored": r["scored"],
                "exotic": recommend_exotic(r["scored"]),
            }
            for r in processed
        ],
    }
    out_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sandbox_score.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    repo = Path(__file__).resolve().parent.parent
    in_dir = repo / "data" / f"cd-{date}"
    entries_path = in_dir / "raw-entries.json"
    pps_path = in_dir / "horse-pps.json"

    if not entries_path.exists():
        print(f"ERROR: {entries_path} not found")
        sys.exit(2)
    if not pps_path.exists():
        print(f"WARNING: {pps_path} not found — running with empty PP data "
              "(Stage 1 will be near-flat)")
        horse_pps = {"horses": {}}
    else:
        horse_pps = json.loads(pps_path.read_text())

    raw = json.loads(entries_path.read_text())
    pps_by_name = horse_pps.get("horses", {})

    processed = []
    for race in raw["races"]:
        race["date"] = date  # for layoff calculation
        scored = score_race(race, pps_by_name)
        processed.append(scored)

    # Outputs
    write_sandbox_picks_md(processed, date, in_dir / "sandbox-picks.md")
    write_sandbox_scores_json(processed, date, in_dir / "sandbox-scores.json")

    # Console summary — what patterns?
    print(f"✅ {date}: {len(processed)} races scored (Stage 1 sandbox)")
    print(f"   - {in_dir}/sandbox-picks.md")
    print(f"   - {in_dir}/sandbox-scores.json")
    print()
    print("📊 PATTERN SCAN — biggest model-vs-market edges across card:")
    all_horses = []
    for r in processed:
        for s in r["scored"]:
            all_horses.append({
                "race": r["raceNumber"],
                "edge": s["edge"],
                "name": s["name"],
                "program": s["program"],
                "ml": s["ml_odds"],
                "model_pct": s["model_prob"] * 100,
            })
    all_horses.sort(key=lambda x: -x["edge"])
    print()
    print("  TOP 10 OVERLAYS (model says > market):")
    for h in all_horses[:10]:
        print(f"    R{h['race']} #{h['program']:>3} {h['name'][:24]:24s} "
              f"ML {h['ml']:>5} → model {h['model_pct']:5.1f}%  "
              f"edge {h['edge']*100:+5.1f}%")
    print()
    print("  TOP 10 FADES (market says > model):")
    for h in all_horses[-10:]:
        print(f"    R{h['race']} #{h['program']:>3} {h['name'][:24]:24s} "
              f"ML {h['ml']:>5} → model {h['model_pct']:5.1f}%  "
              f"edge {h['edge']*100:+5.1f}%")


if __name__ == "__main__":
    main()
