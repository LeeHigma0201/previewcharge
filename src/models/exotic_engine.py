"""Exotic Betting Engine — structured bet recommendations from Monte Carlo results.

Consumes SimulationResult from henery_simulate() and produces optimal
exotic bet tickets (exacta, trifecta, superfecta) with Kelly-scaled sizing.

The core insight from Benter: exotic bets amplify probability advantages
multiplicatively. Two horses with 10% model-vs-public advantage can
produce 30%+ advantage on exacta/trifecta wagers. This engine finds
and structures those opportunities.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from src.models.monte_carlo import SimulationResult


@dataclass
class ExoticBet:
    """A single exotic bet recommendation."""

    bet_type: str  # "exacta", "trifecta", "superfecta"
    combinations: list[tuple[int, ...]]  # list of (horse_index, ...) combos
    cost: float  # total cost of the ticket
    probability: float  # total probability of hitting any combo
    expected_value: float  # weighted EV across all combos
    kelly_stake: float  # recommended stake as fraction of bankroll
    horses_used: dict[int, str]  # index -> horse name mapping
    ticket_structure: str  # human-readable notation, e.g. "1,3/2,4,5/ALL"


@dataclass
class ExoticRecommendation:
    """Full exotic bet recommendation for a race."""

    race_slug: str
    race_name: str
    bankroll: float
    win_probs: dict[str, float]  # horse_name -> model win probability
    market_probs: dict[str, float]  # horse_name -> market implied probability
    bets: list[ExoticBet]
    total_cost: float
    summary: str


class ExoticEngine:
    """Generate optimal exotic bet tickets from Monte Carlo simulation results.

    Allocates bankroll across exotic types:
    - 40% trifecta (best EV amplification for model edges)
    - 25% exacta (simpler, lower variance)
    - 20% superfecta (highest payoff, highest variance)
    - 15% win/place (hedge)
    """

    def __init__(
        self,
        sim: SimulationResult,
        horse_names: list[str],
        morning_line_odds: list[float] | None = None,
        bankroll: float = 1000.0,
        takeout: float = 0.22,
        kelly_fraction: float = 0.25,
        min_ev: float = 1.10,
        allocation: dict[str, float] | None = None,
    ):
        self.sim = sim
        self.horse_names = horse_names
        self.n_horses = len(horse_names)
        self.bankroll = bankroll
        self.takeout = takeout
        self.kelly_fraction = kelly_fraction
        self.min_ev = min_ev
        self.allocation = allocation or {
            "trifecta": 0.40,
            "exacta": 0.25,
            "superfecta": 0.20,
            "win_place": 0.15,
        }

        # Market-implied probabilities from morning line
        if morning_line_odds is not None:
            raw = np.array([1.0 / (o + 1.0) if o > 0 else 0.05 for o in morning_line_odds])
            self.market_probs = raw / raw.sum()
        else:
            self.market_probs = sim.win_probs.copy()

    def _estimate_payoff(self, combo_prob_market: float) -> float:
        """Estimate exotic payoff from market probability, net of takeout."""
        if combo_prob_market <= 0:
            return 0.0
        return (1.0 / combo_prob_market) * (1.0 - self.takeout)

    def _combo_market_prob_exacta(self, i: int, j: int) -> float:
        """Estimate market exacta probability using Harville approximation."""
        pi, pj = self.market_probs[i], self.market_probs[j]
        return pi * pj / (1.0 - pi) if (1.0 - pi) > 0 else 0.0

    def _combo_market_prob_trifecta(self, i: int, j: int, k: int) -> float:
        """Estimate market trifecta probability using Harville."""
        pi, pj, pk = self.market_probs[i], self.market_probs[j], self.market_probs[k]
        denom1 = 1.0 - pi
        denom2 = 1.0 - pi - pj
        if denom1 <= 0 or denom2 <= 0:
            return 0.0
        return pi * (pj / denom1) * (pk / denom2)

    def _combo_market_prob_superfecta(self, i: int, j: int, k: int, l: int) -> float:
        """Estimate market superfecta probability using Harville."""
        pi, pj, pk, pl = (
            self.market_probs[i],
            self.market_probs[j],
            self.market_probs[k],
            self.market_probs[l],
        )
        d1 = 1.0 - pi
        d2 = d1 - pj
        d3 = d2 - pk
        if d1 <= 0 or d2 <= 0 or d3 <= 0:
            return 0.0
        return pi * (pj / d1) * (pk / d2) * (pl / d3)

    def _kelly(self, model_prob: float, estimated_payoff: float) -> float:
        """Fractional Kelly stake for an exotic combo."""
        if estimated_payoff <= 0 or model_prob <= 0:
            return 0.0
        q = 1.0 - model_prob
        full = (estimated_payoff * model_prob - q) / estimated_payoff
        return max(0.0, full * self.kelly_fraction)

    def _name_map(self, indices: set[int]) -> dict[int, str]:
        return {i: self.horse_names[i] for i in sorted(indices)}

    def generate_exacta_tickets(
        self, max_cost: float | None = None, base_cost: float = 2.0, top_n: int = 10
    ) -> list[ExoticBet]:
        """Generate exacta tickets ranked by EV overlay."""
        if max_cost is None:
            max_cost = self.bankroll * self.allocation.get("exacta", 0.25)

        # Score all exacta combos
        scored: list[tuple[float, int, int, float, float]] = []
        for i in range(self.n_horses):
            for j in range(self.n_horses):
                if i == j:
                    continue
                model_prob = float(self.sim.exacta_probs[i, j])
                if model_prob <= 0:
                    continue
                market_prob = self._combo_market_prob_exacta(i, j)
                payoff = self._estimate_payoff(market_prob)
                ev = model_prob * payoff
                if ev > self.min_ev:
                    scored.append((ev, i, j, model_prob, payoff))

        scored.sort(reverse=True)

        # Build tickets from top combos within budget
        bets = []
        total_spent = 0.0
        combos_in_ticket: list[tuple[int, ...]] = []
        total_prob = 0.0
        total_ev_weighted = 0.0
        all_indices: set[int] = set()

        for ev, i, j, prob, payoff in scored[:top_n]:
            if total_spent + base_cost > max_cost:
                break
            combos_in_ticket.append((i, j))
            total_spent += base_cost
            total_prob += prob
            total_ev_weighted += ev * base_cost
            all_indices.update({i, j})

        if combos_in_ticket:
            avg_ev = total_ev_weighted / total_spent if total_spent > 0 else 0.0
            kelly = self._kelly(total_prob, (avg_ev / total_prob) if total_prob > 0 else 0.0)
            ticket_str = self._format_ticket("exacta", combos_in_ticket)
            bets.append(
                ExoticBet(
                    bet_type="exacta",
                    combinations=combos_in_ticket,
                    cost=total_spent,
                    probability=total_prob,
                    expected_value=avg_ev,
                    kelly_stake=kelly,
                    horses_used=self._name_map(all_indices),
                    ticket_structure=ticket_str,
                )
            )

        return bets

    def generate_trifecta_tickets(
        self, max_cost: float | None = None, base_cost: float = 1.0, top_n: int = 15
    ) -> list[ExoticBet]:
        """Generate trifecta tickets ranked by EV overlay."""
        if max_cost is None:
            max_cost = self.bankroll * self.allocation.get("trifecta", 0.40)

        scored: list[tuple[float, int, int, int, float, float]] = []
        for i in range(self.n_horses):
            for j in range(self.n_horses):
                if j == i:
                    continue
                for k in range(self.n_horses):
                    if k == i or k == j:
                        continue
                    model_prob = float(self.sim.trifecta_probs[i, j, k])
                    if model_prob <= 0:
                        continue
                    market_prob = self._combo_market_prob_trifecta(i, j, k)
                    payoff = self._estimate_payoff(market_prob)
                    ev = model_prob * payoff
                    if ev > self.min_ev:
                        scored.append((ev, i, j, k, model_prob, payoff))

        scored.sort(reverse=True)

        bets = []
        total_spent = 0.0
        combos: list[tuple[int, ...]] = []
        total_prob = 0.0
        total_ev_weighted = 0.0
        all_indices: set[int] = set()

        for ev, i, j, k, prob, payoff in scored[:top_n]:
            if total_spent + base_cost > max_cost:
                break
            combos.append((i, j, k))
            total_spent += base_cost
            total_prob += prob
            total_ev_weighted += ev * base_cost
            all_indices.update({i, j, k})

        if combos:
            avg_ev = total_ev_weighted / total_spent if total_spent > 0 else 0.0
            kelly = self._kelly(total_prob, (avg_ev / total_prob) if total_prob > 0 else 0.0)
            ticket_str = self._format_ticket("trifecta", combos)
            bets.append(
                ExoticBet(
                    bet_type="trifecta",
                    combinations=combos,
                    cost=total_spent,
                    probability=total_prob,
                    expected_value=avg_ev,
                    kelly_stake=kelly,
                    horses_used=self._name_map(all_indices),
                    ticket_structure=ticket_str,
                )
            )

        return bets

    def generate_superfecta_tickets(
        self, max_cost: float | None = None, base_cost: float = 0.10, top_n: int = 20
    ) -> list[ExoticBet]:
        """Generate superfecta tickets from threshold-pruned combos."""
        if self.sim.superfecta_probs is None:
            return []

        if max_cost is None:
            max_cost = self.bankroll * self.allocation.get("superfecta", 0.20)

        scored: list[tuple[float, tuple[int, int, int, int], float, float]] = []
        for combo, model_prob in self.sim.superfecta_probs.items():
            if model_prob <= 0:
                continue
            i, j, k, l = combo
            market_prob = self._combo_market_prob_superfecta(i, j, k, l)
            payoff = self._estimate_payoff(market_prob)
            ev = model_prob * payoff
            if ev > self.min_ev:
                scored.append((ev, combo, model_prob, payoff))

        scored.sort(reverse=True)

        bets = []
        total_spent = 0.0
        combos: list[tuple[int, ...]] = []
        total_prob = 0.0
        total_ev_weighted = 0.0
        all_indices: set[int] = set()

        for ev, combo, prob, payoff in scored[:top_n]:
            if total_spent + base_cost > max_cost:
                break
            combos.append(combo)
            total_spent += base_cost
            total_prob += prob
            total_ev_weighted += ev * base_cost
            all_indices.update(combo)

        if combos:
            avg_ev = total_ev_weighted / total_spent if total_spent > 0 else 0.0
            kelly = self._kelly(total_prob, (avg_ev / total_prob) if total_prob > 0 else 0.0)
            ticket_str = self._format_ticket("superfecta", combos)
            bets.append(
                ExoticBet(
                    bet_type="superfecta",
                    combinations=combos,
                    cost=total_spent,
                    probability=total_prob,
                    expected_value=avg_ev,
                    kelly_stake=kelly,
                    horses_used=self._name_map(all_indices),
                    ticket_structure=ticket_str,
                )
            )

        return bets

    def full_recommendation(
        self, race_slug: str = "", race_name: str = ""
    ) -> ExoticRecommendation:
        """Generate the complete exotic bet recommendation for a race."""
        bets: list[ExoticBet] = []

        exacta_bets = self.generate_exacta_tickets()
        bets.extend(exacta_bets)

        trifecta_bets = self.generate_trifecta_tickets()
        bets.extend(trifecta_bets)

        superfecta_bets = self.generate_superfecta_tickets()
        bets.extend(superfecta_bets)

        total_cost = sum(b.cost for b in bets)

        # Build win probability maps
        win_probs_map = {
            self.horse_names[i]: float(self.sim.win_probs[i]) for i in range(self.n_horses)
        }
        market_probs_map = {
            self.horse_names[i]: float(self.market_probs[i]) for i in range(self.n_horses)
        }

        # Summary
        lines = [f"=== {race_name or race_slug} — Exotic Recommendations ==="]
        lines.append(f"Bankroll: ${self.bankroll:.0f} | Total ticket cost: ${total_cost:.2f}")
        lines.append("")
        for bet in bets:
            lines.append(f"  {bet.bet_type.upper()} — {len(bet.combinations)} combos")
            lines.append(f"    Cost: ${bet.cost:.2f} | Hit prob: {bet.probability:.2%} | EV: {bet.expected_value:.2f}")
            lines.append(f"    Ticket: {bet.ticket_structure}")
            lines.append("")

        return ExoticRecommendation(
            race_slug=race_slug,
            race_name=race_name,
            bankroll=self.bankroll,
            win_probs=win_probs_map,
            market_probs=market_probs_map,
            bets=bets,
            total_cost=total_cost,
            summary="\n".join(lines),
        )

    def _format_ticket(self, bet_type: str, combos: list[tuple[int, ...]]) -> str:
        """Format combos into human-readable ticket notation.

        Groups by position to create part-wheel notation where possible.
        Example: [(0,1,2), (0,1,3), (0,2,3)] -> "1/2,3/3,4" (program numbers are 1-indexed).
        """
        if not combos:
            return ""

        n_positions = len(combos[0])

        # Collect unique horses per position
        per_pos: list[set[int]] = [set() for _ in range(n_positions)]
        for combo in combos:
            for pos, horse_idx in enumerate(combo):
                per_pos[pos].add(horse_idx)

        # Format as program numbers (1-indexed)
        parts = []
        for pos_set in per_pos:
            nums = sorted(pos_set)
            labels = [str(n + 1) for n in nums]
            parts.append(",".join(labels))

        return f"{bet_type.upper()}: {'/'.join(parts)}"

    def print_report(self) -> str:
        """Generate a formatted console report of win probabilities and exotic recommendations."""
        lines: list[str] = []

        # Win probability table
        lines.append("=" * 70)
        lines.append(f"{'#':<4} {'Horse':<25} {'Model':>8} {'Market':>8} {'Edge':>8}")
        lines.append("-" * 70)

        # Sort by model win prob descending
        order = np.argsort(-self.sim.win_probs)
        for rank, idx in enumerate(order, 1):
            name = self.horse_names[idx]
            model_p = self.sim.win_probs[idx]
            market_p = self.market_probs[idx]
            edge = model_p - market_p
            edge_str = f"+{edge:.1%}" if edge > 0 else f"{edge:.1%}"
            lines.append(f"{rank:<4} {name:<25} {model_p:>7.1%} {market_p:>7.1%} {edge_str:>8}")

        lines.append("=" * 70)
        lines.append("")

        # Top exacta combos
        lines.append("TOP 10 EXACTA COMBINATIONS")
        lines.append(f"{'Combo':<30} {'Prob':>8} {'Est Payoff':>12}")
        lines.append("-" * 52)
        exacta_ranked = []
        for i in range(self.n_horses):
            for j in range(self.n_horses):
                if i == j:
                    continue
                p = float(self.sim.exacta_probs[i, j])
                if p > 0:
                    exacta_ranked.append((p, i, j))
        exacta_ranked.sort(reverse=True)
        for p, i, j in exacta_ranked[:10]:
            mp = self._combo_market_prob_exacta(i, j)
            payoff = self._estimate_payoff(mp)
            combo_str = f"{self.horse_names[i]} / {self.horse_names[j]}"
            lines.append(f"{combo_str:<30} {p:>7.2%} ${payoff:>10.0f}")
        lines.append("")

        # Top trifecta combos
        lines.append("TOP 10 TRIFECTA COMBINATIONS")
        lines.append(f"{'Combo':<45} {'Prob':>8} {'Est Payoff':>12}")
        lines.append("-" * 67)
        tri_ranked = []
        for i in range(self.n_horses):
            for j in range(self.n_horses):
                if j == i:
                    continue
                for k in range(self.n_horses):
                    if k == i or k == j:
                        continue
                    p = float(self.sim.trifecta_probs[i, j, k])
                    if p > 0:
                        tri_ranked.append((p, i, j, k))
        tri_ranked.sort(reverse=True)
        for p, i, j, k in tri_ranked[:10]:
            mp = self._combo_market_prob_trifecta(i, j, k)
            payoff = self._estimate_payoff(mp)
            combo_str = f"{self.horse_names[i]} / {self.horse_names[j]} / {self.horse_names[k]}"
            lines.append(f"{combo_str:<45} {p:>7.3%} ${payoff:>10.0f}")
        lines.append("")

        # Top superfecta combos
        if self.sim.superfecta_probs:
            lines.append("TOP 10 SUPERFECTA COMBINATIONS")
            lines.append(f"{'Combo':<60} {'Prob':>8} {'Est Payoff':>12}")
            lines.append("-" * 82)
            super_ranked = sorted(
                self.sim.superfecta_probs.items(), key=lambda x: x[1], reverse=True
            )
            for (i, j, k, l), p in super_ranked[:10]:
                mp = self._combo_market_prob_superfecta(i, j, k, l)
                payoff = self._estimate_payoff(mp)
                names = [self.horse_names[x] for x in (i, j, k, l)]
                combo_str = " / ".join(names)
                lines.append(f"{combo_str:<60} {p:>7.3%} ${payoff:>10.0f}")
            lines.append("")

        return "\n".join(lines)
