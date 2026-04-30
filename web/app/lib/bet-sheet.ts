// Analytic exotic strategy computation — no Monte Carlo. Fast enough to
// run across all 11 races on page load (few ms total). Uses softmax win
// probabilities from multi-race.ts and computes exacta/trifecta/super
// combo probabilities via iterative conditional probabilities (Harville).

import type { BetStrategy, ExoticCombo } from "./types";
import type { StaticRace } from "./keeneland-apr18";
import { pickForRace } from "./multi-race";

const TAKEOUT = 0.22;

function estimatePayoff(prob: number): number {
  if (prob <= 0) return 0;
  return (1.0 / prob) * (1.0 - TAKEOUT);
}

function perms<T>(arr: T[]): T[][] {
  if (arr.length <= 1) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
    for (const p of perms(rest)) out.push([arr[i], ...p]);
  }
  return out;
}

// Analytic conditional probability (Harville model):
// P(i finishes next | set S already finished) = p_i / sum(p_j for j not in S)
function exoticProb(probs: number[], order: number[]): number {
  let prob = 1;
  const taken = new Set<number>();
  for (const idx of order) {
    let denom = 0;
    for (let i = 0; i < probs.length; i++) {
      if (!taken.has(i)) denom += probs[i];
    }
    if (denom <= 0) return 0;
    prob *= probs[idx] / denom;
    taken.add(idx);
  }
  return prob;
}

function comboKey(programs: string[]): string {
  return programs.join(",");
}

// Builds a BetStrategy from a list of covered combos
function buildStrategy(
  betType: BetStrategy["betType"],
  name: string,
  description: string,
  unitCost: number,
  tickets: ExoticCombo[],
): BetStrategy {
  const ticketCount = tickets.length;
  const totalCost = Math.round(ticketCount * unitCost * 100) / 100;
  const hitProbability = tickets.reduce((s, t) => s + t.probability, 0);
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

// Get analytic win probabilities for a race + program lookup
export interface RaceProbs {
  programs: string[];            // ordered by horse index
  names: string[];
  winProbs: number[];
}

/**
 * Harville conditional probability: given that the horses at `lockedIndices`
 * have already finished (in order) at the leading positions, compute the
 * probability of every remaining horse finishing NEXT.
 *
 * Math: P(j finishes next | locked) = winProb[j] / (1 - sum(winProb[locked]))
 */
export function conditionalNextProbs(rp: RaceProbs, lockedIndices: number[]): number[] {
  const lockedSet = new Set(lockedIndices);
  const lockedSum = lockedIndices.reduce((s, i) => s + rp.winProbs[i], 0);
  const remaining = 1 - lockedSum;
  if (remaining <= 1e-9) return rp.winProbs.map(() => 0);
  return rp.winProbs.map((p, i) => (lockedSet.has(i) ? 0 : p / remaining));
}

// Re-export computeRaceProbs so the bet sheet UI can build the matrix from a race
export function getRaceProbs(race: StaticRace): RaceProbs {
  return computeRaceProbs(race);
}

function computeRaceProbs(race: StaticRace): RaceProbs {
  // Drop scratched horses before scoring so they don't appear in any ticket.
  const scratched = new Set(race.scratches ?? []);
  const horses = race.horses.filter((h) => !scratched.has(h.program));
  const n = horses.length;
  const programs = horses.map((h) => h.program);
  const names = horses.map((h) => h.name);

  // Reuse multi-race pickForRace to confirm top picks, but we need all probs
  // so recompute softmax directly from the same ability components:
  const beyers = horses.map((h) => {
    const b = h.last3Beyer ?? [];
    if (b.length === 0) return null;
    return b.reduce((a, v) => a + v, 0) / b.length;
  });
  const known = beyers.filter((x): x is number => x !== null);
  const med = known.length
    ? [...known].sort((a, b) => a - b)[Math.floor(known.length / 2)]
    : 80;
  const beyerVals = beyers.map((b) => b ?? med);
  const bMean = beyerVals.reduce((a, b) => a + b, 0) / n;
  const bSd = Math.sqrt(beyerVals.reduce((a, v) => a + (v - bMean) ** 2, 0) / n) || 1;
  const speedZ = beyerVals.map((v) => (v - bMean) / bSd);

  const earlyCount = horses.filter((h) => ["E", "EP"].includes(h.style)).length;
  const paceAdj = horses.map((h) => {
    if (earlyCount >= 3) {
      if (["E", "EP"].includes(h.style)) return -0.8;
      if (["S", "C"].includes(h.style)) return 0.8;
      return 0.3;
    }
    if (earlyCount === 1 && ["E", "EP"].includes(h.style)) return 1.2;
    if (earlyCount === 2) {
      if (["S", "C"].includes(h.style)) return 0.4;
      if (["E", "EP"].includes(h.style)) return -0.4;
    }
    return 0;
  });

  let biasAdj: number[] = new Array(n).fill(0);
  if (race.trackBias) {
    const tb = race.trackBias;
    biasAdj = horses.map((h) => {
      const s = (h.style || "P").toUpperCase();
      const iv =
        s === "E"  ? tb.eIV :
        s === "EP" ? tb.epIV :
        s === "P"  ? tb.pIV :
                     tb.sIV;
      // Learning (R2): tighter week-IV clamp — small-sample noise shouldn't swamp ability
      const styleA = Math.max(-0.5, Math.min(0.6, (iv - 1.0) * 0.35));
      const pp = Number(h.program) || 0;
      const pIv =
        pp <= 3 ? tb.post1to3IV :
        pp <= 7 ? tb.post4to7IV :
                  tb.post8plusIV;
      const postA = Math.max(-0.5, Math.min(0.6, (pIv - 1.0) * 0.30));
      return styleA + postA * 0.5;
    });
  }

  const classAdj = horses.map((h) =>
    (h.isClassDrop ?? (h.currentClass && h.avgClassLast3 && h.currentClass < h.avgClassLast3)) ? 0.6 : 0,
  );

  // Learning (R1): softer layoff penalty for high-class horses (peak Beyer >= 82)
  const layoffAdj = horses.map((h) => {
    const d = h.daysSinceLast ?? 0;
    if (d >= 14 && d <= 35) return 0.15;
    if (d > 60) {
      const peak = h.last3Beyer && h.last3Beyer.length > 0 ? Math.max(...h.last3Beyer) : 0;
      return peak >= 82 ? -0.08 : -0.22;
    }
    if (d > 0 && d < 7) return -0.25;
    return 0;
  });

  // Learning (R1-R5): Prime Power (Brisnet composite) was in the data but
  // unused in scoring. Adding it as a z-scored feature — one of the most
  // predictive single numbers Brisnet publishes.
  const ppVals = horses.map((h) => h.primePower ?? 0);
  const ppKnown = ppVals.filter((v) => v > 0);
  const ppMean = ppKnown.length ? ppKnown.reduce((a, b) => a + b, 0) / ppKnown.length : 100;
  const ppSd = ppKnown.length
    ? Math.sqrt(ppKnown.reduce((a, v) => a + (v - ppMean) ** 2, 0) / ppKnown.length) || 1
    : 1;
  const primePowerZ = ppVals.map((v) => (v > 0 ? (v - ppMean) / ppSd : 0));

  // Learning (R1 Apr 29 CD): Tres Soles (PP rank 6) outran Quokka (PP rank 3)
  // because Tres Soles' last3Beyer was trending UP (72→77→85) while Quokka's
  // was DOWN (83→86→76). Mean-of-L3 misses the trend; slope captures it.
  // Learning (R2 Apr 29 CD): Barksdale won despite negative trend [71,92,84]
  // because the 71 was a LAYOFF PREP (59 days off). When daysSinceLast > 45,
  // the most-recent figure is unreliable — drop it from trend calc, use the
  // older two figures' delta instead.
  const trendVals = horses.map((h) => {
    const b = h.last3Beyer ?? [];
    const days = h.daysSinceLast ?? 0;
    const isPostLayoffPrep = days > 45;
    // Use index 1+ if returning from layoff (skip the prep race)
    const start = isPostLayoffPrep && b.length >= 3 ? 1 : 0;
    if (b.length - start < 2) return 0;
    const recent = b[start] ?? 0;
    const oldest = b[b.length - 1] ?? recent;
    return recent - oldest; // positive = improving, negative = declining
  });
  const trendKnown = trendVals.filter((v) => v !== 0);
  const tMean = trendKnown.length ? trendKnown.reduce((a, b) => a + b, 0) / trendKnown.length : 0;
  const tSd = trendKnown.length
    ? Math.sqrt(trendKnown.reduce((a, v) => a + (v - tMean) ** 2, 0) / trendKnown.length) || 1
    : 1;
  const trendZ = trendVals.map((v) => (v - tMean) / tSd);

  // Learning (R1 Apr 29 CD): track was muddy/wet — closer/stalker types ran past
  // pace-figure leaders, EXCEPT Empire Builder (E, post 1, PP-topper) won wire-to-wire.
  // Refined: full E/EP penalty in mud only when NOT on rail. Rail-running speed in routes
  // can hold even on wet — they get away cleanly and aren't engulfed by closers.
  const surfStr = (race.surface ?? "").toLowerCase();
  const condStr = (race.condition ?? "").toLowerCase();
  const isDirtSurface = surfStr.includes("dirt");
  const isWet = ["muddy", "sloppy", "good", "yielding", "soft", "wet"].some((c) => condStr.includes(c));
  const distFurlongs = (() => {
    const d = (race.distance ?? "").toLowerCase();
    const fM = d.match(/([\d.]+)\s*f/);
    if (fM) return parseFloat(fM[1]);
    const frM = d.match(/(\d+)\s+(\d+)\/(\d+)\s*m/);
    if (frM) return (parseInt(frM[1]) + parseInt(frM[2]) / parseInt(frM[3])) * 8;
    const mM = d.match(/([\d.]+)\s*m/);
    return mM ? parseFloat(mM[1]) * 8 : 8;
  })();
  const isRoute = distFurlongs >= 8; // 1m and beyond
  const wetAdj = horses.map((h) => {
    if (!(isDirtSurface && isWet)) return 0;
    const s = (h.style || "").toUpperCase();
    const post = Number(h.program) || 0;
    const isInside = post >= 1 && post <= 3;
    const isRail = post === 1;
    if (["S", "C"].includes(s)) return 0.55;
    if (["E", "EP"].includes(s)) {
      // Learning (R1, R2 Apr 29 CD): rail-running E (post 1) wires on slop in
      // BOTH routes (Empire Builder R1 1m) and SPRINTS (Barksdale R2 6.5f).
      // Two for two — rail E + clean break = wet-track winner.
      if (isRail) return 0.10; // small POSITIVE for rail E in slop
      if (isInside) return -0.10; // post 2-3: nearly neutral
      // Outer posts: full wet penalty
      return -0.45;
    }
    return 0;
  });

  // Final ability: speed mean (0.22) + pace shape (0.18) + class drop (0.14) +
  // style/post IV (0.12) + layoff (0.08) + PP composite (0.10) + speed trend (0.10) + wet adj (0.12)
  const abilities = horses.map((_, i) =>
    0.22 * speedZ[i] + 0.18 * paceAdj[i] + 0.14 * classAdj[i] + 0.12 * biasAdj[i] + 0.08 * layoffAdj[i] + 0.10 * primePowerZ[i] + 0.10 * trendZ[i] + 0.12 * wetAdj[i],
  );
  const maxA = Math.max(...abilities);
  const exps = abilities.map((a) => Math.exp(a - maxA));
  const sum = exps.reduce((a, b) => a + b, 0);
  const modelProbs = exps.map((e) => Math.max(e / sum, 1e-6));

  // Learning (R1-R5): pure ability model kept ignoring public-priced winners
  // (Reality Star 6/1, Consolidated 6/1, Capturing 8/1). Blend 70% model /
  // 30% market — public reflects sharp money + trainer intel our features miss.
  const marketRaw = horses.map((h) => 1.0 / (h.mlOdds + 1.0));
  const marketSum = marketRaw.reduce((a, b) => a + b, 0);
  const marketProbs = marketRaw.map((p) => (marketSum > 0 ? p / marketSum : 1 / n));
  const winProbs = modelProbs.map((mp, i) =>
    Math.max(0.70 * mp + 0.30 * marketProbs[i], 1e-6),
  );
  return { programs, names, winProbs };
}

// Build an ExoticCombo from an ordered index list
function makeCombo(indices: number[], rp: RaceProbs): ExoticCombo {
  const prob = exoticProb(rp.winProbs, indices);
  return {
    rank: 0,
    programs: indices.map((i) => rp.programs[i]),
    names: indices.map((i) => rp.names[i]),
    probability: prob,
    estimatedPayoff: estimatePayoff(prob),
    unitCost: 0, // filled in per-strategy
    aboveCutoff: false,
  };
}

// Pick the best candidate. Parimutuel bets all have negative EV
// (takeout ~22%), so pure-EV comparison just picks whichever is
// cheapest — wrong for race-day betting. What matters is probability
// of cashing at all.
//
// Learning (R7 Apr 18): model had #7/#3/#1 as top 3; actual was 1/7/3.
// 3-horse box at $0.50×6=$3 hit; top-5 straight at $2.50 missed.
// Jason cashed and asked for "low bet, sure things almost" — which is
// exactly the box pattern.
//
// Rules (applied in order):
//   1. If any candidate is a "box" whose hit probability is ≥ 1.5× the
//      best straight's hit probability AND costs ≤ 2.5× cheapest →
//      prefer the box (matches user's "sure things" preference).
//   2. Otherwise rank by hit probability among affordable (≤ 2.5× cheapest).
//   3. EV is the final tiebreaker.
function pickBest(cands: BetStrategy[]): BetStrategy {
  if (cands.length === 0) throw new Error("no candidates");
  const cheapest = Math.min(...cands.map((c) => c.totalCost));
  const affordable = cands.filter((c) => c.totalCost <= cheapest * 2.5);

  // Rule 1: strong box preference when it clearly beats straight on hit rate
  const boxes = affordable.filter((c) => c.name.toLowerCase().includes("box"));
  const straights = affordable.filter((c) => c.name.toLowerCase().includes("straight"));
  if (boxes.length > 0 && straights.length > 0) {
    const bestBox = boxes.slice().sort((a, b) => b.hitProbability - a.hitProbability)[0];
    const bestStraight = straights.slice().sort((a, b) => b.hitProbability - a.hitProbability)[0];
    if (bestBox.hitProbability >= bestStraight.hitProbability * 1.5) {
      return bestBox;
    }
  }

  // Rule 2+3
  return affordable.slice().sort((a, b) => {
    if (Math.abs(a.hitProbability - b.hitProbability) > 0.005) {
      return b.hitProbability - a.hitProbability;
    }
    return b.expectedValue - a.expectedValue;
  })[0];
}

// Top 5 ordered combos by probability, given a candidate index-list generator
function topFive(
  rp: RaceProbs,
  legLength: 2 | 3 | 4,
): ExoticCombo[] {
  const n = rp.winProbs.length;
  const combos: ExoticCombo[] = [];
  if (legLength === 2) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      if (i === j) continue;
      combos.push(makeCombo([i, j], rp));
    }
  } else if (legLength === 3) {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) {
      if (i === j || i === k || j === k) continue;
      combos.push(makeCombo([i, j, k], rp));
    }
  } else {
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let k = 0; k < n; k++) for (let l = 0; l < n; l++) {
      if (i === j || i === k || i === l || j === k || j === l || k === l) continue;
      combos.push(makeCombo([i, j, k, l], rp));
    }
  }
  combos.sort((a, b) => b.probability - a.probability);
  return combos.slice(0, 5);
}

// Helpers to translate programs → indices
function findIdx(rp: RaceProbs, program: string): number {
  return rp.programs.findIndex((p) => p === program);
}

function topProgramsByWin(rp: RaceProbs, n: number): string[] {
  return rp.programs
    .map((p, i) => ({ p, w: rp.winProbs[i] }))
    .sort((a, b) => b.w - a.w)
    .slice(0, n)
    .map((x) => x.p);
}

export interface RaceExoticRecs {
  raceNumber: number;
  exacta: BetStrategy;
  trifecta: BetStrategy;
  superfecta: BetStrategy;
}

export function computeExoticsAnalytic(race: StaticRace): RaceExoticRecs {
  const rp = computeRaceProbs(race);
  const n = rp.winProbs.length;

  // ── EXACTA candidates ──
  const exactaCands: BetStrategy[] = [];
  {
    const unit = 1.0;
    // A: top 5 straight
    const straight = topFive(rp, 2).map((c) => ({ ...c, unitCost: unit }));
    exactaCands.push(buildStrategy("Exacta", "Top 5 straight",
      "Play each of the top 5 ordered exactas as its own ticket.", unit, straight));
    // B: 3-horse box (6 combos)
    if (n >= 3) {
      const top3 = topProgramsByWin(rp, 3);
      const indices = top3.map((p) => findIdx(rp, p));
      const tickets = perms(indices).map((order) => ({ ...makeCombo(order, rp), unitCost: unit }));
      exactaCands.push(buildStrategy("Exacta", "3-horse box",
        `Box top 3: #${top3.join(" / #")} — any order.`, unit, tickets));
    }
    // C: Key fav over top 4
    if (n >= 4) {
      const top4 = topProgramsByWin(rp, 4);
      const fav = top4[0];
      const favIdx = findIdx(rp, fav);
      const tickets = top4.slice(1).map((o) => ({
        ...makeCombo([favIdx, findIdx(rp, o)], rp),
        unitCost: unit,
      }));
      exactaCands.push(buildStrategy("Exacta", "Key favorite on top",
        `#${fav} to win over #${top4.slice(1).join(" / #")}.`, unit, tickets));
    }
  }

  // ── TRIFECTA candidates ──
  const triCands: BetStrategy[] = [];
  {
    const unit = 0.5;
    const straight = topFive(rp, 3).map((c) => ({ ...c, unitCost: unit }));
    triCands.push(buildStrategy("Trifecta", "Top 5 straight",
      "Play each of the top 5 ordered tris as its own $0.50 ticket.", unit, straight));
    if (n >= 3) {
      const top3 = topProgramsByWin(rp, 3);
      const indices = top3.map((p) => findIdx(rp, p));
      const tickets = perms(indices).map((order) => ({ ...makeCombo(order, rp), unitCost: unit }));
      triCands.push(buildStrategy("Trifecta", "3-horse box",
        `Box top 3: #${top3.join(" / #")}.`, unit, tickets));
    }
    if (n >= 4) {
      const top4 = topProgramsByWin(rp, 4);
      const indices = top4.map((p) => findIdx(rp, p));
      const tickets: ExoticCombo[] = [];
      for (const [a, b, c] of perms(indices).map((p) => [p[0], p[1], p[2]])) {
        // only take 3 of 4 — we need 3-horse perms of 4
      }
      // Generate 3-perms of top 4: 4P3 = 24 combos
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
        if (a === b || a === c || b === c) continue;
        tickets.push({ ...makeCombo([indices[a], indices[b], indices[c]], rp), unitCost: unit });
      }
      triCands.push(buildStrategy("Trifecta", "4-horse box",
        `Box top 4: #${top4.join(" / #")}.`, unit, tickets));
    }
    if (n >= 4) {
      const top4 = topProgramsByWin(rp, 4);
      const fav = top4[0];
      const others = top4.slice(1);
      const favIdx = findIdx(rp, fav);
      const tickets: ExoticCombo[] = [];
      for (let i = 0; i < others.length; i++) for (let j = 0; j < others.length; j++) {
        if (i === j) continue;
        tickets.push({ ...makeCombo([favIdx, findIdx(rp, others[i]), findIdx(rp, others[j])], rp), unitCost: unit });
      }
      triCands.push(buildStrategy("Trifecta", "Key favorite wheel",
        `#${fav} to win over #${others.join(" / #")} any order.`, unit, tickets));
    }
  }

  // ── SUPERFECTA candidates ──
  const superCands: BetStrategy[] = [];
  {
    const unit = 0.5;
    if (n >= 4) {
      const straight = topFive(rp, 4).map((c) => ({ ...c, unitCost: unit }));
      superCands.push(buildStrategy("Superfecta", "Top 5 straight",
        "Play each of the top 5 ordered supers as its own $0.50 ticket.", unit, straight));
    }
    if (n >= 4) {
      const top4 = topProgramsByWin(rp, 4);
      const indices = top4.map((p) => findIdx(rp, p));
      const tickets = perms(indices).map((order) => ({ ...makeCombo(order, rp), unitCost: unit }));
      superCands.push(buildStrategy("Superfecta", "4-horse box",
        `Box top 4: #${top4.join(" / #")} — covers all 24 orderings.`, unit, tickets));
    }
    if (n >= 5) {
      const top5 = topProgramsByWin(rp, 5);
      const fav = top5[0];
      const others = top5.slice(1);
      const favIdx = findIdx(rp, fav);
      const tickets: ExoticCombo[] = [];
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) for (let c = 0; c < 4; c++) {
        if (a === b || a === c || b === c) continue;
        tickets.push({
          ...makeCombo([favIdx, findIdx(rp, others[a]), findIdx(rp, others[b]), findIdx(rp, others[c])], rp),
          unitCost: unit,
        });
      }
      superCands.push(buildStrategy("Superfecta", "Key favorite over top 4",
        `#${fav} to win, any 3 of #${others.join(" / #")} fill 2-3-4.`, unit, tickets));
    }
  }

  return {
    raceNumber: race.raceNumber,
    exacta: pickBest(exactaCands),
    trifecta: pickBest(triCands),
    superfecta: pickBest(superCands.length > 0 ? superCands : exactaCands),
  };
}

// Also keep the top-1 pick for each leg for quick display
export function topPickForRace(race: StaticRace) {
  return pickForRace(race);
}
