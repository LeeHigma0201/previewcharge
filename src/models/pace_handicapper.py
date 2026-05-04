"""Pace Handicapper — projects first-call leader and classifies race shape.

Built from EquinEdge methodology (claimed 72% first-call accuracy) plus
Brisnet pace-handicapping process and Sartin methodology cross-references.

Why this matters:
    The R2 2026-05-02 miss was a textbook LONE_SPEED scenario the algo
    didn't model. #1 Out of the Woods (E1=98, post 1, style E) had the
    only sub-12-point E1 in the field — that's wire-to-wire signal.
    Generic style IV multipliers don't catch this; raw pace projection does.

Two-pass pipeline:
    1. compute_pace_score(horse) — float per horse: (E1 / field_avg_e1)*2.0
       + style_pts + post bonus/penalty
    2. classify_race_shape(field) — LONE_SPEED / SLOW / HONEST / FAST /
       MELTDOWN based on E1 distribution thresholds

Then:
    closer_overlay_flag(horse, race_shape) — True if MELTDOWN + LP > field_avg_lp + 10
    pace_position_rank(horses) — ranked LEADER / PRESSER / STALKER / CLOSER per horse

Sources:
    - https://equinedge.com/metrics/pace-handicapping
    - https://help.equinedge.com/en/articles/5878169-pace-metric
    - Brisnet "An Effective Pace Handicapping Process"
    - Sartin Methodology (Pace Advantage forum primary source)
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from statistics import mean


# Style points — empirical weights from EquinEdge pace methodology
STYLE_PTS = {
    "E": 2.0,
    "E/P": 1.5, "EP": 1.5,
    "P": 0.5,
    "S": 0.0,
    "C": 0.0,            # alternative closer label
    "NA": 0.5,
}


class RaceShape(str, Enum):
    LONE_SPEED = "LONE_SPEED"      # one horse uncontested early
    SLOW_PACE = "SLOW_PACE"        # no real speed, P horses dominate
    HONEST_PACE = "HONEST_PACE"    # 2-3 E/EP horses, manageable fractions
    FAST_PACE = "FAST_PACE"        # 3+ E1≥90 horses, contested early
    MELTDOWN = "MELTDOWN"          # FAST + extreme: closers win


@dataclass
class PaceProjection:
    program: str
    name: str
    pace_score: float
    pace_rank: int           # 1-N, 1 = projected leader
    pace_position: str       # LEADER / PRESSER / STALKER / CLOSER
    e1: int | None           # raw E1 used in calc
    lp: int | None           # raw LP (for closer-overlay)
    style: str
    post: int | None
    closer_overlay: bool = False
    overlay_reason: str = ""


@dataclass
class RaceShapeReport:
    shape: RaceShape
    projected_leader: str | None
    leader_confidence: str   # HIGH / MEDIUM / LOW
    e_count: int             # # of E or EP horses
    top3_e1_avg: float
    top3_e1_spread: int
    field_avg_e1: float
    field_avg_lp: float
    horses: list[PaceProjection] = field(default_factory=list)
    bet_signal: str = ""


def compute_pace_score(
    e1: int | None,
    style: str,
    post: int | None,
    field_avg_e1: float,
) -> float:
    """EquinEdge-style pace score. Higher = more likely to lead at first call.

    pace_score = (e1 / field_avg_e1) * 2.0 + style_pts + post_bonus - post_penalty
    """
    e1_factor = 0.0
    if e1 is not None and field_avg_e1 > 0:
        e1_factor = (e1 / field_avg_e1) * 2.0

    style_factor = STYLE_PTS.get(style, 0.5)

    post_bonus = 0.0
    post_penalty = 0.0
    if post is not None and style in ("E", "E/P", "EP"):
        if post <= 3:
            post_bonus = 0.3   # CD rail advantage for early speed
        elif post >= 9:
            post_penalty = 0.2  # wide post hurts speed

    return e1_factor + style_factor + post_bonus - post_penalty


def classify_race_shape(
    horses: list[dict],
) -> RaceShapeReport:
    """Classify the field's pace shape. horses is a list of dicts with keys:
    program, name, style, post, e1 (earlyPaceLast), lp (latePaceLast).
    """
    e1_values = [h.get("e1") for h in horses if h.get("e1") is not None]
    lp_values = [h.get("lp") for h in horses if h.get("lp") is not None]
    field_avg_e1 = mean(e1_values) if e1_values else 80.0
    field_avg_lp = mean(lp_values) if lp_values else 80.0

    e_count = sum(1 for h in horses if h.get("style") in ("E", "E/P", "EP"))

    sorted_e1 = sorted([h.get("e1") for h in horses if h.get("e1") is not None], reverse=True)
    top3 = sorted_e1[:3] if len(sorted_e1) >= 3 else sorted_e1
    top3_e1_avg = mean(top3) if top3 else 0.0
    top3_e1_spread = (top3[0] - top3[-1]) if len(top3) >= 2 else 0

    # Per-horse pace scores
    projections: list[PaceProjection] = []
    for h in horses:
        score = compute_pace_score(h.get("e1"), h.get("style", "P"), h.get("post"), field_avg_e1)
        projections.append(
            PaceProjection(
                program=h["program"],
                name=h.get("name", ""),
                pace_score=score,
                pace_rank=0,  # set below
                pace_position="",
                e1=h.get("e1"),
                lp=h.get("lp"),
                style=h.get("style", ""),
                post=h.get("post"),
            )
        )
    projections.sort(key=lambda p: p.pace_score, reverse=True)
    n = len(projections)
    for i, p in enumerate(projections):
        p.pace_rank = i + 1
        if i == 0:
            p.pace_position = "LEADER"
        elif i <= 2:
            p.pace_position = "PRESSER"
        elif i <= 5:
            p.pace_position = "STALKER"
        else:
            p.pace_position = "CLOSER"

    # Race shape classification (thresholds from EquinEdge methodology +
    # agent-validated calibration against R3 today)
    high_e1_count = sum(1 for e in sorted_e1 if e >= 95)
    if e_count <= 1 or (e_count == 2 and top3_e1_spread > 10):
        shape = RaceShape.LONE_SPEED
    elif e_count == 0:
        shape = RaceShape.SLOW_PACE
    elif e_count >= 3 and top3_e1_avg >= 93 and high_e1_count >= 2:
        # MELTDOWN: 3+ early types AND top-3 E1 avg ≥ 93 AND 2+ horses ≥ 95
        # Spread requirement dropped — multiple horses with E1 ≥ 95 is meltdown
        # signal regardless of single dominant outlier (e.g. R3 has #5 at 111
        # with #11 at 101, top-3 avg 104 — still meltdown despite 11pt spread).
        shape = RaceShape.MELTDOWN
    elif e_count >= 3 and top3_e1_avg >= 90 and top3_e1_spread <= 8:
        shape = RaceShape.FAST_PACE
    else:
        shape = RaceShape.HONEST_PACE

    # Leader confidence
    if len(projections) >= 2:
        gap = (projections[0].pace_score - projections[1].pace_score)
        if gap > projections[1].pace_score * 0.15:
            confidence = "HIGH"
        elif gap > projections[1].pace_score * 0.05:
            confidence = "MEDIUM"
        else:
            confidence = "LOW"
    else:
        confidence = "LOW"

    # Closer-overlay flagging — two triggers:
    # (1) high LP relative to field avg
    # (2) large LP-vs-E1 differential (signals late kick regardless of style label)
    if shape in (RaceShape.MELTDOWN, RaceShape.FAST_PACE):
        lp_threshold = field_avg_lp + (10 if shape == RaceShape.MELTDOWN else 12)
        diff_threshold = 12  # LP - E1 >= 12 = strong late-kick signal
        for p in projections:
            if not p.lp:
                continue
            high_lp = p.lp > lp_threshold
            big_diff = p.e1 is not None and (p.lp - p.e1) >= diff_threshold
            late_style = p.style in ("P", "S", "C")
            if (high_lp and late_style) or big_diff:
                p.closer_overlay = True
                reasons = []
                if high_lp and late_style:
                    reasons.append(f"style {p.style} + LP {p.lp} > field avg {field_avg_lp:.0f}+{lp_threshold-field_avg_lp:.0f}")
                if big_diff:
                    reasons.append(f"LP-E1 differential = {p.lp - p.e1} (≥{diff_threshold} = late-kick signal)")
                p.overlay_reason = f"{shape.value}: " + " AND ".join(reasons) + ". Closer benefits from pace duel."

    # Bet signal per shape
    bet_signal = {
        RaceShape.LONE_SPEED: "Key projected leader on top of exacta/trifecta. Box with P/EP underneath.",
        RaceShape.SLOW_PACE: "P horses win — closers fade. Use pressers in keys.",
        RaceShape.HONEST_PACE: "Neutral pace; class/Beyer matters more. Spread 3-4 in exotics.",
        RaceShape.FAST_PACE: "Pressers + closers favored. Lean P/S for win, E/EP show.",
        RaceShape.MELTDOWN: "Strong closer w/ LP≥90 = HIGH VALUE overlay. Key on bottom of tri/super; fade favorites.",
    }[shape]

    return RaceShapeReport(
        shape=shape,
        projected_leader=projections[0].program if projections else None,
        leader_confidence=confidence,
        e_count=e_count,
        top3_e1_avg=top3_e1_avg,
        top3_e1_spread=top3_e1_spread,
        field_avg_e1=field_avg_e1,
        field_avg_lp=field_avg_lp,
        horses=projections,
        bet_signal=bet_signal,
    )


def closer_overlay_multiplier(report: RaceShapeReport, program: str) -> float:
    """Return multiplier to apply to horse's win prob if pace shape favors them.

    +25% in MELTDOWN, +10% in FAST_PACE, neutral otherwise.
    """
    horse = next((h for h in report.horses if h.program == program), None)
    if not horse or not horse.closer_overlay:
        return 1.0
    if report.shape == RaceShape.MELTDOWN:
        return 1.25
    if report.shape == RaceShape.FAST_PACE:
        return 1.10
    return 1.0
