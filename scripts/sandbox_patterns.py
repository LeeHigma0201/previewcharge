#!/usr/bin/env python3
"""
Stage 1 cross-card pattern detector.

Reads data/cd-{date}/sandbox-scores.json (output of sandbox_score.py) and
surfaces SYSTEMATIC patterns — not single-race picks. The thesis: if Stage 1
is finding edge in a particular *category* of horse/race, that's a pool
inefficiency we can lean on for Thu/Fri/Sat. If patterns are scattered noise,
Stage 1 needs more features.

Five pattern hypotheses tested:
  1. Class-distance mismatch fades  — high speed, no distance proven
  2. Race-type edge concentration   — claimers vs stakes vs MSW
  3. Trainer-meet anomaly           — overlay/fade trainers across the card
  4. Layoff-returner overlays       — class horses off 60+ days
  5. Form-trend longshots           — improving Beyers at 12/1+

Usage: python3 scripts/sandbox_patterns.py 2026-04-29
"""
from __future__ import annotations

import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path


def load_scores(date: str) -> dict:
    repo = Path(__file__).resolve().parent.parent
    p = repo / "data" / f"cd-{date}" / "sandbox-scores.json"
    if not p.exists():
        print(f"ERROR: {p} not found. Run sandbox_score.py first.")
        sys.exit(2)
    return json.loads(p.read_text())


def flatten(payload: dict) -> list[dict]:
    """Flatten races → per-horse rows for cross-card analysis."""
    rows = []
    for race in payload["races"]:
        rn = race["race_number"]
        for h in race["scored"]:
            rows.append({
                "race_number": rn,
                "race_type": race.get("race_type"),
                "stakes_name": race.get("stakes_name"),
                "profile": race.get("profile"),
                "distance": race["distance"],
                "surface": race["surface"],
                "field_size": race["field_size"],
                "program": h["program"],
                "name": h["name"],
                "trainer": h.get("trainer"),
                "jockey": h.get("jockey"),
                "ml_odds": h.get("ml_odds"),
                "model_prob": h["model_prob"],
                "market_prob": h["market_prob"],
                "edge": h["edge"],
                "model_rank": h["model_rank"],
                "speedZ": h["features"]["speedZ"],
                "distance_fit": h["features"]["distance_fit"],
                "form_trend": h["features"]["form_trend"],
                "class_signal": h["features"]["class_signal"],
                "layoff_adj": h["features"]["layoff_adj"],
                "n_pps": h.get("n_pps", 0),
                "career_best_beyer": h.get("career_best_beyer"),
            })
    return rows


def header(s: str) -> str:
    return f"\n## {s}\n"


def pattern_class_distance_mismatch(rows: list[dict]) -> str:
    """High speed (top 30% speedZ in field) + low distance fit (≤ 0) — pure FADE setup."""
    out = ["**Hypothesis:** Market overrates career-best Beyer when distance is unproven."]
    flagged = [r for r in rows if r["speedZ"] >= 0.5 and r["distance_fit"] <= 0]
    if not flagged:
        out.append("\n_No horses match the pattern. Either market priced it correctly or Stage 1 doesn't have enough Beyer/distance data._")
        return "\n".join(out)

    flagged.sort(key=lambda r: r["edge"])  # most negative edge first
    out.append(f"\n**{len(flagged)} horses flagged.** Stage 1 says fade — high speed, no distance.\n")
    out.append("| R | # | Horse | speedZ | distFit | ML | Mkt% | Model% | Edge |")
    out.append("|---|---|---|---|---|---|---|---|---|")
    for r in flagged[:10]:
        out.append(
            f"| {r['race_number']} | {r['program']} | {r['name'][:22]} | "
            f"{r['speedZ']:+.2f} | {r['distance_fit']:+.2f} | "
            f"{r['ml_odds']} | {r['market_prob']*100:.1f}% | "
            f"{r['model_prob']*100:.1f}% | **{r['edge']*100:+.1f}%** |"
        )
    return "\n".join(out)


def pattern_race_type_concentration(rows: list[dict]) -> str:
    """Where does Stage 1 find the most edge? By race profile."""
    out = ["**Hypothesis:** Stakes have sharper money than claimers/MSWs. Stage 1 should find bigger edges in less-bet pools."]
    by_profile = defaultdict(list)
    for r in rows:
        by_profile[r["profile"]].append(r["edge"])

    out.append("\n| Profile | N horses | Mean |edge| | Max overlay | Max fade |")
    out.append("|---|---|---|---|---|")
    for profile, edges in sorted(by_profile.items()):
        if not edges:
            continue
        mean_abs = statistics.mean(abs(e) for e in edges)
        max_over = max(edges)
        max_fade = min(edges)
        out.append(
            f"| {profile} | {len(edges)} | {mean_abs*100:.1f}% | "
            f"+{max_over*100:.1f}% | {max_fade*100:+.1f}% |"
        )

    # Also break out by race_type string
    by_rt = defaultdict(list)
    for r in rows:
        rt = (r["race_type"] or "?")
        by_rt[rt].append(r["edge"])
    out.append("\n**By race-type string:**\n")
    out.append("| Race type | N | Mean |edge| | Top overlay | Top fade |")
    out.append("|---|---|---|---|---|")
    for rt, edges in sorted(by_rt.items()):
        if not edges:
            continue
        mean_abs = statistics.mean(abs(e) for e in edges)
        max_over = max(edges)
        max_fade = min(edges)
        out.append(
            f"| {rt} | {len(edges)} | {mean_abs*100:.1f}% | "
            f"+{max_over*100:.1f}% | {max_fade*100:+.1f}% |"
        )
    return "\n".join(out)


def pattern_trainer_anomaly(rows: list[dict]) -> str:
    """Trainers consistently overlaid or faded across the card."""
    out = ["**Hypothesis:** A meet-specific hot/cold trainer the market hasn't priced in. CD spring is a 2-week window — these effects are real."]
    by_trainer = defaultdict(list)
    for r in rows:
        t = (r["trainer"] or "?").strip()
        by_trainer[t].append(r["edge"])

    # Only consider trainers with 2+ horses on the card
    multi = {t: edges for t, edges in by_trainer.items() if len(edges) >= 2}
    if not multi:
        out.append("\n_No trainer has 2+ horses on the card. Pattern not detectable on a single card; revisit on Thu+._")
        return "\n".join(out)

    ranked = sorted(multi.items(), key=lambda kv: -statistics.mean(kv[1]))
    out.append(f"\n**{len(multi)} trainers with 2+ horses today.** Sum of edges shows systematic over/under-rating.\n")
    out.append("| Trainer | N | Mean edge | Sum edge | Verdict |")
    out.append("|---|---|---|---|---|")
    for t, edges in ranked[:15]:
        mean = statistics.mean(edges)
        total = sum(edges)
        verdict = "🟢 OVERLAY" if mean > 0.03 else ("🔴 FADE" if mean < -0.03 else "·")
        out.append(
            f"| {t[:30]} | {len(edges)} | {mean*100:+.1f}% | {total*100:+.1f}% | {verdict} |"
        )
    return "\n".join(out)


def pattern_layoff_returners(rows: list[dict]) -> str:
    """Horses with negative layoff_adj but high career_best_beyer — class survives layoff."""
    out = ["**Hypothesis:** Market dings layoff horses uniformly, but class survives time off. Stage 1's layoff penalty is class-aware (halved for peak Beyer ≥82)."]
    flagged = [r for r in rows
               if r["layoff_adj"] < -0.05
               and (r["career_best_beyer"] or 0) >= 90
               and r["edge"] > 0.02]
    if not flagged:
        out.append("\n_No horses match. Either no big-class layoff returners on this card, or the agent didn't find the dates._")
        return "\n".join(out)

    flagged.sort(key=lambda r: -r["edge"])
    out.append(f"\n**{len(flagged)} layoff overlays found.**\n")
    out.append("| R | # | Horse | Best Beyer | Layoff adj | Mkt% | Model% | Edge |")
    out.append("|---|---|---|---|---|---|---|---|")
    for r in flagged[:8]:
        out.append(
            f"| {r['race_number']} | {r['program']} | {r['name'][:22]} | "
            f"{r['career_best_beyer']} | {r['layoff_adj']:+.2f} | "
            f"{r['market_prob']*100:.1f}% | {r['model_prob']*100:.1f}% | "
            f"**{r['edge']*100:+.1f}%** |"
        )
    return "\n".join(out)


def pattern_form_trend_longshots(rows: list[dict]) -> str:
    """Improving Beyer trend at 12/1+ — classic Benter signal."""
    out = ["**Hypothesis:** Improving form (Beyer slope +) at long odds is the canonical Benter overlay. Market lags form cycles."]
    flagged = [r for r in rows
               if r["form_trend"] >= 0.4
               and (r["ml_odds"] or 0) >= 10]
    if not flagged:
        out.append("\n_No improving longshots flagged. Either no overlays or PP data too sparse to detect form trend._")
        return "\n".join(out)

    flagged.sort(key=lambda r: -r["edge"])
    out.append(f"\n**{len(flagged)} improving-form longshots.**\n")
    out.append("| R | # | Horse | Form trend | ML | Model% | Edge |")
    out.append("|---|---|---|---|---|---|---|")
    for r in flagged[:10]:
        out.append(
            f"| {r['race_number']} | {r['program']} | {r['name'][:22]} | "
            f"{r['form_trend']:+.2f} | {r['ml_odds']} | "
            f"{r['model_prob']*100:.1f}% | **{r['edge']*100:+.1f}%** |"
        )
    return "\n".join(out)


def pattern_data_quality(rows: list[dict]) -> str:
    """How much of the card has real PP data vs missing?"""
    out = ["**Diagnostic:** how confident can we be in the Stage 1 output?"]
    n = len(rows)
    n_with_pps = sum(1 for r in rows if r["n_pps"] >= 3)
    n_with_beyer = sum(1 for r in rows if r["speedZ"] != 0)
    n_with_dist = sum(1 for r in rows if r["distance_fit"] != 0)
    n_with_form = sum(1 for r in rows if r["form_trend"] != 0)
    out.append(f"\n- **{n_with_pps} / {n}** horses have ≥3 past performances")
    out.append(f"- **{n_with_beyer} / {n}** have Beyer-derived speedZ (non-zero)")
    out.append(f"- **{n_with_dist} / {n}** have distance-fit signal (non-zero)")
    out.append(f"- **{n_with_form} / {n}** have form-trend signal (non-zero)")

    # Per-race coverage
    by_race = defaultdict(lambda: {"total": 0, "with_pps": 0})
    for r in rows:
        by_race[r["race_number"]]["total"] += 1
        if r["n_pps"] >= 3:
            by_race[r["race_number"]]["with_pps"] += 1
    out.append("\n**Per-race PP coverage:**\n")
    out.append("| Race | Coverage |")
    out.append("|---|---|")
    for rn, stats in sorted(by_race.items()):
        pct = (stats["with_pps"] / stats["total"] * 100) if stats["total"] else 0
        marker = "✅" if pct >= 80 else ("⚠️" if pct >= 50 else "❌")
        out.append(f"| R{rn} | {marker} {stats['with_pps']}/{stats['total']} ({pct:.0f}%) |")
    return "\n".join(out)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 sandbox_patterns.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    payload = load_scores(date)
    rows = flatten(payload)

    out = []
    out.append(f"# CD {date} — Stage 1 cross-card pattern report\n")
    out.append(f"_{len(rows)} horses across {len(payload['races'])} races scored. "
               "Patterns are SYSTEMATIC — single-race noise is filtered._\n")

    out.append(header("0. Data quality"))
    out.append(pattern_data_quality(rows))

    out.append(header("1. Class-distance mismatch fades"))
    out.append(pattern_class_distance_mismatch(rows))

    out.append(header("2. Race-type edge concentration"))
    out.append(pattern_race_type_concentration(rows))

    out.append(header("3. Trainer-meet anomaly"))
    out.append(pattern_trainer_anomaly(rows))

    out.append(header("4. Layoff-returner overlays"))
    out.append(pattern_layoff_returners(rows))

    out.append(header("5. Form-trend longshots"))
    out.append(pattern_form_trend_longshots(rows))

    repo = Path(__file__).resolve().parent.parent
    out_path = repo / "data" / f"cd-{date}" / "sandbox-patterns.md"
    out_path.write_text("\n".join(out), encoding="utf-8")
    print(f"✅ Pattern report written to {out_path}")
    # Also print to console
    print()
    print("\n".join(out))


if __name__ == "__main__":
    main()
