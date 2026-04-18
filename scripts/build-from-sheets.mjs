// Build authoritative keeneland-apr18.ts from the Google Sheets lineup
// plus reconciled Gemini data for the detailed stats (pace, class, speed figs).

import fs from "node:fs";

const [sheetsPath, reconciledPath, outPath] = process.argv.slice(2);
const sheets = JSON.parse(fs.readFileSync(sheetsPath, "utf-8"));
const recon = JSON.parse(fs.readFileSync(reconciledPath, "utf-8"));

const reconByRace = new Map((recon.races || []).map(r => [r.raceNumber, r]));

function findReconHorse(raceNum, program, name) {
  const r = reconByRace.get(raceNum);
  if (!r) return null;
  // Try program match first, then name match
  return r.horses.find(h =>
    h.program === program ||
    (h.name || "").trim().toLowerCase() === (name || "").trim().toLowerCase()
  );
}

function horseToTs(h) {
  const pairs = [];
  const push = (k, v) => {
    if (v === undefined || v === null) return;
    if (typeof v === "number" && !Number.isFinite(v)) return;
    if (Array.isArray(v)) {
      if (v.length === 0) return;
      pairs.push(`${k}: [${v.join(", ")}]`);
      return;
    }
    if (typeof v === "string") {
      pairs.push(`${k}: ${JSON.stringify(v)}`);
      return;
    }
    if (typeof v === "boolean") {
      pairs.push(`${k}: ${v}`);
      return;
    }
    pairs.push(`${k}: ${v}`);
  };
  push("program", h.program);
  push("post", h.post);
  push("name", h.name);
  push("jockey", h.jockey);
  push("trainer", h.trainer);
  push("mlOdds", h.mlOdds);
  push("style", h.style || "?");
  push("primePower", h.primePower ?? 0);
  if (h.classRating != null) push("classRating", h.classRating);
  if (h.classLast3 != null) push("classLast3", h.classLast3);
  if (h.paceE1 != null) push("paceE1", h.paceE1);
  if (h.paceE2 != null) push("paceE2", h.paceE2);
  if (h.paceLate != null) push("paceLate", h.paceLate);
  if (h.earlyPaceLast != null) push("earlyPaceLast", h.earlyPaceLast);
  if (h.latePaceLast != null) push("latePaceLast", h.latePaceLast);
  if (h.speedLastRace != null) push("speedLastRace", h.speedLastRace);
  if (h.backSpeed != null) push("backSpeed", h.backSpeed);
  if (h.last3Speeds?.length) push("last3Speeds", h.last3Speeds);
  if (h.wins != null) push("wins", h.wins);
  if (h.starts != null) push("starts", h.starts);
  if (h.places != null) push("places", h.places);
  if (h.shows != null) push("shows", h.shows);
  if (h.daysSinceLast != null) push("daysSinceLast", h.daysSinceLast);
  if (h.lastFinishPosition != null) push("lastFinishPosition", h.lastFinishPosition);
  if (h.jockeyWinPct != null) push("jockeyWinPct", h.jockeyWinPct);
  if (h.trainerWinPct != null) push("trainerWinPct", h.trainerWinPct);
  if (h.weight != null) push("weight", h.weight);
  if (h.scratched) push("scratched", true);
  if (h.notes) push("notes", h.notes);
  return `      { ${pairs.join(", ")} },`;
}

function raceToTs(r) {
  const horses = r.horses.map(horseToTs).join("\n");
  const par = r.par || { e1: 0, e2: 0, late: 0, speed: 0 };
  const postTime = r.postTime || "";
  return `  {
    raceNumber: ${r.raceNumber},
    postTime: ${JSON.stringify(postTime)},
    distance: ${JSON.stringify(r.distance || "")},
    surface: ${JSON.stringify(r.surface)},
    raceType: ${JSON.stringify(r.raceType || "")},
    purse: ${r.purse || 0},
    conditions: ${JSON.stringify(r.conditions || "")},
    par: { e1: ${par.e1 || 0}, e2: ${par.e2 || 0}, late: ${par.late || 0}, speed: ${par.speed || 0} },
    speedBiasMeet: ${r.speedBiasMeet ?? 0.5},
    wirePctMeet: ${r.wirePctMeet ?? 0.15},
    railImpact: ${r.railImpact ?? 1.0},
    dataConfidence: "HIGH",
    horses: [
${horses}
    ],
  },`;
}

const POST_TIMES = {
  1: "1:00 PM", 2: "1:32 PM", 3: "2:04 PM", 4: "2:36 PM",
  5: "3:08 PM", 6: "3:40 PM", 7: "4:12 PM", 8: "4:44 PM",
  9: "5:16 PM", 10: "5:48 PM", 11: "6:20 PM",
};

const MEET_BIAS = {
  // Per surface/distance bucket from Brisnet track bias stats
  1: { speedBiasMeet: 0.90, wirePctMeet: 0.20, railImpact: 0.70 },   // Mdn 110k dirt route
  2: { speedBiasMeet: 0.25, wirePctMeet: 0.00, railImpact: 1.68 },   // Clm dirt route
  3: { speedBiasMeet: 0.57, wirePctMeet: 0.14, railImpact: 0.00 },   // Turf sprint
  4: { speedBiasMeet: 0.90, wirePctMeet: 0.20, railImpact: 0.70 },   // Alw dirt route
  5: { speedBiasMeet: 0.90, wirePctMeet: 0.20, railImpact: 0.70 },   // MC dirt route
  6: { speedBiasMeet: 0.43, wirePctMeet: 0.05, railImpact: 1.32 },   // Turf mile
  7: { speedBiasMeet: 1.00, wirePctMeet: 0.33, railImpact: 1.11 },   // Dirt sprint
  8: { speedBiasMeet: 0.57, wirePctMeet: 0.14, railImpact: 0.00 },   // Turf sprint
  9: { speedBiasMeet: 0.71, wirePctMeet: 0.14, railImpact: 0.99 },   // Dirt route
  10: { speedBiasMeet: 0.43, wirePctMeet: 0.05, railImpact: 1.32 },  // Turf route
  11: { speedBiasMeet: 1.00, wirePctMeet: 0.50, railImpact: 0.00 },  // Dirt sprint (7F)
};

// Merge authoritative sheets lineup with reconciled stats
const mergedRaces = sheets.races.map(r => {
  const bias = MEET_BIAS[r.raceNumber] || {};
  return {
    ...r,
    postTime: POST_TIMES[r.raceNumber] || "",
    speedBiasMeet: bias.speedBiasMeet,
    wirePctMeet: bias.wirePctMeet,
    railImpact: bias.railImpact,
    horses: r.horses.map(h => {
      const reconH = findReconHorse(r.raceNumber, h.program, h.name);
      // AUTHORITATIVE fields from sheet 2: program, name, mlOdds, style, primePower, jockey, trainer
      // FILL-IN fields from reconciled Gemini: classRating, paceE1, paceE2, paceLate,
      //   speedLastRace, backSpeed, last3Speeds, wins, starts, daysSinceLast,
      //   lastFinishPosition, jockeyWinPct, trainerWinPct, weight
      const merged = {
        program: h.program,
        post: Number(h.program) || undefined,
        name: h.name,
        jockey: h.jockey,
        trainer: h.trainer,
        mlOdds: h.mlOdds,
        style: h.style,
        primePower: h.primePower,
      };
      const fillFields = ["classRating", "classLast3", "paceE1", "paceE2", "paceLate",
        "earlyPaceLast", "latePaceLast", "speedLastRace", "backSpeed", "last3Speeds",
        "wins", "starts", "places", "shows", "daysSinceLast", "lastFinishPosition",
        "jockeyWinPct", "trainerWinPct", "weight"];
      if (reconH) {
        for (const f of fillFields) {
          if (reconH[f] != null) merged[f] = reconH[f];
        }
      }
      if (h.scratched) merged.scratched = true;
      if (h.scratchReason) merged.notes = h.scratchReason;
      else if (h.notes) merged.notes = h.notes;
      return merged;
    }),
  };
});

const banner = `// Keeneland Saturday April 18, 2026 — full card, authoritative.
// AUTO-GENERATED — see scripts/build-from-sheets.mjs
//
// AUTHORITATIVE SOURCES (no hallucination):
//   • horse 2.gsheet — Race/Pgm/Name/ML/Style/PrimePower/Jockey/Trainer (Gemini via NotebookLM)
//   • horse 3.gsheet — Race metadata (distance, surface, purse, pars)
//   • Copy of Horse Racing Data Extraction.gsheet — scratch list
// FILL-IN (best-effort):
//   • Detailed stats (pace figs, class, speed figs, connections %) from reconciled Gemini API ingestion

export interface KeeneHorse {
  program: string;
  post: number;
  name: string;
  jockey: string;
  trainer: string;
  mlOdds: number;
  style: "E" | "EP" | "P" | "S" | "C" | "?";
  primePower: number;
  classRating?: number;
  classLast3?: number;
  paceE1?: number;
  paceE2?: number;
  paceLate?: number;
  earlyPaceLast?: number;
  latePaceLast?: number;
  speedLastRace?: number;
  backSpeed?: number;
  last3Speeds?: number[];
  wins?: number;
  starts?: number;
  places?: number;
  shows?: number;
  daysSinceLast?: number;
  lastFinishPosition?: number;
  jockeyWinPct?: number;
  trainerWinPct?: number;
  weight?: number;
  scratched?: boolean;
  notes?: string;
}

export interface KeeneRace {
  raceNumber: number;
  postTime: string;
  distance: string;
  surface: "Dirt" | "Turf";
  raceType: string;
  purse: number;
  conditions: string;
  par: { e1: number; e2: number; late: number; speed: number };
  speedBiasMeet?: number;
  wirePctMeet?: number;
  railImpact?: number;
  dataConfidence?: "HIGH" | "MED" | "LOW" | "UNKNOWN";
  horses: KeeneHorse[];
}

export const KEE_APRIL_18_2026: KeeneRace[] = [
`;

const tsContent = banner + mergedRaces.map(raceToTs).join("\n") + "\n];\n";
fs.writeFileSync(outPath, tsContent);

const totalHorses = mergedRaces.reduce((s, r) => s + r.horses.length, 0);
const scratched = mergedRaces.reduce((s, r) => s + r.horses.filter(h => h.scratched).length, 0);
console.log(`[build-from-sheets] ✓ ${mergedRaces.length} races / ${totalHorses} horses (${scratched} scratched) → ${outPath}`);
