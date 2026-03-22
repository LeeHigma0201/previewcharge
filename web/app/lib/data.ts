import type {
  RaceInfo,
  HorseEntry,
  PredictionRow,
  ExactaRow,
  TrifectaRow,
  PaceScenario,
} from "./types";

// Sample race from conftest.py — Saratoga R5, ALW, 6f Dirt
export const sampleRace: RaceInfo = {
  track: "SAR",
  date: "2023-08-15",
  raceNumber: 5,
  distance: "6f (1320y)",
  surface: "Dirt",
  raceType: "ALW",
  purse: 100000,
  condition: "Fast",
  entries: [
    { pp: 1, program: "1", name: "Speed Demon", jockey: "I. Ortiz Jr.", trainer: "C. Brown", mlOdds: 3.0, style: "E", speed: 90, e1Pace: 95, latePace: 85 },
    { pp: 2, program: "2", name: "Stalker Sam", jockey: "J. Rosario", trainer: "T. Pletcher", mlOdds: 5.0, style: "P", speed: 85, e1Pace: 80, latePace: 90 },
    { pp: 3, program: "3", name: "Closer Carl", jockey: "L. Saez", trainer: "B. Cox", mlOdds: 8.0, style: "C", speed: 88, e1Pace: 75, latePace: 95 },
    { pp: 4, program: "4", name: "Early Bird", jockey: "J. Castellano", trainer: "W. Mott", mlOdds: 4.0, style: "EP", speed: 87, e1Pace: 92, latePace: 83 },
    { pp: 5, program: "5", name: "Pace Setter", jockey: "M. Franco", trainer: "S. Asmussen", mlOdds: 6.0, style: "E", speed: 82, e1Pace: 93, latePace: 78 },
    { pp: 6, program: "6", name: "Mid Pack", jockey: "T. Gaffalione", trainer: "M. Maker", mlOdds: 10.0, style: "P", speed: 80, e1Pace: 82, latePace: 82 },
    { pp: 7, program: "7", name: "Long Shot", jockey: "D. Davis", trainer: "L. Rice", mlOdds: 20.0, style: "S", speed: 78, e1Pace: 78, latePace: 88 },
    { pp: 8, program: "8", name: "Dark Horse", jockey: "J. Alvarado", trainer: "R. Dutrow", mlOdds: 15.0, style: "C", speed: 83, e1Pace: 72, latePace: 92 },
  ],
};

// Henery normal model simulation (pre-computed for the sample race)
// Uses probit transform as implemented in our monte_carlo.py
function probit(p: number): number {
  // Rational approximation of inverse normal CDF
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

function simulateHenery(
  entries: HorseEntry[],
  nSims: number = 100000
): {
  predictions: PredictionRow[];
  exactas: ExactaRow[];
  trifectas: TrifectaRow[];
} {
  const n = entries.length;

  // Convert ML odds to implied probabilities, then normalize
  let probs = entries.map((e) => 1.0 / (e.mlOdds + 1.0));
  const total = probs.reduce((a, b) => a + b, 0);
  probs = probs.map((p) => Math.max(p / total, 1e-6));

  // Probit transform for abilities
  const abilities = probs.map((p) => probit(p));

  // Simulate
  const finishCounts = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0)
  );
  const exactaCounts = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => 0)
  );
  const trifectaCounts = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => Array.from({ length: n }, () => 0))
  );

  // Seeded pseudo-random (mulberry32)
  let seed = 42;
  function random(): number {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Box-Muller
  function randn(): number {
    const u1 = random();
    const u2 = random();
    return Math.sqrt(-2 * Math.log(u1 + 1e-15)) * Math.cos(2 * Math.PI * u2);
  }

  for (let sim = 0; sim < nSims; sim++) {
    // Generate finishing times
    const times: [number, number][] = [];
    for (let i = 0; i < n; i++) {
      times.push([-abilities[i] + randn(), i]);
    }
    // Sort by time (lower = better)
    times.sort((a, b) => a[0] - b[0]);

    const ranking = times.map((t) => t[1]);
    for (let pos = 0; pos < n; pos++) {
      finishCounts[ranking[pos]][pos]++;
    }
    exactaCounts[ranking[0]][ranking[1]]++;
    trifectaCounts[ranking[0]][ranking[1]][ranking[2]]++;
  }

  const predictions: PredictionRow[] = entries.map((e, i) => ({
    name: e.name,
    mlOdds: e.mlOdds,
    style: e.style,
    winPct: (finishCounts[i][0] / nSims) * 100,
    placePct:
      ((finishCounts[i][0] + finishCounts[i][1]) / nSims) * 100,
    showPct:
      ((finishCounts[i][0] + finishCounts[i][1] + finishCounts[i][2]) / nSims) *
      100,
  }));

  // Top exactas
  const exactaList: ExactaRow[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i !== j && exactaCounts[i][j] > 0) {
        exactaList.push({
          first: entries[i].name,
          second: entries[j].name,
          prob: (exactaCounts[i][j] / nSims) * 100,
        });
      }
    }
  }
  exactaList.sort((a, b) => b.prob - a.prob);

  // Top trifectas
  const trifectaList: TrifectaRow[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      for (let k = 0; k < n; k++) {
        if (k === i || k === j) continue;
        if (trifectaCounts[i][j][k] > 0) {
          trifectaList.push({
            first: entries[i].name,
            second: entries[j].name,
            third: entries[k].name,
            prob: (trifectaCounts[i][j][k] / nSims) * 100,
          });
        }
      }
    }
  }
  trifectaList.sort((a, b) => b.prob - a.prob);

  return {
    predictions: predictions.sort((a, b) => b.winPct - a.winPct),
    exactas: exactaList.slice(0, 10),
    trifectas: trifectaList.slice(0, 10),
  };
}

export function getPaceScenario(entries: HorseEntry[]): PaceScenario {
  const earlyCount = entries.filter((e) =>
    ["E", "EP"].includes(e.style)
  ).length;
  const presserCount = entries.filter((e) =>
    ["P"].includes(e.style)
  ).length;
  const closerCount = entries.filter((e) =>
    ["S", "C"].includes(e.style)
  ).length;

  let scenario: string;
  let description: string;
  if (earlyCount >= 3) {
    scenario = "Speed Duel";
    description =
      "3+ early speed types will contest the early pace. Expect a hot pace that benefits closers and stalkers. Speed horses likely to tire.";
  } else if (earlyCount === 2) {
    scenario = "Contested Pace";
    description =
      "Two speed types will push each other early. Moderate pace advantage for closers, but not a meltdown scenario.";
  } else if (earlyCount === 1) {
    scenario = "Lone Speed";
    description =
      "Single early speed horse can control the pace unchallenged. Historically wins at ~35%. Strong advantage for the speed horse.";
  } else {
    scenario = "No Speed";
    description =
      "No committed early speed. Race likely to develop slowly with a sprint finish. Tactical speed from stalkers will be key.";
  }

  return { scenario, earlyCount, presserCount, closerCount, description };
}

export function getSimulationResults(entries: HorseEntry[]) {
  return simulateHenery(entries, 100000);
}
