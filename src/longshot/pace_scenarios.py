"""Pace scenario analysis for longshot signals.

The single most important pace variable is the count of early-speed
types in a race. Multiple E/EP horses create pace pressure → fast
fractions → pace collapse → stalker/closer advantage.

Conversely, a lone speed horse with no pressure can wire the field
at any odds.
"""

from __future__ import annotations

import numpy as np

from src.data.models import Entry, Race
from src.longshot.signals import LongshotSignal


def classify_pace_scenario(entries: list[Entry]) -> dict:
    """Classify the race's pace scenario.

    Returns:
        Dict with scenario type, early speed count, and pressure assessment.
    """
    styles = [e.running_style or "P" for e in entries]
    early_count = sum(1 for s in styles if s in ("E", "EP"))
    closer_count = sum(1 for s in styles if s in ("S", "C"))
    presser_count = sum(1 for s in styles if s == "P")

    if early_count == 0:
        scenario = "no_speed"
    elif early_count == 1:
        scenario = "lone_speed"
    elif early_count == 2:
        scenario = "contested_pace"
    else:
        scenario = "speed_duel"

    return {
        "scenario": scenario,
        "early_count": early_count,
        "closer_count": closer_count,
        "presser_count": presser_count,
        "pace_pressure": "hot" if early_count >= 3 else "moderate" if early_count == 2 else "mild",
    }


def check_pace_signals(
    entry: Entry, race: Race, all_entries: list[Entry]
) -> list[LongshotSignal]:
    """Check for pace-related longshot signals."""
    signals = []
    scenario = classify_pace_scenario(all_entries)
    style = entry.running_style or "P"

    # Signal: Closer in a speed duel
    if style in ("S", "C") and scenario["scenario"] == "speed_duel":
        signals.append(LongshotSignal(
            name="closer_speed_duel",
            weight=3.0,
            active=True,
            detail=f"{scenario['early_count']} early speed types → likely pace collapse, benefits {style} runner",
        ))

    # Signal: Lone speed
    if style in ("E", "EP") and scenario["scenario"] == "lone_speed":
        # Check if THIS horse is the lone speed
        other_early = sum(
            1 for e in all_entries
            if e.id != entry.id and (e.running_style or "P") in ("E", "EP")
        )
        if other_early == 0:
            signals.append(LongshotSignal(
                name="lone_speed",
                weight=3.5,
                active=True,
                detail="Only early speed in the race — can control pace unchallenged",
            ))

    # Signal: Stalker watching contested pace
    if style == "P" and scenario["early_count"] >= 2:
        signals.append(LongshotSignal(
            name="stalker_advantage",
            weight=2.0,
            active=True,
            detail=f"Presser sitting behind {scenario['early_count']} speed types in contested pace",
        ))

    return signals


def estimate_pace_impact(
    entries: list[Entry],
) -> dict[int, float]:
    """Estimate how much pace scenario helps/hurts each entry.

    Returns dict mapping entry_id to a pace adjustment factor:
    > 1.0 = pace scenario benefits this horse
    < 1.0 = pace scenario hurts this horse
    """
    scenario = classify_pace_scenario(entries)
    adjustments = {}

    for entry in entries:
        style = entry.running_style or "P"
        adj = 1.0

        if scenario["scenario"] == "speed_duel":
            if style in ("E", "EP"):
                adj = 0.80  # Speed duels hurt early runners
            elif style in ("S", "C"):
                adj = 1.25  # Closers benefit
            elif style == "P":
                adj = 1.10  # Pressers benefit slightly
        elif scenario["scenario"] == "lone_speed":
            if style in ("E", "EP"):
                # Check if this is the lone speed
                others_early = sum(
                    1 for e in entries
                    if e.id != entry.id and (e.running_style or "P") in ("E", "EP")
                )
                if others_early == 0:
                    adj = 1.30  # Huge advantage
            elif style in ("S", "C"):
                adj = 0.85  # Hard to catch lone speed

        adjustments[entry.id] = adj

    return adjustments
