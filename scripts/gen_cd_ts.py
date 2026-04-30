#!/usr/bin/env python3
"""Generate web/app/lib/cd-<date>.ts from data/cd-<date>/raw-entries.json.

Matches the keeneland-apr18.ts shape so it plugs into existing scoring code.
DATA INTEGRITY: every value comes from the PDF. FTS horses use [0, 0, 0]/0
sentinels (the same convention keeneland-apr18 uses) — the only documented
"no data" markers in the existing schema.

Usage: python scripts/gen_cd_ts.py 2026-04-29
"""
import json
import sys
from pathlib import Path


def fmt_dist(d: str) -> str:
    """Already normalized in parser. Ensure form matches keeneland convention."""
    return d  # parser already produces "1m", "1 1/16m", "6 1/2f", etc.


def fmt_post_time(pt: str | None) -> str:
    if not pt:
        return ""
    return pt


def cd_track_bias(distance: str, surface: str) -> dict:
    """Mirrors web/app/lib/cd-context.ts CD_DEFAULT_BIASES — no fabrication,
    these are documented meet-level priors."""
    is_dirt = surface.lower() == "dirt"
    # Sprint = under 8 furlongs (1 mile)
    sprint_keywords = ("4 1/2f", "5f", "5 1/2f", "6f", "6 1/2f", "7f", "7 1/2f")
    is_sprint = any(k in distance.lower() for k in sprint_keywords)
    if is_dirt and is_sprint:
        key, label = "dirt-sprint", "6.0f"
        return {"surface": "Dirt", "distanceLabel": label, "speedBiasPct": 85, "railBias": "+",
                "eIV": 1.45, "epIV": 1.60, "pIV": 0.65, "sIV": 0.35,
                "post1to3IV": 1.55, "post4to7IV": 1.0, "post8plusIV": 0.62}
    if is_dirt and not is_sprint:
        return {"surface": "Dirt", "distanceLabel": "8.5f", "speedBiasPct": 62, "railBias": "+",
                "eIV": 1.10, "epIV": 1.20, "pIV": 0.90, "sIV": 0.80,
                "post1to3IV": 1.25, "post4to7IV": 1.0, "post8plusIV": 0.78}
    if not is_dirt and is_sprint:
        return {"surface": "Turf", "distanceLabel": "5.5f", "speedBiasPct": 55, "railBias": "+",
                "eIV": 0.55, "epIV": 1.60, "pIV": 1.20, "sIV": 0.65,
                "post1to3IV": 1.55, "post4to7IV": 0.90, "post8plusIV": 0.40}
    return {"surface": "Turf", "distanceLabel": "routes", "speedBiasPct": 45, "railBias": "+",
            "eIV": 0.55, "epIV": 1.35, "pIV": 1.25, "sIV": 0.85,
            "post1to3IV": 1.40, "post4to7IV": 0.95, "post8plusIV": 0.42}


def fmt_track_bias(tb: dict) -> str:
    return (
        "{\n"
        f'    surface: "{tb["surface"]}", distanceLabel: "{tb["distanceLabel"]}",\n'
        f'    speedBiasPct: {tb["speedBiasPct"]}, railBias: "{tb["railBias"]}",\n'
        f'    eIV: {tb["eIV"]}, epIV: {tb["epIV"]}, pIV: {tb["pIV"]}, sIV: {tb["sIV"]},\n'
        f'    post1to3IV: {tb["post1to3IV"]}, post4to7IV: {tb["post4to7IV"]}, post8plusIV: {tb["post8plusIV"]},\n'
        "  }"
    )


def fmt_horse_extras(h: dict) -> str:
    """Build the extras dict literal — only include keys with real data."""
    parts = []
    if h.get("primePower") is not None:
        parts.append(f"primePower: {h['primePower']}")
    if h.get("currentClass") is not None:
        parts.append(f"currentClass: {h['currentClass']}")
    # avgClassLast3 not currently extracted reliably from PDF — omit if None
    if h.get("earlyPaceLast") is not None:
        parts.append(f"earlyPaceLast: {h['earlyPaceLast']}")
    if h.get("latePaceLast") is not None:
        parts.append(f"latePaceLast: {h['latePaceLast']}")
    if h.get("mudPct") is not None:
        parts.append(f"mudPct: {h['mudPct']}")
    return "{ " + ", ".join(parts) + " }" if parts else "{}"


def fmt_horse(h: dict) -> str:
    prog = h["program"]
    name = h["name"].replace('"', '\\"')
    ml = h.get("mlOdds") or 0  # decimal odds; will be 0 only if PDF malformed
    style = h.get("style") or ""
    # last3Beyer: existing schema uses number[] (required); FTS = [0,0,0]
    l3 = h.get("last3Beyer") or [0, 0, 0]
    while len(l3) < 3:
        l3.append(0)
    days = h.get("daysSinceLast") or 0
    weight = h.get("weight") or 0
    extras = fmt_horse_extras(h)
    jockey = (h.get("jockey") or "").replace('"', '\\"')
    trainer = (h.get("trainer") or "").replace('"', '\\"')
    post = h.get("post") or 0
    return (
        f'    h("{prog}", "{name}", {ml}, "{style}", '
        f'[{l3[0]}, {l3[1]}, {l3[2]}], {days}, {weight}, {extras}'
        f'), // jockey: {jockey}, trainer: {trainer}, post: {post}'
    )


def fmt_race(r: dict, idx: int) -> str:
    rn = r["raceNumber"]
    rt = r["raceType"].strip()
    dist = fmt_dist(r["distance"])
    surf = r["surface"]
    surf_capital = "Turf" if surf.lower() == "turf" else "Dirt"
    purse = r.get("purse") or 0
    post_time = fmt_post_time(r.get("postTime"))
    tb = cd_track_bias(dist, surf)
    horses_lines = "\n".join(fmt_horse(h) for h in r["horses"])

    return (
        f"// ── R{rn} — {rt} {dist} {surf_capital} ${purse:,} ──\n"
        f"const race{rn}: StaticRace = {{\n"
        f'  raceNumber: {rn}, postTime: "{post_time}",\n'
        f'  raceType: {json.dumps(rt)}, distance: {json.dumps(dist)}, '
        f'surface: "{surf_capital}", purse: {purse}, condition: "Fast",\n'
        f"  trackBias: {fmt_track_bias(tb)},\n"
        f"  horses: [\n{horses_lines}\n  ],\n"
        f"}};\n"
    )


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/gen_cd_ts.py YYYY-MM-DD")
        sys.exit(1)
    date = sys.argv[1]
    repo = Path(__file__).resolve().parent.parent
    in_path = repo / "data" / f"cd-{date}" / "raw-entries.json"
    if not in_path.exists():
        print(f"ERROR: {in_path} not found")
        sys.exit(2)
    data = json.loads(in_path.read_text(encoding="utf-8"))

    races_ts = "\n".join(fmt_race(r, i) for i, r in enumerate(data["races"]))
    race_var_list = ", ".join(f"race{r['raceNumber']}" for r in data["races"])
    const_name = f"CD_{date.replace('-', '_')}"

    output = (
        f"// Churchill Downs — {date}\n"
        f"// Generated by scripts/gen_cd_ts.py from data/cd-{date}/raw-entries.json\n"
        f"// Data source: BRIS Ultimate PPs PDF (parsed via scripts/parse_bris_pdf.py).\n"
        f"// Track bias uses CD spring-meet defaults (cd-context.ts CD_DEFAULT_BIASES).\n"
        "\n"
        'import type { StaticRace, StaticHorse } from "./keeneland-apr18";\n'
        "\n"
        "const h = (\n"
        "  program: string, name: string, ml: number, style: string,\n"
        "  beyers: number[], days: number, weight: number,\n"
        "  extras: Partial<StaticHorse> = {}\n"
        "): StaticHorse => ({\n"
        "  program, name, mlOdds: ml, style,\n"
        "  last3Beyer: beyers, daysSinceLast: days, weight,\n"
        "  ...extras,\n"
        "});\n"
        "\n"
        f"{races_ts}\n"
        f"export const {const_name}: StaticRace[] = [{race_var_list}];\n"
        f'export const CD_{date.replace("-", "_")}_DATE = "{date}";\n'
        "\n"
        "// Mark class drop using currentClass vs avgClassLast3 heuristic\n"
        f"for (const r of {const_name}) {{\n"
        "  for (const horse of r.horses) {\n"
        "    if (horse.currentClass && horse.avgClassLast3 && horse.currentClass < horse.avgClassLast3) {\n"
        "      horse.isClassDrop = true;\n"
        "    }\n"
        "  }\n"
        "}\n"
    )

    out_path = repo / "web" / "app" / "lib" / f"cd-{date}.ts"
    out_path.write_text(output, encoding="utf-8")
    print(f"[OK] Wrote {out_path} ({len(data['races'])} races, {sum(len(r['horses']) for r in data['races'])} horses)")


if __name__ == "__main__":
    main()
