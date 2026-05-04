"""Exotic v2 — Henery-corrected ordering probabilities + EV-checked structure builder.

Background:
    The standard Harville formula P(i=1st, j=2nd) = p_i * p_j / (1 - p_i)
    systematically OVERSTATES favorites finishing 2nd/3rd and understates
    longshots — a bias Benter (1994) called out and that Lo & Bacon-Shone (2008)
    formalized as the practical Henery correction.

    Empirically-fit gamma/delta parameters (from Hong Kong PMU data, Benter):
        gamma = 0.81  (place / 2nd)
        delta = 0.65  (show / 3rd)

    sigma_i = exp(gamma * log p_i) / sum_j(exp(gamma * log p_j))   # 2nd
    tau_i   = exp(delta * log p_i) / sum_j(exp(delta * log p_j))   # 3rd

    Trifecta probability:
        P(i=1, j=2, k=3) = p_i
                         * sigma_j_renorm_excluding_i
                         * tau_k_renorm_excluding_i_and_j

    For 20-horse fields (KY Derby), enumerate trifecta combos directly
    (24,360 combos < 50k, fine). Superfecta (116,280 combos for 20) is
    also fine to enumerate.

References:
    - Benter (1994), Computer Based Horse Race Handicapping & Wagering Systems
    - Henery (1981), Permutation Probabilities, JRSS-B 43(1)
    - Lo & Bacon-Shone (2008), Approximation to Ordering Probabilities
    - Crist (2006), Exotic Betting (DRF Press)
    - Ziemba & Hausch (1987), Beat the Racetrack
"""
from __future__ import annotations

import math
from dataclasses import dataclass, field
from itertools import permutations
from typing import Iterable

# Empirically-fit Henery parameters (Benter HK data — well-validated)
GAMMA_2ND = 0.81
DELTA_3RD = 0.65
EPSILON_4TH = 0.55  # extrapolated for superfecta — less validated, treat as approximate

EV_THRESHOLD = 0.15  # 15% edge over takeout-adjusted breakeven
DEFAULT_TAKEOUT = 0.22  # Churchill exotic pool takeout band


@dataclass
class HorseProb:
    program: str
    name: str
    win_prob: float           # algo's normalized win probability (sums to 1.0 across field)
    market_prob: float | None = None  # ML-implied prob (takeout-stripped)


@dataclass
class TrifectaCombo:
    win: str
    place: str
    show: str
    p: float                  # Henery-corrected joint probability
    fair_payout: float        # 1/p, the breakeven payout (no takeout)
    market_payout: float | None = None  # market-implied payout (1/market_p_combo)
    edge: float = 0.0         # (market_payout - fair_payout) / fair_payout
    is_overlay: bool = False


@dataclass
class RaceRec:
    race_number: int
    edge_tier: str
    play: str = "PASS"
    structure: str = ""
    ticket: str = ""
    cost: float = 0.0
    rationale: str = ""
    top_combos: list[TrifectaCombo] = field(default_factory=list)
    filters: list[str] = field(default_factory=list)


def henery_position_probs(win_probs: list[float], gamma: float) -> list[float]:
    """Lo & Bacon-Shone position probabilities for k-th finish given gamma."""
    log_p = [math.log(max(p, 1e-9)) for p in win_probs]
    weighted = [math.exp(gamma * lp) for lp in log_p]
    s = sum(weighted)
    return [w / s for w in weighted]


def trifecta_probability(
    horses: list[HorseProb],
    win_idx: int,
    place_idx: int,
    show_idx: int,
) -> float:
    """P(horses[win_idx]=1st, place_idx=2nd, show_idx=3rd) under Henery."""
    p_win = horses[win_idx].win_prob
    if p_win <= 0:
        return 0.0
    # 2nd: exclude win horse, renormalize sigmas
    sigmas_full = henery_position_probs([h.win_prob for h in horses], GAMMA_2ND)
    sigma_remaining = [s for i, s in enumerate(sigmas_full) if i != win_idx]
    rem_indices = [i for i in range(len(horses)) if i != win_idx]
    s_sum = sum(sigma_remaining)
    if s_sum <= 0:
        return 0.0
    place_position = rem_indices.index(place_idx)
    p_place = sigma_remaining[place_position] / s_sum
    # 3rd: exclude win + place, renormalize taus
    taus_full = henery_position_probs([h.win_prob for h in horses], DELTA_3RD)
    taus_remaining = [t for i, t in enumerate(taus_full) if i != win_idx and i != place_idx]
    rem3_indices = [i for i in range(len(horses)) if i != win_idx and i != place_idx]
    t_sum = sum(taus_remaining)
    if t_sum <= 0:
        return 0.0
    show_position = rem3_indices.index(show_idx)
    p_show = taus_remaining[show_position] / t_sum
    return p_win * p_place * p_show


def all_trifecta_combos(horses: list[HorseProb], top_n: int = 8) -> list[TrifectaCombo]:
    """Enumerate trifectas restricted to the top-N by win prob (combinatorial guard)."""
    sorted_idx = sorted(range(len(horses)), key=lambda i: horses[i].win_prob, reverse=True)
    pool = sorted_idx[:top_n]
    combos: list[TrifectaCombo] = []
    for win, place, show in permutations(pool, 3):
        p = trifecta_probability(horses, win, place, show)
        if p <= 0:
            continue
        combos.append(
            TrifectaCombo(
                win=horses[win].program,
                place=horses[place].program,
                show=horses[show].program,
                p=p,
                fair_payout=1.0 / p,
            )
        )
    combos.sort(key=lambda c: c.p, reverse=True)
    return combos


def market_combo_probability(horses: list[HorseProb], win_idx: int, place_idx: int, show_idx: int) -> float | None:
    """Same Henery math but using market_prob — the public's implied trifecta probability."""
    if any(h.market_prob is None for h in horses):
        return None
    fake = [HorseProb(h.program, h.name, h.market_prob or 0.0) for h in horses]
    return trifecta_probability(fake, win_idx, place_idx, show_idx)


def annotate_overlay(horses: list[HorseProb], combos: list[TrifectaCombo]) -> None:
    """Tag each combo with edge vs market and overlay status."""
    for c in combos:
        try:
            wi = next(i for i, h in enumerate(horses) if h.program == c.win)
            pi = next(i for i, h in enumerate(horses) if h.program == c.place)
            si = next(i for i, h in enumerate(horses) if h.program == c.show)
        except StopIteration:
            continue
        m_p = market_combo_probability(horses, wi, pi, si)
        if m_p and m_p > 0:
            c.market_payout = 1.0 / m_p
            # Edge: how much more our prob is than the market's prob (bigger = bigger overlay)
            c.edge = (c.p - m_p) / m_p
            c.is_overlay = c.edge > 0.30  # 30%+ probability divergence


# ---------- Edge filters from research brief ----------


def detect_lone_speed(horses: list[HorseProb], styles: dict[str, str]) -> str | None:
    """If exactly one horse has E or E/P style, flag lone speed."""
    speed_horses = [h.program for h in horses if styles.get(h.program, "") in ("E", "E/P")]
    if len(speed_horses) == 1:
        return f"LONE_SPEED #{speed_horses[0]}"
    return None


def detect_chalk_vulnerability(horses: list[HorseProb]) -> str | None:
    """If the market favorite is rated lower than top-2 by the algo."""
    if not all(h.market_prob is not None for h in horses):
        return None
    market_fav = max(horses, key=lambda h: h.market_prob or 0)
    algo_top2 = sorted(horses, key=lambda h: h.win_prob, reverse=True)[:2]
    if market_fav.program not in [h.program for h in algo_top2]:
        return f"CHALK_VULN #{market_fav.program} mkt-fav rated outside algo top-2"
    return None


def detect_field_too_small(horses: list[HorseProb]) -> str | None:
    if len(horses) <= 6:
        return f"SMALL_FIELD ({len(horses)} runners — exotics pool too thin)"
    return None


# ---------- Structure recipes ----------


def recommend_structure(
    horses: list[HorseProb],
    edge_tier: str,
    field_size: int,
    base_unit: float = 0.10,
) -> RaceRec:
    """Return a structure recommendation based on edge tier and field characteristics.

    Recipes mirror the research brief:
        FULL EDGE  -> KEY top algo horse over 4-horse spread (heavy overlay)
        PARTIAL    -> forward exacta of top-2 OR small key-and-wheel
        CHALK MATCH -> PASS (per chalk-overlap audit)
        DERBY      -> super-wheel (top-2 keys, top-6 underneath)
    """
    rec = RaceRec(race_number=0, edge_tier=edge_tier)
    if field_size <= 6:
        rec.play = "PASS"
        rec.rationale = "Small field — exotics pool too thin to pay overlay."
        return rec

    sorted_horses = sorted(horses, key=lambda h: h.win_prob, reverse=True)
    if edge_tier == "CHALK_MATCH":
        rec.play = "PASS"
        rec.rationale = "Algo top-2 = market top-2. No demonstrable ordering edge — paying takeout for market box."
        return rec

    top_progs = [h.program for h in sorted_horses[:6]]
    if edge_tier == "PARTIAL_EDGE":
        # Forward exacta (top-2 in order) + small wheel for super
        e1, e2, e3, e4, e5 = top_progs[:5]
        rec.play = "BET"
        rec.structure = "exacta_forward + super_wheel"
        rec.ticket = f"EX {e1}/{e2} ${base_unit*5:.2f} + SUPER {e1}-{e2}-{e3},{e4},{e5}/{e3},{e4},{e5} ${base_unit:.2f}"
        # rough cost: 1*1 forward exacta @ 5x + small super wheel
        rec.cost = round(base_unit * 5 + base_unit * 6, 2)
        rec.rationale = "Partial edge: forward the divergence (don't pay box premium for the public-supported leg)."
        return rec

    if edge_tier == "FULL_EDGE":
        # KEY the top algo horse, wheel 3-4 underneath
        key = top_progs[0]
        wheel = ",".join(top_progs[1:5])
        rec.play = "BET"
        rec.structure = "trifecta_key"
        rec.ticket = f"TRI KEY {key} / {wheel} / {wheel} @ ${base_unit:.2f}"
        rec.cost = round(base_unit * 4 * 3, 2)  # 1 × 4 × 3 = 12 combos
        rec.rationale = "FULL EDGE: zero algo-top-2 overlap with market — key your conviction over wide spread."
        return rec

    if edge_tier == "DERBY_CHAOS":
        # 20-horse super-wheel: top-2 keys, top-6 underneath
        keys = top_progs[:2]
        wheel = top_progs[:6]
        rec.play = "BET"
        rec.structure = "superfecta_part_wheel"
        rec.ticket = f"SUPER {','.join(keys)} / {','.join(wheel)} / {','.join(wheel)} / {','.join(wheel)} @ ${base_unit:.2f}"
        # 2 keys × 5 × 4 × 3 = 120 combos × 0.10 = $12
        rec.cost = round(base_unit * 2 * 5 * 4 * 3, 2)
        rec.rationale = "Derby chaos: massive pool, small unit, wide super coverage. Once-a-year priced inefficiency."
        return rec

    rec.play = "PASS"
    rec.rationale = f"Unrecognized edge tier: {edge_tier}"
    return rec


def race_rec(
    race_number: int,
    horses: list[HorseProb],
    edge_tier: str,
    styles: dict[str, str] | None = None,
    base_unit: float = 0.10,
    field_size: int | None = None,
) -> RaceRec:
    """Top-level: produce a full Exotic v2 recommendation for a race."""
    styles = styles or {}
    field_size = field_size or len(horses)

    rec = recommend_structure(horses, edge_tier, field_size, base_unit=base_unit)
    rec.race_number = race_number

    # Run filters and tag
    for fn in (detect_lone_speed, detect_chalk_vulnerability, detect_field_too_small):
        if fn is detect_lone_speed:
            tag = fn(horses, styles)
        else:
            tag = fn(horses)
        if tag:
            rec.filters.append(tag)

    # Compute top trifecta combos (for inspection / display)
    rec.top_combos = all_trifecta_combos(horses, top_n=min(8, len(horses)))[:10]
    annotate_overlay(horses, rec.top_combos)
    return rec


# ---------- Convenience: load from horses.csv ----------


def load_horses_from_csv(csv_path: str) -> dict[int, list[HorseProb]]:
    """Read horses.csv produced by scripts/process_card.py and return per-race HorseProbs.

    Uses score_pct (algo's normalized rank prob) as win_prob, ML implied prob as market_prob.
    """
    import csv

    races: dict[int, list[HorseProb]] = {}
    with open(csv_path) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    # group by race
    for r in rows:
        rn = int(r["race"])
        races.setdefault(rn, []).append(r)
    out: dict[int, list[HorseProb]] = {}
    for rn, rows in races.items():
        # win prob: rescale score_pct to sum to 1.0 across field
        total = sum(float(x.get("score_pct", 0) or 0) for x in rows) or 1.0
        # market prob: from ml_odds (decimal): p = 1/(1+odds) then renorm
        ml = []
        for x in rows:
            try:
                d = float(x["ml_odds"])
                ml.append(1.0 / (1.0 + d))
            except (ValueError, KeyError):
                ml.append(0.0)
        ml_total = sum(ml) or 1.0
        ml_norm = [m / ml_total for m in ml]
        out[rn] = [
            HorseProb(
                program=row["program"],
                name=row["name"],
                win_prob=float(row.get("score_pct", 0) or 0) / total,
                market_prob=ml_norm[i],
            )
            for i, row in enumerate(rows)
        ]
    return out


def styles_from_csv(csv_path: str) -> dict[int, dict[str, str]]:
    """race_number -> { program -> style }"""
    import csv

    out: dict[int, dict[str, str]] = {}
    with open(csv_path) as f:
        for r in csv.DictReader(f):
            rn = int(r["race"])
            out.setdefault(rn, {})[r["program"]] = r.get("style", "")
    return out
