import type {
  RaceInfo,
  HorseEntry,
  PredictionRow,
  ExoticCombo,
  RankedExoticList,
  PaceScenario,
  SimulationResult,
  BetStrategy,
} from "./types";

// ---------------------------------------------------------------------------
// Probit (inverse normal CDF) — same as Python's norm.ppf
// ---------------------------------------------------------------------------

function probit(p: number): number {
  const a = [
    -3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
    1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0,
  ];
  const b = [
    -5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
    6.680131188771972e1, -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0,
    -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0,
  ];
  const d = [
    7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0,
    3.754408661907416e0,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  let q: number, r: number;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  } else if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (
      ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
        q) /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  } else {
    q = Math.sqrt(-2 * Math.log(1 - p));
    return (
      -(
        (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q +
          c[5]) /
        ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
      )
    );
  }
}

// ---------------------------------------------------------------------------
// Pace scenario analysis — adjusts raw probabilities
// ---------------------------------------------------------------------------

export function getPaceScenario(entries: HorseEntry[]): PaceScenario {
  const earlyCount = entries.filter((e) =>
    ["E", "EP"].includes(e.style),
  ).length;
  const presserCount = entries.filter((e) => e.style === "P").length;
  const closerCount = entries.filter((e) =>
    ["S", "C"].includes(e.style),
  ).length;

  let scenario: string;
  let description: string;
  if (earlyCount >= 3) {
    scenario = "Speed Duel";
    description =
      "3+ early speed types contest the pace. Hot pace benefits closers/stalkers.";
  } else if (earlyCount === 2) {
    scenario = "Contested Pace";
    description =
      "Two speed types push each other. Moderate closer advantage.";
  } else if (earlyCount === 1) {
    scenario = "Lone Speed";
    description =
      "Single speed horse controls pace unchallenged. ~35% win rate historically.";
  } else {
    scenario = "No Speed";
    description =
      "No committed speed. Slow pace, sprint finish. Tactical speed is key.";
  }

  return { scenario, earlyCount, presserCount, closerCount, description };
}

// ===========================================================================
// PHASE 1: PURE ABILITY MODEL — NO ODDS ALLOWED
//
// The model computes ability from performance data ONLY. Odds are never
// used to determine probability. This eliminates market bias entirely.
//
// Data inputs and their predictive weights (from racing research):
//   Speed figures (Beyer):  0.35 — strongest single predictor
//   Pace fit:               0.20 — running style × field dynamics
//   Class:                  0.15 — competition level
//   Form cycle:             0.15 — rest, trend, equipment
//   Connections:            0.10 — jockey + trainer
//   Post position:          0.05 — track/distance specific
// ===========================================================================

const WEIGHTS = {
  speed: 0.28,
  pace: 0.18,
  class: 0.14,
  form: 0.14,
  connections: 0.09,
  post: 0.05,
  trackBias: 0.12, // KEE real Brisnet IVs — stronger signal than generic heuristic
};

// Z-score a numeric array within the field (mean=0, std=1)
function zScore(values: number[]): number[] {
  const n = values.length;
  if (n === 0) return [];
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, v) => a + (v - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std === 0) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

// Score 1: SPEED — Beyer speed figures, z-scored within field
// Fix (Marcus Chen critique): horses WITHOUT Beyer data were getting 0,
// which z-scores to a massively negative value when others have real data
// (e.g., field of [82, 79, 85, 0] → the 0 is ~-2.5 sigma). This punishes
// unknowns far more than warranted. Instead, impute the field MEDIAN for
// missing horses — they get z-score ≈ 0 (neutral), not a death sentence.
function speedScores(entries: HorseEntry[]): number[] {
  const rawAvgs = entries.map((e) => {
    if (e.last3Beyer && e.last3Beyer.length > 0) {
      return e.last3Beyer.reduce((a, b) => a + b, 0) / e.last3Beyer.length;
    }
    return null; // explicitly mark as missing
  });

  // If ALL horses lack data, return zeros (no signal)
  const known = rawAvgs.filter((a): a is number => a !== null);
  if (known.length === 0) return entries.map(() => 0);

  // Impute missing with field median (robust to outliers, per Dr. Vasquez)
  const sorted = [...known].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const imputed = rawAvgs.map((a) => a ?? median);
  return zScore(imputed);
}

// Score 2: PACE FIT — running style × field pace scenario
function paceScores(entries: HorseEntry[]): number[] {
  const pace = getPaceScenario(entries);
  return entries.map((e) => {
    const style = e.style || "P";
    if (pace.scenario === "Speed Duel") {
      if (["E", "EP"].includes(style)) return -0.8; // speed duel hurts speed
      if (["S", "C"].includes(style)) return 0.8;   // closers benefit
      if (style === "P") return 0.3;
    } else if (pace.scenario === "Lone Speed") {
      if (["E", "EP"].includes(style)) {
        const otherSpeed = entries.filter(
          (x) => x.name !== e.name && ["E", "EP"].includes(x.style || "P"),
        ).length;
        if (otherSpeed === 0) return 1.2; // massive advantage
      }
      if (["S", "C"].includes(style)) return -0.6;
    } else if (pace.scenario === "Contested Pace") {
      if (["S", "C"].includes(style)) return 0.4;
      if (["E", "EP"].includes(style)) return -0.4;
    }
    return 0;
  });
}

// Score 3: CLASS — based on class movement and career win rate
function classScores(entries: HorseEntry[]): number[] {
  return entries.map((e) => {
    let score = 0;
    if (e.isClassDrop) score += 0.8;
    if (e.isClassRaise) score -= 0.5;
    // Career win rate as class indicator
    if (e.wins && e.starts && e.starts >= 3) {
      const winPct = e.wins / e.starts;
      if (winPct > 0.25) score += 0.5;
      else if (winPct > 0.15) score += 0.2;
      else if (winPct < 0.05) score -= 0.3;
    }
    return score;
  });
}

// Score 4: FORM CYCLE — rest, improvement trend, equipment, last finish
function formScores(entries: HorseEntry[]): number[] {
  return entries.map((e) => {
    let score = 0;
    // Beyer trend
    if (e.last3Beyer && e.last3Beyer.length >= 2) {
      const recent = e.last3Beyer[0];
      const avg = e.last3Beyer.reduce((a, b) => a + b, 0) / e.last3Beyer.length;
      if (recent > avg + 3) score += 0.6;  // improving
      if (recent < avg - 3) score -= 0.6;  // declining
    }
    // Rest pattern — layoff penalty softens for high-class horses
    // Learning (KEE Apr 18 R1): Reality Star won at 6/1 with 98d layoff; my
    // flat −0.5 penalty pushed him from win-pick to 3rd. Check back-speed:
    // if the horse's peak recent Beyer is strong, the layoff is intentional
    // (trainer freshened), not decline.
    if (e.daysSinceLast) {
      if (e.daysSinceLast >= 14 && e.daysSinceLast <= 35) score += 0.3;
      if (e.daysSinceLast > 60) {
        const peakBeyer = e.last3Beyer && e.last3Beyer.length > 0 ? Math.max(...e.last3Beyer) : 0;
        // Soften penalty if peakBeyer >= 82 (quality horse who ran well recently)
        score -= peakBeyer >= 82 ? 0.2 : 0.5;
      }
      if (e.daysSinceLast < 7) score -= 0.6;
    }
    // Last finish position — recent winner/placer is in better form
    if (e.lastFinishPosition) {
      if (e.lastFinishPosition === 1) score += 0.5;
      else if (e.lastFinishPosition <= 3) score += 0.2;
      else if (e.lastFinishPosition >= 8) score -= 0.3;
    }
    // Equipment change
    if (e.equipmentChange) score += 0.3;
    // Weight — heavier weight is a penalty (1 lb ≈ 1 length at a mile)
    if (e.weight && e.weight > 124) score -= (e.weight - 122) * 0.05;
    if (e.weight && e.weight < 118) score += (122 - e.weight) * 0.03;
    return score;
  });
}

// Score 5: CONNECTIONS — jockey + trainer strength
function connectionScores(entries: HorseEntry[]): number[] {
  return entries.map((e) => {
    let score = 0;
    if (e.jockeyWinPct && e.jockeyWinPct > 0.20) score += 0.5;
    else if (e.jockeyWinPct && e.jockeyWinPct > 0.15) score += 0.2;
    if (e.trainerWinPct && e.trainerWinPct > 0.25) score += 0.5;
    else if (e.trainerWinPct && e.trainerWinPct > 0.18) score += 0.2;
    // Distance/surface specialist
    if (e.distanceWins && e.distanceStarts && e.distanceStarts >= 3) {
      if (e.distanceWins / e.distanceStarts > 0.30) score += 0.4;
    }
    if (e.surfaceWins && e.surfaceStarts && e.surfaceStarts >= 3) {
      if (e.surfaceWins / e.surfaceStarts > 0.30) score += 0.3;
    }
    return score;
  });
}

// Score 6: POST POSITION — inside advantage on dirt sprints
function postScores(entries: HorseEntry[], race?: RaceInfo): number[] {
  const n = entries.length;
  const isKEE = race?.track === "KEE";
  const isDirt = !race?.surface || race.surface.toLowerCase().includes("dirt");
  const isSprint = race?.distance ? parseDistanceFurlongs(race.distance) <= 7 : true;

  return entries.map((e) => {
    const pp = e.pp;

    // Keeneland-specific post position bias
    if (isKEE && isDirt && isSprint) {
      // KEE dirt sprints: inside posts have 5-8% edge, outside posts struggle
      if (pp <= 2) return 0.6;   // Strong inside advantage
      if (pp <= 4) return 0.4;   // Solid inside advantage
      if (pp <= 6) return 0;
      if (pp >= 10) return -0.6; // Significant outside disadvantage
      if (pp >= 8) return -0.4;
      return -0.2;
    }

    if (isKEE && isDirt && !isSprint) {
      // KEE dirt routes (1 1/16m+): inside still helps but less extreme
      if (pp <= 3) return 0.3;
      if (pp <= 6) return 0;
      if (n >= 10 && pp >= n - 1) return -0.3;
      return -0.1;
    }

    if (isKEE && !isDirt) {
      // KEE turf: more neutral, slight outside preference at routes
      if (isSprint && pp <= 3) return 0.2;
      return 0;
    }

    // Generic (non-KEE) fallback
    if (pp <= 3) return 0.3;
    if (pp <= 6) return 0;
    if (n >= 10 && pp >= n - 1) return -0.4;
    return -0.1;
  });
}

// Parse distance string to furlongs for bias calculations
function parseDistanceFurlongs(dist: string): number {
  const d = dist.toLowerCase();
  const fMatch = d.match(/([\d.]+)\s*furlong/);
  if (fMatch) return parseFloat(fMatch[1]);
  const mFracMatch = d.match(/(\d+)\s+(\d+)\/(\d+)\s*mile/);
  if (mFracMatch) return (parseInt(mFracMatch[1]) + parseInt(mFracMatch[2]) / parseInt(mFracMatch[3])) * 8;
  const mMatch = d.match(/([\d.]+)\s*mile/);
  if (mMatch) return parseFloat(mMatch[1]) * 8;
  return 8; // default to 1 mile
}

// Keeneland-specific track condition adjustments
// NOTE: These return values on the SAME SCALE as the other score functions
// (roughly -1 to +1 z-score range). They go through the weight system
// via WEIGHTS.trackBias to prevent them from dominating the model.
// (Dr. Vasquez critique: raw additive adjustments were 13x too strong)
function keenelandConditionAdj(entries: HorseEntry[], race?: RaceInfo): number[] {
  if (race?.track !== "KEE") return entries.map(() => 0);

  // PREFERRED PATH: real Brisnet track bias for this specific surface+distance.
  // Convert impact values (IV) to z-scored adjustments.
  // IV of 1.0 = neutral (expected); > 1.0 = outperforming; < 1.0 = underperforming.
  // We cap the adjustment range so it doesn't swamp the 7% weight.
  if (race.trackBias) {
    const tb = race.trackBias;
    const n = entries.length;

    // Style IVs → additive adjustment centered at IV=1.0
    const styleAdj = (style: string): number => {
      const s = (style || "P").toUpperCase();
      // Map style code to IV slot. "C" (deep closer) uses S slot.
      const iv =
        s === "E"  ? tb.eIV :
        s === "EP" ? tb.epIV :
        s === "P"  ? tb.pIV :
        /* S/C */    tb.sIV;
      // Learning (KEE Apr 18 R2): Week bias with <5 race samples overfit —
      // it called a closer race, #5 Consolidated (EP, 65d) won at 6/1
      // bucking the 0% week speed bias. Clamp IV impact tighter so weekly
      // noise doesn't override meet-level priors. IV of 2.6 → +0.56, IV 0 → -0.35.
      return Math.max(-0.5, Math.min(0.6, (iv - 1.0) * 0.35));
    };

    // Post IVs — inside (1-3), middle (4-7), outside (8+)
    const postAdj = (pp: number): number => {
      const iv =
        pp <= 3 ? tb.post1to3IV :
        pp <= 7 ? tb.post4to7IV :
                  tb.post8plusIV;
      return Math.max(-0.5, Math.min(0.6, (iv - 1.0) * 0.30));
    };

    return entries.map((e) => {
      const sa = styleAdj(e.style);
      const pa = postAdj(e.pp);
      // Modest weight on post (already covered partly by postScores)
      return sa + pa * 0.5;
    });
  }

  // FALLBACK PATH: generic surface heuristic when no real bias data is present.
  const isDirt = !race.surface || race.surface.toLowerCase().includes("dirt");
  const condition = (race.condition || "").toLowerCase();
  const isWet = ["muddy", "sloppy", "good", "yielding", "soft"].some((c) => condition.includes(c));

  return entries.map((e) => {
    if (!isDirt) return 0;
    const style = e.style || "P";
    if (isWet) {
      if (["S", "C"].includes(style)) return 0.6;
      if (["E", "EP"].includes(style)) return -0.5;
    } else {
      if (["E", "EP"].includes(style)) return 0.3;
      if (["S", "C"].includes(style)) return -0.15;
    }
    return 0;
  });
}

// COMPOSITE: Weighted ability score → probability
function computeAbilityProbs(entries: HorseEntry[], race?: RaceInfo): number[] {
  const speed = speedScores(entries);
  const pace = paceScores(entries);
  const cls = classScores(entries);
  const form = formScores(entries);
  const conn = connectionScores(entries);
  const post = postScores(entries, race);
  const keeAdj = keenelandConditionAdj(entries, race);

  // Weighted composite ability score — all factors go through weight system
  const abilities = entries.map((_, i) =>
    WEIGHTS.speed * speed[i] +
    WEIGHTS.pace * pace[i] +
    WEIGHTS.class * cls[i] +
    WEIGHTS.form * form[i] +
    WEIGHTS.connections * conn[i] +
    WEIGHTS.post * post[i] +
    WEIGHTS.trackBias * keeAdj[i],
  );

  // Convert ability scores to probabilities via softmax
  // (not probit here — probit is for the Monte Carlo simulation)
  const maxAbility = Math.max(...abilities);
  const exps = abilities.map((a) => Math.exp(a - maxAbility)); // subtract max for numerical stability
  const sumExp = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => Math.max(e / sumExp, 1e-6));
}

// ===========================================================================
// PHASE 2: OVERLAY DETECTION — odds enter ONLY here
//
// After the ability model produces probabilities, compare to market odds.
// Flag when model probability >> market-implied probability.
// ===========================================================================

interface OverlayInfo {
  modelProb: number;
  marketProb: number;
  overlay: number;     // ratio: model/market (>1 = value)
  isOverlay: boolean;  // model sees more value than market
  overlayPct: number;  // percentage above market
}

function detectOverlays(
  modelProbs: number[],
  entries: HorseEntry[],
): OverlayInfo[] {
  return entries.map((e, i) => {
    const marketProb = 1.0 / (e.mlOdds + 1.0);
    const overlay = modelProbs[i] / (marketProb + 1e-10);
    return {
      modelProb: modelProbs[i],
      marketProb,
      overlay,
      // Morning line odds have ~30-50% noise vs true market (Marcus Chen critique).
      // Require 40%+ edge to flag as VALUE, not 20%, to avoid false positives.
      isOverlay: overlay > 1.40,
      overlayPct: Math.round((overlay - 1) * 100),
    };
  });
}

// ---------------------------------------------------------------------------
// Henery Monte Carlo simulation — full exotic engine
// ---------------------------------------------------------------------------

const TAKEOUT = 0.22;

function estimatePayoff(prob: number): number {
  if (prob <= 0) return 0;
  return (1.0 / prob) * (1.0 - TAKEOUT);
}

// ────────────────────────────────────────────────────────────────────────────
// EV-driven bet strategy selector.
//
// For each bet type (exacta/trifecta/superfecta), enumerates candidate
// structures — top-N straight, N-horse box, key-horse wheels — and picks
// the one with highest expected value. "ROI" here is EV / cost so it's
// comparable across different ticket sizes.
//
// Why box sometimes beats straight: when the top 3-4 horses concentrate
// probability, the box covers ALL orderings of those horses for a cost
// comparable to playing only 5 specific orderings. Model doesn't need to
// call the order correctly — just identify the cast.
//
// Why key-over sometimes beats both: when one horse dominates (winProb > 0.35
// roughly), paying to cover just the other slots is cheaper than boxing.
// ────────────────────────────────────────────────────────────────────────────

function perms<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of perms(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

function comboKey(programs: string[]): string {
  return programs.join(",");
}

// Build a strategy from a set of ordered combos the bet covers
function buildStrategy(
  betType: BetStrategy["betType"],
  name: string,
  description: string,
  unitCost: number,
  coveredKeys: string[],
  allCombos: ExoticCombo[],
): BetStrategy {
  const comboByKey = new Map(allCombos.map((c) => [comboKey(c.programs), c]));
  const tickets: ExoticCombo[] = [];
  for (const k of coveredKeys) {
    const c = comboByKey.get(k);
    if (c) tickets.push(c);
  }
  tickets.sort((a, b) => b.probability - a.probability);
  const ticketCount = coveredKeys.length; // even combos with 0 prob cost money
  const totalCost = Math.round(ticketCount * unitCost * 100) / 100;
  const hitProbability = tickets.reduce((s, t) => s + t.probability, 0);
  // E[payout] = Σ prob × payoff per covered combo, then scale by unit stake
  // estimatePayoff returns $ per $1 bet at fair odds minus takeout
  const expectedPayout =
    tickets.reduce((s, t) => s + t.probability * t.estimatedPayoff, 0) * unitCost;
  const expectedValue = Math.round((expectedPayout - totalCost) * 100) / 100;
  const expectedRoi = totalCost > 0 ? expectedValue / totalCost : 0;
  return {
    betType, name, description, tickets, ticketCount,
    unitCost, totalCost, hitProbability, expectedPayout,
    expectedValue, expectedRoi,
  };
}

function candidateStrategiesExacta(
  predictions: PredictionRow[],
  combos: ExoticCombo[],
): BetStrategy[] {
  const unit = 1.0; // $1 minimum at KEE
  const topProgs = predictions.slice(0, 5).map((p) => p.program);
  const out: BetStrategy[] = [];

  // Strategy A: top 5 straight
  out.push(buildStrategy("Exacta", "Top 5 straight", "Play each of the top 5 ordered combos as its own ticket.", unit,
    combos.slice(0, 5).map((c) => comboKey(c.programs)), combos));

  // Strategy B: 3-horse box (6 combos)
  const box3 = perms(topProgs.slice(0, 3)).map((p) => p.join(","));
  out.push(buildStrategy("Exacta", "3-horse box", `Box top 3: #${topProgs.slice(0, 3).join(" / #")} — pays any order of those 3.`, unit, box3, combos));

  // Strategy C: Key favorite over top 4 (fav in 1st, top 4 others in 2nd)
  const fav = topProgs[0];
  const others = topProgs.slice(1, 5);
  const keyOver: string[] = [];
  for (const o of others) keyOver.push(`${fav},${o}`);
  out.push(buildStrategy("Exacta", "Key favorite on top", `#${fav} to win over any of #${others.join(" / #")}.`, unit, keyOver, combos));

  return out;
}

function candidateStrategiesTrifecta(
  predictions: PredictionRow[],
  combos: ExoticCombo[],
): BetStrategy[] {
  const unit = 0.5;
  const topProgs = predictions.slice(0, 5).map((p) => p.program);
  const out: BetStrategy[] = [];

  // A: top 5 straight
  out.push(buildStrategy("Trifecta", "Top 5 straight", "Play each of the top 5 ordered tri combos as its own $0.50 ticket.", unit,
    combos.slice(0, 5).map((c) => comboKey(c.programs)), combos));

  // B: 3-horse box (6 combos = $3)
  const box3 = perms(topProgs.slice(0, 3)).map((p) => p.join(","));
  out.push(buildStrategy("Trifecta", "3-horse box", `Box top 3: #${topProgs.slice(0, 3).join(" / #")} — hits any order.`, unit, box3, combos));

  // C: 4-horse box (24 combos = $12) — only if hit probability is very high
  const box4 = perms(topProgs.slice(0, 4)).map((p) => p.join(","));
  out.push(buildStrategy("Trifecta", "4-horse box", `Box top 4: #${topProgs.slice(0, 4).join(" / #")} — wide net but $12.`, unit, box4, combos));

  // D: Key favorite over top 3 in 2nd & 3rd (choose 2 of 3, ordered = 6 combos)
  const fav = topProgs[0];
  const others3 = topProgs.slice(1, 4);
  const keyOver: string[] = [];
  for (let i = 0; i < others3.length; i++) {
    for (let j = 0; j < others3.length; j++) {
      if (i === j) continue;
      keyOver.push(`${fav},${others3[i]},${others3[j]}`);
    }
  }
  out.push(buildStrategy("Trifecta", "Key favorite wheel", `#${fav} to win over #${others3.join(" / #")} any order.`, unit, keyOver, combos));

  return out;
}

function candidateStrategiesSuperfecta(
  predictions: PredictionRow[],
  combos: ExoticCombo[],
): BetStrategy[] {
  const unit = 0.5;
  const topProgs = predictions.slice(0, 5).map((p) => p.program);
  const out: BetStrategy[] = [];

  // A: top 5 straight
  out.push(buildStrategy("Superfecta", "Top 5 straight", "Play each of the top 5 ordered super combos as its own $0.50 ticket.", unit,
    combos.slice(0, 5).map((c) => comboKey(c.programs)), combos));

  // B: 4-horse box (24 combos)
  if (topProgs.length >= 4) {
    const box4 = perms(topProgs.slice(0, 4)).map((p) => p.join(","));
    out.push(buildStrategy("Superfecta", "4-horse box", `Box top 4: #${topProgs.slice(0, 4).join(" / #")} — covers all 24 orderings.`, unit, box4, combos));
  }

  // C: 5-horse box (120 combos = $60 at $0.50)
  if (topProgs.length >= 5) {
    const box5 = perms(topProgs.slice(0, 5)).map((p) => p.join(","));
    out.push(buildStrategy("Superfecta", "5-horse box", `Box top 5 — wide safety net but $60 at $0.50.`, unit, box5, combos));
  }

  // D: Key favorite over top 4 in 2-3-4 slots (24 combos possible, but only permutations of the other 3 from top 4)
  if (topProgs.length >= 5) {
    const fav = topProgs[0];
    const others4 = topProgs.slice(1, 5);
    const keyOver: string[] = [];
    // fav in 1st, any 3 of others4 in positions 2,3,4 in order
    for (let a = 0; a < others4.length; a++) {
      for (let b = 0; b < others4.length; b++) {
        if (b === a) continue;
        for (let c = 0; c < others4.length; c++) {
          if (c === a || c === b) continue;
          keyOver.push(`${fav},${others4[a]},${others4[b]},${others4[c]}`);
        }
      }
    }
    out.push(buildStrategy("Superfecta", "Key favorite over top 4", `#${fav} to win, any 3 of #${others4.join(" / #")} fill 2-3-4.`, unit, keyOver, combos));
  }

  return out;
}

function pickBestStrategy(cands: BetStrategy[]): BetStrategy {
  // Prefer highest EV. Ties broken by higher hit probability.
  return cands.slice().sort((a, b) => {
    if (Math.abs(a.expectedValue - b.expectedValue) > 0.01) return b.expectedValue - a.expectedValue;
    return b.hitProbability - a.hitProbability;
  })[0];
}

export function runSimulation(
  entries: HorseEntry[],
  simCountOverride?: number,
  race?: RaceInfo,
): SimulationResult {
  const n = entries.length;

  // ---------------------------------------------------------------
  // PHASE 1: Compute ability-based probabilities (no odds)
  // ---------------------------------------------------------------
  const probs = computeAbilityProbs(entries, race);
  const abilities = probs.map((p) => probit(Math.max(0.001, Math.min(0.999, p))));

  // ---------------------------------------------------------------
  // PHASE 2: Statistically-driven Monte Carlo simulation
  //
  // Formula: n = (z² × p × (1-p)) / e²
  // At 95% confidence (z=1.96):
  //   Win probs (~15%): n = (3.84 × 0.15 × 0.85) / 0.005² = 19,584
  //   Exacta (~3%):     n = (3.84 × 0.03 × 0.97) / 0.003² = 12,390
  //   Trifecta (~0.5%): n = (3.84 × 0.005 × 0.995) / 0.002² = 4,776
  //   Superfecta (~0.1%): needs ~38K for 0.1% margin
  //
  // Strategy: Start at computed minimum, run batches, stop at convergence.
  // Smaller fields need fewer sims. Larger fields need more for exotics.
  // ---------------------------------------------------------------

  // Compute minimum sims needed for this field size
  // Use the rarest bet type we need: superfecta prob ≈ 1/(n × (n-1) × (n-2) × (n-3))
  const rarestProb = n >= 4
    ? 1 / (n * (n - 1) * (n - 2) * (n - 3))  // superfecta
    : n >= 3
      ? 1 / (n * (n - 1) * (n - 2))  // trifecta
      : 1 / (n * (n - 1));  // exacta
  const marginOfError = Math.max(rarestProb * 0.3, 0.0005); // 30% relative margin or 0.05% absolute
  const minSims = Math.ceil((3.84 * rarestProb * (1 - rarestProb)) / (marginOfError ** 2));

  // If user set a specific sim count, use it directly. Otherwise auto-compute.
  const useFixedCount = simCountOverride && simCountOverride > 0;
  const BATCH_SIZE = useFixedCount
    ? Math.min(simCountOverride, 50000)
    : Math.min(Math.max(Math.ceil(minSims / 3), 10000), 50000);
  const MAX_BATCHES = useFixedCount
    ? Math.ceil(simCountOverride / BATCH_SIZE)
    : Math.min(Math.ceil(minSims / BATCH_SIZE) + 2, 8);
  const CONVERGENCE_THRESHOLD = useFixedCount ? 0 : 0.003; // fixed count = no early stop

  const finishCounts: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );
  const exactaCounts: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );
  const trifectaCounts: number[][][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Array(n).fill(0)),
  );
  const superfectaMap = new Map<string, number>();

  // Seed from ABILITY scores, NOT odds — keeps the model odds-free
  let seed = Math.round(
    abilities.reduce((s, a) => s + Math.abs(a) * 100000, 7919),
  ) & 0xffffffff;
  function random(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function randn(): number {
    const u1 = random();
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
  }

  let totalSims = 0;
  let prevWinProbs = new Array(n).fill(0);
  let batchesRun = 0;

  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    for (let sim = 0; sim < BATCH_SIZE; sim++) {
      const times: [number, number][] = [];
      for (let i = 0; i < n; i++) {
        times.push([-abilities[i] + randn(), i]);
      }
      times.sort((a, b) => a[0] - b[0]);
      const ranking = times.map((t) => t[1]);

      for (let pos = 0; pos < n; pos++) {
        finishCounts[ranking[pos]][pos]++;
      }
      exactaCounts[ranking[0]][ranking[1]]++;
      if (n >= 3) {
        trifectaCounts[ranking[0]][ranking[1]][ranking[2]]++;
      }
      if (n >= 4) {
        const key = `${ranking[0]},${ranking[1]},${ranking[2]},${ranking[3]}`;
        superfectaMap.set(key, (superfectaMap.get(key) ?? 0) + 1);
      }
    }
    totalSims += BATCH_SIZE;
    batchesRun++;

    // Check convergence: has the win probability distribution stabilized?
    const currWinProbs = finishCounts.map((row) => row[0] / totalSims);
    if (batch > 0) {
      const maxDelta = Math.max(
        ...currWinProbs.map((p, i) => Math.abs(p - prevWinProbs[i])),
      );
      if (maxDelta < CONVERGENCE_THRESHOLD) break; // stable — stop simulating
    }
    prevWinProbs = currWinProbs;
  }

  const nSims = totalSims;

  // --- Predictions ---
  const predictions: PredictionRow[] = entries
    .map((e, i) => ({
      name: e.name,
      program: e.program,
      mlOdds: e.mlOdds,
      style: e.style,
      winPct: (finishCounts[i][0] / nSims) * 100,
      placePct:
        ((finishCounts[i][0] + finishCounts[i][1]) / nSims) * 100,
      showPct:
        ((finishCounts[i][0] + finishCounts[i][1] + finishCounts[i][2]) /
          nSims) *
        100,
      adjustedProb: probs[i],
    }))
    .sort((a, b) => b.winPct - a.winPct);

  // --- Ranked Exactas (with pace-correlation penalty) ---
  // Speed-duel correlation: two E/EP horses in 1-2 positions tire each other
  // out — the independent model overestimates this combo's probability.
  const paceInfo = getPaceScenario(entries);
  const isSpeedDuel = paceInfo.scenario === "Speed Duel" || paceInfo.scenario === "Contested Pace";

  const exactaCombos: ExoticCombo[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || exactaCounts[i][j] === 0) continue;
      let prob = exactaCounts[i][j] / nSims;
      // Pace-correlation: if both 1st and 2nd are E/EP in a speed duel,
      // they tire each other → actual probability is lower than simulated
      if (isSpeedDuel
        && ["E", "EP"].includes(entries[i].style)
        && ["E", "EP"].includes(entries[j].style)) {
        prob *= 0.85;
      }
      exactaCombos.push({
        rank: 0,
        programs: [entries[i].program, entries[j].program],
        names: [entries[i].name, entries[j].name],
        probability: prob,
        estimatedPayoff: estimatePayoff(prob),
        unitCost: 1.0,
        aboveCutoff: false, // set below — top 5 at $1 = $5 play
      });
    }
  }
  exactaCombos.sort((a, b) => b.probability - a.probability);
  exactaCombos.forEach((c, i) => {
    c.rank = i + 1;
    c.aboveCutoff = i < 5; // top 5 × $1 = $5 play
  });
  const topExactas = exactaCombos.slice(0, 50);

  // --- Ranked Trifectas ---
  const trifectaCombos: ExoticCombo[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j || trifectaCounts[i][j][k] === 0) continue;
        const prob = trifectaCounts[i][j][k] / nSims;
        trifectaCombos.push({
          rank: 0,
          programs: [entries[i].program, entries[j].program, entries[k].program],
          names: [entries[i].name, entries[j].name, entries[k].name],
          probability: prob,
          estimatedPayoff: estimatePayoff(prob),
          unitCost: 0.5,
          aboveCutoff: false, // set below — top 5 at $0.50 = $2.50 play
        });
      }
    }
  }
  trifectaCombos.sort((a, b) => b.probability - a.probability);
  trifectaCombos.forEach((c, i) => {
    c.rank = i + 1;
    c.aboveCutoff = i < 5; // top 5 × $0.50 = $2.50 play
  });
  const topTrifectas = trifectaCombos.slice(0, 50);

  // --- Ranked Superfectas ---
  const superfectaCombos: ExoticCombo[] = [];
  for (const [key, count] of superfectaMap) {
    const [i, j, k, l] = key.split(",").map(Number);
    const prob = count / nSims;
    if (prob <= 0) continue;
    superfectaCombos.push({
      rank: 0,
      programs: [
        entries[i].program,
        entries[j].program,
        entries[k].program,
        entries[l].program,
      ],
      names: [
        entries[i].name,
        entries[j].name,
        entries[k].name,
        entries[l].name,
      ],
      probability: prob,
      estimatedPayoff: estimatePayoff(prob),
      unitCost: 0.5,
      aboveCutoff: false, // set below — top 5 at $0.50 = $2.50 play
    });
  }
  superfectaCombos.sort((a, b) => b.probability - a.probability);
  superfectaCombos.forEach((c, i) => {
    c.rank = i + 1;
    c.aboveCutoff = i < 5; // top 5 × $0.50 = $2.50 play
  });
  const topSuperfectas = superfectaCombos.slice(0, 100);

  const makeList = (
    betType: string,
    unitCost: number,
    combos: ExoticCombo[],
  ): RankedExoticList => {
    const above = combos.filter((c) => c.aboveCutoff);
    return {
      betType,
      unitCost,
      combos,
      totalAboveCutoff: above.length,
      costAboveCutoff: Math.round(above.length * unitCost * 100) / 100,
    };
  };

  // Phase 2: Overlay detection — odds enter ONLY here
  const overlays = detectOverlays(probs, entries);

  // Phase 3: EV-driven strategy selection. For each bet type, enumerate
  // candidate structures (straight / box / key) and pick highest EV.
  const strategies: BetStrategy[] = [];
  if (n >= 2) {
    strategies.push(pickBestStrategy(candidateStrategiesExacta(predictions, topExactas)));
  }
  if (n >= 3) {
    strategies.push(pickBestStrategy(candidateStrategiesTrifecta(predictions, topTrifectas)));
  }
  if (n >= 4) {
    strategies.push(pickBestStrategy(candidateStrategiesSuperfecta(predictions, topSuperfectas)));
  }

  return {
    predictions,
    exactas: makeList("Exacta", 1.0, topExactas),
    trifectas: makeList("Trifecta", 0.5, topTrifectas),
    superfectas: makeList("Superfecta", 0.5, topSuperfectas),
    paceScenario: getPaceScenario(entries),
    overlays,
    strategies,
    simInfo: {
      totalSims: nSims,
      batchesRun,
      converged: batchesRun < MAX_BATCHES,
    },
  };
}
