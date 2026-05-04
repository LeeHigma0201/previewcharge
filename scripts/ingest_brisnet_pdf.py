#!/usr/bin/env python3
"""Parse a Brisnet Race Summary PDF for one race day and emit cd-<date>.ts.

Usage:
    python3 scripts/ingest_brisnet_pdf.py <pdf_path> <yyyy-mm-dd>

Example:
    python3 scripts/ingest_brisnet_pdf.py ~/Downloads/Churchill\\ wed.pdf 2026-04-29

Output:
    web/app/lib/cd-<yyyy-mm-dd>.ts

Strategy: extract text via pdftotext -layout, then parse race-by-race.
Brisnet PDFs use one race per page. Fields:
    Per race (from page header):
        - race number, race type, distance/surface, purse, post time, conditions
        - Track Bias Stats (Week section preferred over Meet)
    Per horse (from "Race Summary" table):
        - program#, name, ML odds, eqp, days since last
        - run style (E/EP/P/S/C)
        - Sp1, Sp2, Sp3, Sp4 (last 4 race speeds)
        - ACL (avg class last 3 — column header on full-data rows)
        - Final Speed Avg, Rcg Spd R1..R3
        - Pedigree Mud Sts, Mud%, AWD
    Bottom rankings (parsed separately, joined by name):
        - Speed Last Race
        - Best Pace E1/Late
        - Average Class Last 3
        - Current Class
        - Prime Power
        - Early Pace Last Race
        - Late Pace Last Race
"""
from __future__ import annotations

import re
import sys
import subprocess
from pathlib import Path
from dataclasses import dataclass, field, asdict
from typing import Optional


@dataclass
class HorseStats:
    program: str
    name: str
    ml_odds_raw: str = ""
    ml_decimal: float = 0.0
    eqp: str = "L"
    days_since: int = 0
    style: str = ""
    last3_beyer: list[int] = field(default_factory=list)
    weight: int = 118
    prime_power: float = 0.0
    current_class: float = 0.0
    avg_class_last3: float = 0.0
    early_pace_last: int = 0
    late_pace_last: int = 0
    mud_pct: int = 0


@dataclass
class RaceStats:
    race_number: int = 0
    post_time: str = ""
    race_type: str = ""
    distance: str = ""
    surface: str = ""
    purse: int = 0
    condition: str = "Fast"
    name: Optional[str] = None
    speed_bias_pct_week: int = 0
    rail_bias: str = "0"
    eIV: float = 0.0
    epIV: float = 0.0
    pIV: float = 0.0
    sIV: float = 0.0
    post1to3IV: float = 0.0
    post4to7IV: float = 0.0
    post8plusIV: float = 0.0
    distance_label: str = ""
    horses: list[HorseStats] = field(default_factory=list)


ML_FRAC = re.compile(r"^(\d+)/(\d+)$")


def ml_to_decimal(raw: str) -> float:
    """Convert '9/5' to 1.8, '8/1' to 8.0, etc."""
    raw = raw.strip()
    m = ML_FRAC.match(raw)
    if m:
        n, d = int(m.group(1)), int(m.group(2))
        return round(n / d, 2)
    try:
        return float(raw)
    except ValueError:
        return 0.0


def split_pages(text: str) -> list[str]:
    return text.split("\f")


def parse_race_header(page: str) -> RaceStats:
    r = RaceStats()
    # Race number, race type, day-of-week tag
    head = re.search(r"Race Summary\s+Churchill Downs\s+(.+?)\s+(\w+,\s+\w+\s+\d+,\s+\d{4})\s+Race\s+(\d+)", page)
    if head:
        r.race_type = head.group(1).strip()
        r.race_number = int(head.group(3))
    # Distance + purse from full-conditions block
    pursem = re.search(r"Purse\s+\$([\d,]+)", page)
    if pursem:
        r.purse = int(pursem.group(1).replace(",", ""))
    # Post time first one is ET
    pt = re.search(r"Post Time:\s*\(?\s*(\d+:\d+)\s*\)?", page)
    if pt:
        h, m = pt.group(1).split(":")
        hi = int(h)
        suffix = "AM" if hi < 8 else "PM"  # CD post times are noon-evening; <8 means evening like 5:27 ≈ rendered "5:27"
        # Actually treat all post times as PM since CD doesn't run before 12pm
        suffix = "PM"
        r.post_time = f"{hi}:{m} {suffix}"
    # Distance + surface from race-conditions paragraph
    dist_surf = re.search(r"(\d+(?:[½¼⅓⅔ˆ]|\s+\d+/\d+)?\s+(?:Furlongs|Mile|Miles)|\d+½?\s*Furlongs)\.\s*", page)
    if dist_surf:
        rd = dist_surf.group(1)
        r.distance = normalize_distance(rd)
    # Surface from track-bias header
    bias_head = re.search(r"(Dirt|Turf|All-Weather)\s+(\d+\.?\d*[fmM]?)", page)
    if bias_head:
        r.surface = bias_head.group(1)
        r.distance_label = bias_head.group(2)
    # Week track-bias block (second occurrence after Meet block)
    week = re.search(
        r"\* Week Totals \*.*?Speed Bias:\s*(\d+)%.*?"
        r"Impact Values:\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+).*?"
        r"Impact Values:\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)",
        page, re.DOTALL,
    )
    if week:
        r.speed_bias_pct_week = int(week.group(1))
        r.eIV = float(week.group(2))
        r.epIV = float(week.group(3))
        r.pIV = float(week.group(4))
        r.sIV = float(week.group(5))
        # second IV row is rail/posts
        r.post1to3IV = float(week.group(7))
        r.post4to7IV = float(week.group(8))
        r.post8plusIV = float(week.group(9))
    # Rail bias indicator (look for + / 0 / - near Rail label, post-1-3 col)
    rail = re.search(r"Post Bias:\s*RAIL\s+1-3", page)
    if rail:
        # Check next line for + / 0 / -
        after = page[rail.end():rail.end() + 200]
        if "+" in after.split("\n")[1] if "\n" in after else "":
            r.rail_bias = "+"
        elif "-" in after.split("\n")[1] if "\n" in after else "":
            r.rail_bias = "-"
    return r


def normalize_distance(raw: str) -> str:
    raw = raw.strip()
    raw = raw.replace("ˆ", " 1/16").replace("½", " 1/2").replace("¼", " 1/4")
    raw = raw.replace("⅓", " 1/3").replace("⅔", " 2/3").replace("⅛", " 1/8")
    raw = re.sub(r"\s+", " ", raw)
    if "Furlongs" in raw:
        return raw.replace(" Furlongs", "f").replace("Furlongs", "f")
    if "Mile" in raw:
        return raw.replace(" Miles", "m").replace(" Mile", "m").replace("Miles", "m").replace("Mile", "m")
    return raw


def parse_horses(page: str) -> list[HorseStats]:
    """Extract horse rows from the Race Summary table.

    Row pattern starts with: '<digit> <Name...> <ml> ...'
    We anchor on 'Horse Name' header line, then read subsequent rows until the
    rankings section ('Speed Last Race').
    """
    horses: list[HorseStats] = []
    # Find table region
    tbl_start = re.search(r"#\s+Horse Name\s+Odds Eqp", page)
    tbl_end = re.search(r"Speed Last Race", page)
    if not tbl_start or not tbl_end:
        return horses
    region = page[tbl_start.end():tbl_end.start()]
    for line in region.split("\n"):
        line = line.rstrip()
        if not line.strip():
            continue
        # Row starts with: optional spaces, digit (program), space, Capitalized Name
        m = re.match(r"^\s*(\d+[A-Z]?)\s+([A-Za-z][A-Za-z0-9'\.\s\-]+?)\s{2,}(\d+/\d+|\d+\.\d+|\*?\d+\*?)\s+(L|N|f|b)?\s*(\d+\.?\d*\.*)\s*([EPSC]+)\s+(\d+)\s+(.+)$",
                     line)
        if not m:
            # try a looser pattern
            m2 = re.match(r"^\s*(\d+[A-Z]?)\s+([A-Z][A-Za-z0-9'\.\s\-]+?)\s+(\d+/\d+)\s+(L|N|b|f)?\s+(\d+\.?\d*\.*)\s+(E/P|EP|E|P|S|C)\s+", line)
            if not m2:
                continue
            program = m2.group(1)
            name = m2.group(2).strip()
            ml = m2.group(3)
            days_str = m2.group(5)
            style_raw = m2.group(6)
        else:
            program = m.group(1)
            name = m.group(2).strip()
            ml = m.group(3)
            days_str = m.group(5)
            style_raw = m.group(6)
        days = int(re.sub(r"\D", "", days_str)) if re.sub(r"\D", "", days_str) else 0
        style = style_raw.replace("/", "")
        h = HorseStats(
            program=program,
            name=name,
            ml_odds_raw=ml,
            ml_decimal=ml_to_decimal(ml),
            days_since=days,
            style=style,
        )
        # Extract last3 speed figures (Sp1, Sp2, Sp3) from row tail
        # They appear as numbers followed by '.' optionally, after the Best Pace block
        speed_seq = re.findall(r"\b(\d{2,3})\.?[T]?\b", line)
        if len(speed_seq) >= 3:
            # Sp1 Sp2 Sp3 are in the middle of the row - this is best-effort
            h.last3_beyer = [int(x) for x in speed_seq[-7:-4]] if len(speed_seq) >= 7 else [int(x) for x in speed_seq[:3]]
        horses.append(h)
    return horses


def parse_rankings(page: str, horses_by_name: dict[str, HorseStats]) -> None:
    """Parse the bottom-of-page ranking blocks and merge into horses by name."""
    # Each ranking block is a column with header and N rows of "value Horse Name"
    # Use multi-pass to find each column's values.
    blocks = {
        "current_class": r"Current Class\s*\n((?:[^\n]*\n){1,15})",
        "avg_class_last3": r"Average\s*\n\s*Class Last 3\s*\n((?:[^\n]*\n){1,15})",
        "prime_power": r"Prime Power\s*\n((?:[^\n]*\n){1,15})",
        "early_pace_last": r"Early Pace\s+Last Race\s*\n((?:[^\n]*\n){1,15})",
        "late_pace_last": r"Late Pace\s+Last Race\s*\n((?:[^\n]*\n){1,15})",
    }
    for key, rgx in blocks.items():
        m = re.search(rgx, page)
        if not m:
            continue
        block = m.group(1)
        for row in block.split("\n"):
            row = row.strip()
            if not row:
                continue
            mm = re.match(r"^([\d.]+)\s+([A-Z][A-Za-z0-9'\.\s\-]+)$", row)
            if not mm:
                continue
            val_s = mm.group(1)
            nm = mm.group(2).strip()
            val = float(val_s) if "." in val_s else int(val_s)
            if nm in horses_by_name:
                setattr(horses_by_name[nm], key, val)


def emit_ts(date_iso: str, races: list[RaceStats], output_path: Path) -> None:
    """Emit cd-<date>.ts in the same shape as cd-2026-04-26.ts."""
    lines: list[str] = []
    lines.append(f"// Churchill Downs — {date_iso}")
    lines.append(f"// Auto-ingested from Brisnet Race Summary PDF.")
    lines.append("")
    lines.append('import type { StaticRace, StaticHorse } from "./keeneland-apr18";')
    lines.append("")
    lines.append("const h = (")
    lines.append("  program: string, name: string, ml: number, style: string,")
    lines.append("  beyers: number[], days: number, weight: number,")
    lines.append("  extras: Partial<StaticHorse> = {},")
    lines.append("): StaticHorse => ({")
    lines.append("  program, name, mlOdds: ml, style,")
    lines.append("  last3Beyer: beyers, daysSinceLast: days, weight,")
    lines.append("  ...extras,")
    lines.append("});")
    lines.append("")
    for r in races:
        lines.append(f"const race{r.race_number}: StaticRace = {{")
        cond_str = f', name: "{r.name}"' if r.name else ""
        lines.append(f'  raceNumber: {r.race_number}, postTime: "{r.post_time}",')
        lines.append(f'  raceType: "{r.race_type}", distance: "{r.distance}", surface: "{r.surface}", purse: {r.purse}, condition: "{r.condition}"{cond_str},')
        lines.append("  trackBias: {")
        lines.append(f'    surface: "{r.surface}", distanceLabel: "{r.distance_label}",')
        lines.append(f'    speedBiasPct: {r.speed_bias_pct_week}, railBias: "{r.rail_bias}",')
        lines.append(f'    eIV: {r.eIV}, epIV: {r.epIV}, pIV: {r.pIV}, sIV: {r.sIV},')
        lines.append(f'    post1to3IV: {r.post1to3IV}, post4to7IV: {r.post4to7IV}, post8plusIV: {r.post8plusIV},')
        lines.append("  },")
        lines.append("  horses: [")
        for hh in r.horses:
            extras_parts = []
            if hh.prime_power: extras_parts.append(f"primePower: {hh.prime_power}")
            if hh.current_class: extras_parts.append(f"currentClass: {hh.current_class}")
            if hh.avg_class_last3: extras_parts.append(f"avgClassLast3: {hh.avg_class_last3}")
            if hh.early_pace_last: extras_parts.append(f"earlyPaceLast: {hh.early_pace_last}")
            if hh.late_pace_last: extras_parts.append(f"latePaceLast: {hh.late_pace_last}")
            if hh.mud_pct: extras_parts.append(f"mudPct: {hh.mud_pct}")
            extras_str = "{ " + ", ".join(extras_parts) + " }" if extras_parts else "{}"
            beyers = hh.last3_beyer if hh.last3_beyer else [0, 0, 0]
            lines.append(
                f'    h("{hh.program}", "{hh.name}", {hh.ml_decimal}, "{hh.style}", {beyers}, {hh.days_since}, {hh.weight}, {extras_str}),'
            )
        lines.append("  ],")
        lines.append("};")
        lines.append("")
    # Export array
    arr = ", ".join(f"race{r.race_number}" for r in races)
    lines.append(f"export const CD_{date_iso.replace('-','_')}: StaticRace[] = [{arr}];")
    lines.append(f'export const CD_{date_iso.replace("-","_")}_DATE = "{format_date_pretty(date_iso)}";')
    output_path.write_text("\n".join(lines) + "\n")


def format_date_pretty(date_iso: str) -> str:
    from datetime import datetime
    d = datetime.strptime(date_iso, "%Y-%m-%d")
    return d.strftime("%A, %B %d, %Y")


def main() -> None:
    if len(sys.argv) != 3:
        print("Usage: python3 scripts/ingest_brisnet_pdf.py <pdf_path> <yyyy-mm-dd>")
        sys.exit(2)
    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    date_iso = sys.argv[2]
    if not pdf_path.exists():
        print(f"PDF not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)
    # Extract text
    text = subprocess.check_output(["pdftotext", "-layout", str(pdf_path), "-"], text=True)
    pages = split_pages(text)
    races: list[RaceStats] = []
    for page in pages:
        if "Race Summary" not in page or "Churchill Downs" not in page:
            continue
        r = parse_race_header(page)
        if r.race_number == 0:
            continue
        r.horses = parse_horses(page)
        if r.horses:
            by_name = {h.name: h for h in r.horses}
            parse_rankings(page, by_name)
        races.append(r)
    races.sort(key=lambda x: x.race_number)
    web_lib = Path(__file__).resolve().parent.parent / "web" / "app" / "lib"
    output = web_lib / f"cd-{date_iso}.ts"
    emit_ts(date_iso, races, output)
    print(f"Wrote {output} with {len(races)} races, {sum(len(r.horses) for r in races)} horses")


if __name__ == "__main__":
    main()
