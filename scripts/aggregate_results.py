"""Aggregate per-horse JSON result files into a single results.jsonl.

Each subagent writes one JSON file per horse into a results directory. This
script reads that directory, normalizes speed-figure field names, and appends
Result records to the shared results.jsonl.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(_PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(_PROJECT_ROOT))

from src.agents.dispatcher import Result


_SPEED_ALIASES = ("speed_figure", "hrn_speed", "hrn_speed_figure", "speed")


def _strip_fences(raw: str) -> str:
    raw = raw.strip()
    if raw.startswith("```"):
        m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL)
        if m:
            return m.group(1)
    return raw


def _normalize(payload: dict) -> dict:
    pps = payload.get("pps")
    if isinstance(pps, list):
        for pp in pps:
            if not isinstance(pp, dict):
                continue
            if "beyer_speed" not in pp or pp.get("beyer_speed") is None:
                for alt in _SPEED_ALIASES:
                    if alt in pp and pp[alt] is not None:
                        pp["beyer_speed"] = pp[alt]
                        break
    return payload


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--results-dir", default="data/previews/results")
    p.add_argument("--out", default="data/previews/KEE_2026-04-17_results.jsonl")
    p.add_argument("--spec", default="equibase_pps")
    p.add_argument("--already", default="",
                   help="comma-separated list of horse names to skip (already persisted)")
    args = p.parse_args()

    rdir = Path(args.results_dir)
    if not rdir.exists():
        print(f"No results dir: {rdir}", file=sys.stderr)
        return 1

    skip = {s.strip() for s in args.already.split(",") if s.strip()}
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # Collect existing result task_ids to avoid duplicates.
    existing: set[str] = set()
    if out_path.exists():
        with out_path.open() as f:
            for line in f:
                try:
                    existing.add(json.loads(line).get("task_id") or "")
                except Exception:
                    pass

    added = 0
    with out_path.open("a") as out_f:
        for path in sorted(rdir.glob("*.json")):
            try:
                raw = _strip_fences(path.read_text())
                data = json.loads(raw)
            except Exception as exc:
                print(f"  [skip] {path.name}: parse failed: {exc}", file=sys.stderr)
                continue

            name = data.get("horse_name") or path.stem.replace("_", " ")
            if name in skip:
                continue
            task_id = f"{args.spec}:{name}"
            if task_id in existing:
                continue

            status = data.get("status") or "ok"
            payload = _normalize(data) if status == "ok" else {}
            result = Result(
                task_id=task_id,
                spec_id=args.spec,
                horse_name=name,
                status=status,
                payload=payload,
            )
            out_f.write(json.dumps(asdict(result)) + "\n")
            existing.add(task_id)
            added += 1

    print(f"Aggregated {added} results into {out_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
