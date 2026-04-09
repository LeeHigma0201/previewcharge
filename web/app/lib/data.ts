import type {
  RaceInfo,
  HorseEntry,
  PredictionRow,
  ExoticCombo,
  RankedExoticList,
  PaceScenario,
  SimulationResult,
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

function paceAdjustments(entries: HorseEntry[]): number[] {
  const pace = getPaceScenario(entries);
  return entries.map((e) => {
    if (pace.scenario === "Speed Duel") {
      // Quirin (1979): front-runners win 16% in contested pace vs 35% lone speed
      if (["E", "EP"].includes(e.style)) return 0.85;
      if (["S", "C"].includes(e.style)) return 1.18;
      if (e.style === "P") return 1.08;
    } else if (pace.scenario === "Lone Speed") {
      if (["E", "EP"].includes(e.style)) {
        const otherSpeed = entries.filter(
          (x) => x.name !== e.name && ["E", "EP"].includes(x.style),
        ).length;
        if (otherSpeed === 0) return 1.30;
      }
      if (["S", "C"].includes(e.style)) return 0.85;
    } else if (pace.scenario === "Contested Pace") {
      if (["S", "C"].includes(e.style)) return 1.10;
      if (["E", "EP"].includes(e.style)) return 0.90;
    }
    return 1.0;
  });
}

function beyerTrendAdjustments(entries: HorseEntry[]): number[] {
  return entries.map((e) => {
    if (!e.last3Beyer || e.last3Beyer.length < 2) return 1.0;
    const recent = e.last3Beyer[0];
    const avg =
      e.last3Beyer.reduce((a, b) => a + b, 0) / e.last3Beyer.length;
    if (recent > avg + 3) return 1.10; // Improving form
    if (recent < avg - 3) return 0.90; // Declining form
    return 1.0;
  });
}

// Layer 5: Trainer/jockey connection strength
function connectionAdjustments(entries: HorseEntry[]): number[] {
  return entries.map((e) => {
    let adj = 1.0;
    // Hot jockey boost
    if (e.jockeyWinPct && e.jockeyWinPct > 0.20) adj *= 1.08;
    // Hot trainer boost
    if (e.trainerWinPct && e.trainerWinPct > 0.25) adj *= 1.08;
    // Distance specialist
    if (e.distanceWins && e.distanceStarts && e.distanceStarts >= 3) {
      const distPct = e.distanceWins / e.distanceStarts;
      if (distPct > 0.30) adj *= 1.10;
    }
    // Surface specialist
    if (e.surfaceWins && e.surfaceStarts && e.surfaceStarts >= 3) {
      const surfPct = e.surfaceWins / e.surfaceStarts;
      if (surfPct > 0.30) adj *= 1.08;
    }
    return adj;
  });
}

// Layer 6: Class and form cycle
function classFormAdjustments(entries: HorseEntry[]): number[] {
  return entries.map((e) => {
    let adj = 1.0;
    // Quinn (2003): class droppers show 12-18% edge
    if (e.isClassDrop) adj *= 1.15;
    // Class raise — still have base ability, don't over-penalize
    if (e.isClassRaise) adj *= 0.90;
    // Optimal rest (14-35 days)
    if (e.daysSinceLast) {
      if (e.daysSinceLast >= 14 && e.daysSinceLast <= 35) adj *= 1.05;
      if (e.daysSinceLast > 60) adj *= 0.92; // Layoff penalty
      if (e.daysSinceLast < 7) adj *= 0.90; // Too quick turnaround
    }
    // Equipment change (first-time blinkers is positive)
    if (e.equipmentChange) adj *= 1.05;
    return adj;
  });
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
  speed: 0.35,
  pace: 0.20,
  class: 0.15,
  form: 0.15,
  connections: 0.10,
  post: 0.05,
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
function speedScores(entries: HorseEntry[]): number[] {
  const avgs = entries.map((e) => {
    if (e.last3Beyer && e.last3Beyer.length > 0) {
      return e.last3Beyer.reduce((a, b) => a + b, 0) / e.last3Beyer.length;
    }
    // No Beyer data: use 0 (field average after z-scoring)
    return 0;
  });
  // If ALL horses lack data, return zeros (no signal)
  if (avgs.every((a) => a === 0)) return entries.map(() => 0);
  return zScore(avgs);
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
    // Rest pattern
    if (e.daysSinceLast) {
      if (e.daysSinceLast >= 14 && e.daysSinceLast <= 35) score += 0.3;
      if (e.daysSinceLast > 60) score -= 0.5;
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
function postScores(entries: HorseEntry[]): number[] {
  const n = entries.length;
  return entries.map((e) => {
    // Inside posts (1-3) have slight advantage in dirt sprints
    // Outside posts in large fields (10+) have disadvantage
    const pp = e.pp;
    if (pp <= 3) return 0.3;
    if (pp <= 6) return 0;
    if (n >= 10 && pp >= n - 1) return -0.4;
    return -0.1;
  });
}

// COMPOSITE: Weighted ability score → probability
function computeAbilityProbs(entries: HorseEntry[]): number[] {
  const speed = speedScores(entries);
  const pace = paceScores(entries);
  const cls = classScores(entries);
  const form = formScores(entries);
  const conn = connectionScores(entries);
  const post = postScores(entries);

  // Weighted composite ability score
  const abilities = entries.map((_, i) =>
    WEIGHTS.speed * speed[i] +
    WEIGHTS.pace * pace[i] +
    WEIGHTS.class * cls[i] +
    WEIGHTS.form * form[i] +
    WEIGHTS.connections * conn[i] +
    WEIGHTS.post * post[i],
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
      isOverlay: overlay > 1.20,  // model says 20%+ more likely than market
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

export function runSimulation(
  entries: HorseEntry[],
): SimulationResult {
  const n = entries.length;

  // ---------------------------------------------------------------
  // PHASE 1: Compute ability-based probabilities (no odds)
  // ---------------------------------------------------------------
  const probs = computeAbilityProbs(entries);
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

  // Clamp between 10K and 300K — never waste compute, never starve accuracy
  const BATCH_SIZE = Math.min(Math.max(Math.ceil(minSims / 3), 10000), 50000);
  const MAX_BATCHES = Math.min(Math.ceil(minSims / BATCH_SIZE) + 2, 8);
  const CONVERGENCE_THRESHOLD = 0.003; // 0.3% change between batches = converged

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
        unitCost: 2.0,
        aboveCutoff: prob >= 0.01,
      });
    }
  }
  exactaCombos.sort((a, b) => b.probability - a.probability);
  exactaCombos.forEach((c, i) => (c.rank = i + 1));
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
          unitCost: 1.0,
          aboveCutoff: prob >= 0.003,
        });
      }
    }
  }
  trifectaCombos.sort((a, b) => b.probability - a.probability);
  trifectaCombos.forEach((c, i) => (c.rank = i + 1));
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
      unitCost: 0.1,
      aboveCutoff: prob >= 0.001,
    });
  }
  superfectaCombos.sort((a, b) => b.probability - a.probability);
  superfectaCombos.forEach((c, i) => (c.rank = i + 1));
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

  return {
    predictions,
    exactas: makeList("Exacta", 2.0, topExactas),
    trifectas: makeList("Trifecta", 1.0, topTrifectas),
    superfectas: makeList("Superfecta", 0.1, topSuperfectas),
    paceScenario: getPaceScenario(entries),
    overlays,
    simInfo: {
      totalSims: nSims,
      batchesRun,
      converged: batchesRun < MAX_BATCHES,
    },
  };
}
