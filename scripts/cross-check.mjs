// Cross-check two Gemini PDF extractions. Any per-race disagreements on
// horse lineup or critical stats get flagged for human verification.

import fs from "node:fs";

const [ultimatePath, premiumPath] = process.argv.slice(2);
if (!ultimatePath || !premiumPath) {
  console.error("Usage: node scripts/cross-check.mjs <ultimate.json> <premium.json>");
  process.exit(1);
}

const ultimate = JSON.parse(fs.readFileSync(ultimatePath, "utf-8"));
const premium = JSON.parse(fs.readFileSync(premiumPath, "utf-8"));

const uByNum = new Map((ultimate.races || []).map(r => [r.raceNumber, r]));
const pByNum = new Map((premium.races || []).map(r => [r.raceNumber, r]));

const report = [];

for (let n = 1; n <= 11; n++) {
  const u = uByNum.get(n);
  const p = pByNum.get(n);
  if (!u || !p) {
    report.push({ race: n, severity: "MISSING", msg: `missing in ${!u ? "ultimate" : "premium"}` });
    continue;
  }
  // Compare horse lineups by program number
  const uHorses = new Map((u.horses || []).map(h => [h.program, h]));
  const pHorses = new Map((p.horses || []).map(h => [h.program, h]));
  const allProgs = new Set([...uHorses.keys(), ...pHorses.keys()]);

  const disagreements = [];
  for (const prog of allProgs) {
    const uH = uHorses.get(prog);
    const pH = pHorses.get(prog);
    if (!uH) { disagreements.push(`#${prog}: only in premium (${pH.name})`); continue; }
    if (!pH) { disagreements.push(`#${prog}: only in ultimate (${uH.name})`); continue; }
    if ((uH.name || "").trim() !== (pH.name || "").trim()) {
      disagreements.push(`#${prog}: NAME MISMATCH — ultimate="${uH.name}" premium="${pH.name}"`);
    }
    // Stats mismatch — focus on critical fields
    const fieldChecks = [
      { f: "mlOdds", tol: 0.2 },
      { f: "style", tol: 0 },
      { f: "primePower", tol: 3 },
      { f: "scratched", tol: 0, bool: true },
    ];
    for (const { f, tol, bool } of fieldChecks) {
      const uV = uH[f], pV = pH[f];
      if (uV == null || pV == null) continue;
      if (bool) {
        if (Boolean(uV) !== Boolean(pV)) {
          disagreements.push(`#${prog} ${uH.name || pH.name} ${f}: ultimate=${uV} premium=${pV}`);
        }
      } else if (typeof uV === "number" && typeof pV === "number") {
        if (Math.abs(uV - pV) > tol) {
          disagreements.push(`#${prog} ${uH.name || pH.name} ${f}: ultimate=${uV} premium=${pV}`);
        }
      } else if (uV !== pV) {
        disagreements.push(`#${prog} ${uH.name || pH.name} ${f}: ultimate="${uV}" premium="${pV}"`);
      }
    }
  }

  report.push({
    race: n,
    type: u.raceType,
    uCount: uHorses.size,
    pCount: pHorses.size,
    severity: disagreements.length === 0 ? "AGREE" : disagreements.length <= 3 ? "MINOR" : "MAJOR",
    disagreements,
  });
}

// Print report
console.log(`\n=== CROSS-CHECK: Ultimate vs Premium Gemini extractions ===\n`);
for (const r of report) {
  const tag = r.severity === "AGREE" ? "✓ AGREE" : r.severity === "MINOR" ? "~ MINOR" : "✗ MAJOR";
  console.log(`\n${tag}  Race ${r.race} (${r.type || "?"}): U=${r.uCount}h / P=${r.pCount}h`);
  if (r.disagreements?.length) {
    for (const d of r.disagreements) console.log(`   - ${d}`);
  }
}

// Summary
const agree = report.filter(r => r.severity === "AGREE").length;
const minor = report.filter(r => r.severity === "MINOR").length;
const major = report.filter(r => r.severity === "MAJOR").length;
console.log(`\n=== SUMMARY: ${agree} clean / ${minor} minor / ${major} MAJOR disagreements ===\n`);
if (major > 0) {
  console.log(`>>> HUMAN VERIFICATION NEEDED for races:`, report.filter(r => r.severity === "MAJOR").map(r => r.race).join(", "));
}
