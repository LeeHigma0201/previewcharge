/**
 * EV Math — corrected pari-mutuel expected value formulas
 * Added: 2026-04-25
 *
 * BUG FIXED: The original payoff estimator `l(e) { return 1/e * 0.78 }`
 * used the SIMULATION-derived hit probability as the payoff denominator.
 * Because the simulation encodes model probabilities, this collapses to:
 *   EV = modelHit × (1-takeout)/modelHit − 1 = (1-takeout) − 1 = -takeout
 * i.e., every ticket has EV = -22% regardless of true edge.
 *
 * CORRECT formula (per Cortex note 2026-04-18):
 *   payoff = (1 − takeout) / marketHitProb   [market-derived payout]
 *   EV = modelHitProb × payoff − 1
 *
 * Market hit probabilities are derived using Harville conditional independence:
 *   P(A wins)       = market_A  (normalized from ML odds)
 *   P(B 2nd | A 1st) = market_B / (1 − market_A)
 *   Exacta market prob = market_A × market_B / (1 − market_A)
 *   Trifecta market prob = market_A × market_B/(1−market_A) × market_C/(1−market_A−market_B)
 *
 * EV is positive when: modelHitProb / marketHitProb > 1/(1−takeout) ≈ 1.27
 * i.e., the model must see at least a 27% overlay on the combination.
 */

/** Per-horse record for EV calculation */
export interface HorseProbs {
  program: string;
  name: string;
  modelProb: number;    // model-derived win probability (from Stage 1 + softmax)
  marketProb: number;   // market-implied win probability (normalized from ML odds)
  simWinProb: number;   // MC simulation win % (used only for hit rate display, NOT payoff)
}

/** Standard takeout rates by bet type */
export const TAKEOUT = {
  WIN:      0.162,
  PLACE:    0.172,
  SHOW:     0.172,
  EXACTA:   0.19,
  TRIFECTA: 0.215,
  SUPERFECTA: 0.22,
  PICK3:    0.215,
  PICK4:    0.22,
  PICK5:    0.22,
  PICK6:    0.25,
} as const;

/**
 * Correct win-bet EV.
 * EV = modelProb × (1 − takeout) / marketProb − 1
 */
export function winEV(horse: HorseProbs): number {
  if (horse.marketProb <= 0) return -1;
  return horse.modelProb * (1 - TAKEOUT.WIN) / horse.marketProb - 1;
}

/**
 * Harville market probability for exacta (A → B)
 */
export function exactaMarketProb(
  marketA: number,
  marketB: number
): number {
  const denom = 1 - marketA;
  if (denom <= 0) return 0;
  return (marketA * marketB) / denom;
}

/**
 * Harville model probability for exacta (A → B)
 * Uses model probs for numerator
 */
export function exactaModelProb(
  modelA: number,
  modelB: number
): number {
  const denom = 1 - modelA;
  if (denom <= 0) return 0;
  return (modelA * modelB) / denom;
}

/**
 * Correct exacta EV for a specific (A → B) combination.
 * Positive when model sees >1.27x overlay on the combination.
 */
export function exactaEV(
  winnerModel: number,
  winnerMarket: number,
  secondModel: number,
  secondMarket: number
): { modelHit: number; marketHit: number; payoff: number; ev: number; evPerDollar: number } {
  const modelHit = exactaModelProb(winnerModel, secondModel);
  const marketHit = exactaMarketProb(winnerMarket, secondMarket);
  if (marketHit <= 0) return { modelHit, marketHit: 0, payoff: 0, ev: -1, evPerDollar: -1 };
  const payoff = (1 - TAKEOUT.EXACTA) / marketHit;
  const ev = modelHit * payoff - 1;
  return { modelHit, marketHit, payoff, ev, evPerDollar: ev / 2.0 };
}

/**
 * Harville market probability for trifecta (A → B → C)
 */
export function trifectaMarketProb(
  marketA: number,
  marketB: number,
  marketC: number
): number {
  const denomAB = 1 - marketA;
  if (denomAB <= 0) return 0;
  const denomABC = 1 - marketA - marketB;
  if (denomABC <= 0) return 0;
  return (marketA / 1) * (marketB / denomAB) * (marketC / denomABC);
}

/**
 * Harville model probability for trifecta (A → B → C)
 */
export function trifectaModelProb(
  modelA: number,
  modelB: number,
  modelC: number
): number {
  const denomAB = 1 - modelA;
  if (denomAB <= 0) return 0;
  const denomABC = 1 - modelA - modelB;
  if (denomABC <= 0) return 0;
  return (modelA / 1) * (modelB / denomAB) * (modelC / denomABC);
}

/**
 * Correct trifecta EV for a specific (A → B → C) combination.
 */
export function trifectaEV(
  aModel: number, aMarket: number,
  bModel: number, bMarket: number,
  cModel: number, cMarket: number
): { modelHit: number; marketHit: number; payoff: number; ev: number; evPerDollar: number } {
  const modelHit = trifectaModelProb(aModel, bModel, cModel);
  const marketHit = trifectaMarketProb(aMarket, bMarket, cMarket);
  if (marketHit <= 0) return { modelHit, marketHit: 0, payoff: 0, ev: -1, evPerDollar: -1 };
  const payoff = (1 - TAKEOUT.TRIFECTA) / marketHit;
  const ev = modelHit * payoff - 1;
  // Standard trifecta unit = $0.50
  return { modelHit, marketHit, payoff, ev, evPerDollar: ev / 0.5 };
}

/**
 * Superfecta EV (A → B → C → D)
 */
export function superfectaEV(
  aModel: number, aMarket: number,
  bModel: number, bMarket: number,
  cModel: number, cMarket: number,
  dModel: number, dMarket: number
): { ev: number; evPerDollar: number } {
  const denomAB = 1 - aMarket;
  const denomABC = 1 - aMarket - bMarket;
  const denomABCD = 1 - aMarket - bMarket - cMarket;
  if (denomAB <= 0 || denomABC <= 0 || denomABCD <= 0) return { ev: -1, evPerDollar: -1 };
  const marketHit = aMarket * (bMarket / denomAB) * (cMarket / denomABC) * (dMarket / denomABCD);

  const mDenAB = 1 - aModel;
  const mDenABC = 1 - aModel - bModel;
  const mDenABCD = 1 - aModel - bModel - cModel;
  if (mDenAB <= 0 || mDenABC <= 0 || mDenABCD <= 0) return { ev: -1, evPerDollar: -1 };
  const modelHit = aModel * (bModel / mDenAB) * (cModel / mDenABC) * (dModel / mDenABCD);

  if (marketHit <= 0) return { ev: -1, evPerDollar: -1 };
  const payoff = (1 - TAKEOUT.SUPERFECTA) / marketHit;
  const ev = modelHit * payoff - 1;
  return { ev, evPerDollar: ev / 0.5 };
}

/**
 * Minimum overlay needed for a bet type to be +EV.
 * overlay = modelHitProb / marketHitProb > 1/(1-takeout)
 */
export const MIN_OVERLAY_FOR_EV: Record<keyof typeof TAKEOUT, number> = {
  WIN:         1 / (1 - TAKEOUT.WIN),          // ≈ 1.194
  PLACE:       1 / (1 - TAKEOUT.PLACE),         // ≈ 1.208
  SHOW:        1 / (1 - TAKEOUT.SHOW),          // ≈ 1.208
  EXACTA:      1 / (1 - TAKEOUT.EXACTA),        // ≈ 1.235
  TRIFECTA:    1 / (1 - TAKEOUT.TRIFECTA),      // ≈ 1.274
  SUPERFECTA:  1 / (1 - TAKEOUT.SUPERFECTA),    // ≈ 1.282
  PICK3:       1 / (1 - TAKEOUT.PICK3),         // ≈ 1.274
  PICK4:       1 / (1 - TAKEOUT.PICK4),         // ≈ 1.282
  PICK5:       1 / (1 - TAKEOUT.PICK5),         // ≈ 1.282
  PICK6:       1 / (1 - TAKEOUT.PICK6),         // ≈ 1.333
};

/**
 * Build the full ranked exacta play list using corrected EV.
 * Replaces the current `l(e)` function in data.ts.
 *
 * @param horses - Sorted list of horses with model/market probs
 * @param simExactas - 2D matrix from MC sim: simExactas[i][j] = hit count for #i→#j
 * @param totalSims - Total simulations run
 * @returns Sorted exacta plays by EV/dollar descending
 */
export interface ExactaPlay {
  programs: [string, string];
  names: [string, string];
  modelHitPct: number;
  marketHitPct: number;
  payoff: number;
  ev: number;
  evPerDollar: number;
  isPositiveEV: boolean;
  unitCost: number;
}

export function buildExactaPlays(
  horses: HorseProbs[],
  simExactas: number[][],
  totalSims: number
): ExactaPlay[] {
  const plays: ExactaPlay[] = [];
  const n = horses.length;

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || simExactas[i][j] === 0) continue;

      const result = exactaEV(
        horses[i].modelProb,
        horses[i].marketProb,
        horses[j].modelProb,
        horses[j].marketProb
      );

      plays.push({
        programs: [horses[i].program, horses[j].program],
        names: [horses[i].name, horses[j].name],
        modelHitPct: result.modelHit * 100,
        marketHitPct: result.marketHit * 100,
        payoff: result.payoff,
        ev: result.ev,
        evPerDollar: result.evPerDollar,
        isPositiveEV: result.ev > 0,
        unitCost: 2.0,
      });
    }
  }

  // Sort by EV/dollar descending — cheap +EV plays surface first
  return plays.sort((a, b) =>
    Math.abs(a.evPerDollar - b.evPerDollar) > 0.01
      ? b.evPerDollar - a.evPerDollar
      : b.modelHitPct - a.modelHitPct
  );
}

/** Classify tier using the OR rule (per Jason's 2026-04-18 decision) */
export function classifyTier(
  winPct: number,
  ratio: number
): "A" | "B" | "C" {
  if (winPct >= 22 || (ratio >= 1.15 && winPct >= 8)) return "A";
  if (winPct >= 5) return "B";
  return "C";
}

/**
 * Detect false favorite: ML favorite (ratio < 1.0) that ranks outside top 3 by model.
 * Returns true if this horse should be flagged as "FADE" or "exclude"-candidate.
 */
export function isFalseFavorite(
  horse: HorseProbs,
  allHorses: HorseProbs[],
  modelRank: number  // 1-based rank by modelProb descending
): boolean {
  // Is this the ML favorite?
  const isFav = horse.marketProb === Math.max(...allHorses.map((h) => h.marketProb));
  if (!isFav) return false;
  // Ranks outside top 3 by model
  return modelRank > 3;
}
