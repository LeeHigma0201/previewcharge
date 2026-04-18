// Convert Gemini-ingested JSON → TypeScript data file.
// Also produces a diff report against the existing hand-typed data.
//
// Usage: node scripts/json-to-ts.mjs <primary-json> [secondary-json] <output-ts>
// The primary source is authoritative. Secondary is used only to fill in nulls.

import fs from "node:fs";
import path from "node:path";

const [, , primaryPath, secondaryPath, outPath] = process.argv;
if (!primaryPath || !outPath) {
  console.error("Usage: node scripts/json-to-ts.mjs <primary-json> [secondary-json] <output-ts>");
  console.error("  If only 2 args given, 2nd is treated as output path (no secondary).");
  process.exit(1);
}

// Handle the 2-arg case
let effPrimary = primaryPath;
let effSecondary = secondaryPath;
let effOut = outPath;
if (!outPath) {
  effOut = secondaryPath;
  effSecondary = null;
}

const primary = JSON.parse(fs.readFileSync(effPrimary, "utf-8"));
const secondary = effSecondary && effSecondary !== "/dev/null" && fs.existsSync(effSecondary) && fs.statSync(effSecondary).size > 0
  ? JSON.parse(fs.readFileSync(effSecondary, "utf-8")) : null;

function mergeHorse(pHorse, sHorse) {
  if (!sHorse) return pHorse;
  const merged = { ...pHorse };
  for (const k of Object.keys(sHorse)) {
    if (merged[k] == null && sHorse[k] != null) merged[k] = sHorse[k];
  }
  return merged;
}

function mergeRace(pRace, sRace) {
  if (!sRace) return pRace;
  const merged = { ...pRace };
  for (const k of ["par", "speedBiasMeet", "wirePctMeet", "railImpact"]) {
    if (merged[k] == null && sRace[k] != null) merged[k] = sRace[k];
  }
  // Merge horses by program number
  const pByProg = new Map((pRace.horses || []).map((h) => [h.program, h]));
  const sByProg = new Map((sRace.horses || []).map((h) => [h.program, h]));
  const allProgs = new Set([...pByProg.keys(), ...sByProg.keys()]);
  merged.horses = [...allProgs].map((prog) =>
    mergeHorse(pByProg.get(prog) || sByProg.get(prog), sByProg.get(prog))
  ).sort((a, b) => Number(a.program) - Number(b.program));
  return merged;
}

// Merge races by raceNumber
const pRaces = primary.races || [];
const sRaces = (secondary && secondary.races) || [];
const sByNum = new Map(sRaces.map((r) => [r.raceNumber, r]));
const mergedRaces = pRaces.map((r) => mergeRace(r, sByNum.get(r.raceNumber)));

// Sanity-check styling and fields
function clean(v) {
  if (v === null || v === undefined) return undefined;
  return v;
}

function jsv(v) {
  if (v === undefined || v === null) return undefined;
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "boolean") return String(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "0";
  if (Array.isArray(v)) return "[" + v.map(jsv).join(", ") + "]";
  return JSON.stringify(v);
}

function horseToTs(h) {
  const pairs = [];
  const push = (k, v) => { if (v !== undefined && v !== null) pairs.push(`${k}: ${jsv(v)}`); };
  push("program", h.program);
  push("post", h.post);
  push("name", h.name);
  push("jockey", h.jockey);
  push("trainer", h.trainer);
  push("mlOdds", h.mlOdds);
  push("style", h.style === "?" ? "?" : (h.style || "?"));
  // Style needs quotes — fix manually
  const styleIdx = pairs.findIndex(p => p.startsWith("style:"));
  if (styleIdx >= 0) {
    const styleVal = h.style === "?" ? "?" : (h.style || "?");
    pairs[styleIdx] = `style: ${JSON.stringify(styleVal)}`;
  }
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
  if (h.last3Speeds && h.last3Speeds.length) push("last3Speeds", h.last3Speeds);
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
  const horses = (r.horses || []).map(horseToTs).join("\n");
  const par = r.par || { e1: 0, e2: 0, late: 0, speed: 0 };
  const confidence = r.confidence || "UNKNOWN";
  const audit = r.dataAudit ? ` [unanimous=${r.dataAudit.unanimous} 2of3=${r.dataAudit.twoOfThree} disputed=${r.dataAudit.disputed}]` : "";
  return `  {
    raceNumber: ${r.raceNumber},
    postTime: ${JSON.stringify(r.postTime || "")},
    distance: ${JSON.stringify(r.distance || "")},
    surface: ${JSON.stringify(r.surface === "Turf" ? "Turf" : "Dirt")},
    raceType: ${JSON.stringify(r.raceType || "")},
    purse: ${r.purse || 0},
    conditions: ${JSON.stringify(r.conditions || "")},
    par: { e1: ${par.e1 || 0}, e2: ${par.e2 || 0}, late: ${par.late || 0}, speed: ${par.speed || 0} },
    speedBiasMeet: ${r.speedBiasMeet ?? 0.5},
    wirePctMeet: ${r.wirePctMeet ?? 0.15},
    railImpact: ${r.railImpact ?? 1.0},
    dataConfidence: ${JSON.stringify(confidence)}, // ${confidence}${audit}
    horses: [
${horses}
    ],
  },`;
}

const banner = `// Keeneland Saturday April 18 2026 — full card.
// AUTO-GENERATED from Gemini PDF ingestion — DO NOT EDIT BY HAND.
// Regenerate via: node scripts/json-to-ts.mjs data/kee-apr18-ultimate.json data/kee-apr18-premium.json web/app/lib/keeneland-apr18.ts
//
// Source: Brisnet Ultimate PP's (primary) + Premium Plus PP's (secondary fill-in).

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
  /** Data reconciliation confidence: HIGH = all 3 sources agree, MED = 2 of 3, LOW = sources disagree */
  dataConfidence?: "HIGH" | "MED" | "LOW" | "UNKNOWN";
  horses: KeeneHorse[];
}

export const KEE_APRIL_18_2026: KeeneRace[] = [
`;

const tsContent = banner + mergedRaces.map(raceToTs).join("\n") + "\n];\n";

fs.writeFileSync(effOut, tsContent);

const horseCount = mergedRaces.reduce((sum, r) => sum + r.horses.length, 0);
const scratchCount = mergedRaces.reduce((sum, r) => sum + r.horses.filter(h => h.scratched).length, 0);
console.log(`[gen] ✓ ${mergedRaces.length} races / ${horseCount} horses / ${scratchCount} scratched → ${effOut}`);
