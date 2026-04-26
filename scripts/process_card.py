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
import re
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


def post_iv_for(post: int, bias: dict) -> float:
    if post <= 3:
        return bias["post1to3IV"]
    if post <= 7:
        return bias["post4to7IV"]
    return bias["post8plusIV"]


def style_iv_for(style: str, bias: dict) -> float:
    if not style:
        return 1.0  # no info → neutral
    s = style.upper()
    return {"E": bias["eIV"], "EP": bias["epIV"], "P": bias["pIV"], "S": bias["sIV"], "C": bias["sIV"]}.get(s, 1.0)


def score_horses(horses: list, race: dict) -> list:
    """Compute scored prob for each horse and return enriched list."""
    bias_key = classify_race(race["distance"], race["surface"])
    bias = CD_BIASES[bias_key]
    enriched = []

    # 1. Raw market probabilities
    raw_market = [market_prob(h.get("mlOdds")) for h in horses]
    market_total = sum(raw_market) or 1.0
    market_norm = [p / market_total for p in raw_market]

    # 2. Bias-adjusted score
    for h, mp in zip(horses, market_norm):
        post = h.get("postPosition") or 0
        post_iv = post_iv_for(post, bias)
        style_iv = style_iv_for(h.get("style") or "", bias)

        # Multiply market prob by bias factor (clamped)
        bias_factor = 1.0 + 0.35 * (post_iv - 1.0) + 0.30 * (style_iv - 1.0)
        bias_factor = max(0.5, min(1.6, bias_factor))

        # Trainer/jockey tier bonus
        trainer = (h.get("trainer") or "").lower().strip()
        jockey = (h.get("jockey") or "").lower().strip()
        t_bonus = TIER_TRAINERS.get(trainer, 0.0)
        j_bonus = TIER_JOCKEYS.get(jockey, 0.0)

        adj_score = mp * bias_factor * (1.0 + t_bonus + j_bonus)
        enriched.append({
            **h,
            "market_prob": mp,
            "post_iv": post_iv,
            "style_iv": style_iv,
            "bias_factor": bias_factor,
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
    Returns the PRIMARY rec; alt structures are returned in `alternates`."""
    n = len(scored)
    if n < 4:
        return {"recommendation": "PASS — too small a field for exotic"}

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
    return primary


def write_horses_csv(processed_races: list, out_path: Path):
    """One row per horse, with scoring + race context."""
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "race", "post_time", "distance", "surface", "purse", "race_type", "stakes",
            "program", "name", "jockey", "trainer", "post_position", "ml_odds",
            "style", "market_prob_pct", "post_iv", "style_iv", "bias_factor",
            "trainer_tier_bonus", "jockey_tier_bonus", "score_pct", "rank", "is_top_pick",
        ])
        for r in processed_races:
            for h in r["scored"]:
                w.writerow([
                    r["raceNumber"], r["postTime"], r["distance"], r["surface"], r["purse"],
                    r["raceType"], r.get("stakesName", "") or "",
                    h["program"], h["name"], h.get("jockey", ""), h.get("trainer", ""),
                    h.get("postPosition", ""), h.get("mlOdds", ""), h.get("style", "") or "",
                    f"{h['market_prob']*100:.1f}",
                    f"{h['post_iv']:.2f}", f"{h['style_iv']:.2f}", f"{h['bias_factor']:.3f}",
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
    has_pp = any(h.get("primePower", 0) > 0 for r in processed_races for h in r["scored"])
    mode = "Round 2 (Brisnet PPs)" if has_pp else "Limited-data (ML + post + tier only)"
    lines = [
        f"# CD {date} — Algo Picks & Exotic Recommendations",
        "",
        f"_Generated {datetime.now().isoformat(timespec='seconds')} • Mode: **{mode}**_",
        "",
    ]
    if has_pp:
        lines += [
            "Inputs: Prime Power, current/avg-class, last-3 Beyers, runstyle, days-since-last,",
            "mud %, plus per-race track-bias IVs (week totals, fallback to meet where N<5).",
            "Scoring: 70/30 model/market blend (shifts toward market in sparse-data races).",
        ]
    else:
        lines += [
            "Scoring inputs: ML odds, post position, jockey tier, trainer tier, CD track-bias defaults.",
            "**Missing**: Beyer speed figures, Prime Power, class ratings, days-since-last-race, runstyle.",
        ]
    lines += ["", "---", ""]
    for r in processed_races:
        lines.append(f"## R{r['raceNumber']} — {r['postTime']} • {r['distance']} {r['surface']} • ${r['purse']:,} • {r['raceType']}")
        if r.get("stakesName"):
            lines.append(f"**{r['stakesName']}**")
        lines.append("")
        lines.append("| Rank | # | Horse | Jockey / Trainer | Post | ML | Score |")
        lines.append("|---|---|---|---|---|---|---|")
        for h in r["scored"][:6]:
            lines.append(
                f"| {h['rank']} | {h['program']} | {h['name']} | "
                f"{h.get('jockey','?')} / {h.get('trainer','?')} | "
                f"{h.get('postPosition','?')} | {h.get('mlOdds','?')} | "
                f"**{h['score']*100:.1f}%** |"
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


def parse_ts_card(ts_path: Path) -> dict | None:
    """Extract StaticRace[] from a cd-YYYY-MM-DD.ts file via regex parsing.
    Returns the same structure as raw-entries.json so the rest of the pipeline
    works unchanged. Returns None if file not found."""
    if not ts_path.exists():
        return None
    txt = ts_path.read_text()

    # Find race blocks: `// ── Rn ──` / `const raceN: StaticRace = { ... };`
    race_blocks = re.split(r"//\s*── R(\d+) — ([^\n]*?) ──\n", txt)
    races = []
    for i in range(1, len(race_blocks), 3):
        rnum = int(race_blocks[i])
        header = race_blocks[i + 1].strip()
        body = race_blocks[i + 2]
        # Stop at next race or export
        body = re.split(r"//\s*── R\d+ —|^export\s+const", body, maxsplit=1, flags=re.MULTILINE)[0]

        # Race-level fields
        rt = re.search(r'raceNumber:\s*(\d+),\s*postTime:\s*"([^"]+)"', body)
        rttype = re.search(r'raceType:\s*"([^"]+)",\s*distance:\s*"([^"]+)",\s*surface:\s*"([^"]+)",\s*purse:\s*(\d+),\s*condition:\s*"([^"]+)"', body)
        # Track bias
        tb = re.search(
            r'speedBiasPct:\s*([\d.]+),\s*railBias:\s*"([^"]+)",\s*'
            r"eIV:\s*([\d.]+),\s*epIV:\s*([\d.]+),\s*pIV:\s*([\d.]+),\s*sIV:\s*([\d.]+),\s*"
            r"post1to3IV:\s*([\d.]+),\s*post4to7IV:\s*([\d.]+),\s*post8plusIV:\s*([\d.]+)",
            body,
        )
        scratches_m = re.search(r"scratches:\s*\[([^\]]*)\]", body)
        scratches = [s.strip().strip('"') for s in scratches_m.group(1).split(",")] if scratches_m and scratches_m.group(1).strip() else []

        # Horses: each h(...) call
        horses = []
        for hm in re.finditer(
            r'h\(\s*"(?P<prog>[^"]+)",\s*"(?P<name>[^"]+)",\s*(?P<ml>[\d.]+),\s*"(?P<style>[^"]+)",\s*'
            r"\[(?P<beyers>[^\]]*)\],\s*(?P<days>\d+),\s*(?P<weight>\d+)"
            r"(?:,\s*\{(?P<extras>[^}]*)\})?",
            body,
        ):
            beyers = [int(b.strip()) for b in hm.group("beyers").split(",") if b.strip().lstrip("-").isdigit()]
            extras = {}
            if hm.group("extras"):
                for em in re.finditer(r"(\w+):\s*([\d.]+)", hm.group("extras")):
                    extras[em.group(1)] = float(em.group(2)) if "." in em.group(2) else int(em.group(2))
            horses.append({
                "program": hm.group("prog"),
                "name": hm.group("name"),
                "mlOdds": float(hm.group("ml")),
                "style": hm.group("style"),
                "last3Beyer": beyers,
                "daysSinceLast": int(hm.group("days")),
                "weight": int(hm.group("weight")),
                "primePower": extras.get("primePower", 0),
                "currentClass": extras.get("currentClass", 0),
                "avgClassLast3": extras.get("avgClassLast3", 0),
                "earlyPaceLast": extras.get("earlyPaceLast", 0),
                "latePaceLast": extras.get("latePaceLast", 0),
                "mudPct": extras.get("mudPct", 0),
                "isClassDrop": (
                    extras.get("currentClass", 0) > 0
                    and extras.get("avgClassLast3", 0) > 0
                    and extras.get("currentClass", 0) < extras.get("avgClassLast3", 0)
                ),
            })

        race = {
            "raceNumber": int(rt.group(1)) if rt else rnum,
            "postTime": rt.group(2) if rt else "",
            "raceType": rttype.group(1) if rttype else "",
            "distance": rttype.group(2) if rttype else "",
            "surface": rttype.group(3) if rttype else "",
            "purse": int(rttype.group(4)) if rttype else 0,
            "condition": rttype.group(5) if rttype else "Fast",
            "trackBias": {
                "speedBiasPct": float(tb.group(1)),
                "railBias": tb.group(2),
                "eIV": float(tb.group(3)), "epIV": float(tb.group(4)),
                "pIV": float(tb.group(5)), "sIV": float(tb.group(6)),
                "post1to3IV": float(tb.group(7)),
                "post4to7IV": float(tb.group(8)),
                "post8plusIV": float(tb.group(9)),
            } if tb else None,
            "horses": horses,
            "scratches": scratches,
        }
        races.append(race)

    return {"track": "CD", "date": ts_path.stem.replace("cd-", ""), "races": races, "source": "ts"}


def normalize_within_race(values: list, fallback: float = 0.05) -> list:
    """Normalize a list of values to sum to 1.0. Zeros get fallback share."""
    nonzero = [v for v in values if v and v > 0]
    if not nonzero:
        return [1.0 / len(values)] * len(values)
    mean_nz = sum(nonzero) / len(nonzero)
    adj = [v if v and v > 0 else mean_nz * fallback for v in values]
    total = sum(adj) or 1.0
    return [v / total for v in adj]


def score_horses_full(horses: list, race: dict) -> list:
    """Round 2 scoring with full Brisnet fields.
    Inputs per horse: primePower, currentClass, avgClassLast3, last3Beyer[],
                      earlyPaceLast, latePaceLast, daysSinceLast, mudPct, style.
    Race-level: trackBias from PDF (eIV/epIV/pIV/sIV, post1to3IV, post4to7IV, post8plusIV)
    """
    bias = race.get("trackBias")
    if not bias:
        # Fall back to CD defaults
        bias_key = classify_race(race["distance"], race["surface"])
        bias = CD_BIASES[bias_key]

    enriched = []
    n = len(horses)

    # 1. Market-implied prob
    market_raw = [market_prob(h.get("mlOdds")) for h in horses]
    market_norm = normalize_within_race(market_raw)

    # 2. Prime Power normalized within race (model ability prob)
    pp_raw = [h.get("primePower") or 0 for h in horses]
    pp_known = sum(1 for p in pp_raw if p > 0)
    # Maiden / sparse-data fallback: if <60% of field has PP data, blend toward market.
    # Pure ability scoring doesn't make sense when most horses are first-time starters.
    if pp_known == 0:
        pp_norm = market_norm[:]
        sparse_factor = 0.0  # no model signal
    else:
        pp_norm = normalize_within_race(pp_raw)
        coverage = pp_known / n
        sparse_factor = min(1.0, coverage / 0.6)  # full weight at >=60% coverage

    for i, h in enumerate(horses):
        # 3. Class signal (drop = bonus, raise = penalty)
        cc = h.get("currentClass") or 0
        ac3 = h.get("avgClassLast3") or 0
        class_delta = (cc - ac3) if (cc and ac3) else 0
        class_bonus = 0
        if h.get("isClassDrop"):
            class_bonus = min(0.10, abs(class_delta) * 0.02)
        elif class_delta > 1.0:
            class_bonus = -min(0.05, class_delta * 0.01)

        # 4. Form signal — best of last 3 Beyers
        beyers = h.get("last3Beyer") or [0, 0, 0]
        nonzero_beyers = [b for b in beyers if b and b > 0]
        best_beyer = max(nonzero_beyers) if nonzero_beyers else 0

        # 5. Layoff penalty (Apr 18 cortex rule: halve if peak Beyer >= 82)
        days = h.get("daysSinceLast") or 0
        layoff_pen = 0
        if days > 60:
            layoff_pen = -0.5
            if best_beyer >= 82:
                layoff_pen = -0.25  # halved for quality horses

        # 6. Track-bias adj
        style = (h.get("style") or "P").upper()
        style_iv = {"E": bias["eIV"], "EP": bias["epIV"], "P": bias["pIV"],
                    "S": bias["sIV"], "C": bias["sIV"]}.get(style, 1.0)
        # Post position not in PDF — skip post-IV since we don't have draws
        # (will be added when scratches/draws are confirmed day-of)
        bias_factor = 1.0 + 0.35 * (style_iv - 1.0)
        bias_factor = max(0.5, min(1.6, bias_factor))

        # 7. Combine: ability (PP) × bias × (1 + class) × (1 + layoff_pen/10)
        ability = pp_norm[i] * bias_factor * (1.0 + class_bonus + layoff_pen / 10.0)
        ability = max(0.001, ability)

        enriched.append({
            **h,
            "market_prob": market_norm[i],
            "pp_prob_raw": pp_norm[i],
            "best_beyer": best_beyer,
            "class_delta": class_delta,
            "class_bonus": class_bonus,
            "layoff_penalty": layoff_pen,
            "style_iv": style_iv,
            "bias_factor": bias_factor,
            "ability_raw": ability,
        })

    # 8. Renormalize ability scores
    abilities = [e["ability_raw"] for e in enriched]
    a_total = sum(abilities) or 1.0
    for e in enriched:
        e["model_prob"] = e["ability_raw"] / a_total

    # 9. Final blend — Round 2 is 0.7 model + 0.3 market when data is full,
    # but for maiden/sparse races we shift toward market to avoid overweighting
    # the few horses that happen to have PP data.
    model_weight = 0.7 * sparse_factor
    market_weight = 1.0 - model_weight
    for e in enriched:
        e["score"] = model_weight * e["model_prob"] + market_weight * e["market_prob"]

    # 10. Re-normalize final score to sum=1.0
    s_total = sum(e["score"] for e in enriched) or 1.0
    for e in enriched:
        e["score"] = e["score"] / s_total

    # Sort + rank
    enriched.sort(key=lambda x: -x["score"])
    for i, e in enumerate(enriched):
        e["rank"] = i + 1
    return enriched


def write_horses_csv_full(processed_races: list, out_path: Path):
    """Richer horses.csv with Brisnet columns."""
    with open(out_path, "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow([
            "race", "post_time", "distance", "surface", "purse", "race_type",
            "program", "name", "ml_odds", "style", "days_since_last",
            "prime_power", "current_class", "avg_class_last3", "class_drop",
            "last3_beyer_best", "early_pace_last", "late_pace_last", "mud_pct",
            "market_prob_pct", "pp_prob_pct", "model_prob_pct", "score_pct",
            "rank", "is_top_pick",
        ])
        for r in processed_races:
            for h in r["scored"]:
                w.writerow([
                    r["raceNumber"], r["postTime"], r["distance"], r["surface"], r["purse"],
                    r.get("raceType", ""),
                    h["program"], h["name"], h.get("mlOdds", ""), h.get("style", ""), h.get("daysSinceLast", ""),
                    h.get("primePower", ""), h.get("currentClass", ""), h.get("avgClassLast3", ""),
                    "Y" if h.get("isClassDrop") else "",
                    h.get("best_beyer", ""), h.get("earlyPaceLast", ""), h.get("latePaceLast", ""), h.get("mudPct", ""),
                    f"{h['market_prob']*100:.1f}",
                    f"{h.get('pp_prob_raw', 0)*100:.1f}",
                    f"{h.get('model_prob', 0)*100:.1f}",
                    f"{h['score']*100:.1f}",
                    h["rank"], "YES" if h["rank"] == 1 else "",
                ])


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 process_card.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    repo = Path(__file__).resolve().parent.parent
    in_dir = repo / "data" / f"cd-{date}"

    # Prefer the TS card (full Brisnet data) if present
    ts_path = repo / "web" / "app" / "lib" / f"cd-{date}.ts"
    raw = parse_ts_card(ts_path)
    score_fn = score_horses_full if raw else score_horses
    write_horses_csv_fn = write_horses_csv_full if raw else write_horses_csv

    if not raw:
        in_path = in_dir / "raw-entries.json"
        if not in_path.exists():
            print(f"ERROR: neither {ts_path} nor {in_path} found")
            sys.exit(2)
        raw = json.loads(in_path.read_text())

    track = raw.get("track", "CD")
    print(f"Source: {raw.get('source', 'json')} ({len(raw['races'])} races)")

    processed = []
    for race in raw["races"]:
        scored = score_fn(race["horses"], race)
        exotic = best_exotic_strategy(scored, race.get("raceType", "") + " " + (race.get("stakesName") or ""))
        processed.append({**race, "scored": scored, "exotic": exotic})

    # Outputs
    write_horses_csv_fn(processed, in_dir / "horses.csv")
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

    # TS static data file — only generate if we DON'T have a hand-written .ts already
    # (parsing the .ts produces raw with source="ts" — skip overwrite)
    if raw.get("source") != "ts":
        write_ts_static(processed, date, track, repo / "web" / "app" / "lib" / f"cd-{date}.ts")

    # Backtest if results exist
    res_path = in_dir / "results.json"
    if res_path.exists():
        results = json.loads(res_path.read_text())
        write_backtest_md(processed, results, date, in_dir / "backtest.md")

    print(f"✅ {date}: {len(processed)} races processed")
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
