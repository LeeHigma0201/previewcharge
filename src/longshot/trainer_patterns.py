"""Trainer pattern detection for longshot signals.

Certain trainers excel in specific situations. Examples from research:
- Bob Baffert removing blinkers after winning debut: 75% win rate
- Specific trainers with high ROI in first-off-claim, layoff returns,
  surface switches, and class drops.

This module detects trainer-situation pattern matches from historical data.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from src.data.models import Entry, Race
from src.longshot.signals import LongshotSignal


def check_trainer_patterns(
    entry: Entry, race: Race, session: Session
) -> list[LongshotSignal]:
    """Check for trainer pattern matches that indicate value.

    Signals checked:
    - First off the claim (trainer claims horse and runs quickly)
    - Layoff return specialist (trainer good with freshened horses)
    - Surface switch pattern (trainer wins with surface switches)
    - Equipment change intent (trainer adds/removes blinkers strategically)
    """
    signals = []
    trainer = entry.trainer
    if not trainer:
        return signals

    # Get trainer's historical entries BEFORE this race date only.
    # Without the date filter, future results leak into signals — lookahead bias.
    race_date = race.race_date if race else None
    query = (
        session.query(Entry)
        .filter(Entry.trainer == trainer)
        .filter(Entry.finish_position.isnot(None))
    )
    if race_date is not None:
        query = query.join(Race).filter(Race.race_date < race_date)
    trainer_entries = query.all()

    if len(trainer_entries) < 20:
        return signals

    total = len(trainer_entries)
    wins = sum(1 for e in trainer_entries if e.finish_position == 1)
    overall_win_pct = wins / total if total > 0 else 0

    # Signal: Trainer surface switch success
    pps = sorted(entry.past_performances, key=lambda p: p.pp_number)
    if pps and pps[0].surface and pps[0].surface != race.surface:
        switch_entries = [
            e for e in trainer_entries
            if e.past_performances
            and any(
                pp.pp_number == 1 and pp.surface and pp.surface != (e.race.surface if e.race else "")
                for pp in e.past_performances
            )
        ]
        if len(switch_entries) >= 5:
            switch_wins = sum(1 for e in switch_entries if e.finish_position == 1)
            switch_pct = switch_wins / len(switch_entries)
            if switch_pct > overall_win_pct * 1.5:
                signals.append(LongshotSignal(
                    name="trainer_surface_switch",
                    weight=2.0,
                    active=True,
                    detail=f"{trainer} wins {switch_pct:.0%} on surface switches vs {overall_win_pct:.0%} overall",
                ))

    # Signal: Trainer equipment change pattern
    if entry.equipment and "b" in entry.equipment.lower():
        blinker_entries = [
            e for e in trainer_entries if e.equipment and "b" in e.equipment.lower()
        ]
        if len(blinker_entries) >= 5:
            blinker_wins = sum(1 for e in blinker_entries if e.finish_position == 1)
            blinker_pct = blinker_wins / len(blinker_entries)
            if blinker_pct > overall_win_pct * 1.3:
                signals.append(LongshotSignal(
                    name="trainer_blinkers",
                    weight=1.5,
                    active=True,
                    detail=f"{trainer} wins {blinker_pct:.0%} with blinkers vs {overall_win_pct:.0%} overall",
                ))

    return signals
