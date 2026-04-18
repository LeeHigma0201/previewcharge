import type {
  RaceInfo,
  HorseEntry,
  PredictionRow,
  ExoticCombo,
  RankedExoticList,
  PaceScenario,
  SimulationResult,
  TicketSpec,
} from "./types";
import type { KeeneHorse, KeeneRace } from "./keeneland-apr18";

// Convert Brisnet Ultimate PP data → HorseEntry (model input).
// Scratches are filtered out. Prime Power is the primary speed signal.
export function keeneHorseToEntry(h: KeeneHorse): HorseEntry {
  return {
    pp: h.post,
    program: h.program,
    name: h.name,
    jockey: h.jockey,
    trainer: h.trainer,
    mlOdds: h.mlOdds,
    style: h.style === "?" ? "P" : h.style,
    // Use Prime Power as the primary speed input since it's a Brisnet
    // composite (speed + pace + class + pedigree in one number).
    speed: h.primePower,
    e1Pace: h.paceE1 ?? 0,
    latePace: h.paceLate ?? 0,
    // Last 3 speed figures for form-cycle trend
    last3Beyer: h.last3Speeds?.length ? h.last3Speeds : undefined,
    wins: h.wins,
    starts: h.starts,
    jockeyWinPct: h.jockeyWinPct,
    trainerWinPct: h.trainerWinPct,
    daysSinceLast: h.daysSinceLast,
    lastFinishPosition: h.lastFinishPosition,
    weight: h.weight,
    // Class drop: horse has higher avg class than today's class rating
    isClassDrop: Boolean(h.classLast3 && h.classRating && h.classLast3 > h.classRating + 2),
    isClassRaise: Boolean(h.classLast3 && h.classRating && h.classLast3 < h.classRating - 2),
  };
}

// Given a KeeneRace, build a RaceInfo the simulation can consume.
export function keeneRaceToRaceInfo(r: KeeneRace): RaceInfo {
  const entries = r.horses
    .filter((h) => !h.scratched)
    .map(keeneHorseToEntry);
  return {
    track: "KEE",
    trackName: "Keeneland",
    date: "2026-04-18",
    raceNumber: r.raceNumber,
    distance: r.distance,
    surface: r.surface,
    raceType: r.raceType,
    purse: r.purse,
    condition: "fast",  // Keeneland default unless wet
    entries,
  };
}

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
// Pace Pressure Score (PPS) — continuous 0-100 score from Exotic Bet Algo §3.1
//
// Traditional handicapping uses discrete labels ("E", "EP", "P", "S"). That's
// mathematically imprecise. This function analyzes E1 velocity (early pace
// figures) to produce a continuous Pace Pressure Score.
//
// PPS > 80  → Pace Meltdown — extreme early friction; closers get boost
// PPS 40-60 → Honest pace — runs to baseline ability
// PPS < 30  → Lone Speed — uncontested front; speed horse gets massive boost
// ---------------------------------------------------------------------------

function computePPS(entries: HorseEntry[]): number {
  // Count horses with early intent AND decent E1 pace figures
  const earlyHorses = entries.filter((e) => ["E", "EP"].includes(e.style));
  const eCount = entries.filter((e) => e.style === "E").length;
  const epCount = entries.filter((e) => e.style === "EP").length;

  // Base: each E is 25 pts, each EP is 15 pts of pressure
  let pps = eCount * 25 + epCount * 15;

  // Adjust by E1 pace strength: if the early horses have similar E1 figures,
  // they'll actually duel. If one has 105 vs others at 85, it's lone speed.
  if (earlyHorses.length >= 2) {
    const e1s = earlyHorses
      .map((e) => e.e1Pace || 0)
      .filter((v) => v > 0)
      .sort((a, b) => b - a);
    if (e1s.length >= 2) {
      const topGap = e1s[0] - e1s[1];
      if (topGap >= 15) pps -= 30;       // dominant lone speed even with multiple Es
      else if (topGap >= 8) pps -= 10;   // slight edge, some pressure relief
      // tight gap → pressure stays high
    }
  }

  // Sprint distances (≤7f) amplify pace friction
  // Route distances (≥1 1/16m) dilute it (more time to recover)
  // We can't access race from here, so we approximate with field size:
  // denser fields create more friction.
  if (entries.length >= 10) pps += 5;
  if (entries.length <= 6) pps -= 5;

  return Math.max(0, Math.min(100, pps));
}

export function getPaceScenario(entries: HorseEntry[]): PaceScenario {
  const earlyCount = entries.filter((e) =>
    ["E", "EP"].includes(e.style),
  ).length;
  const presserCount = entries.filter((e) => e.style === "P").length;
  const closerCount = entries.filter((e) =>
    ["S", "C"].includes(e.style),
  ).length;

  const pps = computePPS(entries);

  let scenario: string;
  let description: string;
  if (pps > 80) {
    scenario = "Pace Meltdown";
    description =
      `PPS ${pps}. Extreme early friction expected. Closers/stalkers favored, speed penalized.`;
  } else if (pps >= 60) {
    scenario = "Speed Duel";
    description =
      `PPS ${pps}. Multiple speed types contest the lead. Hot pace benefits late runners.`;
  } else if (pps >= 40) {
    scenario = "Honest Pace";
    description =
      `PPS ${pps}. Fair tempo. Horses run to baseline ability — no pace-based edge.`;
  } else if (pps >= 20) {
    scenario = "Soft Pace";
    description =
      `PPS ${pps}. Moderate early pressure. Tactical speed and stalkers advantaged.`;
  } else {
    scenario = "Lone Speed";
    description =
      `PPS ${pps}. Uncontested front. Primary speed horse gets major boost (+40% historically).`;
  }

  return { scenario, earlyCount, presserCount, closerCount, description, pps };
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
  speed: 0.30,
  pace: 0.20,
  class: 0.15,
  form: 0.15,
  connections: 0.10,
  post: 0.05,
  trackBias: 0.05, // KEE surface/condition effect (0 for non-KEE)
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

// Score 2: PACE FIT — running style × continuous Pace Pressure Score (PPS)
// Uses Exotic Bet Algorithm §3.1 thresholds:
//   PPS > 80 → Pace Meltdown: E/EP −0.9, S/C +0.9
//   PPS < 30 → Lone Speed: E/EP +1.2 (if truly alone), S/C −0.7
//   Continuous interpolation in between.
function paceScores(entries: HorseEntry[]): number[] {
  const pps = computePPS(entries);
  return entries.map((e) => {
    const style = e.style || "P";

    // Normalize PPS to a pressure coefficient: 0 at PPS=50 (neutral),
    // +1 at PPS=100 (meltdown), -1 at PPS=0 (lone speed).
    const pressure = (pps - 50) / 50;

    if (style === "E" || style === "EP") {
      // High pressure hurts early horses. Very low pressure helps them.
      // But lone-speed bonus requires genuine isolation.
      if (pressure < -0.4) {
        const otherSpeed = entries.filter(
          (x) => x.name !== e.name && ["E", "EP"].includes(x.style || "P"),
        ).length;
        if (otherSpeed === 0) return 1.2;       // genuine lone speed
        if (otherSpeed === 1 && pressure < -0.5) return 0.6;
      }
      return -pressure * 0.9;  // 0 at neutral, -0.9 at meltdown
    }

    if (style === "S" || style === "C") {
      // Closers benefit from high pressure, suffer in lone-speed scenarios.
      return pressure * 0.9;
    }

    if (style === "P") {
      // Stalkers/pressers — the sweet spot. Positive in meltdowns,
      // still OK in honest pace, slightly negative in pure lone speed.
      return pressure * 0.4 + 0.1;
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

  const isDirt = !race.surface || race.surface.toLowerCase().includes("dirt");
  const condition = (race.condition || "").toLowerCase();
  const isWet = ["muddy", "sloppy", "good", "yielding", "soft"].some((c) => condition.includes(c));

  return entries.map((e) => {
    if (!isDirt) return 0;

    const style = e.style || "P";

    // These scores are on the same scale as paceScores, but capture
    // the TRACK-SPECIFIC surface effect, not the field pace dynamic.
    // paceScores measures "lone speed vs speed duel" (field composition).
    // This measures "does KEE dirt help speed horses hold?" (track surface).
    if (isWet) {
      // KEE wet dirt: surface becomes deeper, tiring for front-runners
      if (["S", "C"].includes(style)) return 0.6;
      if (["E", "EP"].includes(style)) return -0.5;
    } else {
      // KEE fast dirt: firm surface helps speed maintain
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
// PHASE 2: EV EDGE + A/B/C TIERING — odds enter ONLY here
//
// THIS IS THE ONLY PLACE ODDS TOUCH THE MODEL.
//
// The ability model (Phase 1) produces a raw win probability from data alone.
// Phase 2 compares that to the market's implied probability (from ML odds)
// and calculates the Expected Value edge:
//
//   EV = (P_model / P_market) × (1 - takeout)
//
// EV > 1.0 means positive expected value — the model sees more win equity
// than the public does. These are the horses to anchor exotic tickets on.
//
// Tier assignment (Exotic Bet Algorithm §10; relaxed per session 2026-04-18):
//   A (Primary Anchor)    — winPct ≥ 22% OR (ratio ≥ 1.15 AND winPct ≥ 8%)
//   B (Defensive)         — winPct ≥ 5% AND ratio ≥ 0.85 (fair-priced contender)
//   C (Variance Longshot) — ratio ≥ 1.15 AND 3% ≤ winPct ≤ 12% AND marketProb < 0.12
//   Exclude               — ratio < 0.80 AND marketProb > 0.15 (false favorite) OR winPct < 2%
// ===========================================================================

const TAKEOUT_EXOTIC = 0.22;  // typical exotic takeout (~18-24%)

interface OverlayInfo {
  modelProb: number;
  marketProb: number;
  overlay: number;      // ratio: model/market
  isOverlay: boolean;   // EV > 1.10 (not just >1.0 — MLs are noisy)
  overlayPct: number;   // percentage above market
  evEdge: number;       // (model/market) × (1 - takeout)
  tier: "A" | "B" | "C" | "exclude";
  tierReason: string;
}

function classifyTier(
  modelProb: number,
  marketProb: number,
  winPct: number,
): { tier: "A" | "B" | "C" | "exclude"; reason: string; evEdge: number } {
  const ratio = modelProb / (marketProb + 1e-10);
  const evEdge = ratio * (1 - TAKEOUT_EXOTIC);

  // A-tier: primary anchor
  // PDF doctrine: A-tier = highest +EV OR overwhelming baseline win probability (OR, not AND).
  // In large fields (14+ horses) the best horse may only hit 8-10% win prob,
  // so we scale the floor with field size.
  if (winPct >= 22) {
    return { tier: "A", reason: `Dominant ability (${winPct.toFixed(0)}% win prob)`, evEdge };
  }
  if (ratio >= 1.15 && winPct >= 8) {
    return { tier: "A", reason: `+EV anchor (model ${(modelProb*100).toFixed(0)}% vs market ${(marketProb*100).toFixed(0)}%, edge ${((ratio-1)*100).toFixed(0)}%)`, evEdge };
  }
  // Large-field catch: 12+ horse races with strong edge but low abs win prob.
  // Capturing (10.6% / 8-1 ML → ratio 1.1) in a 16-horse field deserves A-tier respect.
  if (ratio >= 1.30 && winPct >= 6) {
    return { tier: "A", reason: `Big-field +EV (model ${(modelProb*100).toFixed(0)}% vs market ${(marketProb*100).toFixed(0)}%, edge ${((ratio-1)*100).toFixed(0)}%)`, evEdge };
  }

  // Exclude: severely overbet favorites
  if (ratio < 0.80 && marketProb > 0.15) {
    return { tier: "exclude", reason: `False favorite — market ${(marketProb*100).toFixed(0)}% but model only ${(modelProb*100).toFixed(0)}%`, evEdge };
  }
  if (winPct < 2) {
    return { tier: "exclude", reason: `No chance (${winPct.toFixed(1)}% win prob)`, evEdge };
  }

  // C-tier: variance longshot with value
  if (ratio >= 1.15 && winPct >= 3 && winPct <= 12 && marketProb < 0.12) {
    return { tier: "C", reason: `Longshot overlay (${(winPct).toFixed(0)}% model vs ${(marketProb*100).toFixed(0)}% market)`, evEdge };
  }

  // B-tier: fair-priced contender
  if (winPct >= 5 && ratio >= 0.85) {
    return { tier: "B", reason: `Defensive coverage (${winPct.toFixed(0)}% win prob, fair price)`, evEdge };
  }

  // Everything else — low-probability, unclear value
  return { tier: "exclude", reason: `Below playable threshold`, evEdge };
}

function detectOverlays(
  modelProbs: number[],
  entries: HorseEntry[],
  winPcts: number[],
): OverlayInfo[] {
  return entries.map((e, i) => {
    const marketProb = 1.0 / (e.mlOdds + 1.0);
    const overlay = modelProbs[i] / (marketProb + 1e-10);
    const { tier, reason, evEdge } = classifyTier(modelProbs[i], marketProb, winPcts[i]);
    return {
      modelProb: modelProbs[i],
      marketProb,
      overlay,
      isOverlay: overlay > 1.10,
      overlayPct: Math.round((overlay - 1) * 100),
      evEdge,
      tier,
      tierReason: reason,
    };
  });
}

// ===========================================================================
// PHASE 3: TICKET CONSTRUCTION — build staggered A/B/C exotic tickets
// From Exotic Bet Algorithm §10.2.
// ===========================================================================

// ===========================================================================
// TICKET MATH — hit probability + payoff estimation for any bet structure
//
// For a ticket covering a SET of winning combos:
//   hitProbability = sum over covered combos of (combo count / total sims)
//   expectedPayoff ≈ (1 / avgIndividualComboProb) × (1 - takeout)
//   EV = hitProb × totalPayoffIfHit - totalCost
//
// Takeout varies by bet type — exotic pools are typically 18-25%.
// ===========================================================================

const TAKEOUT = {
  exacta: 0.20,      // most tracks 20-22%
  trifecta: 0.22,    // 22-24% typical
  superfecta: 0.24,  // 24-25% typical, sometimes higher
};

// Calculate hit probability for an EXACTA covering programs (winProgs × placeProgs).
// Uses the Monte Carlo exactaCounts[i][j] matrix.
function exactaHitProb(
  winProgs: number[], placeProgs: number[],
  exactaCounts: number[][], nSims: number,
): { prob: number; combos: number } {
  let count = 0;
  let combos = 0;
  for (const i of winProgs) {
    for (const j of placeProgs) {
      if (i === j) continue;
      combos++;
      count += exactaCounts[i]?.[j] ?? 0;
    }
  }
  return { prob: count / nSims, combos };
}

function trifectaHitProb(
  winProgs: number[], placeProgs: number[], showProgs: number[],
  trifectaCounts: number[][][], nSims: number,
): { prob: number; combos: number } {
  let count = 0;
  let combos = 0;
  for (const i of winProgs) {
    for (const j of placeProgs) {
      if (i === j) continue;
      for (const k of showProgs) {
        if (k === i || k === j) continue;
        combos++;
        count += trifectaCounts[i]?.[j]?.[k] ?? 0;
      }
    }
  }
  return { prob: count / nSims, combos };
}

function superfectaHitProb(
  winProgs: number[], placeProgs: number[], showProgs: number[], fourthProgs: number[],
  superfectaMap: Map<string, number>, nSims: number,
): { prob: number; combos: number } {
  let count = 0;
  let combos = 0;
  for (const i of winProgs) {
    for (const j of placeProgs) {
      if (i === j) continue;
      for (const k of showProgs) {
        if (k === i || k === j) continue;
        for (const l of fourthProgs) {
          if (l === i || l === j || l === k) continue;
          combos++;
          count += superfectaMap.get(`${i},${j},${k},${l}`) ?? 0;
        }
      }
    }
  }
  return { prob: count / nSims, combos };
}

// Parimutuel EV math:
//   Payout per $1 ticket = (1 - takeout) / marketHitProb
//   (the track takes its cut, remainder is split proportionally to bets on winning combo)
//   EV per $1 = modelHitProb × payoff - 1 = (modelHitProb / marketHitProb) × (1 - takeout) - 1
//
// So EV is POSITIVE when modelHitProb / marketHitProb > 1 / (1 - takeout) ≈ 1.28 for exacta.
// This is why you need a real edge — the takeout means a "fair" bet always has EV = -takeout.
function computeTicketEV(
  modelHitProb: number,
  marketHitProb: number,
  combos: number,
  unitCost: number,
  pool: keyof typeof TAKEOUT,
): { totalCost: number; payoff: number; ev: number; breakeven: number } {
  const totalCost = combos * unitCost;
  if (modelHitProb <= 0 || marketHitProb <= 0) {
    return { totalCost, payoff: 0, ev: -totalCost, breakeven: 1 };
  }
  // Payout per $1 bet if ticket hits (parimutuel formula)
  const payoffPerDollar = (1 - TAKEOUT[pool]) / marketHitProb;
  const payoff = payoffPerDollar * totalCost;  // total dollar return if hits
  const ev = modelHitProb * payoff - totalCost;
  // Breakeven model hit prob = cost / (expected payoff if hit × ways_to_win)
  const breakeven = 1 / payoffPerDollar;  // model hit prob needed for EV = 0
  return { totalCost, payoff, ev, breakeven };
}

// Harville-style market hit probability: assume market's implied probs are the truth
// and compute joint probabilities as conditional products.
// For the exacta A-B: p_market(A wins AND B 2nd) = p_A × p_B / (1 - p_A)
function marketExactaProb(iA: number, iB: number, marketProbs: number[]): number {
  const pA = marketProbs[iA], pB = marketProbs[iB];
  if (pA <= 0 || 1 - pA <= 0) return 0;
  return pA * (pB / (1 - pA));
}

// Floor denominators at 0.05 to prevent Harville explosion in chalk-heavy fields.
// Without this floor, when pA + pB approaches 1.0 (two favorites = 90% of market),
// pC / (1 - pA - pB) can blow up 20-100x, inflating marketHitProb and crushing EV.
// The floor trades a tiny approximation error for stability.
const HARVILLE_FLOOR = 0.05;

function marketTrifectaProb(iA: number, iB: number, iC: number, marketProbs: number[]): number {
  const pA = marketProbs[iA], pB = marketProbs[iB], pC = marketProbs[iC];
  if (pA <= 0 || pB <= 0 || pC <= 0) return 0;
  const d1 = Math.max(1 - pA, HARVILLE_FLOOR);
  const d2 = Math.max(1 - pA - pB, HARVILLE_FLOOR);
  return pA * (pB / d1) * (pC / d2);
}

function marketSuperfectaProb(iA: number, iB: number, iC: number, iD: number, marketProbs: number[]): number {
  const pA = marketProbs[iA], pB = marketProbs[iB], pC = marketProbs[iC], pD = marketProbs[iD];
  if (pA <= 0 || pB <= 0 || pC <= 0 || pD <= 0) return 0;
  const d1 = Math.max(1 - pA, HARVILLE_FLOOR);
  const d2 = Math.max(1 - pA - pB, HARVILLE_FLOOR);
  const d3 = Math.max(1 - pA - pB - pC, HARVILLE_FLOOR);
  return pA * (pB / d1) * (pC / d2) * (pD / d3);
}

// Aggregate market hit prob over all combos in a ticket
function aggregateMarketProb(
  winProgs: number[], placeProgs: number[], marketProbs: number[],
  showProgs?: number[], fourthProgs?: number[],
): number {
  let total = 0;
  for (const i of winProgs) for (const j of placeProgs) {
    if (i === j) continue;
    if (showProgs) {
      for (const k of showProgs) {
        if (k === i || k === j) continue;
        if (fourthProgs) {
          for (const l of fourthProgs) {
            if (l === i || l === j || l === k) continue;
            total += marketSuperfectaProb(i, j, k, l, marketProbs);
          }
        } else {
          total += marketTrifectaProb(i, j, k, marketProbs);
        }
      }
    } else {
      total += marketExactaProb(i, j, marketProbs);
    }
  }
  return total;
}

function buildStrategicTickets(
  predictions: PredictionRow[],
  entries: HorseEntry[],
  exactaCounts: number[][],
  trifectaCounts: number[][][],
  superfectaMap: Map<string, number>,
  nSims: number,
): TicketSpec[] {
  const tickets: TicketSpec[] = [];
  if (predictions.length < 2) return tickets;

  // Map program string → entry index (for looking up in count matrices)
  const idxByProgram = new Map<string, number>();
  entries.forEach((e, i) => idxByProgram.set(e.program, i));
  const toIdx = (progs: string[]) => progs.map((p) => idxByProgram.get(p) ?? -1).filter((i) => i >= 0);

  // Market-implied probabilities, normalized to sum to 1 (track takeout already in pool).
  // These are used to compute parimutuel payouts via Harville conditional formula.
  const rawMarket = entries.map((e) => 1.0 / (e.mlOdds + 1.0));
  const marketSum = rawMarket.reduce((a, b) => a + b, 0);
  const marketProbs = rawMarket.map((p) => p / marketSum);

  // Helper: given the args that went into hitProb, also compute market hit prob
  // and run EV math. Returns all fields needed for a TicketSpec.
  const evFor = (
    pool: keyof typeof TAKEOUT,
    unitCost: number,
    prob: number,
    combos: number,
    winProgs: number[], placeProgs: number[],
    showProgs?: number[], fourthProgs?: number[],
  ) => {
    const marketProb = aggregateMarketProb(winProgs, placeProgs, marketProbs, showProgs, fourthProgs);
    return computeTicketEV(prob, marketProb, combos, unitCost, pool);
  };

  // Work across ALL predictions so we catch A-tier overlays that rank lower
  // by ability (common when public favorites dominate the top).
  const aTier = predictions.filter((p) => p.tier === "A");
  const bTier = predictions.filter((p) => p.tier === "B");
  const cTier = predictions.filter((p) => p.tier === "C");

  // Contenders = anyone not excluded, ordered by ability (already sorted)
  const contenders = predictions.filter((p) => p.tier !== "exclude");
  if (contenders.length === 0) return tickets;

  // TWO DIFFERENT ANCHORS for two different betting mindsets:
  //   primaryAnchor  = A-tier horse with HIGHEST win probability (most likely to actually win)
  //   varianceAnchor = A-tier horse with HIGHEST evEdge (biggest mathematical overlay, usually longshot)
  // If these are the same horse, great. If different, we build one ticket each way.
  const aByWin = [...aTier].sort((a, b) => b.winPct - a.winPct);
  const aByEdge = [...aTier].sort((a, b) => b.evEdge - a.evEdge);
  const primaryAnchor = aByWin[0] ?? contenders[0];
  const varianceAnchor = aByEdge[0] && aByEdge[0].program !== primaryAnchor.program
    ? aByEdge[0]
    : null;
  const anchorIdx = idxByProgram.get(primaryAnchor.program)!;

  // STRAIGHT bets key the primary anchor over the next best contender
  // (NOT the top-ability horse if that horse is excluded as a false favorite).
  const straightSecond = contenders.find((p) => p.program !== primaryAnchor.program);
  const top3 = contenders.slice(0, 3);
  const top3Idxs = top3.map((p) => idxByProgram.get(p.program)!);

  // ========= EXACTAS =========
  // 1. STRAIGHT Exacta — primary anchor / next best contender in exact order
  if (straightSecond) {
    const i1 = idxByProgram.get(primaryAnchor.program)!;
    const i2 = idxByProgram.get(straightSecond.program)!;
    const { prob, combos } = exactaHitProb([i1], [i2], exactaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("exacta", 2.00, prob, combos, [i1], [i2]);
    tickets.push({
      label: `Exacta STRAIGHT: #${primaryAnchor.program} / #${straightSecond.program}`,
      pool: "exacta",
      structure: "straight",
      legs: [[primaryAnchor.program], [straightSecond.program]],
      combinations: combos,
      unitCost: 2.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Primary anchor over next best contender. Max conviction, lowest cost — only hits if finish order is exact.`,
      risk: "aggressive",
    });
  }

  // 2. KEY Exacta — anchor wins, top 3 others for 2nd (part-wheel)
  if (contenders.length >= 3) {
    const placeProgs = contenders.filter((p) => p.program !== primaryAnchor.program).slice(0, 3);
    const placeIdxs = placeProgs.map((p) => idxByProgram.get(p.program)!);
    const { prob, combos } = exactaHitProb([anchorIdx], placeIdxs, exactaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("exacta", 2.00, prob, combos, [anchorIdx], placeIdxs);
    tickets.push({
      label: `Exacta KEY: #${primaryAnchor.program} over #${placeProgs.map((p) => p.program).join(",#")}`,
      pool: "exacta",
      structure: "key",
      keyPositions: [{ slot: 1, programs: [primaryAnchor.program] }],
      legs: [[primaryAnchor.program], placeProgs.map((p) => p.program)],
      combinations: combos,
      unitCost: 2.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Key anchor to win, part-wheel top 3 contenders for 2nd. Anchor must win.`,
      risk: "balanced",
    });
  }

  // 3. BOX Exacta — top 3 in any order (6 combos)
  if (top3.length >= 3) {
    const { prob, combos } = exactaHitProb(top3Idxs, top3Idxs, exactaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("exacta", 2.00, prob, combos, top3Idxs, top3Idxs);
    tickets.push({
      label: `Exacta BOX: #${top3.map((p) => p.program).join(",#")}`,
      pool: "exacta",
      structure: "box",
      wheelPrograms: top3.map((p) => p.program),
      combinations: combos,
      unitCost: 2.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Top 3 boxed — wins if any two of the three finish 1-2 in either order.`,
      risk: "balanced",
    });
  }

  // ========= TRIFECTAS =========
  // 4. STRAIGHT Trifecta — primary anchor / next best two contenders
  if (contenders.length >= 3) {
    const p1 = primaryAnchor;
    const others = contenders.filter((p) => p.program !== p1.program).slice(0, 2);
    const p2 = others[0], p3 = others[1];
    const i1 = idxByProgram.get(p1.program)!;
    const i2 = idxByProgram.get(p2.program)!;
    const i3 = idxByProgram.get(p3.program)!;
    const { prob, combos } = trifectaHitProb([i1], [i2], [i3], trifectaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("trifecta", 1.00, prob, combos, [i1], [i2], [i3]);
    tickets.push({
      label: `Trifecta STRAIGHT: #${p1.program}-${p2.program}-${p3.program}`,
      pool: "trifecta",
      structure: "straight",
      legs: [[p1.program], [p2.program], [p3.program]],
      combinations: combos,
      unitCost: 1.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Primary anchor / next best two in exact order. Max conviction, lowest cost.`,
      risk: "aggressive",
    });
  }

  // 5. KEY-BOX Trifecta — anchor wins, top 3 others boxed in 2nd/3rd
  if (contenders.length >= 4) {
    const boxProgs = contenders.filter((p) => p.program !== primaryAnchor.program).slice(0, 3);
    const boxIdxs = boxProgs.map((p) => idxByProgram.get(p.program)!);
    const { prob, combos } = trifectaHitProb([anchorIdx], boxIdxs, boxIdxs, trifectaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("trifecta", 1.00, prob, combos, [anchorIdx], boxIdxs, boxIdxs);
    tickets.push({
      label: `Trifecta KEY-BOX: #${primaryAnchor.program} / BOX #${boxProgs.map((p) => p.program).join(",#")}`,
      pool: "trifecta",
      structure: "key-box",
      keyPositions: [{ slot: 1, programs: [primaryAnchor.program] }],
      wheelPrograms: boxProgs.map((p) => p.program),
      combinations: combos,
      unitCost: 1.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Anchor must win, then top 3 can finish 2nd/3rd in either order. Balanced structure.`,
      risk: "balanced",
    });
  }

  // 6. BOX Trifecta top 3 — 6 combos
  if (top3.length >= 3) {
    const { prob, combos } = trifectaHitProb(top3Idxs, top3Idxs, top3Idxs, trifectaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("trifecta", 1.00, prob, combos, top3Idxs, top3Idxs, top3Idxs);
    tickets.push({
      label: `Trifecta BOX: #${top3.map((p) => p.program).join(",#")}`,
      pool: "trifecta",
      structure: "box",
      wheelPrograms: top3.map((p) => p.program),
      combinations: combos,
      unitCost: 1.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Top 3 boxed — catches any 1-2-3 order among the three. Classic balanced play.`,
      risk: "balanced",
    });
  }

  // ========= SUPERFECTAS =========
  // 7. SUPERFECTA PART-WHEEL — anchor / top 3 / top 3 / top 3
  if (contenders.length >= 4) {
    const othersIdxs = contenders.filter((p) => p.program !== primaryAnchor.program).slice(0, 3).map((p) => idxByProgram.get(p.program)!);
    const { prob, combos } = superfectaHitProb([anchorIdx], othersIdxs, othersIdxs, othersIdxs, superfectaMap, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("superfecta", 0.10, prob, combos, [anchorIdx], othersIdxs, othersIdxs, othersIdxs);
    const othersProgs = contenders.filter((p) => p.program !== primaryAnchor.program).slice(0, 3).map((p) => p.program);
    tickets.push({
      label: `Superfecta PART-WHEEL: #${primaryAnchor.program} / #${othersProgs.join(",#")} / #${othersProgs.join(",#")} / #${othersProgs.join(",#")}`,
      pool: "superfecta",
      structure: "part-wheel",
      keyPositions: [{ slot: 1, programs: [primaryAnchor.program] }],
      legs: [[primaryAnchor.program], othersProgs, othersProgs, othersProgs],
      combinations: combos,
      unitCost: 0.10,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Anchor to win, top 3 fill 2nd/3rd/4th in any order. Small cost, big upside.`,
      risk: "balanced",
    });
  }

  // 8. SUPERFECTA KEY-BOX — anchor + top 4 boxed in 2/3/4
  if (contenders.length >= 5) {
    const boxProgs = contenders.filter((p) => p.program !== primaryAnchor.program).slice(0, 4);
    const boxIdxs = boxProgs.map((p) => idxByProgram.get(p.program)!);
    const { prob, combos } = superfectaHitProb([anchorIdx], boxIdxs, boxIdxs, boxIdxs, superfectaMap, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("superfecta", 0.10, prob, combos, [anchorIdx], boxIdxs, boxIdxs, boxIdxs);
    tickets.push({
      label: `Superfecta KEY-BOX: #${primaryAnchor.program} / BOX #${boxProgs.map((p) => p.program).join(",#")}`,
      pool: "superfecta",
      structure: "key-box",
      keyPositions: [{ slot: 1, programs: [primaryAnchor.program] }],
      wheelPrograms: boxProgs.map((p) => p.program),
      combinations: combos,
      unitCost: 0.10,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Anchor must win; top 4 fill 2nd/3rd/4th in any order. Wider coverage for ~$2-3.`,
      risk: "balanced",
    });
  }

  // 9. VARIANCE TRIFECTA — the longshot +EV horse keyed to win over anchors
  // This is the "lottery ticket" — varianceAnchor has the highest EV edge
  // (usually a longshot with a big overlay). Small cost, giant payoff if it hits.
  if (varianceAnchor) {
    const vIdx = idxByProgram.get(varianceAnchor.program)!;
    // Structure: varianceAnchor wins, primary + top contenders in 2/3
    const backers = [primaryAnchor, ...contenders.filter((p) =>
      p.program !== primaryAnchor.program && p.program !== varianceAnchor.program
    )].slice(0, 3);
    const backerIdxs = backers.map((p) => idxByProgram.get(p.program)!);
    const { prob, combos } = trifectaHitProb([vIdx], backerIdxs, backerIdxs, trifectaCounts, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("trifecta", 1.00, prob, combos, [vIdx], backerIdxs, backerIdxs);
    tickets.push({
      label: `Trifecta VARIANCE: #${varianceAnchor.program} (${(varianceAnchor.mlOdds).toFixed(0)}/1) / BOX #${backers.map((p) => p.program).join(",#")}`,
      pool: "trifecta",
      structure: "key-box",
      keyPositions: [{ slot: 1, programs: [varianceAnchor.program] }],
      wheelPrograms: backers.map((p) => p.program),
      combinations: combos,
      unitCost: 1.00,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Longshot +EV play. #${varianceAnchor.program} at ${varianceAnchor.mlOdds.toFixed(0)}/1 has the highest EV edge (${varianceAnchor.evEdge.toFixed(2)}) but low win prob (${varianceAnchor.winPct.toFixed(0)}%). Low hit rate, massive payoff if it lands.`,
      risk: "variance",
    });
  }

  // C-tier variance boost: if there's a C-tier longshot, also include an
  // anchor + C-tier superfecta ticket (small bet, huge payout potential).
  if (cTier.length >= 1 && contenders.length >= 4) {
    const cProg = cTier[0];
    const cIdx = idxByProgram.get(cProg.program)!;
    const midProgs = contenders.filter((p) =>
      p.program !== primaryAnchor.program && p.program !== cProg.program
    ).slice(0, 3);
    const midIdxs = midProgs.map((p) => idxByProgram.get(p.program)!);
    const othersIdxs = [cIdx, ...midIdxs];
    const { prob, combos } = superfectaHitProb([anchorIdx], othersIdxs, othersIdxs, othersIdxs, superfectaMap, nSims);
    const { totalCost, payoff, ev, breakeven } = evFor("superfecta", 0.10, prob, combos, [anchorIdx], othersIdxs, othersIdxs, othersIdxs);
    const allOthers = [cProg.program, ...midProgs.map((p) => p.program)];
    tickets.push({
      label: `Superfecta C-INJECT: #${primaryAnchor.program} / #${allOthers.join(",#")} (C-tier #${cProg.program} included)`,
      pool: "superfecta",
      structure: "part-wheel",
      keyPositions: [{ slot: 1, programs: [primaryAnchor.program] }],
      legs: [[primaryAnchor.program], allOthers, allOthers, allOthers],
      combinations: combos,
      unitCost: 0.10,
      totalCost,
      hitProbability: prob,
      estimatedPayoff: payoff,
      expectedValue: ev,
      breakevenOdds: breakeven,
      rationale: `Anchor wins; C-tier overlay #${cProg.program} (${cProg.mlOdds.toFixed(0)}/1) boxed in 2/3/4 slots. Catches variance when the board collapses.`,
      risk: "variance",
    });
  }

  // Sort tickets by EV-per-dollar (small-bet efficiency).
  // Higher ratio = more expected value per dollar wagered → best use of small bankroll.
  tickets.sort((a, b) => {
    const effA = a.expectedValue / Math.max(a.totalCost, 0.01);
    const effB = b.expectedValue / Math.max(b.totalCost, 0.01);
    return effB - effA;
  });

  return tickets;
}


// ---------------------------------------------------------------------------
// Henery Monte Carlo simulation — full exotic engine
// ---------------------------------------------------------------------------

function estimatePayoff(prob: number): number {
  if (prob <= 0) return 0;
  // Average takeout across exotic pools (~22%)
  return (1.0 / prob) * (1.0 - 0.22);
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
  // Raw win/place/show percentages come from ability-based Monte Carlo.
  // Odds enter ONLY in the overlay/tier layer below.
  const rawWinPcts = entries.map((_, i) => (finishCounts[i][0] / nSims) * 100);

  const predictionsUnsorted: PredictionRow[] = entries.map((e, i) => {
    const marketProb = 1.0 / (e.mlOdds + 1.0);
    const modelProb = finishCounts[i][0] / nSims;
    const { tier, reason, evEdge } = classifyTier(modelProb, marketProb, rawWinPcts[i]);
    return {
      name: e.name,
      program: e.program,
      mlOdds: e.mlOdds,
      style: e.style,
      winPct: rawWinPcts[i],
      placePct:
        ((finishCounts[i][0] + finishCounts[i][1]) / nSims) * 100,
      showPct:
        ((finishCounts[i][0] + finishCounts[i][1] + finishCounts[i][2]) /
          nSims) *
        100,
      adjustedProb: probs[i],
      marketProb,
      evEdge,
      tier,
      tierReason: reason,
    };
  });
  // Sorted by ability (winPct), NOT by odds
  const predictions = [...predictionsUnsorted].sort((a, b) => b.winPct - a.winPct);

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
  const overlays = detectOverlays(probs, entries, rawWinPcts);

  // Phase 3: Ticket construction — proper STRAIGHT/KEY/BOX/WHEEL/PART-WHEEL
  // with hit probability, EV, and breakeven computed from the MC count matrices.
  const tickets = buildStrategicTickets(
    predictions, entries, exactaCounts, trifectaCounts, superfectaMap, nSims,
  );

  return {
    predictions,
    exactas: makeList("Exacta", 2.0, topExactas),
    trifectas: makeList("Trifecta", 1.0, topTrifectas),
    superfectas: makeList("Superfecta", 0.1, topSuperfectas),
    paceScenario: getPaceScenario(entries),
    overlays,
    tickets,
    simInfo: {
      totalSims: nSims,
      batchesRun,
      converged: batchesRun < MAX_BATCHES,
    },
  };
}
