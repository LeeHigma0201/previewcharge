// Multi-race bet helpers — computes top picks per leg using the same
// ability model as the single-race simulator, then returns sequence
// recommendations for Pick 3/4/5/6.

import type { HorseEntry, RaceInfo } from "./types";
import type { StaticRace, StaticHorse } from "./keeneland-apr18";
import { CD_2026_04_30 as TODAYS_CARD } from "./cd-2026-04-30";

function staticToEntries(race: StaticRace): { horses: HorseEntry[]; raceInfo: RaceInfo } {
  const scratched = new Set(race.scratches ?? []);
  const horses: HorseEntry[] = race.horses
    .filter((sh: StaticHorse) => !scratched.has(sh.program))
    .map((sh: StaticHorse) => ({
    pp: Number(sh.program) || 0,
    program: sh.program,
    name: sh.name,
    jockey: "",
    trainer: "",
    mlOdds: sh.mlOdds,
    style: sh.style,
    speed: sh.last3Beyer[0] ?? 0,
    e1Pace: sh.earlyPaceLast ?? 80,
    latePace: sh.latePaceLast ?? 80,
    last3Beyer: sh.last3Beyer,
    daysSinceLast: sh.daysSinceLast,
    weight: sh.weight,
    isClassDrop: sh.isClassDrop,
    // Carry Prime Power via an augmented field so abilitySoftmax can pick it up
    // without widening the global HorseEntry interface mid-session.
    ...(sh.primePower !== undefined ? { primePower: sh.primePower } : {}),
  } as HorseEntry & { primePower?: number }));
  const raceInfo: RaceInfo = {
    track: "CD",
    trackName: "Churchill Downs",
    date: "2026-04-30",
    raceNumber: race.raceNumber,
    distance: race.distance,
    surface: race.surface,
    raceType: race.raceType,
    purse: race.purse,
    condition: race.condition,
    trackBias: race.trackBias,
    entries: horses,
  };
  return { horses, raceInfo };
}

// Minimal softmax ability model — synchronous & cheap, uses same weights
// as the simulator so picks match.
function abilitySoftmax(horses: HorseEntry[], race: RaceInfo): number[] {
  const n = horses.length;
  if (n === 0) return [];
  // Speed z-score (last3Beyer mean)
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
  const beyerMean = beyerVals.reduce((a, b) => a + b, 0) / n;
  const beyerSd = Math.sqrt(
    beyerVals.reduce((a, v) => a + (v - beyerMean) ** 2, 0) / n,
  ) || 1;
  const speedZ = beyerVals.map((v) => (v - beyerMean) / beyerSd);

  // Pace-context adjustment (same shape as paceScores in data.ts)
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

  // Track bias adjustment via IVs
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
      // Learning (R2): tighter clamp on small-sample weekly IVs
      const styleA = Math.max(-0.5, Math.min(0.6, (iv - 1.0) * 0.35));
      const pp = h.pp;
      const pIv =
        pp <= 3 ? tb.post1to3IV :
        pp <= 7 ? tb.post4to7IV :
                  tb.post8plusIV;
      const postA = Math.max(-0.5, Math.min(0.6, (pIv - 1.0) * 0.30));
      return styleA + postA * 0.5;
    });
  }

  // Class movement (drop = bump)
  const classAdj = horses.map((h) => (h.isClassDrop ? 0.6 : 0));

  // Learning (R1): softer layoff penalty when peak Beyer shows class is intact
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

  // Prime Power — Brisnet composite (previously unused, now z-scored in)
  const ppVals = horses.map((h) => {
    const raw = (h as unknown as { primePower?: number }).primePower;
    return typeof raw === "number" && raw > 0 ? raw : 0;
  });
  const ppKnown = ppVals.filter((v) => v > 0);
  const ppMean = ppKnown.length ? ppKnown.reduce((a, b) => a + b, 0) / ppKnown.length : 100;
  const ppSd = ppKnown.length
    ? Math.sqrt(ppKnown.reduce((a, v) => a + (v - ppMean) ** 2, 0) / ppKnown.length) || 1
    : 1;
  const primePowerZ = ppVals.map((v) => (v > 0 ? (v - ppMean) / ppSd : 0));

  // Composite ability with same weights as runSimulation
  const abilities = horses.map((_, i) =>
    0.22 * speedZ[i] +
    0.18 * paceAdj[i] +
    0.14 * classAdj[i] +
    0.12 * biasAdj[i] +
    0.08 * layoffAdj[i] +
    0.10 * primePowerZ[i]
  );

  // Softmax
  const maxA = Math.max(...abilities);
  const exps = abilities.map((a) => Math.exp(a - maxA));
  const sum = exps.reduce((a, b) => a + b, 0);
  const modelProbs = exps.map((e) => Math.max(e / sum, 1e-6));

  // Learning (R1-R5): blend 70/30 model/market — public priced 4 of 5 winners
  // reasonably. ML odds carry info our ability features miss.
  const marketRaw = horses.map((h) => 1.0 / (h.mlOdds + 1.0));
  const marketSum = marketRaw.reduce((a, b) => a + b, 0);
  const marketProbs = marketRaw.map((p) => (marketSum > 0 ? p / marketSum : 1 / n));
  return modelProbs.map((mp, i) => Math.max(0.70 * mp + 0.30 * marketProbs[i], 1e-6));
}

export interface RacePick {
  raceNumber: number;
  raceType: string;
  distance: string;
  surface: "Dirt" | "Turf";
  postTime: string;
  top1: { program: string; name: string; winPct: number };
  top2: { program: string; name: string; winPct: number };
  top3: { program: string; name: string; winPct: number };
  concentration: number; // top1 winPct / top2 winPct — higher = more lock
}

export function pickForRace(race: StaticRace): RacePick {
  const { horses, raceInfo } = staticToEntries(race);
  const probs = abilitySoftmax(horses, raceInfo);
  const ranked = horses
    .map((h, i) => ({ h, p: probs[i] }))
    .sort((a, b) => b.p - a.p);
  const top1 = ranked[0];
  const top2 = ranked[1] ?? ranked[0];
  const top3 = ranked[2] ?? ranked[0];
  return {
    raceNumber: race.raceNumber,
    raceType: race.raceType,
    distance: race.distance,
    surface: race.surface,
    postTime: race.postTime,
    top1: { program: top1.h.program, name: top1.h.name, winPct: top1.p * 100 },
    top2: { program: top2.h.program, name: top2.h.name, winPct: top2.p * 100 },
    top3: { program: top3.h.program, name: top3.h.name, winPct: top3.p * 100 },
    concentration: top2.p > 0 ? top1.p / top2.p : 1,
  };
}

export function allRacePicks(): RacePick[] {
  return TODAYS_CARD.map(pickForRace);
}

// Multi-race bet structures offered at Keeneland Apr 18
export interface MultiRaceBet {
  id: string;
  label: string;
  legs: number[]; // race numbers
  minUnit: number; // $ minimum
}

// CD Apr 30 — 12-race card with R6 = UAE President Cup Arabian Stakes (excluded;
// our model is Thoroughbred-only, and the track typically pools Arabians separately).
export const MULTI_RACE_BETS: MultiRaceBet[] = [
  { id: "early-p5", label: "Early Pick 5",      legs: [1, 2, 3, 4, 5],     minUnit: 0.5 },
  { id: "p6",       label: "Pick 6 Jackpot",    legs: [7, 8, 9, 10, 11, 12], minUnit: 0.5 },
  { id: "late-p5",  label: "Late Pick 5",       legs: [8, 9, 10, 11, 12],  minUnit: 0.5 },
  { id: "p4",       label: "Pick 4 (9-12)",     legs: [9, 10, 11, 12],     minUnit: 0.5 },
  { id: "turf-p3",  label: "Turf Pick 3",       legs: [7, 9, 11],          minUnit: 1.0 },
  { id: "late-p3",  label: "Late Pick 3",       legs: [10, 11, 12],        minUnit: 1.0 },
  { id: "roll-p3-2",label: "Rolling Pick 3",    legs: [2, 3, 4],           minUnit: 1.0 },
  { id: "roll-p3-7",label: "Rolling Pick 3",    legs: [7, 8, 9],           minUnit: 1.0 },
];

export interface MultiRaceRec {
  bet: MultiRaceBet;
  singleTicket: string;          // "R7 #4 → R8 #11 → R9 #8 → R10 #8"
  singleCost: number;
  singleHitPct: number;          // product of per-leg top1 winPcts
  coverageTicket: string;        // "R7 #4 → R8 #11/#3 → R9 #8/#4 → R10 #8" (top-2 on chaos legs)
  coverageCost: number;
  coverageHitPct: number;
  legs: Array<{
    race: number;
    primary: string;
    primaryName: string;
    winPct: number;
    backup?: string;
    backupName?: string;
    backupWinPct?: number;
    isChaos: boolean; // top1/top2 concentration low = wide race
  }>;
}

// Generate Pick N recommendation: single ticket top picks, plus a
// coverage version that adds a backup horse in the most uncertain legs
// (lowest concentration ratio). Default: add backup to the 2 most chaotic legs.
export function computeMultiRaceRec(bet: MultiRaceBet, picks: RacePick[]): MultiRaceRec {
  const legPicks = bet.legs.map((r) => picks.find((p) => p.raceNumber === r)).filter(Boolean) as RacePick[];
  // Rank legs by concentration (low = chaos)
  const sortedByChaos = [...legPicks].sort((a, b) => a.concentration - b.concentration);
  // Number of backup legs = roughly half of legs, capped at 2-3 depending on bet size
  const backupCount = Math.min(
    bet.legs.length <= 3 ? 1 : bet.legs.length === 4 ? 2 : 3,
    sortedByChaos.length,
  );
  const backupRaces = new Set(sortedByChaos.slice(0, backupCount).map((p) => p.raceNumber));

  const legs = legPicks.map((p) => ({
    race: p.raceNumber,
    primary: p.top1.program,
    primaryName: p.top1.name,
    winPct: p.top1.winPct,
    backup: backupRaces.has(p.raceNumber) ? p.top2.program : undefined,
    backupName: backupRaces.has(p.raceNumber) ? p.top2.name : undefined,
    backupWinPct: backupRaces.has(p.raceNumber) ? p.top2.winPct : undefined,
    isChaos: backupRaces.has(p.raceNumber),
  }));

  const singleTicket = legs.map((l) => `R${l.race} #${l.primary}`).join(" → ");
  const singleCost = bet.minUnit;
  const singleHitPct = legs.reduce((a, l) => a * (l.winPct / 100), 1) * 100;

  const coverageTicket = legs
    .map((l) => l.backup ? `R${l.race} #${l.primary}/#${l.backup}` : `R${l.race} #${l.primary}`)
    .join(" → ");
  // Coverage cost = 2^backupCount combinations × minUnit
  const coverageCombos = Math.pow(2, backupCount);
  const coverageCost = coverageCombos * bet.minUnit;
  const coverageHitPct = legs.reduce(
    (a, l) => a * ((l.winPct + (l.backupWinPct ?? 0)) / 100),
    1,
  ) * 100;

  return {
    bet,
    singleTicket,
    singleCost,
    singleHitPct,
    coverageTicket,
    coverageCost,
    coverageHitPct,
    legs,
  };
}
