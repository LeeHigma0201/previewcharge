// Chunked Gemini ingestion: one race per API call, run in parallel.
// This avoids output-token truncation on the 46-page Brisnet PP PDF.
//
// Usage: node scripts/ingest-chunked.mjs <pdf-path> <output-json> [--races 1,2,3,...]

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "/Users/jason/previewcharge/.claude/worktrees/infallible-noyce-e0c0c4/web/node_modules/@google/genai/dist/node/index.mjs";

const GEMINI_MODEL = "gemini-2.5-flash";
const MAX_CONCURRENCY = 5;  // keep under rate limits

function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  for (const p of [
    "/Users/jason/previewcharge/.env",
    "/Users/jason/previewcharge/.claude/worktrees/infallible-noyce-e0c0c4/.env",
    "/Users/jason/previewcharge/.claude/worktrees/infallible-noyce-e0c0c4/web/.env.local",
  ]) {
    if (fs.existsSync(p)) {
      const m = fs.readFileSync(p, "utf-8").match(/GEMINI_API_KEY=(.+)/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("GEMINI_API_KEY not found");
}

const SINGLE_RACE_PROMPT = (raceNum) => `Extract ONLY RACE ${raceNum} from this Brisnet PP PDF.
Scroll through the PDF to find the page headed "Race ${raceNum}" at the top.

Return this JSON object (no markdown, no commentary, no fences):

{
  "raceNumber": ${raceNum},
  "postTime": "HH:MM AM/PM exactly as shown (look for 'Post Time:')",
  "distance": "e.g. '1 1/16 Mile' or '6 Furlongs' or '5.5 Furlongs'",
  "surface": "Dirt" or "Turf",
  "raceType": "e.g. Mdn 110k, Alw 30000s, Clm 20000n2L, BenAli-G3, Elkhorn-G2",
  "purse": number dollars no commas,
  "conditions": "short description of entry conditions from the race header",
  "par": { "e1": number, "e2": number, "late": number, "speed": number } from PARS row,
  "speedBiasMeet": decimal 0-1 (Track Bias Stats Speed Bias % — 90% = 0.90),
  "wirePctMeet": decimal 0-1 (%Wire column),
  "railImpact": number (Post Bias RAIL Impact Value row),
  "horses": [
    {
      "program": "string program number e.g. '1' or '1A'",
      "post": number (post position, often same as program),
      "name": "horse name exactly",
      "jockey": "last name + first initial e.g. 'Machado L'",
      "trainer": "last name only e.g. 'Pletcher T'",
      "mlOdds": decimal (3/1=3, 9/5=1.8, 2/5=0.4, 20/1=20, 5/2=2.5),
      "style": "E" | "EP" | "P" | "S" | "C" | "?" (from Run Style — ++E/P→EP, ++S→S, NA→?),
      "primePower": number from Prime Power box in horse header,
      "classRating": number from Avg Race Rating column in Race Summary (round to 0.1),
      "classLast3": number from Average Class Last 3 row (round to 0.1),
      "paceE1": number from Best Pace E1 column,
      "paceE2": number from Best Pace E2 column,
      "paceLate": number from Best Pace Late column,
      "earlyPaceLast": number from Early Pace Last Race row,
      "latePaceLast": number from Late Pace Last Race row,
      "speedLastRace": number from Speed Last Race row (most recent SPD value),
      "backSpeed": number from Back Speed row (second SPD value),
      "last3Speeds": [up to 3 numbers from SPD column of the 3 most recent DATE TRK lines in this horse's PP block],
      "wins": number from Life W column,
      "starts": number from Life total starts column (leftmost Life number),
      "places": number from Life 2nd place column,
      "shows": number from Life 3rd place column,
      "daysSinceLast": number from Days Since L/R column,
      "lastFinishPosition": number from FIN column of most recent PP line (0 if DNF or first race),
      "jockeyWinPct": decimal 0-1 (jockey 2025-2026 win% — 17% = 0.17),
      "trainerWinPct": decimal 0-1 (trainer 2025-2026 win%),
      "weight": number (e.g. 118, 120, 124, 126),
      "scratched": boolean (true if annotated MTO, PV-Illness, Also-Eligible that won't run, OR listed in scratch watch footer),
      "notes": "short annotation if scratched or layoff, else null"
    }
  ]
}

RULES:
1. Values not visible → null, never 0 or made up.
2. ML odds decimals like 3.5/1 → 3.5.
3. Include scratched horses in the array with scratched: true.
4. ++E/P → EP. Strip the ++ qualifier.
5. For first-start horses with no PP lines, last3Speeds: [], wins: 0, starts: 0.
6. DO NOT return any race other than ${raceNum}. Just this one race object.

Return ONLY the JSON object, starting with { and ending with }.`;

async function extractRace(ai, pdfBase64, raceNum) {
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          { text: SINGLE_RACE_PROMPT(raceNum) },
        ],
      }],
      config: {
        temperature: 0.0,
        responseMimeType: "application/json",
        maxOutputTokens: 16384,
        thinkingConfig: { thinkingBudget: 0 },
      },
    });
    const text = response.text ?? "";
    if (!text) throw new Error(`empty response for race ${raceNum}`);
    try {
      return JSON.parse(text);
    } catch (err) {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw err;
    }
  } catch (err) {
    console.error(`[race ${raceNum}] FAILED: ${err.message}`);
    return null;
  }
}

const [, , pdfPath, outPath, ...extra] = process.argv;
if (!pdfPath || !outPath) {
  console.error("Usage: node scripts/ingest-chunked.mjs <pdf-path> <output-json> [--races 1,2,3]");
  process.exit(1);
}

const racesToRun = (() => {
  const idx = extra.indexOf("--races");
  if (idx >= 0 && extra[idx + 1]) return extra[idx + 1].split(",").map(Number);
  return Array.from({ length: 11 }, (_, i) => i + 1);
})();

(async () => {
  const ai = new GoogleGenAI({ apiKey: loadKey() });
  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  console.log(`[chunked] PDF loaded (${(pdfBase64.length * 0.75 / 1024 / 1024).toFixed(1)} MB), running ${racesToRun.length} races in parallel...`);
  const start = Date.now();

  // Run in batches of MAX_CONCURRENCY
  const results = new Array(racesToRun.length);
  for (let i = 0; i < racesToRun.length; i += MAX_CONCURRENCY) {
    const batch = racesToRun.slice(i, i + MAX_CONCURRENCY);
    const settled = await Promise.all(batch.map((rn, j) => extractRace(ai, pdfBase64, rn).then((r) => {
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      console.log(`[race ${rn}] ${r ? `${r.horses?.length || 0} horses (${elapsed}s)` : "FAILED"}`);
      return r;
    })));
    settled.forEach((r, j) => { results[i + j] = r; });
  }

  const races = results.filter(Boolean).sort((a, b) => a.raceNumber - b.raceNumber);
  fs.writeFileSync(outPath, JSON.stringify({ races }, null, 2));
  const horseCount = races.reduce((s, r) => s + (r.horses?.length || 0), 0);
  console.log(`[chunked] ✓ ${races.length} races / ${horseCount} horses in ${((Date.now() - start) / 1000).toFixed(1)}s → ${outPath}`);
})();
