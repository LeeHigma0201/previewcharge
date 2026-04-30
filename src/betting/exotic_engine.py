"""Anchor-keyed exotic bet engine.

Strategy: identify the most likely winner (anchor), solidify that horse
in the 1st position, then use Monte Carlo conditional probabilities to
select contenders for 2nd/3rd/4th. Build exacta/trifecta/superfecta
tickets keyed on the anchor with Kelly-sized stakes.

For multi-race exotics (DD, Pick 3-6), anchor races become "singles"
and non-anchor races become "spreads" of the top contenders.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import product

import numpy as np
import pandas as pd

from src.betting.kelly import (
    UNIT_COSTS,
    SizedTicket,
    allocate_bankroll,
    estimate_exotic_payoff,
    kelly_exotic,
)
from src.models.monte_carlo import (
    SimulationResult,
    compute_superfecta_for_anchor,
    henery_simulate,
)


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------


@dataclass
class AnchorAssessment:
    """Assessment of a potential anchor horse."""

    entry_index: int
    horse_name: str
    program_number: str
    win_prob: float
    wps_prob: float
    confidence_score: float
    pace_fit: float
    class_advantage: float
    form_trend: float
    is_qualified: bool


@dataclass
class ContenderSlot:
    """A contender for a specific finish position."""

    entry_index: int
    horse_name: str
    program_number: str
    conditional_prob: float
    position: int  # 2, 3, or 4


@dataclass
class BetTicket:
    """A constructed exotic bet ticket."""

    bet_type: str  # "exacta", "trifecta", "superfecta"
    structure: str  # e.g. "#3 / #1,#4,#7"
    combinations: int
    unit_cost: float
    total_cost: float
    hit_prob: float
    est_ev: float
    kelly_stake: float = 0.0


@dataclass
class ExoticBetPlan:
    """Complete exotic bet plan for a single race."""

    race_info: dict
    anchor: AnchorAssessment
    contenders_2nd: list[ContenderSlot]
    contenders_3rd: list[ContenderSlot]
    contenders_4th: list[ContenderSlot]
    tickets: list[BetTicket]
    total_investment: float
    bankroll_pct: float
    notes: list[str] = field(default_factory=list)


@dataclass
class RaceLeg:
    """One leg of a multi-race exotic bet."""

    race_number: int
    track_code: str
    anchor: AnchorAssessment | None
    selections: list[dict]  # [{index, name, program_number, win_prob}]
    is_single: bool
    leg_hit_prob: float


@dataclass
class MultiRaceBetPlan:
    """Complete multi-race exotic bet plan."""

    bet_type: str  # "dd", "pick3", "pick4", "pick5", "pick6"
    track_code: str
    legs: list[RaceLeg]
    total_combinations: int
    unit_cost: float
    total_cost: float
    combined_hit_prob: float
    est_ev: float
    kelly_stake: float = 0.0
    notes: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

SPREAD_SIZES = {
    "dd": 2,
    "pick3": 3,
    "pick4": 3,
    "pick5": 4,
    "pick6": 4,
}


# ---------------------------------------------------------------------------
# Anchor Selection
# ---------------------------------------------------------------------------


def select_anchor(
    win_probs: np.ndarray,
    sim: SimulationResult,
    features_df: pd.DataFrame | None,
    entries: list,
    min_win_prob: float = 0.25,
    min_wps_prob: float = 0.55,
) -> AnchorAssessment:
    """Select and validate the anchor horse.

    The anchor is the horse with the highest win probability that also
    meets the WPS threshold (~70% WPS = solidified favorite).

    Confidence score is a composite:
      0.4 * win_prob_scaled + 0.2 * pace_fit + 0.2 * class_z + 0.2 * form_z
    """
    best_idx = int(np.argmax(win_probs))
    best_win = float(win_probs[best_idx])
    best_wps = float(sim.show_probs[best_idx])

    entry = entries[best_idx]
    name = _get_horse_name(entry)
    prog = _get_program_number(entry, best_idx)

    # Extract feature signals for anchor validation
    pace_fit = 1.0
    class_z = 0.0
    form_z = 0.0

    if features_df is not None and not features_df.empty:
        # Try to get entry's row from features DataFrame
        entry_id = _get_entry_id(entry)
        if entry_id in features_df.index:
            row = features_df.loc[entry_id]
            class_z = float(row.get("class_change_pct", 0.0) or 0.0)
            form_z = float(row.get("improvement_last_3", 0.0) or 0.0)

    # Pace fit from pace scenario features if available
    if features_df is not None and not features_df.empty:
        entry_id = _get_entry_id(entry)
        if entry_id in features_df.index:
            row = features_df.loc[entry_id]
            # lone_speed is a strong positive for E/EP anchors
            lone = float(row.get("lone_speed", 0.0) or 0.0)
            if lone > 0:
                pace_fit = 1.3
            # Check pace scenario hurt
            style_pace = float(row.get("style_x_pace_hot", 0.0) or 0.0)
            if style_pace < -0.5:
                pace_fit = 0.8

    # Composite confidence
    win_scaled = min(best_win / 0.5, 1.0)  # 50% win prob = max score
    confidence = (
        0.4 * win_scaled
        + 0.2 * min(max(pace_fit, 0.0), 1.5) / 1.5
        + 0.2 * min(max(class_z + 0.5, 0.0), 1.0)
        + 0.2 * min(max(form_z + 0.5, 0.0), 1.0)
    )

    is_qualified = best_win >= min_win_prob and best_wps >= min_wps_prob

    return AnchorAssessment(
        entry_index=best_idx,
        horse_name=name,
        program_number=prog,
        win_prob=best_win,
        wps_prob=best_wps,
        confidence_score=round(confidence, 3),
        pace_fit=round(pace_fit, 2),
        class_advantage=round(class_z, 3),
        form_trend=round(form_z, 3),
        is_qualified=is_qualified,
    )


# ---------------------------------------------------------------------------
# Contender Selection
# ---------------------------------------------------------------------------


def select_contenders(
    anchor_idx: int,
    sim: SimulationResult,
    entries: list,
    n_contenders: int = 4,
    superfecta_anchor: np.ndarray | None = None,
) -> tuple[list[ContenderSlot], list[ContenderSlot], list[ContenderSlot]]:
    """Select top contenders for 2nd, 3rd, and 4th positions.

    Uses conditional probabilities given the anchor wins.
    """
    n = len(sim.win_probs)
    anchor_win_prob = sim.win_probs[anchor_idx]
    if anchor_win_prob <= 0:
        return [], [], []

    # 2nd place: P(j 2nd | anchor wins)
    cond_2nd = sim.exacta_probs[anchor_idx, :] / anchor_win_prob
    contenders_2nd = _top_contenders(
        cond_2nd, anchor_idx, entries, position=2, n=n_contenders, exclude={anchor_idx}
    )

    # 3rd place: marginalize over 2nd place
    # P(k 3rd | anchor wins) = sum_j P(anchor, j, k) / P(anchor wins)
    cond_3rd = np.zeros(n)
    for k in range(n):
        if k == anchor_idx:
            continue
        cond_3rd[k] = sim.trifecta_probs[anchor_idx, :, k].sum() / anchor_win_prob
    contenders_3rd = _top_contenders(
        cond_3rd, anchor_idx, entries, position=3, n=n_contenders, exclude={anchor_idx}
    )

    # 4th place: from superfecta if available
    contenders_4th = []
    if superfecta_anchor is not None:
        # superfecta_anchor[j, k, l] = P(anchor, j, k, l)
        cond_4th = np.zeros(n)
        for l in range(n):
            if l == anchor_idx:
                continue
            cond_4th[l] = superfecta_anchor[:, :, l].sum() / anchor_win_prob
        contenders_4th = _top_contenders(
            cond_4th, anchor_idx, entries, position=4, n=n_contenders, exclude={anchor_idx}
        )
    else:
        # Fallback: use finish_matrix P(horse l finishes 4th)
        cond_4th = sim.finish_matrix[:, 3] if sim.finish_matrix.shape[1] > 3 else np.zeros(n)
        contenders_4th = _top_contenders(
            cond_4th, anchor_idx, entries, position=4, n=n_contenders, exclude={anchor_idx}
        )

    return contenders_2nd, contenders_3rd, contenders_4th


def _top_contenders(
    probs: np.ndarray,
    anchor_idx: int,
    entries: list,
    position: int,
    n: int,
    exclude: set[int],
) -> list[ContenderSlot]:
    """Pick top N contenders by probability, excluding specified indices."""
    candidates = []
    for i in range(len(probs)):
        if i in exclude:
            continue
        candidates.append((i, probs[i]))
    candidates.sort(key=lambda x: x[1], reverse=True)

    return [
        ContenderSlot(
            entry_index=idx,
            horse_name=_get_horse_name(entries[idx]),
            program_number=_get_program_number(entries[idx], idx),
            conditional_prob=round(float(prob), 4),
            position=position,
        )
        for idx, prob in candidates[:n]
        if prob > 0
    ]


# ---------------------------------------------------------------------------
# Ticket Construction
# ---------------------------------------------------------------------------


def build_tickets(
    anchor: AnchorAssessment,
    contenders_2nd: list[ContenderSlot],
    contenders_3rd: list[ContenderSlot],
    contenders_4th: list[ContenderSlot],
    sim: SimulationResult,
    bankroll: float,
    takeout: float = 0.22,
    max_race_pct: float = 0.10,
    superfecta_anchor: np.ndarray | None = None,
) -> list[BetTicket]:
    """Build exotic bet tickets keyed on the anchor."""
    tickets = []
    sized = []
    a = anchor.entry_index

    # --- Exacta key: anchor / top contenders ---
    top_2nd = contenders_2nd[:3]
    if top_2nd:
        combos = len(top_2nd)
        hit_prob = sum(sim.exacta_probs[a, c.entry_index] for c in top_2nd)
        payoff = estimate_exotic_payoff(hit_prob, takeout) if hit_prob > 0 else 0.0
        ev = hit_prob * payoff / UNIT_COSTS["exacta"] if hit_prob > 0 else 0.0
        kelly = kelly_exotic(hit_prob, payoff)

        structure = f"#{anchor.program_number} / {_format_contenders(top_2nd)}"
        tickets.append(BetTicket(
            bet_type="exacta",
            structure=structure,
            combinations=combos,
            unit_cost=UNIT_COSTS["exacta"],
            total_cost=combos * UNIT_COSTS["exacta"],
            hit_prob=round(hit_prob, 4),
            est_ev=round(ev, 2),
        ))
        sized.append(SizedTicket(
            combo=(a,), bet_type="exacta", probability=hit_prob,
            estimated_payoff=payoff, ev=ev, kelly_fraction=kelly, stake=0.0,
        ))

    # --- Trifecta key: anchor / top 4 / top 4 ---
    top_3rd = contenders_3rd[:4]
    tri_2nd = contenders_2nd[:4]
    if tri_2nd and top_3rd:
        # Count valid combos (2nd != 3rd)
        tri_combos = 0
        tri_hit_prob = 0.0
        for c2 in tri_2nd:
            for c3 in top_3rd:
                if c2.entry_index != c3.entry_index:
                    tri_combos += 1
                    tri_hit_prob += sim.trifecta_probs[a, c2.entry_index, c3.entry_index]

        if tri_combos > 0:
            payoff = estimate_exotic_payoff(tri_hit_prob, takeout) if tri_hit_prob > 0 else 0.0
            ev = tri_hit_prob * payoff / UNIT_COSTS["trifecta"] if tri_hit_prob > 0 else 0.0
            kelly = kelly_exotic(tri_hit_prob, payoff)

            structure = f"#{anchor.program_number} / {_format_contenders(tri_2nd)} / {_format_contenders(top_3rd)}"
            tickets.append(BetTicket(
                bet_type="trifecta",
                structure=structure,
                combinations=tri_combos,
                unit_cost=UNIT_COSTS["trifecta"],
                total_cost=tri_combos * UNIT_COSTS["trifecta"],
                hit_prob=round(tri_hit_prob, 4),
                est_ev=round(ev, 2),
            ))
            sized.append(SizedTicket(
                combo=(a,), bet_type="trifecta", probability=tri_hit_prob,
                estimated_payoff=payoff, ev=ev, kelly_fraction=kelly, stake=0.0,
            ))

    # --- Superfecta key: anchor / top 3 / top 4 / top 4 ---
    top_4th = contenders_4th[:4]
    super_2nd = contenders_2nd[:3]
    super_3rd = contenders_3rd[:4]
    if super_2nd and super_3rd and top_4th and superfecta_anchor is not None:
        super_combos = 0
        super_hit_prob = 0.0
        for c2 in super_2nd:
            for c3 in super_3rd:
                if c3.entry_index == c2.entry_index:
                    continue
                for c4 in top_4th:
                    if c4.entry_index in (c2.entry_index, c3.entry_index):
                        continue
                    super_combos += 1
                    super_hit_prob += superfecta_anchor[
                        c2.entry_index, c3.entry_index, c4.entry_index
                    ]

        if super_combos > 0:
            payoff = estimate_exotic_payoff(super_hit_prob, takeout) if super_hit_prob > 0 else 0.0
            ev = super_hit_prob * payoff / UNIT_COSTS["superfecta"] if super_hit_prob > 0 else 0.0
            kelly = kelly_exotic(super_hit_prob, payoff)

            structure = (
                f"#{anchor.program_number} / {_format_contenders(super_2nd)} "
                f"/ {_format_contenders(super_3rd)} / {_format_contenders(top_4th)}"
            )
            tickets.append(BetTicket(
                bet_type="superfecta",
                structure=structure,
                combinations=super_combos,
                unit_cost=UNIT_COSTS["superfecta"],
                total_cost=round(super_combos * UNIT_COSTS["superfecta"], 2),
                hit_prob=round(super_hit_prob, 4),
                est_ev=round(ev, 2),
            ))
            sized.append(SizedTicket(
                combo=(a,), bet_type="superfecta", probability=super_hit_prob,
                estimated_payoff=payoff, ev=ev, kelly_fraction=kelly, stake=0.0,
            ))

    # Kelly-allocate across all tickets
    if sized:
        allocate_bankroll(sized, bankroll, max_race_pct)
        for ticket, st in zip(tickets, sized):
            ticket.kelly_stake = st.stake

    return tickets


# ---------------------------------------------------------------------------
# Top-Level Orchestrator (Single Race)
# ---------------------------------------------------------------------------


def generate_bet_plan(
    race,
    entries: list,
    session,
    bankroll: float = 200.0,
    win_probs: np.ndarray | None = None,
    features_df: pd.DataFrame | None = None,
    mc_sims: int = 100_000,
    takeout: float = 0.22,
    max_race_pct: float = 0.10,
    seed: int | None = None,
) -> ExoticBetPlan:
    """Generate a complete exotic bet plan for a single race.

    If win_probs is not provided, falls back to morning-line-implied
    probabilities (same as the Streamlit predictions page).
    """
    # --- Win probabilities ---
    if win_probs is None:
        ml_odds = np.array([
            getattr(e, "morning_line_odds", None) or 5.0 for e in entries
        ])
        win_probs = 1.0 / (ml_odds + 1.0)
        win_probs = win_probs / win_probs.sum()

    # --- Features (optional, for anchor validation) ---
    if features_df is None:
        try:
            from src.features.core import compute_race_features
            features_df = compute_race_features(race, session)
        except Exception:
            features_df = None

    # --- Monte Carlo simulation ---
    sim = henery_simulate(win_probs, n_simulations=mc_sims, seed=seed)

    # --- Anchor selection ---
    anchor = select_anchor(win_probs, sim, features_df, entries)

    notes = []
    if not anchor.is_qualified:
        notes.append(
            f"No qualified anchor (best: {anchor.horse_name} at "
            f"{anchor.win_prob:.0%} win, {anchor.wps_prob:.0%} WPS). "
            f"Wide-open race — anchor strategy may not apply."
        )

    # --- Superfecta probs for anchor ---
    superfecta_anchor = None
    if len(entries) >= 4:
        superfecta_anchor = compute_superfecta_for_anchor(
            win_probs, anchor.entry_index, n_simulations=mc_sims, seed=seed,
        )

    # --- Contender selection ---
    c2, c3, c4 = select_contenders(
        anchor.entry_index, sim, entries,
        superfecta_anchor=superfecta_anchor,
    )

    # --- Build tickets ---
    tickets = build_tickets(
        anchor, c2, c3, c4, sim, bankroll, takeout, max_race_pct,
        superfecta_anchor=superfecta_anchor,
    )

    total = sum(t.total_cost for t in tickets)

    race_info = {
        "track_code": getattr(race, "track_code", ""),
        "race_number": getattr(race, "race_number", 0),
        "race_date": str(getattr(race, "race_date", "")),
        "num_entrants": len(entries),
    }

    return ExoticBetPlan(
        race_info=race_info,
        anchor=anchor,
        contenders_2nd=c2,
        contenders_3rd=c3,
        contenders_4th=c4,
        tickets=tickets,
        total_investment=round(total, 2),
        bankroll_pct=round(total / bankroll * 100, 1) if bankroll > 0 else 0.0,
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Multi-Race Exotics (DD, Pick 3/4/5/6)
# ---------------------------------------------------------------------------


def analyze_race_leg(
    race,
    entries: list,
    session,
    mc_sims: int = 100_000,
    seed: int | None = None,
    spread_size: int = 3,
) -> RaceLeg:
    """Analyze a single race leg for multi-race exotic.

    Returns a RaceLeg with either a single (anchor) or spread (top N).
    """
    ml_odds = np.array([
        getattr(e, "morning_line_odds", None) or 5.0 for e in entries
    ])
    win_probs = 1.0 / (ml_odds + 1.0)
    win_probs = win_probs / win_probs.sum()

    sim = henery_simulate(win_probs, n_simulations=mc_sims, seed=seed)

    try:
        from src.features.core import compute_race_features
        features_df = compute_race_features(race, session)
    except Exception:
        features_df = None

    anchor = select_anchor(win_probs, sim, features_df, entries)

    if anchor.is_qualified:
        # Single: just the anchor
        selections = [{
            "index": anchor.entry_index,
            "name": anchor.horse_name,
            "program_number": anchor.program_number,
            "win_prob": anchor.win_prob,
        }]
        return RaceLeg(
            race_number=getattr(race, "race_number", 0),
            track_code=getattr(race, "track_code", ""),
            anchor=anchor,
            selections=selections,
            is_single=True,
            leg_hit_prob=anchor.win_prob,
        )
    else:
        # Spread: top N by win probability
        ranked = np.argsort(win_probs)[::-1][:spread_size]
        selections = []
        total_prob = 0.0
        for idx in ranked:
            wp = float(win_probs[idx])
            selections.append({
                "index": int(idx),
                "name": _get_horse_name(entries[idx]),
                "program_number": _get_program_number(entries[idx], int(idx)),
                "win_prob": wp,
            })
            total_prob += wp

        return RaceLeg(
            race_number=getattr(race, "race_number", 0),
            track_code=getattr(race, "track_code", ""),
            anchor=None,
            selections=selections,
            is_single=False,
            leg_hit_prob=total_prob,
        )


def generate_multi_race_plan(
    races: list,
    entries_per_race: list[list],
    session,
    bet_type: str = "pick4",
    bankroll: float = 200.0,
    takeout: float = 0.22,
    max_race_pct: float = 0.10,
    mc_sims: int = 100_000,
    seed: int | None = None,
) -> MultiRaceBetPlan:
    """Generate a multi-race exotic bet plan.

    Args:
        races: List of Race objects (consecutive).
        entries_per_race: List of entry lists, one per race.
        session: DB session.
        bet_type: "dd", "pick3", "pick4", "pick5", "pick6".
        bankroll: Total bankroll.
    """
    spread_size = SPREAD_SIZES.get(bet_type, 3)
    unit_cost = UNIT_COSTS.get(bet_type, 0.50)

    legs = []
    for race, entries in zip(races, entries_per_race):
        leg = analyze_race_leg(
            race, entries, session,
            mc_sims=mc_sims, seed=seed, spread_size=spread_size,
        )
        legs.append(leg)

    # Total combinations = product of selections per leg
    total_combos = 1
    for leg in legs:
        total_combos *= len(leg.selections)

    total_cost = round(total_combos * unit_cost, 2)

    # Combined hit probability = product of leg hit probs
    combined_prob = 1.0
    for leg in legs:
        combined_prob *= leg.leg_hit_prob

    # Estimated EV
    payoff = estimate_exotic_payoff(combined_prob, takeout) if combined_prob > 0 else 0.0
    ev = combined_prob * payoff / unit_cost if combined_prob > 0 else 0.0

    # Kelly sizing
    kelly = kelly_exotic(combined_prob, payoff)
    kelly_amount = min(kelly * bankroll, bankroll * max_race_pct)

    track = legs[0].track_code if legs else ""

    notes = []
    singles = sum(1 for l in legs if l.is_single)
    spreads = len(legs) - singles
    notes.append(f"{singles} singles, {spreads} spreads across {len(legs)} legs")

    return MultiRaceBetPlan(
        bet_type=bet_type,
        track_code=track,
        legs=legs,
        total_combinations=total_combos,
        unit_cost=unit_cost,
        total_cost=total_cost,
        combined_hit_prob=round(combined_prob, 6),
        est_ev=round(ev, 2),
        kelly_stake=round(kelly_amount, 2),
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Formatting Helpers
# ---------------------------------------------------------------------------


def format_bet_slip(plan: ExoticBetPlan) -> str:
    """Format a single-race bet plan as a printable bet slip."""
    lines = []
    lines.append(
        f"{'=' * 50}\n"
        f"EXOTIC BET PLAN — {plan.race_info.get('track_code', '')} "
        f"Race {plan.race_info.get('race_number', '')} "
        f"({plan.race_info.get('race_date', '')})\n"
        f"{'=' * 50}"
    )

    lines.append(
        f"\nANCHOR: #{plan.anchor.program_number} {plan.anchor.horse_name} "
        f"(Win: {plan.anchor.win_prob:.0%} | WPS: {plan.anchor.wps_prob:.0%} "
        f"| Confidence: {plan.anchor.confidence_score:.2f})"
    )

    if not plan.anchor.is_qualified:
        lines.append("  ** WARNING: Anchor does not meet qualification threshold **")

    lines.append("")
    for ticket in plan.tickets:
        lines.append(
            f"  {ticket.bet_type.upper()} KEY: {ticket.structure}\n"
            f"    {ticket.combinations} combos x ${ticket.unit_cost:.2f} "
            f"= ${ticket.total_cost:.2f}"
            f"  |  Hit: {ticket.hit_prob:.2%}  |  EV: {ticket.est_ev:.2f}"
            f"  |  Kelly: ${ticket.kelly_stake:.2f}"
        )

    lines.append(
        f"\n{'─' * 50}\n"
        f"TOTAL: ${plan.total_investment:.2f} "
        f"({plan.bankroll_pct:.1f}% of bankroll)\n"
        f"{'─' * 50}"
    )

    for note in plan.notes:
        lines.append(f"  NOTE: {note}")

    return "\n".join(lines)


def format_multi_race_slip(plan: MultiRaceBetPlan) -> str:
    """Format a multi-race bet plan as a printable bet slip."""
    bt = plan.bet_type.upper().replace("DD", "DAILY DOUBLE")
    lines = []
    lines.append(
        f"{'=' * 50}\n"
        f"{bt} — {plan.track_code}\n"
        f"{'=' * 50}"
    )

    for i, leg in enumerate(plan.legs):
        tag = "SINGLE" if leg.is_single else "SPREAD"
        names = ", ".join(f"#{s['program_number']} {s['name']}" for s in leg.selections)
        lines.append(
            f"  Leg {i + 1} (R{leg.race_number}): {names}  [{tag}]"
            f"  — {leg.leg_hit_prob:.0%}"
        )

    lines.append(
        f"\n{'─' * 50}\n"
        f"  {plan.total_combinations} combos x ${plan.unit_cost:.2f} "
        f"= ${plan.total_cost:.2f}\n"
        f"  HIT PROB: {plan.combined_hit_prob:.2%}  |  "
        f"EST EV: {plan.est_ev:.2f}  |  "
        f"KELLY: ${plan.kelly_stake:.2f}\n"
        f"{'─' * 50}"
    )

    for note in plan.notes:
        lines.append(f"  NOTE: {note}")

    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _get_horse_name(entry) -> str:
    if hasattr(entry, "horse") and entry.horse and hasattr(entry.horse, "name"):
        return entry.horse.name
    if hasattr(entry, "horse_name"):
        return entry.horse_name
    return f"Horse"


def _get_program_number(entry, fallback_idx: int) -> str:
    if hasattr(entry, "program_number") and entry.program_number:
        return str(entry.program_number)
    return str(fallback_idx + 1)


def _get_entry_id(entry) -> int:
    if hasattr(entry, "id"):
        return entry.id
    return 0


def _format_contenders(contenders: list[ContenderSlot]) -> str:
    return ",".join(f"#{c.program_number}" for c in contenders)
