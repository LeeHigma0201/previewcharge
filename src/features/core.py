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

    return {
        "best_beyer": float(max(beyers)),
        "avg_beyer": float(np.mean(beyers)),
        "last_beyer": float(beyers[0]) if beyers else None,
        "beyer_trend": float(beyers[0] - np.mean(beyers)) if len(beyers) > 1 else 0.0,
        "beyer_stdev": float(np.std(beyers)) if len(beyers) > 1 else 0.0,
    }


def compute_pace_features(entry: Entry, pps: list[PastPerformance]) -> dict[str, float | None]:
    """Pace features (8 features)."""
    e1s = [pp.e1_pace for pp in pps if pp.e1_pace is not None]
    e2s = [pp.e2_pace for pp in pps if pp.e2_pace is not None]
    lps = [pp.late_pace for pp in pps if pp.late_pace is not None]

    # Running style encoding: E=1, EP=2, P=3, S=4, C=5
    style_map = {"E": 1.0, "EP": 2.0, "P": 3.0, "S": 4.0, "C": 5.0}
    style_val = style_map.get(entry.running_style, 3.0)

    return {
        "avg_e1_pace": float(np.mean(e1s)) if e1s else None,
        "avg_e2_pace": float(np.mean(e2s)) if e2s else None,
        "avg_late_pace": float(np.mean(lps)) if lps else None,
        "last_e1_pace": float(e1s[0]) if e1s else None,
        "last_late_pace": float(lps[0]) if lps else None,
        "running_style_encoded": style_val,
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
    if not pps:
        return {
            "days_since_last": None,
            "win_rate_last_5": None,
            "win_rate_last_10": None,
            "avg_finish_pos": None,
            "improvement_last_3": None,
            "top3_rate_last_5": None,
        }

    # Days since last race
    days_since = None
    if pps[0].race_date and hasattr(entry, "race") and entry.race and entry.race.race_date:
        days_since = float((entry.race.race_date - pps[0].race_date).days)

    finishes = [pp.finish_position for pp in pps if pp.finish_position is not None]
    fields = [pp.num_entrants for pp in pps if pp.num_entrants is not None]

    # Win rates
    wins_5 = sum(1 for f in finishes[:5] if f == 1) / min(len(finishes), 5) if finishes else None
    wins_10 = sum(1 for f in finishes[:10] if f == 1) / min(len(finishes), 10) if finishes else None
    top3_5 = sum(1 for f in finishes[:5] if f <= 3) / min(len(finishes), 5) if finishes else None

    # Improvement trend (last 3 beyers)
    beyers = [pp.beyer_speed for pp in pps[:3] if pp.beyer_speed is not None]
    improvement = None
    if len(beyers) >= 2:
        improvement = float(beyers[0] - beyers[-1])

    return {
        "days_since_last": days_since,
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

    Computed from all entries in the database for the given jockey/trainer.
    """
    features: dict[str, float | None] = {}

    for role, prefix in [("jockey", "jockey"), ("trainer", "trainer")]:
        name = getattr(entry, role)
        if not name:
            for suffix in ["win_pct", "roi", "starts", "top3_pct", "avg_odds"]:
                features[f"{prefix}_{suffix}"] = None
            continue

        all_entries = session.query(Entry).filter(getattr(Entry, role) == name).all()
        total = len(all_entries)
        if total == 0:
            for suffix in ["win_pct", "roi", "starts", "top3_pct", "avg_odds"]:
                features[f"{prefix}_{suffix}"] = None
            continue

        wins = sum(1 for e in all_entries if e.finish_position == 1)
        top3 = sum(1 for e in all_entries if e.finish_position is not None and e.finish_position <= 3)

        # ROI based on win payoffs
        payoffs = [e.win_payoff for e in all_entries if e.finish_position == 1 and e.win_payoff]
        roi = (sum(payoffs) - total * 2.0) / (total * 2.0) if total > 0 else None

        avg_odds_list = [e.final_odds for e in all_entries if e.final_odds is not None]

        features[f"{prefix}_win_pct"] = float(wins / total) if total > 0 else None
        features[f"{prefix}_roi"] = roi
        features[f"{prefix}_starts"] = float(total)
        features[f"{prefix}_top3_pct"] = float(top3 / total) if total > 0 else None
        features[f"{prefix}_avg_odds"] = float(np.mean(avg_odds_list)) if avg_odds_list else None

    return features


def compute_post_position_features(entry: Entry, race: Race) -> dict[str, float | None]:
    """Post position features (3 features)."""
    pp = entry.post_position
    field_size = race.num_entrants or 10

    return {
        "post_position": float(pp),
        "post_position_pct": float(pp) / float(field_size) if field_size > 0 else None,
        "is_outside": 1.0 if pp > field_size * 0.75 else 0.0,
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
    """Odds-related features (4 features)."""
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
    """Equipment and medication features (3 features)."""
    # Blinkers
    has_blinkers = 1.0 if entry.equipment and "b" in entry.equipment.lower() else 0.0

    # First-time blinkers (has blinkers now, didn't have them in last PP)
    first_blinkers = 0.0
    # Medication: L = Lasix, B = Bute
    has_lasix = 1.0 if entry.medication and "L" in entry.medication else 0.0

    return {
        "has_blinkers": has_blinkers,
        "first_time_blinkers": first_blinkers,
        "has_lasix": has_lasix,
    }


def compute_entry_features(
    entry: Entry, race: Race, session: Session
) -> dict[str, float | None]:
    """Compute all 50 core features for a single entry."""
    pps = sorted(entry.past_performances, key=lambda p: p.pp_number)

    features: dict[str, float | None] = {}
    features.update(compute_speed_features(pps))
    features.update(compute_pace_features(entry, pps))
    features.update(compute_class_features(entry, race, pps))
    features.update(compute_form_features(entry, pps))
    features.update(compute_jockey_trainer_features(entry, session))
    features.update(compute_post_position_features(entry, race))
    features.update(compute_distance_surface_features(entry, race, pps))
    features.update(compute_odds_features(entry))
    features.update(compute_equipment_features(entry, pps))

    return features


def compute_race_features(
    race: Race, session: Session
) -> pd.DataFrame:
    """Compute feature matrix for all entries in a race.

    Returns DataFrame with entry_id as index, feature columns,
    z-scored within the race field.
    """
    rows = []
    for entry in race.entries:
        feats = compute_entry_features(entry, race, session)
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
