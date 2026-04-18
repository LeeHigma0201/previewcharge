// Compare Gemini-ingested JSON vs the hand-typed TS to flag transcription errors.
// Usage: node scripts/diff-data.mjs <gemini-json> <handtyped-ts>

import fs from "node:fs";

const [, , geminiPath, tsPath] = process.argv;
if (!geminiPath || !tsPath) {
  console.error("Usage: node scripts/diff-data.mjs <gemini-json> <handtyped-ts>");
  process.exit(1);
}

const gemini = JSON.parse(fs.readFileSync(geminiPath, "utf-8"));

// Parse the TS file by loading it as string and extracting the array
// We can't `import` a TS file without compilation, so regex it.
const tsContent = fs.readFileSync(tsPath, "utf-8");
// Match each race object in the KEE_APRIL_18_2026 array
const raceBlocks = tsContent.match(/\{\s*raceNumber:\s*\d+[\s\S]*?horses:\s*\[[\s\S]*?\],\s*\}/g) || [];

function parseRaceBlock(block) {
  const num = Number(block.match(/raceNumber:\s*(\d+)/)?.[1] || 0);
  const horses = [];
  // Each horse is like: { program: "1", post: 1, name: "X", ... }
  const horseRe = /\{\s*program:\s*"([^"]+)"[^}]*?\}/g;
  let m;
  while ((m = horseRe.exec(block))) {
    const hBlock = m[0];
    const getNum = (key) => {
      const mm = hBlock.match(new RegExp(`${key}:\\s*(-?[\\d.]+)`));
      return mm ? Number(mm[1]) : null;
    };
    const getStr = (key) => {
      const mm = hBlock.match(new RegExp(`${key}:\\s*"([^"]+)"`));
      return mm ? mm[1] : null;
    };
    const getBool = (key) => hBlock.includes(`${key}: true`);
    horses.push({
      program: m[1],
      name: getStr("name"),
      jockey: getStr("jockey"),
      trainer: getStr("trainer"),
      mlOdds: getNum("mlOdds"),
      style: getStr("style"),
      primePower: getNum("primePower"),
      classRating: getNum("classRating"),
      classLast3: getNum("classLast3"),
      paceE1: getNum("paceE1"),
      paceE2: getNum("paceE2"),
      paceLate: getNum("paceLate"),
      wins: getNum("wins"),
      starts: getNum("starts"),
      scratched: getBool("scratched"),
    });
  }
  return { raceNumber: num, horses };
}

const tsRaces = raceBlocks.map(parseRaceBlock);

const issues = [];
const COMPARE_FIELDS = ["mlOdds", "style", "primePower", "classRating", "classLast3", "paceE1", "paceE2", "paceLate", "wins", "starts"];

function approxEqual(a, b, tolerance) {
  if (a === null || b === null) return a === b;
  if (typeof a !== "number" || typeof b !== "number") return a === b;
  return Math.abs(a - b) <= tolerance;
}

function toleranceFor(field) {
  if (field === "mlOdds") return 0.2;            // 3/1 vs 3.5/1 — small is fine
  if (field === "primePower") return 2.0;        // ±2 pts
  if (field === "classRating") return 2;
  if (field === "classLast3") return 2;
  if (field === "paceE1" || field === "paceE2" || field === "paceLate") return 3;
  return 0;                                       // exact match for names, counts, style
}

for (const gRace of gemini.races || []) {
  const tsRace = tsRaces.find(r => r.raceNumber === gRace.raceNumber);
  if (!tsRace) {
    issues.push({ race: gRace.raceNumber, severity: "MISSING_RACE", msg: "Race not in TS file" });
    continue;
  }
  const gByProg = new Map((gRace.horses || []).map(h => [h.program, h]));
  const tsByProg = new Map((tsRace.horses || []).map(h => [h.program, h]));

  for (const prog of gByProg.keys()) {
    const g = gByProg.get(prog);
    const t = tsByProg.get(prog);
    if (!t) {
      issues.push({ race: gRace.raceNumber, program: prog, severity: "MISSING_HORSE", msg: `${g.name} not in TS` });
      continue;
    }
    // Name mismatch = critical
    if (g.name && t.name && g.name.trim() !== t.name.trim()) {
      issues.push({ race: gRace.raceNumber, program: prog, field: "name", severity: "HIGH", gemini: g.name, ts: t.name });
    }
    // Scratched flag mismatch
    if (Boolean(g.scratched) !== Boolean(t.scratched)) {
      issues.push({ race: gRace.raceNumber, program: prog, field: "scratched", severity: "HIGH",
                    gemini: g.scratched, ts: t.scratched });
    }
    // Numeric / tolerant compares
    for (const field of COMPARE_FIELDS) {
      const gVal = g[field];
      const tVal = t[field];
      if (gVal == null || tVal == null) continue;  // skip if either missing
      const tol = toleranceFor(field);
      if (!approxEqual(gVal, tVal, tol)) {
        const severity = ["primePower", "paceE1", "classRating", "style"].includes(field) ? "HIGH" : "MED";
        issues.push({ race: gRace.raceNumber, program: prog, name: g.name, field, severity, gemini: gVal, ts: tVal });
      }
    }
  }

  // Horses in TS but not in Gemini
  for (const prog of tsByProg.keys()) {
    if (!gByProg.has(prog)) {
      const t = tsByProg.get(prog);
      issues.push({ race: gRace.raceNumber, program: prog, severity: "EXTRA_HORSE", msg: `${t.name} in TS but not in Gemini (may have been scratched in source)` });
    }
  }
}

// Report
const bySeverity = { HIGH: [], MED: [], MISSING_RACE: [], MISSING_HORSE: [], EXTRA_HORSE: [] };
for (const iss of issues) {
  const bucket = bySeverity[iss.severity] || [];
  bucket.push(iss);
  bySeverity[iss.severity] = bucket;
}

console.log(`\n=== DATA DIFF: Gemini JSON vs Hand-typed TS ===\n`);
console.log(`Total discrepancies: ${issues.length}\n`);

for (const sev of ["HIGH", "MED", "MISSING_RACE", "MISSING_HORSE", "EXTRA_HORSE"]) {
  const items = bySeverity[sev] || [];
  if (!items.length) continue;
  console.log(`\n[${sev}] ${items.length} issue${items.length > 1 ? "s" : ""}:`);
  for (const iss of items) {
    const loc = `R${iss.race}${iss.program ? `/#${iss.program}` : ""}${iss.name ? ` (${iss.name})` : ""}`;
    if (iss.field) {
      console.log(`  ${loc} ${iss.field}: gemini=${JSON.stringify(iss.gemini)} ts=${JSON.stringify(iss.ts)}`);
    } else {
      console.log(`  ${loc} ${iss.msg}`);
    }
  }
}

console.log();
