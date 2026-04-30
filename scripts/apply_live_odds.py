#!/usr/bin/env python3
"""Apply live odds + scratches from a TwinSpires snapshot to raw-entries.json.

Reads:
  data/cd-<date>/raw-entries.json   (BRIS-parsed entries with ML odds)
  data/cd-<date>/live-snapshot.json (TwinSpires live data — odds + scratches)

Writes:
  data/cd-<date>/raw-entries.json   (in place; original backed up as .pre-live.json)

Behavior:
  - For each horse on the BRIS card, look up by program number in the snapshot.
  - If snapshot says scratched -> drop the horse from race.horses.
  - Else replace mlOdds with the live decimal odds.
  - Set race.condition from snapshot.track_condition (if not null).

Usage: python scripts/apply_live_odds.py 2026-04-30
"""
import json
import sys
import shutil
from pathlib import Path


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/apply_live_odds.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    base = Path(__file__).resolve().parent.parent / "data" / f"cd-{date}"
    raw_path = base / "raw-entries.json"
    snap_path = base / "live-snapshot.json"
    if not raw_path.exists():
        print(f"ERROR: {raw_path} not found")
        sys.exit(2)
    if not snap_path.exists():
        print(f"ERROR: {snap_path} not found")
        sys.exit(2)

    raw = json.loads(raw_path.read_text(encoding="utf-8"))
    snap = json.loads(snap_path.read_text(encoding="utf-8"))

    # Backup
    backup = raw_path.with_suffix(".pre-live.json")
    if not backup.exists():
        shutil.copy2(raw_path, backup)
        print(f"[backup] saved {backup.name}")

    snap_races = snap.get("races", {})
    track_cond = snap.get("track_condition")

    total_horses_before = 0
    total_horses_after = 0
    total_scratched = 0
    total_odds_updated = 0

    for race in raw["races"]:
        rn = str(race["raceNumber"])
        snap_race = snap_races.get(rn)
        if not snap_race:
            continue  # No live data for this race (e.g., R6 Arabian)
        # Build lookup: program -> snapshot record
        snap_by_prog = {h["program"]: h for h in snap_race}

        if track_cond:
            race["condition"] = track_cond

        kept = []
        for horse in race["horses"]:
            total_horses_before += 1
            prog = horse.get("program") or ""
            # Strip any non-numeric trailing garbage
            prog_norm = prog.split()[0] if prog else ""
            snap_h = snap_by_prog.get(prog_norm) or snap_by_prog.get(prog)
            if not snap_h:
                # Horse is on the BRIS card but missing from snapshot — keep but warn
                kept.append(horse)
                print(f"[warn] R{rn} program {prog!r} not in live snapshot — keeping with ML odds")
                continue
            if snap_h.get("scr"):
                total_scratched += 1
                print(f"[scr ] R{rn} #{prog} {horse.get('name','?')[:25]:<25} ML={horse.get('mlOdds')!s:>5} -> SCRATCHED")
                continue
            # Apply live odds
            new_odds = snap_h.get("ld")
            old_odds = horse.get("mlOdds")
            if new_odds is not None and new_odds != old_odds:
                # Preserve TRUE original ML across multiple live updates.
                # Bug fix: previous version overwrote mlOddsOriginal with the prior live odds,
                # making the sharp_money detector compute ratio against stale baseline after 2nd update.
                if "mlOddsOriginal" not in horse:
                    horse["mlOddsOriginal"] = old_odds
                horse["mlOdds"] = float(new_odds)
                horse["liveOddsString"] = snap_h.get("live")
                total_odds_updated += 1
                # Note when there's significant divergence
                if old_odds and abs((new_odds - old_odds) / old_odds) > 0.25:
                    arrow = "DOWN" if new_odds < old_odds else "UP"
                    print(f"[move] R{rn} #{prog} {horse.get('name','?')[:25]:<25} ML={old_odds!s:>5} -> live={new_odds!s:>5} {arrow}")
            elif new_odds == old_odds:
                horse["liveOddsString"] = snap_h.get("live")  # mark as confirmed live but unchanged
            kept.append(horse)
            total_horses_after += 1

        race["horses"] = kept

    # Tag the file with live update metadata
    raw["live_data_applied"] = True
    raw["live_data_source"] = snap.get("source", "unknown")
    raw["live_data_captured_at"] = snap.get("captured_at", "unknown")

    raw_path.write_text(json.dumps(raw, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print()
    print(f"[done] {date}: {total_horses_before} horses on card, {total_scratched} scratched, "
          f"{total_horses_after} live, {total_odds_updated} odds updates")
    print(f"       wrote {raw_path}")


if __name__ == "__main__":
    main()
