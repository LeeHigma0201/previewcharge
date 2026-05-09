#!/usr/bin/env python3
"""Generate backtest.md + SCORECARD.md for a card date.

Inputs:
  data/cd-<date>/results.json — official finishes + payouts (post-card)
  Either of:
    web/app/lib/cd-<date>-picks.json   (BRIS-rich algo picks file)
    OR data/cd-<date>/picks.md (markdown form)

Output:
  data/cd-<date>/backtest_auto.md — race-by-race actual vs algo top-3
  data/cd-<date>/SCORECARD_auto.md — top-line metrics

Usage:
  python3 scripts/run_backtest.py 2026-05-02
  python3 scripts/run_backtest.py 2026-04-30 --picks-source markdown

Skip races without picks data; degrade gracefully.

Pattern: built after Derby 152 (5/2) post-card analysis showed we need
this to be repeatable for every card. Derby's manual backtest.md +
SCORECARD.md took 30+ minutes; this should take 30 seconds.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def load_results(date: str) -> dict:
    """Read official results.json. Returns dict keyed by race number (str)."""
    p = REPO / "data" / f"cd-{date}" / "results.json"
    if not p.exists():
        sys.exit(f"ERROR: {p} not found. Scrape results first.")
    return json.loads(p.read_text())


def load_picks_json(date: str) -> dict | None:
    """Try web/app/lib/cd-<date>-picks.json first (race-day BRIS scoring)."""
    p = REPO / "web" / "app" / "lib" / f"cd-{date}-picks.json"
    if p.exists():
        return json.loads(p.read_text())
    return None


def picks_top_n(race_obj: dict, n: int = 3) -> list[dict]:
    """Extract algo top-N from a race in picks.json (sorted by rank)."""
    horses = race_obj.get("horses", [])
    sorted_h = sorted(horses, key=lambda h: h.get("rank", 99))
    return sorted_h[:n]


def winner_in_top_n(actual_finish: list[str], algo_top_n: list[dict]) -> bool:
    """True if the actual winner saddle # is in algo's top-N picks."""
    if not actual_finish:
        return False
    winner = actual_finish[0]
    return any(str(h.get("program", "")) == winner for h in algo_top_n)


def winner_is_algo_top1(actual_finish: list[str], algo_top_n: list[dict]) -> bool:
    if not actual_finish or not algo_top_n:
        return False
    winner = actual_finish[0]
    return str(algo_top_n[0].get("program", "")) == winner


def ml_chalk(race_obj: dict) -> str | None:
    """Return saddle # of ML chalk (lowest mlOdds) horse in the race."""
    horses = race_obj.get("horses", [])
    valid = [h for h in horses if h.get("mlOdds") is not None]
    if not valid:
        return None
    chalk = min(valid, key=lambda h: float(h["mlOdds"]))
    return str(chalk.get("program", ""))


def chalk_won(actual_finish: list[str], chalk_saddle: str | None) -> bool:
    if not actual_finish or chalk_saddle is None:
        return False
    return actual_finish[0] == chalk_saddle


def fwd_exacta_in_top2(actual_finish: list[str], algo_top_n: list[dict]) -> bool:
    """True if the algo's top-2 are the 1st and 2nd finishers IN ORDER."""
    if len(actual_finish) < 2 or len(algo_top_n) < 2:
        return False
    a1 = str(algo_top_n[0].get("program", ""))
    a2 = str(algo_top_n[1].get("program", ""))
    return actual_finish[0] == a1 and actual_finish[1] == a2


def parse_payout(payout_str: str | None) -> float | None:
    """Parse '$10.72' → 10.72."""
    if not payout_str:
        return None
    m = re.search(r"[\d,]+(?:\.\d+)?", str(payout_str).replace(",", ""))
    return float(m.group(0)) if m else None


def compute_ex_box_top2_roi(results: dict, picks: dict, base: float = 2.0) -> dict:
    """Theoretical ROI of $1 EX BOX of algo top-2 every race ($2/race × N).

    base = $ base of the listed exacta payout. TwinSpires defaults to $2.
    Returns dict with wagered / returned / net / roi_pct.
    """
    races_data = picks.get("races", [])
    wagered = 0.0
    returned = 0.0
    hits = []
    for r in races_data:
        rn = str(r.get("raceNumber"))
        actual = results.get(rn, {})
        if not actual.get("finish"):
            continue
        top2 = picks_top_n(r, 2)
        if len(top2) < 2:
            continue
        wagered += 2.0  # $1 box of 2 horses = 2 perms × $1
        # Forward exacta hit OR reverse hit (it's a box)
        finish = actual["finish"]
        exa_runners = actual.get("exacta", {}).get("runners", "")
        if not exa_runners:
            continue
        a1, a2 = str(top2[0].get("program", "")), str(top2[1].get("program", ""))
        if finish[0] in (a1, a2) and len(finish) > 1 and finish[1] in (a1, a2) and finish[0] != finish[1]:
            payout = parse_payout(actual.get("exacta", {}).get("payout"))
            if payout is not None:
                # listed payout is on $base; we wagered $1
                ret = payout / base
                returned += ret
                hits.append((rn, ret))
    return {
        "wagered": wagered,
        "returned": returned,
        "net": returned - wagered,
        "roi_pct": ((returned / wagered - 1) * 100) if wagered else 0.0,
        "hits": hits,
    }


def render_backtest(date: str, results: dict, picks: dict) -> str:
    """Build the backtest markdown."""
    races_data = picks.get("races", [])
    rows = []
    for r in races_data:
        rn = str(r.get("raceNumber"))
        actual = results.get(rn, {})
        finish = actual.get("finish", [])
        winner_name = actual.get("winner", "?")
        win_paid = actual.get("win_paid", "?")
        top3 = picks_top_n(r, 3)
        top3_str = " / ".join(f"#{h.get('program', '?')}" for h in top3) or "—"
        algo_top1_hit = "✓" if winner_is_algo_top1(finish, top3) else "✗"
        algo_top3_hit = "✓" if winner_in_top_n(finish, top3) else "✗"
        ml_top1 = ml_chalk(r)
        chalk_hit = "✓" if chalk_won(finish, ml_top1) else "✗"
        finish_str = "-".join(finish[:4]) if finish else "—"
        rows.append(
            f"| {rn} | {finish_str} | {win_paid} | {top3_str} | {algo_top1_hit} | "
            f"{algo_top3_hit} | {chalk_hit} (chalk #{ml_top1}) |"
        )

    # Aggregate
    total = 0
    top1_hits = 0
    top3_hits = 0
    chalk_hits = 0
    fwd_ex = 0
    for r in races_data:
        rn = str(r.get("raceNumber"))
        actual = results.get(rn, {})
        finish = actual.get("finish", [])
        if not finish:
            continue
        total += 1
        top3 = picks_top_n(r, 3)
        if winner_is_algo_top1(finish, top3):
            top1_hits += 1
        if winner_in_top_n(finish, top3):
            top3_hits += 1
        if chalk_won(finish, ml_chalk(r)):
            chalk_hits += 1
        if fwd_exacta_in_top2(finish, top3):
            fwd_ex += 1

    ex_box = compute_ex_box_top2_roi(results, picks)

    out = [
        f"# CD {date} — Backtest (auto-generated)",
        "",
        f"**Total races scored:** {total}",
        "",
        "## Race-by-race",
        "",
        "| R | Finish | Win pay | Algo top-3 | Algo top-1 hit | Algo top-3 hit | ML chalk hit |",
        "|---|---|---|---|---|---|---|",
        *rows,
        "",
        "## Aggregate hit rates",
        "",
        f"- Algo top-1: **{top1_hits}/{total} = {100*top1_hits/total:.1f}%**" if total else "- (no races)",
        f"- Algo top-3 (winner ∈ top-3): **{top3_hits}/{total} = {100*top3_hits/total:.1f}%**" if total else "",
        f"- ML chalk top-1 (control): **{chalk_hits}/{total} = {100*chalk_hits/total:.1f}%**" if total else "",
        f"- Forward exacta in algo top-2: **{fwd_ex}/{total} = {100*fwd_ex/total:.1f}%**" if total else "",
        "",
        "## Theoretical $1 EX BOX top-2 every race",
        "",
        f"- Wagered: **${ex_box['wagered']:.2f}**",
        f"- Returned: **${ex_box['returned']:.2f}**",
        f"- Net: **${ex_box['net']:+.2f}**",
        f"- ROI: **{ex_box['roi_pct']:+.1f}%**",
        f"- Hits: {', '.join(f'R{rn} (${ret:.2f})' for rn, ret in ex_box['hits']) or 'none'}",
        "",
        "---",
        "_Generated by `scripts/run_backtest.py`. Source: results.json + cd-<date>-picks.json._",
    ]
    return "\n".join(line for line in out if line is not None)


def main():
    parser = argparse.ArgumentParser(description="Generate auto backtest from results + picks")
    parser.add_argument("date", help="Card date YYYY-MM-DD")
    parser.add_argument(
        "--out",
        help="Output filename (default: data/cd-<date>/backtest_auto.md)",
    )
    args = parser.parse_args()

    results = load_results(args.date)
    picks = load_picks_json(args.date)
    if picks is None:
        sys.exit(
            f"ERROR: web/app/lib/cd-{args.date}-picks.json not found.\n"
            "This script only supports JSON-form picks (BRIS-rich algo). "
            "For markdown-only picks, would need a parser; skip for now."
        )

    out_path = Path(args.out) if args.out else REPO / "data" / f"cd-{args.date}" / "backtest_auto.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    content = render_backtest(args.date, results, picks)
    out_path.write_text(content)
    print(f"Wrote {out_path} ({len(content.splitlines())} lines)")


if __name__ == "__main__":
    main()
