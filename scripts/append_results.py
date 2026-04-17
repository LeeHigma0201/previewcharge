"""Append WebFetch JSON responses into a results.jsonl.

Each invocation receives a horse name, a spec id, and a JSON blob (or a path
to one); it normalizes the blob and appends a Result entry. Used to collect
parallel WebFetch outputs during dispatch.
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


def _parse_json_payload(raw: str) -> dict:
    """Try direct json.loads; if that fails, look for a ```json block."""
    raw = raw.strip()
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        pass
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", raw, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    # Look for first {...} pair.
    m = re.search(r"(\{.*\})", raw, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    raise ValueError("No JSON payload detected")


# Field-name aliases we see in practice from WebFetch responses.
_SPEED_ALIASES = ("beyer_speed", "speed_figure", "hrn_speed", "hrn_speed_figure", "speed")


def _normalize_pps(payload: dict) -> dict:
    """Normalize per-PP fields to the canonical names our ingest expects."""
    pps = payload.get("pps")
    if not isinstance(pps, list):
        return payload
    cleaned = []
    for pp in pps:
        if not isinstance(pp, dict):
            continue
        if "beyer_speed" not in pp:
            for k in _SPEED_ALIASES[1:]:
                if k in pp and pp[k] is not None:
                    pp["beyer_speed"] = pp[k]
                    break
        cleaned.append(pp)
    payload["pps"] = cleaned
    return payload


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--spec", required=True, help="spec id: equibase_pps, equibase_workouts, jt_stats")
    p.add_argument("--horse", default="", help="horse name (for horse-centric specs)")
    p.add_argument("--person", default="", help="person name (for jt_stats)")
    p.add_argument("--role", default="", help="jockey|trainer (for jt_stats)")
    p.add_argument("--task-id", default="", help="explicit task_id; auto-derived if omitted")
    p.add_argument("--status", default="ok", help="ok|not_found|failed")
    p.add_argument("--error", default="")
    p.add_argument("--from-file", help="Read payload JSON from this path")
    p.add_argument("--out", default="data/previews/KEE_2026-04-17_results.jsonl")
    p.add_argument("payload", nargs="?", default="", help="payload JSON as string")
    args = p.parse_args()

    raw = ""
    if args.from_file:
        raw = Path(args.from_file).read_text()
    else:
        raw = args.payload or sys.stdin.read()

    payload: dict = {}
    if args.status == "ok":
        try:
            payload = _parse_json_payload(raw)
            payload = _normalize_pps(payload)
        except Exception as exc:
            args.status = "failed"
            args.error = f"parse error: {exc}"

    task_id = args.task_id
    if not task_id:
        if args.spec == "jt_stats":
            task_id = f"jt:{args.role}:{args.person}"
        else:
            task_id = f"{args.spec}:{args.horse}"

    result = Result(
        task_id=task_id,
        spec_id=args.spec,
        horse_name=args.horse,
        person_name=args.person,
        role=args.role,
        status=args.status,
        payload=payload,
        error=args.error,
    )
    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("a") as f:
        f.write(json.dumps(asdict(result)) + "\n")
    print(f"appended {task_id} (status={result.status})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
