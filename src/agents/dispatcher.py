"""JSONL task queue for filling missing race data via Claude Code subagents.

The pipeline is:

  1. ``scripts/keeneland_preview.py --export-only`` scrapes HRN, produces a
     v0 CSV with PROMPT[...] cells, and writes a ``tasks.jsonl`` queue where
     each line is a self-contained fetch task (one per horse × spec).
  2. The parent Claude Code agent dispatches these tasks in waves using the
     ``Agent`` tool with ``subagent_type='general-purpose'``. Each subagent
     runs a targeted ``WebFetch`` against Equibase (primary) or HRN (fallback),
     returning JSON matching the spec's schema.
  3. Subagent results are appended to ``results.jsonl``.
  4. ``--ingest-results`` applies each result via ``apply_partial_update`` in
     ``ingest_scraped`` and regenerates the CSV; resolved prompt cells turn
     into numeric z-scored values.

This module is the JSONL I/O layer. It does NOT call the Claude API — the
parent agent drives dispatch, so no API key is required.
"""

from __future__ import annotations

import json
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Iterable

import pandas as pd
from sqlalchemy.orm import Session

from src.data.scrapers.ingest_scraped import apply_partial_update
from src.data.scrapers.prompt_specs import (
    FEATURE_TO_SPEC,
    horse_slug,
    render_prompt,
)


@dataclass
class Task:
    """One subagent fetch task."""
    task_id: str
    spec_id: str            # "equibase_pps" | "equibase_workouts" | "jt_stats"
    horse_name: str = ""    # "" for jt_stats tasks
    person_name: str = ""   # "" for horse-centric tasks
    role: str = ""          # "jockey" | "trainer" for jt_stats
    race_number: int = 0
    track_code: str = ""
    race_date: str = ""
    sire: str = ""
    prompt: str = ""
    attempts: int = 0


@dataclass
class Result:
    """One subagent result, read back from results.jsonl."""
    task_id: str
    spec_id: str
    horse_name: str = ""
    person_name: str = ""
    role: str = ""
    status: str = "ok"      # "ok" | "not_found" | "failed"
    payload: dict = field(default_factory=dict)
    error: str = ""


# ── task building ─────────────────────────────────────────────────────


def build_task_queue(
    df: pd.DataFrame,
    horse_urls: dict[str, str] | None = None,
) -> list[Task]:
    """Collect the unique (horse, spec) and (person, role) tasks from a matrix.

    Deduplicates: shared jockey/trainer across horses → one task per person.
    Each horse-centric spec gets one task per horse (PPs or workouts).
    """
    urls = horse_urls or {}
    tasks: dict[str, Task] = {}

    for _, row in df.iterrows():
        horse_name = str(row.get("horse_name") or "")
        sire = str(row.get("sire") or "") or "unknown"
        race_number = int(row.get("race_number") or 0)
        track_code = str(row.get("track_code") or "")
        race_date = str(row.get("race_date") or "")
        unresolved = str(row.get("unresolved_specs") or "")
        if not unresolved:
            continue
        tokens = [t for t in unresolved.split(",") if t]
        for token in tokens:
            if ":" in token:  # jt_stats:jockey / jt_stats:trainer
                spec_id, role = token.split(":", 1)
                person_name = str(row.get(role) or "")
                if not person_name:
                    continue
                task_id = f"jt:{role}:{person_name}"
                if task_id in tasks:
                    continue
                ctx = {
                    "role": role,
                    "role_param": "Jockey" if role == "jockey" else "Trainer",
                    "person_name": person_name,
                    "person_query": person_name.replace(" ", "+"),
                }
                tasks[task_id] = Task(
                    task_id=task_id,
                    spec_id=spec_id,
                    horse_name="",
                    person_name=person_name,
                    role=role,
                    prompt=render_prompt(spec_id, **ctx),
                )
            else:
                spec_id = token
                if not horse_name:
                    continue
                task_id = f"{spec_id}:{horse_name}"
                if task_id in tasks:
                    continue
                slug = horse_slug(horse_name)
                url = urls.get(horse_name) or f"https://www.horseracingnation.com/horse/{slug}"
                ctx = {
                    "horse_name": horse_name,
                    "sire": sire,
                    "track_code": track_code,
                    "race_number": race_number,
                    "race_date": race_date,
                    "horse_query": horse_name.replace(" ", "+"),
                    "horse_slug": slug,
                    "horse_url": url,
                }
                tasks[task_id] = Task(
                    task_id=task_id,
                    spec_id=spec_id,
                    horse_name=horse_name,
                    sire=sire,
                    race_number=race_number,
                    track_code=track_code,
                    race_date=race_date,
                    prompt=render_prompt(spec_id, **ctx),
                )
    return list(tasks.values())


def write_tasks(tasks: Iterable[Task], path: Path) -> int:
    path.parent.mkdir(parents=True, exist_ok=True)
    n = 0
    with path.open("w") as f:
        for task in tasks:
            f.write(json.dumps(asdict(task)) + "\n")
            n += 1
    return n


def read_tasks(path: Path) -> list[Task]:
    if not path.exists():
        return []
    out: list[Task] = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            out.append(Task(**data))
    return out


def read_results(path: Path) -> list[Result]:
    if not path.exists():
        return []
    out: list[Result] = []
    with path.open() as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            out.append(Result(
                task_id=data.get("task_id", ""),
                spec_id=data.get("spec_id", ""),
                horse_name=data.get("horse_name", ""),
                person_name=data.get("person_name", ""),
                role=data.get("role", ""),
                status=data.get("status", "ok"),
                payload=data.get("payload") or {},
                error=data.get("error", ""),
            ))
    return out


def append_result(result: Result, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a") as f:
        f.write(json.dumps(asdict(result)) + "\n")


# ── result application ───────────────────────────────────────────────


def apply_results(session: Session, results: Iterable[Result]) -> dict[str, int]:
    """Apply subagent results to the DB via apply_partial_update.

    Returns counts per spec_id for telemetry.
    """
    counts: dict[str, int] = {"equibase_pps": 0, "equibase_workouts": 0, "jt_stats": 0, "skipped": 0}
    for r in results:
        if r.status != "ok" or not r.payload:
            counts["skipped"] += 1
            continue
        if r.spec_id == "equibase_pps":
            apply_partial_update(session, r.horse_name, r.payload, kind="pps")
            counts["equibase_pps"] += 1
        elif r.spec_id == "equibase_workouts":
            apply_partial_update(session, r.horse_name, r.payload, kind="workouts")
            counts["equibase_workouts"] += 1
        elif r.spec_id == "jt_stats":
            # JT stats go into a cache file, not the DB — handled by the driver.
            counts["jt_stats"] += 1
        else:
            counts["skipped"] += 1
    session.commit()
    return counts


def retry_failed(previous_tasks: list[Task], results: list[Result], max_attempts: int = 3) -> list[Task]:
    """Re-queue any tasks whose most recent result was failed/not_found."""
    failed_ids = {r.task_id for r in results if r.status != "ok"}
    out: list[Task] = []
    for t in previous_tasks:
        if t.task_id in failed_ids and t.attempts + 1 < max_attempts:
            t2 = Task(**{**asdict(t), "attempts": t.attempts + 1})
            out.append(t2)
    return out
