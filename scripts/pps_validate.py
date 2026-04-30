#!/usr/bin/env python3
"""
horse-pps.json schema validator + gap report.

Run this before sandbox_score.py to confirm the PP file has the per-race
arrays the scorer needs. The HRN-scraping agent produced metadata-only output
(career_best_beyer, lifetime_starts, pp_count) WITHOUT past_performances
arrays — this script catches that gap explicitly.

Usage:
  python3 scripts/pps_validate.py 2026-04-29

Outputs:
  - Console report: per-race coverage + missing horses
  - Exit code 0 if Stage 1 ready, 1 if PP data insufficient
"""
from __future__ import annotations

import json
import sys
from pathlib import Path


REQUIRED_PP_FIELDS = ["date", "distance", "surface", "finish", "beyer"]
NICE_TO_HAVE_PP_FIELDS = ["beaten_lengths", "race_class", "running_style", "track"]
REQUIRED_HORSE_FIELDS = ["expected_trainer", "trainer_match"]


def normalize_pps(data: dict) -> dict[str, dict]:
    """Accept either canonical {horses: {...}} or agent's bucket schema, return flat dict."""
    if "horses" in data and isinstance(data["horses"], dict):
        return data["horses"]
    # Bucket schema fallback
    out = {}
    for bucket in ["horses_with_good_data", "horses_with_sparse_data", "horses_with_issues"]:
        if bucket in data and isinstance(data[bucket], dict):
            out.update(data[bucket])
    return out


def validate_pp(pp: dict) -> list[str]:
    """Return list of missing required fields for one PP."""
    missing = []
    for f in REQUIRED_PP_FIELDS:
        if f not in pp or pp[f] is None:
            missing.append(f)
    return missing


def validate_horse(name: str, horse) -> dict:
    """Return diagnostic for one horse. Tolerates non-dict horse entries
    (e.g. agent's `horses_with_issues` stores plain string error reasons)."""
    if not isinstance(horse, dict):
        return {
            "name": name,
            "n_pps": 0,
            "pps_with_required": 0,
            "pps_with_beyer": 0,
            "has_career_best": False,
            "trainer_match": False,
            "field_gaps": {f: 0 for f in REQUIRED_PP_FIELDS},
            "tier": f"❌ {str(horse)[:60]}",
        }
    pps = horse.get("past_performances") or []
    n_pps = len(pps)

    # PP-level diagnostics
    pps_with_required = 0
    pps_with_beyer = 0
    field_gaps: dict[str, int] = {f: 0 for f in REQUIRED_PP_FIELDS}
    for pp in pps:
        missing = validate_pp(pp)
        if not missing:
            pps_with_required += 1
        for f in missing:
            field_gaps[f] += 1
        if pp.get("beyer") is not None:
            pps_with_beyer += 1

    # Horse-level metadata
    has_career_best = horse.get("career_best_beyer") is not None
    trainer_match = horse.get("trainer_match", False)

    # Tier classification
    if n_pps == 0:
        tier = "❌ no_pps"
    elif pps_with_required == 0:
        tier = "❌ pps_missing_fields"
    elif pps_with_required >= 5:
        tier = "✅ ready"
    elif pps_with_required >= 3:
        tier = "⚠️ partial (3-4 PPs)"
    else:
        tier = "⚠️ sparse (<3 PPs)"

    return {
        "name": name,
        "n_pps": n_pps,
        "pps_with_required": pps_with_required,
        "pps_with_beyer": pps_with_beyer,
        "has_career_best": has_career_best,
        "trainer_match": trainer_match,
        "field_gaps": field_gaps,
        "tier": tier,
    }


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 pps_validate.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    repo = Path(__file__).resolve().parent.parent

    entries_path = repo / "data" / f"cd-{date}" / "raw-entries.json"
    pps_path = repo / "data" / f"cd-{date}" / "horse-pps.json"

    if not entries_path.exists():
        print(f"ERROR: {entries_path} not found")
        sys.exit(2)
    if not pps_path.exists():
        print(f"ERROR: {pps_path} not found — Stage 1 cannot run.")
        print()
        print("Expected schema (per data/cd-{date}/HANDOFF.md):")
        print("""  {
    "horses": {
      "Empire Builder": {
        "expected_trainer": "Armando Hernandez",
        "trainer_match": true,
        "lifetime_starts": 18,
        "lifetime_wins": 3,
        "career_best_beyer": 92,
        "past_performances": [
          {"date": "2026-03-15", "track": "OP", "distance": "1m",
           "surface": "Dirt", "finish": 2, "beaten_lengths": 1.5,
           "beyer": 88, "race_class": "Allowance"}
        ]
      }
    }
  }""")
        sys.exit(2)

    raw = json.loads(entries_path.read_text())
    pps_raw = json.loads(pps_path.read_text())
    pps_by_name = normalize_pps(pps_raw)

    # Aggregate per-race
    print(f"# horse-pps.json validation for {date}")
    print()
    print(f"PP file: {pps_path}")
    print(f"Schema detected: {'canonical' if 'horses' in pps_raw else 'bucket (needs adapter)'}")
    print()

    if "horses" not in pps_raw:
        print("⚠️  Bucket schema detected. Sandbox_score.py expects a flat 'horses' key.")
        print("    The validator handles both, but the scorer doesn't yet.")
        print()

    total_horses = 0
    total_ready = 0
    total_partial = 0
    total_no_pps = 0
    total_missing_fields = 0
    per_race: list[dict] = []

    for race in raw["races"]:
        rn = race["raceNumber"]
        horses = race.get("horses", [])
        race_diag = []
        for h in horses:
            name = h["name"]
            horse_pps = pps_by_name.get(name, {})
            d = validate_horse(name, horse_pps)
            race_diag.append(d)
            total_horses += 1
            if d["tier"].startswith("✅"):
                total_ready += 1
            elif d["tier"].startswith("⚠️"):
                total_partial += 1
            elif "no_pps" in d["tier"]:
                total_no_pps += 1
            elif "missing_fields" in d["tier"]:
                total_missing_fields += 1

        ready = sum(1 for d in race_diag if d["tier"].startswith("✅"))
        per_race.append({
            "race": rn,
            "n_horses": len(horses),
            "ready": ready,
            "diagnostics": race_diag,
        })

    # Summary
    print("## Summary")
    print()
    print(f"Total horses on card: {total_horses}")
    print(f"  ✅ Ready (≥5 PPs with required fields): **{total_ready}**")
    print(f"  ⚠️ Partial (1-4 PPs): {total_partial}")
    print(f"  ❌ No PPs: {total_no_pps}")
    print(f"  ❌ PPs missing required fields: {total_missing_fields}")
    print()

    # Per-race coverage
    print("## Per-race coverage")
    print()
    print("| R | Field | Ready | Status |")
    print("|---|---|---|---|")
    for r in per_race:
        pct = (r["ready"] / r["n_horses"] * 100) if r["n_horses"] else 0
        status = "✅" if pct >= 80 else ("⚠️" if pct >= 50 else "❌")
        print(f"| R{r['race']} | {r['n_horses']} | {r['ready']} | {status} {pct:.0f}% |")

    # Worst gaps
    print()
    print("## Horses missing PP data (need fill-in)")
    print()
    worst = []
    for r in per_race:
        for d in r["diagnostics"]:
            if not d["tier"].startswith("✅"):
                worst.append((r["race"], d))
    if not worst:
        print("None — all horses have ≥5 PPs with required fields. ✅")
    else:
        print(f"{len(worst)} horses need data:")
        print()
        for race, d in worst[:30]:
            gaps = ", ".join(f for f, n in d["field_gaps"].items() if n > 0)
            print(f"  R{race} {d['name'][:30]:30s} — {d['tier']}"
                  + (f" (gaps: {gaps})" if gaps else ""))
        if len(worst) > 30:
            print(f"  ... and {len(worst) - 30} more")

    # Exit code
    print()
    if total_ready >= total_horses * 0.7:
        print(f"✅ Stage 1 READY — {total_ready}/{total_horses} ({total_ready/total_horses*100:.0f}%) "
              "horses have sufficient PPs.")
        sys.exit(0)
    else:
        print(f"⚠️  Stage 1 NOT READY — only {total_ready}/{total_horses} "
              f"({total_ready/total_horses*100:.0f}%) horses have sufficient PPs. Need ≥70%.")
        sys.exit(1)


if __name__ == "__main__":
    main()
