// Jason's TwinSpires placed wagers for CD 2026-04-30, captured by Claude via Chrome MCP.
// Update this file as new bets are placed.

export type PlacedBet = {
  id: string;
  raceNumber: number;
  betType: "WIN" | "PLACE" | "SHOW" | "EX" | "TRI" | "SU" | "SHF" | "P3" | "P4" | "P5" | "P6" | "DD";
  betTypeLabel: string;
  unitCost: number;
  totalCost: number;
  combos: string[]; // human-readable e.g. "11-8-10-4-12"
  bonus?: boolean;
  placedAt: string;
  status: "active" | "won" | "lost" | "refunded";
  notes?: string;
};

export const USER_BETS: PlacedBet[] = [
  {
    id: "p5-r1-r5",
    raceNumber: 1,
    betType: "P5",
    betTypeLabel: "Pick 5 (R1–R5)",
    unitCost: 0.5,
    totalCost: 0.5,
    combos: ["#1 → #5 → #6 → #8 → #4"],
    placedAt: "2026-04-30",
    status: "lost",
    notes: "Busted at L1 — Banned for Life finished 3rd (R1 actual: 4-5-1-2-6).",
  },
  {
    id: "shf-r4",
    raceNumber: 4,
    betType: "SHF",
    betTypeLabel: "Super High Five",
    unitCost: 1.0,
    totalCost: 2.0,
    combos: ["11-8-10-4-12", "11-8-10-12-4"],
    bonus: true,
    placedAt: "2026-04-30",
    status: "lost",
    notes: "R4 finish 12-11-3. Needed #11 on top, but #12 (winner) was only in 4th-5th slots.",
  },
  {
    id: "su-r4",
    raceNumber: 4,
    betType: "SU",
    betTypeLabel: "Superfecta",
    unitCost: 0.1,
    totalCost: 0.4,
    combos: ["8-11-4-12", "8-11-12-4", "11-8-4-12", "11-8-12-4"],
    placedAt: "2026-04-30",
    status: "lost",
    notes: "Needed #8 or #11 in top 2 — but actual was #12 winning. Pool-disparity flag on #8 played out.",
  },
  {
    id: "su-r5",
    raceNumber: 5,
    betType: "SU",
    betTypeLabel: "Superfecta",
    unitCost: 0.1,
    totalCost: 1.8,
    combos: ["#3 OR #12 / #1, #3 OR #12 / #1 / spread {2, 4, 6, 8, 11, 13}"],
    placedAt: "2026-04-30",
    status: "lost",
    notes: "Lost. Needed #1 in 3rd but #6 Big Rog finished 3rd. The exacta #3-#12 (algo's top 2) hit cleanly though — first major algo v2 validation.",
  },
];

// Note: R5 SU lost — needed #1 in 3rd but #6 finished 3rd. The exacta #3-#12 hit cleanly though
// (algo top 2 finished 1-2 in order). Algo v2 first major validation.

export function getBetsForRace(raceNumber: number): PlacedBet[] {
  return USER_BETS.filter((b) => b.raceNumber === raceNumber);
}

export function totalCashAtRisk(): number {
  return USER_BETS
    .filter((b) => b.status === "active" && !b.bonus)
    .reduce((acc, b) => acc + b.totalCost, 0);
}

export function totalBonusAtRisk(): number {
  return USER_BETS
    .filter((b) => b.status === "active" && b.bonus)
    .reduce((acc, b) => acc + b.totalCost, 0);
}
