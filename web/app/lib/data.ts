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
      if (["E", "EP"].includes(e.style)) return 0.80;
      if (["S", "C"].includes(e.style)) return 1.25;
      if (e.style === "P") return 1.10;
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
    // Class drop = significant advantage
    if (e.isClassDrop) adj *= 1.15;
    // Class raise = disadvantage
    if (e.isClassRaise) adj *= 0.85;
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

// ---------------------------------------------------------------------------
// Adjusted probabilities — combines ML odds + pace + form signals
// ---------------------------------------------------------------------------

function computeAdjustedProbs(entries: HorseEntry[]): number[] {
  // Base: morning line implied
  let probs = entries.map((e) => 1.0 / (e.mlOdds + 1.0));
  const baseTotal = probs.reduce((a, b) => a + b, 0);
  probs = probs.map((p) => p / baseTotal);

  // Layer 3: Pace scenario adjustments
  const paceAdj = paceAdjustments(entries);
  probs = probs.map((p, i) => p * paceAdj[i]);

  // Layer 4: Beyer speed figure trend
  const beyerAdj = beyerTrendAdjustments(entries);
  probs = probs.map((p, i) => p * beyerAdj[i]);

  // Layer 5: Trainer/jockey connection strength
  const connAdj = connectionAdjustments(entries);
  probs = probs.map((p, i) => p * connAdj[i]);

  // Layer 6: Class drop/raise + form cycle
  const classAdj = classFormAdjustments(entries);
  probs = probs.map((p, i) => p * classAdj[i]);

  // Re-normalize
  const total = probs.reduce((a, b) => a + b, 0);
  probs = probs.map((p) => Math.max(p / total, 1e-6));

  return probs;
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
  nSims: number = 100000,
): SimulationResult {
  const n = entries.length;
  const probs = computeAdjustedProbs(entries);
  const abilities = probs.map((p) => probit(p));

  // Counts
  const finishCounts: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );
  const exactaCounts: number[][] = Array.from({ length: n }, () =>
    new Array(n).fill(0),
  );
  const trifectaCounts: number[][][] = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Array(n).fill(0)),
  );
  // Superfecta — only track top combos to avoid memory explosion
  const superfectaMap = new Map<string, number>();

  // Seeded PRNG (mulberry32)
  let seed = Date.now() & 0xffffffff;
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

  for (let sim = 0; sim < nSims; sim++) {
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

  // --- Ranked Exactas ---
  const exactaCombos: ExoticCombo[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j || exactaCounts[i][j] === 0) continue;
      const prob = exactaCounts[i][j] / nSims;
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

  return {
    predictions,
    exactas: makeList("Exacta", 2.0, topExactas),
    trifectas: makeList("Trifecta", 1.0, topTrifectas),
    superfectas: makeList("Superfecta", 0.1, topSuperfectas),
    paceScenario: getPaceScenario(entries),
  };
}
