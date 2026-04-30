"""Core feature engineering — 50 features organized by category.

All features are computed per-entry and z-scored within the race field
to handle variable field sizes. This is the Phase 1 feature set.
"""

from __future__ import annotations

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from src.data.models import Entry, PastPerformance, Race


def _z_score(series: pd.Series) -> pd.Series:
    """Z-score normalize within a group. Returns 0 for constant series."""
    std = series.std()
    if std == 0 or pd.isna(std):
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def compute_speed_features(pps: list[PastPerformance]) -> dict[str, float | None]:
    """Speed features from past performances (5 features)."""
    beyers = [pp.beyer_speed for pp in pps if pp.beyer_speed is not None]
    if not beyers:
        return {
            "best_beyer": None,
            "avg_beyer": None,
            "last_beyer": None,
            "beyer_trend": None,
            "beyer_stdev": None,
        }

    # Beyer trend: use linear regression slope over available races,
    # not last-vs-average which conflates bouncing with true trends.
    # A horse running 90-88-86-84 has a clear negative slope.
    trend = 0.0
    if len(beyers) >= 2:
        # polyfit: slope of beyer over race index (0=most recent)
        # Negative slope = improving (most recent races are better)
        slope = np.polyfit(range(len(beyers)), beyers, 1)[0]
        trend = float(-slope)  # negate so positive = improving

    return {
        "best_beyer": float(max(beyers)),
        "avg_beyer": float(np.mean(beyers)),
        "last_beyer": float(beyers[0]) if beyers else None,
        "beyer_trend": trend,
        "beyer_stdev": float(np.std(beyers)) if len(beyers) > 1 else 0.0,
    }


def compute_pace_features(entry: Entry, pps: list[PastPerformance]) -> dict[str, float | None]:
    """Pace features — per-entry pace figures and one-hot running style."""
    e1s = [pp.e1_pace for pp in pps if pp.e1_pace is not None]
    e2s = [pp.e2_pace for pp in pps if pp.e2_pace is not None]
    lps = [pp.late_pace for pp in pps if pp.late_pace is not None]

    # One-hot encode running style (categorical, not ordinal).
    # E=1..C=5 linear scale is meaningless — a closer isn't "2.5x" a front-runner.
    style = entry.running_style or "P"
    style_features = {
        "style_E": 1.0 if style == "E" else 0.0,
        "style_EP": 1.0 if style == "EP" else 0.0,
        "style_P": 1.0 if style == "P" else 0.0,
        "style_S": 1.0 if style == "S" else 0.0,
        "style_C": 1.0 if style == "C" else 0.0,
    }

    return {
        "avg_e1_pace": float(np.mean(e1s)) if e1s else None,
        "avg_e2_pace": float(np.mean(e2s)) if e2s else None,
        "avg_late_pace": float(np.mean(lps)) if lps else None,
        "last_e1_pace": float(e1s[0]) if e1s else None,
        "last_late_pace": float(lps[0]) if lps else None,
        **style_features,
        "pace_velocity_change": (float(np.mean(lps)) - float(np.mean(e1s)))
        if e1s and lps
        else None,
        "early_late_ratio": (float(np.mean(e1s)) / float(np.mean(lps)))
        if e1s and lps and np.mean(lps) != 0
        else None,
    }


def compute_class_features(
    entry: Entry, race: Race, pps: list[PastPerformance]
) -> dict[str, float | None]:
    """Class features (6 features)."""
    purses = [pp.purse for pp in pps if pp.purse is not None]
    avg_purse = float(np.mean(purses)) if purses else None

    # Class change: current purse vs average past purse
    class_change = None
    if avg_purse and race.purse:
        class_change = float(race.purse - avg_purse) / avg_purse if avg_purse > 0 else 0.0

    # Claiming price ratio
    claim_ratio = None
    past_claims = [pp.claiming_price for pp in pps if pp.claiming_price is not None]
    if entry.claiming_price and past_claims:
        claim_ratio = float(entry.claiming_price) / float(np.mean(past_claims))

    # Race type encoding
    type_map = {"MSW": 5.0, "MSL": 4.0, "ALW": 4.0, "STK": 6.0, "CLM": 3.0, "MCL": 2.0, "MOC": 3.5}
    race_type_val = type_map.get(race.race_type, 3.0)

    return {
        "current_purse": float(race.purse) if race.purse else None,
        "avg_past_purse": avg_purse,
        "class_change_pct": class_change,
        "claiming_price_ratio": claim_ratio,
        "race_type_encoded": race_type_val,
        "is_class_drop": 1.0 if class_change is not None and class_change < -0.15 else 0.0,
    }


def compute_form_features(
    entry: Entry, pps: list[PastPerformance]
) -> dict[str, float | None]:
    """Form cycle features (6 features)."""
    null_features = {
        "days_since_last": None,
        "log_days_since_last": None,
        "is_quick_turnaround": None,
        "is_optimal_rest": None,
        "is_freshening": None,
        "is_extended_layoff": None,
        "win_rate_last_5": None,
        "win_rate_last_10": None,
        "avg_finish_pos": None,
        "improvement_last_3": None,
        "top3_rate_last_5": None,
    }
    if not pps:
        return null_features

    # Days since last race — non-linear relationship with performance:
    # <14 days: quick turnaround (usually negative)
    # 28-60 days: optimal rest window
    # 60-120 days: freshening (needs workouts to evaluate)
    # >120 days: extended layoff (major concern)
    days_since = None
    if pps[0].race_date and hasattr(entry, "race") and entry.race and entry.race.race_date:
        days_since = float((entry.race.race_date - pps[0].race_date).days)

    finishes = [pp.finish_position for pp in pps if pp.finish_position is not None]

    # Win rates
    wins_5 = sum(1 for f in finishes[:5] if f == 1) / min(len(finishes), 5) if finishes else None
    wins_10 = sum(1 for f in finishes[:10] if f == 1) / min(len(finishes), 10) if finishes else None
    top3_5 = sum(1 for f in finishes[:5] if f <= 3) / min(len(finishes), 5) if finishes else None

    # Improvement trend via slope over last 3-5 Beyers
    beyers = [pp.beyer_speed for pp in pps[:5] if pp.beyer_speed is not None]
    improvement = None
    if len(beyers) >= 2:
        slope = np.polyfit(range(len(beyers)), beyers, 1)[0]
        improvement = float(-slope)  # positive = improving

    return {
        "days_since_last": days_since,
        "log_days_since_last": float(np.log(days_since + 1)) if days_since is not None else None,
        "is_quick_turnaround": 1.0 if days_since is not None and days_since < 14 else 0.0,
        "is_optimal_rest": 1.0 if days_since is not None and 28 <= days_since <= 60 else 0.0,
        "is_freshening": 1.0 if days_since is not None and 60 < days_since <= 120 else 0.0,
        "is_extended_layoff": 1.0 if days_since is not None and days_since > 120 else 0.0,
        "win_rate_last_5": float(wins_5) if wins_5 is not None else None,
        "win_rate_last_10": float(wins_10) if wins_10 is not None else None,
        "avg_finish_pos": float(np.mean(finishes)) if finishes else None,
        "improvement_last_3": improvement,
        "top3_rate_last_5": float(top3_5) if top3_5 is not None else None,
    }


def compute_jockey_trainer_features(
    entry: Entry, session: Session
) -> dict[str, float | None]:
    """Jockey and trainer statistics (10 features).

    Computed from prior entries only (before this race's date) to prevent
    lookahead bias. Without the date filter, future results leak into features.
    """
    features: dict[str, float | None] = {}

    # Get the race date for this entry to filter out future data
    race_date = entry.race.race_date if entry.race else None

    for role, prefix in [("jockey", "jockey"), ("trainer", "trainer")]:
        name = getattr(entry, role)
        if not name:
            for suffix in ["win_pct", "roi", "starts", "top3_pct", "avg_odds"]:
                features[f"{prefix}_{suffix}"] = None
            continue

        query = session.query(Entry).filter(getattr(Entry, role) == name)
        # Only use entries from races BEFORE the current race date
        if race_date is not None:
            query = query.join(Race).filter(Race.race_date < race_date)
        prior_entries = query.all()

        total = len(prior_entries)
        if total == 0:
            for suffix in ["win_pct", "roi", "starts", "top3_pct", "avg_odds"]:
                features[f"{prefix}_{suffix}"] = None
            continue

        wins = sum(1 for e in prior_entries if e.finish_position == 1)
        top3 = sum(1 for e in prior_entries if e.finish_position is not None and e.finish_position <= 3)

        # ROI based on win payoffs
        payoffs = [e.win_payoff for e in prior_entries if e.finish_position == 1 and e.win_payoff]
        roi = (sum(payoffs) - total * 2.0) / (total * 2.0) if total > 0 else None

        avg_odds_list = [e.final_odds for e in prior_entries if e.final_odds is not None]

        features[f"{prefix}_win_pct"] = float(wins / total) if total > 0 else None
        features[f"{prefix}_roi"] = roi
        features[f"{prefix}_starts"] = float(total)
        features[f"{prefix}_top3_pct"] = float(top3 / total) if total > 0 else None
        features[f"{prefix}_avg_odds"] = float(np.mean(avg_odds_list)) if avg_odds_list else None

    # Jockey/trainer combo stats — how they perform together
    jockey_name = entry.jockey
    trainer_name = entry.trainer
    combo_features: dict[str, float | None] = {
        "combo_win_pct": None,
        "combo_starts": None,
        "combo_roi": None,
        "combo_uplift": None,
    }

    if jockey_name and trainer_name:
        combo_query = session.query(Entry).filter(
            Entry.jockey == jockey_name,
            Entry.trainer == trainer_name,
        )
        if race_date is not None:
            combo_query = combo_query.join(Race).filter(Race.race_date < race_date)
        combo_entries = combo_query.all()

        combo_total = len(combo_entries)
        if combo_total >= 5:
            combo_wins = sum(1 for e in combo_entries if e.finish_position == 1)
            combo_win_pct = float(combo_wins / combo_total)
            combo_payoffs = [
                e.win_payoff for e in combo_entries
                if e.finish_position == 1 and e.win_payoff
            ]
            combo_roi = (
                (sum(combo_payoffs) - combo_total * 2.0) / (combo_total * 2.0)
                if combo_total > 0
                else None
            )
            jockey_wp = features.get("jockey_win_pct") or 0.0
            trainer_wp = features.get("trainer_win_pct") or 0.0
            combo_uplift = combo_win_pct - max(jockey_wp, trainer_wp)

            combo_features["combo_win_pct"] = combo_win_pct
            combo_features["combo_starts"] = float(combo_total)
            combo_features["combo_roi"] = combo_roi
            combo_features["combo_uplift"] = combo_uplift

    features.update(combo_features)
    return features


def compute_post_position_features(entry: Entry, race: Race) -> dict[str, float | None]:
    """Post position features with surface/distance interactions.

    A generic 'is_outside' at 75% ignores that outside posts hurt on
    dirt sprints (first turn is close) but barely matter on turf routes
    or sprint chutes. The interaction features capture what horsemen know.
    """
    pp = entry.post_position
    field_size = race.num_entrants or 10
    is_outside = pp > field_size * 0.75
    is_sprint = (race.distance_yards or 0) <= 1320  # 6f or less
    is_dirt = (race.surface or "D") == "D"
    is_turf = (race.surface or "D") in ("T", "t")

    return {
        "post_position": float(pp),
        "post_position_pct": float(pp) / float(field_size) if field_size > 0 else None,
        "is_outside": 1.0 if is_outside else 0.0,
        # Outside post on dirt sprint = significant disadvantage (losing ground into turn)
        "is_outside_dirt_sprint": 1.0 if is_outside and is_sprint and is_dirt else 0.0,
        # Inside posts on turf can be negative (rail gets chewed up)
        "is_inside_turf": 1.0 if pp <= 3 and is_turf else 0.0,
    }


def compute_distance_surface_features(
    entry: Entry, race: Race, pps: list[PastPerformance]
) -> dict[str, float | None]:
    """Distance and surface preference features (5 features)."""
    # How many past races at this distance (+/- 110 yards ≈ 0.5f)?
    dist_match = sum(
        1 for pp in pps
        if pp.distance_yards is not None
        and abs((pp.distance_yards or 0) - (race.distance_yards or 0)) < 110
    )
    surf_match = sum(
        1 for pp in pps
        if pp.surface is not None and pp.surface == race.surface
    )
    total_pps = len(pps) if pps else 1

    # Surface switch
    is_switch = 0.0
    if pps and pps[0].surface and pps[0].surface != race.surface:
        is_switch = 1.0

    # Distance change
    dist_change = None
    if pps and pps[0].distance_yards and race.distance_yards:
        dist_change = float(race.distance_yards - pps[0].distance_yards)

    return {
        "distance_exp_pct": float(dist_match) / total_pps,
        "surface_exp_pct": float(surf_match) / total_pps,
        "is_surface_switch": is_switch,
        "distance_change_yards": dist_change,
        "is_route_to_sprint": 1.0
        if dist_change is not None and dist_change < -440
        else 0.0,
    }


def compute_odds_features(entry: Entry) -> dict[str, float | None]:
    """Odds-related features (4 features).

    WARNING: These are PUBLIC OPINION, not horse performance data.
    They are excluded from Stage 1 (fundamental prediction model) and
    only used in Stage 2 (overlay detection / value betting).

    Do NOT call this from compute_entry_features() — odds contaminate
    the prediction model. Use compute_overlay_features() separately.
    """
    ml = entry.morning_line_odds
    ml_prob = 1.0 / (1.0 + ml) if ml is not None and ml > 0 else None

    return {
        "morning_line_odds": float(ml) if ml is not None else None,
        "ml_implied_prob": ml_prob,
        "log_ml_odds": float(np.log(ml)) if ml is not None and ml > 0 else None,
        "is_ml_favorite": 1.0 if ml is not None and ml <= 3.0 else 0.0,
    }


def compute_equipment_features(
    entry: Entry, pps: list[PastPerformance]
) -> dict[str, float | None]:
    """Equipment and medication features (4 features).

    First-time blinkers is one of the top-5 most profitable angles in
    thoroughbred racing. Horses adding blinkers for the first time win
    at roughly 2-3x their expected rate, particularly younger horses.
    """
    has_blinkers = 1.0 if entry.equipment and "b" in entry.equipment.lower() else 0.0

    # First-time blinkers: compare current equipment vs last PP's equipment.
    # PastPerformance may or may not have equipment field; check what's available.
    first_blinkers = 0.0
    blinkers_off = 0.0
    if has_blinkers and pps:
        last_equip = getattr(pps[0], "equipment", None) or ""
        if "b" not in last_equip.lower():
            first_blinkers = 1.0
    elif not has_blinkers and pps:
        last_equip = getattr(pps[0], "equipment", None) or ""
        if "b" in last_equip.lower():
            blinkers_off = 1.0

    has_lasix = 1.0 if entry.medication and "L" in entry.medication else 0.0

    return {
        "has_blinkers": has_blinkers,
        "first_time_blinkers": first_blinkers,
        "blinkers_off": blinkers_off,
        "has_lasix": has_lasix,
    }


def compute_trip_shape_features(pps: list[PastPerformance]) -> dict[str, float | None]:
    """Trip shape from running position calls.

    Position calls reveal the actual trip. A horse 2nd at the first call
    and 4th by 6 lengths at the stretch had a rough trip — the bare
    speed figure understates its true ability.
    """
    if not pps:
        return {
            "avg_pos_1st_call": None,
            "avg_pos_stretch": None,
            "avg_pos_gain": None,
            "avg_late_gain": None,
            "troubled_trip_rate": None,
        }

    # Position gain: 1st call position minus finish (positive = gained ground)
    gains = []
    for pp in pps:
        if pp.position_1st_call is not None and pp.finish_position is not None:
            gains.append(pp.position_1st_call - pp.finish_position)

    # Late gain: stretch position minus finish (the "kick")
    late_gains = []
    for pp in pps:
        if pp.position_stretch is not None and pp.finish_position is not None:
            late_gains.append(pp.position_stretch - pp.finish_position)

    # Troubled trip: lost 3+ positions from 1st call to stretch with
    # disproportionate increase in lengths behind
    troubled = 0
    for pp in pps:
        if (pp.position_1st_call is not None and pp.position_stretch is not None
                and pp.position_stretch - pp.position_1st_call >= 3):
            troubled += 1

    pos1s = [pp.position_1st_call for pp in pps if pp.position_1st_call is not None]
    pos_str = [pp.position_stretch for pp in pps if pp.position_stretch is not None]
    n = len(pps)

    return {
        "avg_pos_1st_call": float(np.mean(pos1s)) if pos1s else None,
        "avg_pos_stretch": float(np.mean(pos_str)) if pos_str else None,
        "avg_pos_gain": float(np.mean(gains)) if gains else None,
        "avg_late_gain": float(np.mean(late_gains)) if late_gains else None,
        "troubled_trip_rate": float(troubled / n) if n > 0 else None,
    }


def _lookup_track_bias(race: Race, session: Session):
    """Look up the most recent TrackBias row for this race's track/surface.

    Called once per race in compute_race_features(), then passed to
    compute_track_bias_feature() per entry to avoid N+1 queries.
    """
    from src.data.models import TrackBias

    return (
        session.query(TrackBias)
        .filter(
            TrackBias.track_code == race.track_code,
            TrackBias.surface == race.surface,
        )
        .order_by(TrackBias.date_range_end.desc())
        .first()
    )


def compute_track_bias_feature(
    entry: Entry, race: Race, bias=None,
) -> dict[str, float | None]:
    """Track bias advantage for this entry's PP and running style.

    Args:
        entry: The entry to compute bias for.
        race: The race (used for context only; bias is pre-looked-up).
        bias: Pre-fetched TrackBias object (from _lookup_track_bias).
    """
    if bias is None or not bias.post_position_win_rates:
        return {"track_bias_advantage": None}

    pp_rates = bias.post_position_win_rates
    pp_idx = entry.post_position - 1

    # PP win rate delta vs field average
    avg_pp_rate = sum(pp_rates) / len(pp_rates) if pp_rates else 0.0
    pp_delta = (pp_rates[pp_idx] - avg_pp_rate) if 0 <= pp_idx < len(pp_rates) else 0.0

    # Style win rate delta
    style = entry.running_style or "P"
    style_delta = 0.0
    overall_win_rate = avg_pp_rate  # approximate
    if style in ("E", "EP") and bias.early_speed_win_pct is not None:
        style_delta = bias.early_speed_win_pct - overall_win_rate
    elif style in ("S", "C") and bias.closer_win_pct is not None:
        style_delta = bias.closer_win_pct - overall_win_rate

    return {"track_bias_advantage": pp_delta + style_delta}


def compute_entry_features(
    entry: Entry, race: Race, session: Session, track_bias=None,
) -> dict[str, float | None]:
    """Compute Stage 1 (fundamental) features for a single entry.

    These features are derived ONLY from horse performance data — no
    market odds. This is the Benter two-stage approach:
      Stage 1: Predict finishing order from data (this function)
      Stage 2: Compare predictions to odds for value (overlay module)

    Odds features (morning_line_odds, ml_implied_prob, etc.) are
    intentionally excluded. They represent crowd opinion, not horse
    ability. Use compute_odds_features() separately in Stage 2.

    Args:
        track_bias: Pre-fetched TrackBias object (avoids N+1 queries).
    """
    pps = sorted(entry.past_performances, key=lambda p: p.pp_number)

    features: dict[str, float | None] = {}
    features.update(compute_speed_features(pps))
    features.update(compute_pace_features(entry, pps))
    features.update(compute_class_features(entry, race, pps))
    features.update(compute_form_features(entry, pps))
    features.update(compute_jockey_trainer_features(entry, session))
    features.update(compute_post_position_features(entry, race))
    features.update(compute_distance_surface_features(entry, race, pps))
    # NO compute_odds_features() here — odds are Stage 2 only
    features.update(compute_equipment_features(entry, pps))
    features.update(compute_trip_shape_features(pps))
    features.update(compute_track_bias_feature(entry, race, bias=track_bias))

    return features


def _compute_pace_scenario(race: Race) -> dict[str, float]:
    """Field-level pace scenario features.

    The most important handicapping dimension is missing from per-entry
    features: how many speed horses are in the race? A lone E horse
    wins at ~35%. Three E horses = speed duel = closers benefit.
    """
    styles = [e.running_style or "P" for e in race.entries]
    n_early = sum(1 for s in styles if s in ("E", "EP"))
    n_closers = sum(1 for s in styles if s in ("S", "C"))
    n = len(styles) or 1

    scenario = "hot" if n_early >= 3 else ("honest" if n_early == 2 else "soft")

    return {
        "n_early_speed": float(n_early),
        "n_closers": float(n_closers),
        "speed_horse_pct": float(n_early) / n,
        "pace_scenario_hot": 1.0 if scenario == "hot" else 0.0,
        "pace_scenario_soft": 1.0 if scenario == "soft" else 0.0,
    }


def _compute_pace_interactions(entry: Entry, pace_scenario: dict) -> dict[str, float]:
    """Per-entry pace scenario interactions.

    These capture whether the field composition HELPS or HURTS this horse.
    """
    style = entry.running_style or "P"
    is_speed = style in ("E", "EP")
    is_closer = style in ("S", "C")
    n_early = pace_scenario["n_early_speed"]
    is_hot = pace_scenario["pace_scenario_hot"] == 1.0
    is_soft = pace_scenario["pace_scenario_soft"] == 1.0

    return {
        "lone_speed": 1.0 if is_speed and n_early == 1 else 0.0,
        "style_x_hot_pace": 1.0 if is_closer and is_hot else 0.0,
        "style_x_soft_pace": 1.0 if is_speed and is_soft else 0.0,
        # Pace pressure: how crowded is this horse's tactical position?
        "pace_pressure": float(n_early - 1) if is_speed else float(-n_early),
    }


def compute_race_features(
    race: Race, session: Session
) -> pd.DataFrame:
    """Compute feature matrix for all entries in a race.

    Returns DataFrame with entry_id as index, feature columns,
    z-scored within the race field. Includes field-level pace scenario
    features that require knowledge of the entire field.
    """
    # Compute field-level features once (not per-entry)
    pace_scenario = _compute_pace_scenario(race)
    track_bias = _lookup_track_bias(race, session)

    rows = []
    for entry in race.entries:
        feats = compute_entry_features(entry, race, session, track_bias=track_bias)
        # Add field-level pace scenario + per-entry interactions
        feats.update(pace_scenario)
        feats.update(_compute_pace_interactions(entry, pace_scenario))
        feats["entry_id"] = entry.id
        feats["finish_position"] = entry.finish_position
        feats["final_odds"] = entry.final_odds
        rows.append(feats)

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df = df.set_index("entry_id")

    # Z-score numeric features within the race field
    exclude = {"finish_position", "final_odds"}
    for col in df.columns:
        if col not in exclude and df[col].dtype in [np.float64, np.int64, float, int]:
            df[col] = _z_score(df[col].astype(float))

    return df
