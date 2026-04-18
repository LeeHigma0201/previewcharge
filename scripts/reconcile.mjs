// Reconcile Ultimate + Premium Gemini extractions + hand-typed data.
// Produces a single JSON with per-race confidence scores.
//
// Strategy per race:
//   1. Get horse lineups from all 3 sources (Ultimate, Premium, handtyped)
//   2. Vote: use the lineup that at least 2 of 3 agree on (by program→name mapping)
//   3. For stats, use Ultimate first, fall back to Premium, then handtyped
//   4. Flag confidence: HIGH if all 3 agree, MED if 2 of 3, LOW if they all differ
//
// Usage: node scripts/reconcile.mjs <ultimate> <premium> <hand-ts> <out-json>

import fs from "node:fs";

const [ultPath, premPath, tsPath, outPath] = process.argv.slice(2);

const ultimate = JSON.parse(fs.readFileSync(ultPath, "utf-8"));
const premium = JSON.parse(fs.readFileSync(premPath, "utf-8"));

// Parse hand-typed TS file via regex (same approach as diff-data.mjs)
const tsContent = fs.readFileSync(tsPath, "utf-8");
const raceBlocks = tsContent.match(/\{\s*raceNumber:\s*\d+[\s\S]*?horses:\s*\[[\s\S]*?\],\s*\}/g) || [];
function parseRaceBlock(block) {
  const num = Number(block.match(/raceNumber:\s*(\d+)/)?.[1] || 0);
  const postTime = block.match(/postTime:\s*"([^"]+)"/)?.[1];
  const distance = block.match(/distance:\s*"([^"]+)"/)?.[1];
  const surface = block.match(/surface:\s*"([^"]+)"/)?.[1];
  const raceType = block.match(/raceType:\s*"([^"]+)"/)?.[1];
  const purse = Number(block.match(/purse:\s*(\d+)/)?.[1] || 0);
  const conditions = block.match(/conditions:\s*"([^"]+)"/)?.[1];
  const horses = [];
  const horseRe = /\{\s*program:\s*"([^"]+)"[^}]*?\}/g;
  let m;
  while ((m = horseRe.exec(block))) {
    const hBlock = m[0];
    const g = (k, isBool = false) => {
      if (isBool) return hBlock.includes(`${k}: true`);
      const mm = hBlock.match(new RegExp(`${k}:\\s*(-?[\\d.]+)`));
      return mm ? Number(mm[1]) : null;
    };
    const gs = (k) => hBlock.match(new RegExp(`${k}:\\s*"([^"]+)"`))?.[1] || null;
    const ga = (k) => {
      const mm = hBlock.match(new RegExp(`${k}:\\s*\\[([^\\]]+)\\]`));
      if (!mm) return null;
      return mm[1].split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
    };
    horses.push({
      program: m[1],
      post: g("post"),
      name: gs("name"),
      jockey: gs("jockey"),
      trainer: gs("trainer"),
      mlOdds: g("mlOdds"),
      style: gs("style") || "?",
      primePower: g("primePower"),
      classRating: g("classRating"),
      classLast3: g("classLast3"),
      paceE1: g("paceE1"),
      paceE2: g("paceE2"),
      paceLate: g("paceLate"),
      earlyPaceLast: g("earlyPaceLast"),
      latePaceLast: g("latePaceLast"),
      speedLastRace: g("speedLastRace"),
      backSpeed: g("backSpeed"),
      last3Speeds: ga("last3Speeds"),
      wins: g("wins"),
      starts: g("starts"),
      places: g("places"),
      shows: g("shows"),
      daysSinceLast: g("daysSinceLast"),
      lastFinishPosition: g("lastFinishPosition"),
      jockeyWinPct: g("jockeyWinPct"),
      trainerWinPct: g("trainerWinPct"),
      weight: g("weight"),
      scratched: g("scratched", true),
      notes: gs("notes"),
    });
  }
  return { raceNumber: num, postTime, distance, surface, raceType, purse, conditions, horses };
}
const handRaces = raceBlocks.map(parseRaceBlock);

// Helper: for a race, compare lineups and decide "winning" lineup by majority vote
function pickLineup(uH, pH, hH) {
  const sources = [
    { name: "ultimate", horses: uH || [] },
    { name: "premium", horses: pH || [] },
    { name: "hand", horses: hH || [] },
  ];
  // Build program→name sets for each source
  const sets = sources.map(s => ({
    name: s.name,
    map: new Map((s.horses || []).map(h => [h.program, (h.name || "").trim().toLowerCase()])),
  }));
  // For each program number across all sources, count votes by name
  const allProgs = new Set(sources.flatMap(s => (s.horses || []).map(h => h.program)));
  const lineup = [];
  const votes = {};
  for (const prog of allProgs) {
    const names = sets.map(s => s.map.get(prog)).filter(Boolean);
    const tally = {};
    for (const name of names) tally[name] = (tally[name] || 0) + 1;
    const winning = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    if (!winning) continue;
    const [winName, winCount] = winning;
    votes[prog] = { winName, winCount, total: names.length };
    // Which sources agree on the winner?
    const agreeingSources = sets.filter(s => s.map.get(prog) === winName).map(s => s.name);
    lineup.push({ program: prog, winName, agreeingSources, names });
  }
  // Sort by program number numerically if possible
  lineup.sort((a, b) => {
    const na = Number(a.program), nb = Number(b.program);
    return isNaN(na) || isNaN(nb) ? a.program.localeCompare(b.program) : na - nb;
  });
  return { lineup, votes };
}

// Merge stats for a single horse given its program and the winning name.
// Use ultimate if name matches, fall back to premium if name matches, then hand.
function mergeStats(prog, winName, uH, pH, hH) {
  const norm = (s) => (s || "").trim().toLowerCase();
  const uHorse = (uH || []).find(h => h.program === prog && norm(h.name) === winName);
  const pHorse = (pH || []).find(h => h.program === prog && norm(h.name) === winName);
  const hHorse = (hH || []).find(h => h.program === prog && norm(h.name) === winName);

  // Build merged object — prefer ultimate > premium > hand, but only keep non-null
  const merged = {};
  const allFields = ["post", "name", "jockey", "trainer", "mlOdds", "style", "primePower",
    "classRating", "classLast3", "paceE1", "paceE2", "paceLate", "earlyPaceLast", "latePaceLast",
    "speedLastRace", "backSpeed", "last3Speeds", "wins", "starts", "places", "shows",
    "daysSinceLast", "lastFinishPosition", "jockeyWinPct", "trainerWinPct", "weight", "scratched", "notes"];
  for (const f of allFields) {
    if (uHorse && uHorse[f] != null && (!Array.isArray(uHorse[f]) || uHorse[f].length > 0)) { merged[f] = uHorse[f]; continue; }
    if (pHorse && pHorse[f] != null && (!Array.isArray(pHorse[f]) || pHorse[f].length > 0)) { merged[f] = pHorse[f]; continue; }
    if (hHorse && hHorse[f] != null && (!Array.isArray(hHorse[f]) || hHorse[f].length > 0)) { merged[f] = hHorse[f]; continue; }
  }
  merged.program = prog;
  // Preserve case-correct name — use first non-null actual name (not lowered)
  merged.name = (uHorse?.name) || (pHorse?.name) || (hHorse?.name) || winName;
  merged.style = merged.style === "?" || !merged.style ? "?" : merged.style;
  return merged;
}

const uByNum = new Map((ultimate.races || []).map(r => [r.raceNumber, r]));
const pByNum = new Map((premium.races || []).map(r => [r.raceNumber, r]));
const hByNum = new Map(handRaces.map(r => [r.raceNumber, r]));

const reconciled = [];
for (let n = 1; n <= 11; n++) {
  const u = uByNum.get(n);
  const p = pByNum.get(n);
  const h = hByNum.get(n);
  const firstPresent = u || p || h;
  if (!firstPresent) continue;

  const { lineup, votes } = pickLineup(u?.horses, p?.horses, h?.horses);

  // Confidence based on how many horses got unanimous agreement
  const unanimous = lineup.filter(l => l.agreeingSources.length === 3).length;
  const twoOfThree = lineup.filter(l => l.agreeingSources.length === 2).length;
  const total = lineup.length;
  const confidence = total === 0 ? "NONE" : unanimous === total ? "HIGH" : (unanimous + twoOfThree) >= total * 0.7 ? "MED" : "LOW";

  // Race-level metadata: prefer premium (seemed more complete/stable) then ultimate
  const meta = {
    raceNumber: n,
    postTime: h?.postTime || u?.postTime || p?.postTime,
    distance: h?.distance || u?.distance || p?.distance,
    surface: h?.surface || u?.surface || p?.surface,
    raceType: h?.raceType || u?.raceType || p?.raceType,
    purse: h?.purse || u?.purse || p?.purse,
    conditions: h?.conditions || u?.conditions || p?.conditions,
    par: u?.par || p?.par || { e1: 0, e2: 0, late: 0, speed: 0 },
    speedBiasMeet: u?.speedBiasMeet ?? p?.speedBiasMeet ?? 0.5,
    wirePctMeet: u?.wirePctMeet ?? p?.wirePctMeet ?? 0.15,
    railImpact: u?.railImpact ?? p?.railImpact ?? 1.0,
    confidence,
    dataAudit: { unanimous, twoOfThree, total, disputed: total - unanimous - twoOfThree },
  };

  // Build horse array using voted lineup
  const horses = lineup
    .map(l => mergeStats(l.program, l.winName, u?.horses, p?.horses, h?.horses))
    .filter(h => h.program && h.name);

  reconciled.push({ ...meta, horses });
}

fs.writeFileSync(outPath, JSON.stringify({ races: reconciled }, null, 2));

// Print summary
console.log(`\n=== RECONCILIATION SUMMARY ===`);
for (const r of reconciled) {
  const emoji = r.confidence === "HIGH" ? "✓" : r.confidence === "MED" ? "~" : "✗";
  console.log(`${emoji} Race ${r.raceNumber} (${r.raceType}): ${r.horses.length} horses — ${r.confidence}  [unanimous=${r.dataAudit.unanimous} 2of3=${r.dataAudit.twoOfThree} disputed=${r.dataAudit.disputed}]`);
}
const needVerify = reconciled.filter(r => r.confidence !== "HIGH").map(r => r.raceNumber);
if (needVerify.length) console.log(`\n>>> NotebookLM verification needed for races: ${needVerify.join(", ")}`);
console.log();
