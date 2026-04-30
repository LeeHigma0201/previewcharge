#!/usr/bin/env python3
"""Parse a BRIS Ultimate PPs PDF text dump into raw-entries.json.

DATA INTEGRITY: Every field comes from the PDF text. Missing fields are null,
NEVER defaulted to 0/placeholder. Downstream code must handle nulls explicitly.

Input:  data/<track>_<keyword>_raw.txt (extracted from PDF via pypdf)
Output: data/<track>-<date>/raw-entries.json

Usage: python scripts/parse_bris_pdf.py data/cd_wed_raw.txt CD 2026-04-29
"""
import json
import re
import sys
from datetime import date, datetime
from pathlib import Path


HORSE_HEADER_RE = re.compile(
    r"^\s*(?P<program>\d+[A-Z]?)\s+(?P<name>.+?)\s+\((?P<style>E/P|EP|E|P|S|NA)\s+(?P<extra>\d+)\)\s*\S?\s*Own:\s*(?P<owner>.+?)\s*$"
)
ML_ODDS_LINE_RE = re.compile(r"^\s*(?P<num>\d+)/(?P<den>\d+)\s+\S")
JOCKEY_RE = re.compile(r"^([A-Z][A-Z' .,\-]+?)\s+\(\s*\d+\s+\d+-")
TRAINER_RE = re.compile(r"^Trnr:\s+(.+?)\s+\(\s*\d")
PRIME_POWER_RE = re.compile(r"Prime Power:\s+([\d.]+)\s+\((\d+)(?:st|nd|rd|th)\)")
WEIGHT_RE = re.compile(r"(?:^|\W)(L|Lb|Lf)\s+(\d{3})\b")  # "L 118", "Lb 124", with optional leading junk like "ÈL 124"
WEIGHT_BARE_RE = re.compile(r"^\s*(\d{3})\s*$")  # bare 3-digit weight (FTS)
SIRE_MUD_RE = re.compile(r"Sire Stats:.*?(\d+)%Mud")

# PP row: starts with date like "15Mar26OP" + track. The "speed cluster"
# regex finds:  E1  E2/  LP  1c  2c  SPD  in that order.
PP_DATE_RE = re.compile(r"^(\d{1,2})([A-Z][a-z]{2})(\d{2})(?:'\d{2})?([A-Z][A-Za-z]+)")
SPEED_CLUSTER_RE = re.compile(
    r"(?<!\d)(\d{2,3})\s+(\d{2,3})/\s*(\d{2,3})\s+([+-]?\d+)\s+([+-]?\d+)\s+(\d{1,3})\s+\d"
)

MONTHS = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
          "Jly": 7, "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}

# BRIS distance shorthand → canonical "X 1/N" form
DIST_REPLACEMENTS = [
    ("1ˆ Mile", "1 1/16m"),  # ˆ = 1/16
    ("1Ñ Mile", "1 1/8m"),   # Ñ = 1/8 (educated guess from KEE pattern; flag if wrong)
    ("1Ò Mile", "1 1/4m"),
    ("1‚ Mile", "1 1/16m"),  # ‚ = appears in Arabian-PPs section (CD UAE Cup); best-guess 1 1/16
    ("6½ Furlongs", "6 1/2f"),
    ("4½ Furlongs", "4 1/2f"),
    ("5½ Furlongs", "5 1/2f"),
    ("7½ Furlongs", "7 1/2f"),
    ("1 Mile", "1m"),
    ("5 Furlongs", "5f"),
    ("6 Furlongs", "6f"),
    ("7 Furlongs", "7f"),
    ("8 Furlongs", "1m"),
]


def normalize_distance(raw: str) -> str:
    s = raw.strip()
    for k, v in DIST_REPLACEMENTS:
        if k in s:
            return v
    return s


def parse_race_header(line: str) -> dict | None:
    """`Ultimate PP's [w/ QuickPlay Comments] Churchill Downs <middle> <Day>, ... Race N`"""
    m = re.match(
        r".*Churchill Downs\s+(.+?)\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday).*Race\s+(\d+)\s*$",
        line,
    )
    if not m:
        return None
    middle = m.group(1).strip()
    race_num = int(m.group(2))

    # Surface
    surface = "Turf" if "(T)" in middle else "Dirt"
    # Distance — find pattern like "X Mile[s]" or "X Furlongs" with optional fraction
    dist_m = re.search(
        r"(\d+(?:[½¼¾]|ˆ|Ñ|Ò|‚)?(?:\s*\d/\d)?\s*(?:Mile[s]?|Furlongs?))(?:\s*\(T\))?",
        middle,
    )
    distance_raw = dist_m.group(1).strip() if dist_m else ""
    distance = normalize_distance(distance_raw)
    # Race type = everything before the distance
    race_type = middle[: dist_m.start()].strip() if dist_m else middle
    # Strip leading TM symbol "™" + any leading garbage
    race_type = re.sub(r"^[™\s]+", "", race_type)

    return {
        "raceNumber": race_num,
        "raceType": race_type,
        "distance": distance,
        "distanceRaw": distance_raw,
        "surface": surface,
        "rawHeader": middle,
    }


def parse_purse(text_block: str) -> int | None:
    m = re.search(r"Purse\s+\$([\d,]+)", text_block)
    return int(m.group(1).replace(",", "")) if m else None


def parse_post_time(text_block: str) -> str | None:
    """e.g. 'Post Time: (12:45)/11:45/10:45/ 9:45' — take the parenthesized ET time."""
    m = re.search(r"Post Time:\s*\(\s*([\d: ]+)\)", text_block)
    if m:
        t = m.group(1).strip()
        # Convert to "12:45 PM" form using simple heuristic (CD post times are 12:45-ish onward)
        # Append " PM" since all CD posts are PM
        try:
            hh, mm = t.split(":")
            hh_i = int(hh.strip())
            return f"{hh_i}:{mm.strip()} PM"
        except Exception:
            return t
    return None


def _add_period_initials(text: str) -> str:
    """Add period to single-letter middle initials: 'Jose L Ortiz' -> 'Jose L. Ortiz'."""
    return re.sub(r"\b([A-Z])(?=\s)", r"\1.", text)


def _normalize_suffix(s: str) -> str:
    s = s.upper().rstrip(".")
    if s in ("JR", "SR"):
        return s.title() + "."
    return s


def _flip_lastname_first(raw: str) -> str:
    """Convert 'Last, Suffix. First [Middle]' or 'Last First [Middle]' to 'First [Middle] Last [Suffix.]'."""
    raw = raw.strip().rstrip(",").strip()
    # Pattern: 'Last, Suffix. First [Middle]'
    m = re.match(r"^([A-Za-z']+),\s+(JR|SR|II|III)\.?\s+(.+)$", raw, re.IGNORECASE)
    if m:
        last, suffix, first_rest = m.groups()
        first_rest = first_rest.strip().rstrip(",").strip()
        body = _add_period_initials(f"{first_rest.title()} {last.title()}")
        return f"{body} {_normalize_suffix(suffix)}".strip()
    # Pattern: 'Last Suffix. First [Middle]' (no comma but suffix present)
    m2 = re.match(r"^([A-Za-z']+)\s+(JR\.?|SR\.?|II|III)\s+(.+)$", raw, re.IGNORECASE)
    if m2:
        last, suffix, first_rest = m2.groups()
        first_rest = first_rest.strip().rstrip(",").strip()
        body = _add_period_initials(f"{first_rest.title()} {last.title()}")
        return f"{body} {_normalize_suffix(suffix)}".strip()
    # Default: 'Last First [Middle]' → 'First [Middle] Last'
    parts = raw.split()
    if len(parts) < 2:
        return raw.title()
    last = parts[0].title().rstrip(",")
    first = " ".join(p.title().rstrip(",") for p in parts[1:])
    return _add_period_initials(f"{first} {last}")


def normalize_jockey(raw: str) -> str:
    return _flip_lastname_first(raw)


def normalize_trainer(raw: str) -> str:
    return _flip_lastname_first(raw)


def fractional_to_decimal(num: int, den: int) -> float:
    return round(num / den, 3) if den != 0 else 0.0


def parse_pp_row(line: str) -> dict | None:
    """Extract date_str, spd, e1, e2, lp from a PP row. None if not a PP row."""
    m = PP_DATE_RE.match(line.lstrip())
    if not m:
        return None
    day, mon_short, yr, trk = m.groups()
    if mon_short not in MONTHS:
        return None
    year = 2000 + int(yr)
    pp_date = date(year, MONTHS[mon_short], int(day))

    # Speed cluster after race-type token
    sc = SPEED_CLUSTER_RE.search(line)
    if not sc:
        return {"date": pp_date, "spd": None, "e1": None, "e2": None, "lp": None}
    e1, e2, lp, c1, c2, spd = sc.groups()
    return {
        "date": pp_date,
        "e1": int(e1),
        "e2": int(e2),
        "lp": int(lp),
        "spd": int(spd),
    }


def parse_horse_block(lines: list[str], start_idx: int, end_idx: int) -> dict:
    """Walk lines[start_idx:end_idx] and pull all horse fields."""
    header = HORSE_HEADER_RE.match(lines[start_idx])
    program = header.group("program")
    name = header.group("name").strip()
    style = header.group("style")
    owner = header.group("owner").strip()
    style = "EP" if style == "E/P" else style  # canonicalize for downstream

    ml_odds = None
    ml_odds_str = None
    jockey = None
    trainer = None
    prime_power = None
    prime_power_rank = None
    weight = None
    sire_mud_pct = None
    positives = []
    negatives = []
    pp_rows = []

    for j in range(start_idx + 1, end_idx):
        sub = lines[j]
        if ml_odds is None:
            mom = ML_ODDS_LINE_RE.match(sub)
            if mom:
                num = int(mom.group("num"))
                den = int(mom.group("den"))
                ml_odds = fractional_to_decimal(num, den)
                ml_odds_str = f"{num}/{den}"
        if jockey is None:
            jm = JOCKEY_RE.match(sub)
            if jm:
                jockey = normalize_jockey(jm.group(1))
        if trainer is None:
            tm = TRAINER_RE.match(sub)
            if tm:
                trainer = normalize_trainer(tm.group(1).strip())
        if prime_power is None:
            pm = PRIME_POWER_RE.search(sub)
            if pm:
                prime_power = float(pm.group(1))
                prime_power_rank = int(pm.group(2))
        if weight is None and len(sub.strip()) <= 20:
            # Weight always lives on its own short line: "L 118", "Lb 124", "ÈL 124", or bare "119"
            wm = re.search(r"L[bf]?\s+(\d{3})", sub)
            if wm:
                weight = int(wm.group(1))
            else:
                wbm = WEIGHT_BARE_RE.match(sub)
                if wbm:
                    weight = int(wbm.group(1))
        if sire_mud_pct is None:
            sm = SIRE_MUD_RE.search(sub)
            if sm:
                sire_mud_pct = int(sm.group(1))
        # QuickPlay comments — split on ñ/× tokens within the line
        for piece in re.split(r"(?=[ñ×])", sub):
            piece = piece.strip()
            if piece.startswith("ñ "):
                positives.append(piece[2:].strip())
            elif piece.startswith("× "):
                negatives.append(piece[2:].strip())
        # PP rows
        pp = parse_pp_row(sub)
        if pp:
            pp_rows.append(pp)

    # Sort PPs newest-first (they should already be, but enforce)
    pp_rows.sort(key=lambda r: r["date"], reverse=True)

    last3_spd = [r["spd"] for r in pp_rows[:3]]
    last3_spd = [s for s in last3_spd if s is not None]

    days_since_last = None
    if pp_rows and pp_rows[0]["date"]:
        days_since_last = (date(2026, 4, 29) - pp_rows[0]["date"]).days

    early_pace_last = pp_rows[0]["e1"] if pp_rows else None
    late_pace_last = pp_rows[0]["lp"] if pp_rows else None

    # Post position: assume = numeric part of program (no coupled-entries handling for now)
    post_position = int(re.match(r"\d+", program).group(0))

    return {
        "program": program,
        "name": name,
        "style": style,
        "post": post_position,
        "owner": owner,
        "mlOdds": ml_odds,
        "mlOddsFractional": ml_odds_str,
        "jockey": jockey,
        "trainer": trainer,
        "primePower": prime_power,
        "primePowerRank": prime_power_rank,
        "weight": weight,
        "mudPct": sire_mud_pct,
        "last3Beyer": last3_spd or None,
        "daysSinceLast": days_since_last,
        "earlyPaceLast": early_pace_last,
        "latePaceLast": late_pace_last,
        "ppCount": len(pp_rows),
        "comments": {"positives": positives[:8], "negatives": negatives[:8]},
    }


def find_horse_blocks(lines: list[str]) -> list[tuple[int, int]]:
    """Return (start, end) line ranges for each unique horse occurrence."""
    headers = [i for i, l in enumerate(lines) if HORSE_HEADER_RE.match(l)]
    blocks = []
    for k, idx in enumerate(headers):
        end = headers[k + 1] if k + 1 < len(headers) else len(lines)
        blocks.append((idx, end))
    return blocks


def parse_class_leaderboard(race_block_lines: list[str]) -> dict[str, float]:
    """Extract the per-race Class Rating leaderboard (top 3 horses).

    Format from page header: 4 columns of 3 lines each
        Speed Last Race | Prime Power | Class Rating | Best Speed at Dist
    Rows are listed sequentially: 3 lines per column = 12 lines total.
    Returns {program: class_rating} for top-3 horses (others not in leaderboard).
    """
    out: dict[str, float] = {}
    for i, line in enumerate(race_block_lines):
        if "Class Rating" in line and "Speed Last Race" in line:
            # Next 12 lines hold the leaderboards. Class Rating is rows 7-9 (3rd column).
            block = race_block_lines[i + 1 : i + 13]
            if len(block) >= 9:
                cr_rows = block[6:9]
                for row in cr_rows:
                    m = re.match(r"\s*(\d+[A-Z]?)\s+(.+?)\s+([\d.]+)\s*$", row)
                    if m:
                        out[m.group(1)] = float(m.group(3))
            break
    return out


def main():
    if len(sys.argv) < 4:
        print("Usage: python scripts/parse_bris_pdf.py <raw_txt> <track> <date>")
        sys.exit(1)
    raw_path = Path(sys.argv[1])
    track = sys.argv[2]
    date_str = sys.argv[3]

    text = raw_path.read_text(encoding="utf-8")
    lines = text.splitlines()

    # Find race-header occurrences and group their text
    race_starts = []
    for idx, line in enumerate(lines):
        info = parse_race_header(line)
        if info:
            # Arabian races (e.g. UAE President Cup) — different breed pool, our model
            # is Thoroughbred-only, so flag for downstream skip.
            info["isArabian"] = "Arabian PP" in line
            race_starts.append((idx, info))

    print(f"Found {len(race_starts)} race-header occurrences")

    by_race: dict[int, dict] = {}
    for k, (idx, info) in enumerate(race_starts):
        end = race_starts[k + 1][0] if k + 1 < len(race_starts) else len(lines)
        block = lines[idx:end]
        rn = info["raceNumber"]
        if rn not in by_race:
            by_race[rn] = {**info, "blocks": []}
        by_race[rn]["blocks"].append(block)

    races_out = []
    for rn in sorted(by_race):
        rdata = by_race[rn]
        all_lines: list[str] = []
        for b in rdata["blocks"]:
            all_lines.extend(b)

        purse = parse_purse("\n".join(all_lines))
        post_time = parse_post_time("\n".join(all_lines))
        class_lb = parse_class_leaderboard(all_lines)

        # Find unique horse blocks (by program number)
        h_blocks = find_horse_blocks(all_lines)
        seen = set()
        horses: list[dict] = []
        for s, e in h_blocks:
            header = HORSE_HEADER_RE.match(all_lines[s])
            if not header:
                continue
            prog = header.group("program")
            if prog in seen:
                continue
            seen.add(prog)
            h = parse_horse_block(all_lines, s, e)
            # Attach class rating from leaderboard if present
            h["currentClass"] = class_lb.get(prog)
            horses.append(h)

        horses.sort(key=lambda h: int(re.match(r"\d+", h["program"]).group(0)))

        races_out.append({
            "raceNumber": rdata["raceNumber"],
            "raceType": rdata["raceType"],
            "distance": rdata["distance"],
            "distanceRaw": rdata["distanceRaw"],
            "surface": rdata["surface"],
            "purse": purse,
            "postTime": post_time,
            "stakesName": None,
            "isArabian": rdata.get("isArabian", False),
            "horses": horses,
        })
        print(f"Race {rn}: {len(horses)} horses | {rdata['distanceRaw']} ({rdata['surface']}) | {rdata['raceType']} | post={post_time} | purse={purse}")

    out = {
        "track": track,
        "date": date_str,
        "source": "bris_ultimate_pps_pdf",
        "races": races_out,
    }

    out_dir = Path(__file__).resolve().parent.parent / "data" / f"{track.lower()}-{date_str}"
    out_dir.mkdir(exist_ok=True, parents=True)
    out_path = out_dir / "raw-entries.json"
    out_path.write_text(json.dumps(out, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    print(f"\n[OK] Wrote {out_path}")


if __name__ == "__main__":
    main()
