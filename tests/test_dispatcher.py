"""Tests for the JSONL task-queue dispatcher."""

from __future__ import annotations

import json
from pathlib import Path

import pandas as pd
import pytest

from src.agents.dispatcher import (
    Result,
    Task,
    apply_results,
    build_task_queue,
    read_results,
    read_tasks,
    retry_failed,
    write_tasks,
)
from src.data.models import Entry, Horse, PastPerformance, Race


def _df(rows):
    return pd.DataFrame(rows)


class TestBuildTaskQueue:
    def test_deduplicates_jockey(self):
        df = _df([
            {
                "horse_name": "A", "sire": "SireA",
                "track_code": "KEE", "race_date": "2026-04-17", "race_number": 1,
                "jockey": "Irad Ortiz, Jr.", "trainer": "Cox",
                "unresolved_specs": "equibase_pps,jt_stats:jockey,jt_stats:trainer",
            },
            {
                "horse_name": "B", "sire": "SireB",
                "track_code": "KEE", "race_date": "2026-04-17", "race_number": 1,
                "jockey": "Irad Ortiz, Jr.", "trainer": "Cox",
                "unresolved_specs": "equibase_pps,jt_stats:jockey,jt_stats:trainer",
            },
        ])
        tasks = build_task_queue(df)
        ids = sorted(t.task_id for t in tasks)
        # one pps per horse + one jockey + one trainer → 4 tasks total.
        assert ids == [
            "equibase_pps:A",
            "equibase_pps:B",
            "jt:jockey:Irad Ortiz, Jr.",
            "jt:trainer:Cox",
        ]

    def test_skips_rows_with_no_unresolved(self):
        df = _df([
            {
                "horse_name": "A", "sire": "S", "track_code": "KEE", "race_date": "2026-04-17",
                "race_number": 1, "jockey": "J", "trainer": "T", "unresolved_specs": "",
            },
        ])
        assert build_task_queue(df) == []


class TestJsonlRoundtrip:
    def test_write_and_read(self, tmp_path: Path):
        tasks = [
            Task(task_id="a", spec_id="equibase_pps", horse_name="A", prompt="p"),
            Task(task_id="b", spec_id="jt_stats", person_name="J", role="jockey", prompt="p"),
        ]
        p = tmp_path / "tasks.jsonl"
        n = write_tasks(tasks, p)
        assert n == 2
        back = read_tasks(p)
        assert [t.task_id for t in back] == ["a", "b"]


class TestRetryFailed:
    def test_requeues_not_found(self):
        tasks = [Task(task_id="a", spec_id="equibase_pps", horse_name="A", prompt="p")]
        results = [Result(task_id="a", spec_id="equibase_pps", status="not_found")]
        again = retry_failed(tasks, results, max_attempts=3)
        assert len(again) == 1
        assert again[0].attempts == 1

    def test_caps_attempts(self):
        tasks = [Task(task_id="a", spec_id="equibase_pps", horse_name="A", prompt="p", attempts=2)]
        results = [Result(task_id="a", spec_id="equibase_pps", status="failed")]
        again = retry_failed(tasks, results, max_attempts=3)
        assert again == []


class TestApplyResults:
    def test_applies_pps_roundtrip(self, session):
        from datetime import date as _date
        race = Race(
            track_code="KEE", race_date=_date(2026, 4, 17), race_number=1,
            distance_yards=1870, surface="D", race_type="MCL", purse=55000,
        )
        horse = Horse(name="Olympic Star", sire="Midshipman")
        session.add_all([race, horse])
        session.flush()
        entry = Entry(race_id=race.id, horse_id=horse.id, post_position=1, program_number="1")
        session.add(entry)
        session.commit()

        result = Result(
            task_id="equibase_pps:Olympic Star",
            spec_id="equibase_pps",
            horse_name="Olympic Star",
            status="ok",
            payload={
                "status": "ok",
                "horse_name": "Olympic Star",
                "pps": [
                    {"race_date": "2026-03-15", "track_code": "KEE",
                     "distance_yards": 1760, "surface": "D",
                     "beyer_speed": 82, "finish_position": 4,
                     "e1_pace": 88, "late_pace": 79},
                    {"race_date": "2026-02-20", "track_code": "FG",
                     "distance_yards": 1320, "surface": "D",
                     "beyer_speed": 78, "finish_position": 6},
                ],
            },
        )
        counts = apply_results(session, [result])
        assert counts["equibase_pps"] == 1
        pps = session.query(PastPerformance).filter_by(entry_id=entry.id).all()
        assert len(pps) == 2
        assert pps[0].beyer_speed == 82
