"""Track bias computation from historical results.

Analyzes post-position and running-style win rates for a given
track/surface/condition combination over a configurable lookback window.
Minimum 50 races required for statistical significance.
"""

from __future__ import annotations

from datetime import date, timedelta

from sqlalchemy.orm import Session

from src.data.models import Entry, Race, TrackBias


def compute_track_bias(
    session: Session,
    track_code: str,
    surface: str,
    condition: str | None = None,
    lookback_days: int = 90,
    as_of_date: date | None = None,
) -> TrackBias | None:
    """Compute track bias stats from historical race results.

    Args:
        session: Database session.
        track_code: Track code (e.g., "SAR").
        surface: Surface type ("D", "T", "AW").
        condition: Track condition (e.g., "FT", "MY"). None = all conditions.
        lookback_days: Number of days to look back.
        as_of_date: Reference date. Defaults to today.

    Returns:
        TrackBias object, or None if sample_size < 50.
    """
    if as_of_date is None:
        as_of_date = date.today()

    start_date = as_of_date - timedelta(days=lookback_days)

    query = (
        session.query(Entry)
        .join(Race)
        .filter(
            Race.track_code == track_code,
            Race.surface == surface,
            Race.race_date >= start_date,
            Race.race_date <= as_of_date,
            Entry.finish_position.isnot(None),
        )
    )
    if condition is not None:
        query = query.filter(Race.track_condition == condition)

    entries = query.all()
    if len(entries) < 50:
        return None

    # Post-position win rates (indexed 0 = PP1, 1 = PP2, etc.)
    max_pp = max(e.post_position for e in entries)
    pp_wins = [0] * max_pp
    pp_total = [0] * max_pp
    for e in entries:
        idx = e.post_position - 1
        if 0 <= idx < max_pp:
            pp_total[idx] += 1
            if e.finish_position == 1:
                pp_wins[idx] += 1

    pp_win_rates = [
        float(pp_wins[i] / pp_total[i]) if pp_total[i] > 0 else 0.0
        for i in range(max_pp)
    ]

    # Running style win rates
    early_wins = 0
    early_total = 0
    closer_wins = 0
    closer_total = 0
    for e in entries:
        style = e.running_style or "P"
        if style in ("E", "EP"):
            early_total += 1
            if e.finish_position == 1:
                early_wins += 1
        elif style in ("S", "C"):
            closer_total += 1
            if e.finish_position == 1:
                closer_wins += 1

    early_pct = float(early_wins / early_total) if early_total > 0 else None
    closer_pct = float(closer_wins / closer_total) if closer_total > 0 else None

    # Inside (PP 1-3) vs outside (top quartile) win rates
    inside_wins = sum(1 for e in entries if e.post_position <= 3 and e.finish_position == 1)
    inside_total = sum(1 for e in entries if e.post_position <= 3)
    inside_pct = float(inside_wins / inside_total) if inside_total > 0 else None

    field_sizes = {}
    for e in entries:
        race_id = e.race_id
        if race_id not in field_sizes:
            field_sizes[race_id] = (e.race.num_entrants or 10) if e.race else 10

    outside_wins = 0
    outside_total = 0
    for e in entries:
        fs = field_sizes.get(e.race_id, 10)
        if e.post_position > fs * 0.75:
            outside_total += 1
            if e.finish_position == 1:
                outside_wins += 1
    outside_pct = float(outside_wins / outside_total) if outside_total > 0 else None

    bias = TrackBias(
        track_code=track_code,
        surface=surface,
        condition=condition,
        date_range_start=start_date,
        date_range_end=as_of_date,
        post_position_win_rates=pp_win_rates,
        early_speed_win_pct=early_pct,
        closer_win_pct=closer_pct,
        inside_win_pct=inside_pct,
        outside_win_pct=outside_pct,
        sample_size=len(entries),
    )

    session.add(bias)
    session.flush()
    return bias
