// Gemini PDF → structured JSON pipeline for Keeneland Brisnet PPs.
//
// Usage: node scripts/ingest-pp.mjs <pdf-path> <output-json-path> [race-range]
// Example: node scripts/ingest-pp.mjs ~/Downloads/Keenland.pdf data/kee-apr18-ultimate.json 1-11
//
// Strategy: PDFs are 32-46 pages. Gemini 2.5 Flash has enough context for the
// whole thing, but we chunk by race for reliability and targetable reruns.
// Each chunk returns JSON matching the KeeneHorse/KeeneRace schema exactly.

import fs from "node:fs";
import path from "node:path";
import { GoogleGenAI } from "/Users/jason/previewcharge/.claude/worktrees/infallible-noyce-e0c0c4/web/node_modules/@google/genai/dist/node/index.mjs";

const GEMINI_MODEL = "gemini-2.5-flash";

// Load API key from any of the env files
function loadKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPaths = [
    "/Users/jason/previewcharge/.env",
    "/Users/jason/previewcharge/.claude/worktrees/infallible-noyce-e0c0c4/.env",
    "/Users/jason/previewcharge/.claude/worktrees/infallible-noyce-e0c0c4/web/.env.local",
  ];
  for (const p of envPaths) {
    if (fs.existsSync(p)) {
      const content = fs.readFileSync(p, "utf-8");
      const m = content.match(/GEMINI_API_KEY=(.+)/);
      if (m) return m[1].trim().replace(/^["']|["']$/g, "");
    }
  }
  throw new Error("GEMINI_API_KEY not found in env or .env files");
}

const SCHEMA_PROMPT = `You are extracting horse racing past performance data from a Brisnet PP PDF.
The PDF shows multiple races with each race containing detailed per-horse entries.

EXTRACT EXACTLY THIS JSON STRUCTURE — NO MARKDOWN, NO COMMENTARY, JUST VALID JSON:

{
  "races": [
    {
      "raceNumber": number,
      "postTime": "HH:MM AM/PM string exactly as shown",
      "distance": "e.g. '1 1/16 Mile' or '6 Furlongs' or '5.5 Furlongs'",
      "surface": "Dirt" or "Turf",
      "raceType": "e.g. Mdn 110k, Alw 30000s, Clm 20000n2L, BenAli-G3",
      "purse": number (dollars, no commas),
      "conditions": "short description of entry conditions",
      "par": { "e1": number, "e2": number, "late": number, "speed": number } (from PARS row; use 0 if missing),
      "speedBiasMeet": decimal 0-1 (from Track Bias Stats Speed Bias % column — convert 90% to 0.90),
      "wirePctMeet": decimal 0-1 (from %Wire column),
      "railImpact": number (from Post Bias RAIL Impact Value row, default 1.0 if not shown),
      "horses": [
        {
          "program": "string program number",
          "post": number (usually matches program unless coupled),
          "name": "horse name exactly",
          "jockey": "jockey last name and first initial e.g. 'Machado L'",
          "trainer": "trainer last name e.g. 'Pletcher T'",
          "mlOdds": number (3/1 = 3, 9/5 = 1.8, 2/5 = 0.4, 20/1 = 20),
          "style": one of "E" | "EP" | "P" | "S" | "C" | "?" (from Run Style column — map ++E/P to EP, ++S to S, NA to "?"),
          "primePower": number (from Prime Power heading in the horse's top-right box),
          "classRating": number (from Avg Race Rating column in Race Summary),
          "classLast3": number (from Average Class Last 3 row below Race Summary),
          "paceE1": number (from Best Pace E1 column in Race Summary),
          "paceE2": number (from Best Pace E2 column),
          "paceLate": number (from Best Pace Late column),
          "earlyPaceLast": number (from Early Pace Last Race row),
          "latePaceLast": number (from Late Pace Last Race row),
          "speedLastRace": number (from Speed Last Race row),
          "backSpeed": number (from Back Speed row),
          "last3Speeds": array of up to 3 numbers (SPD column values from most recent 3 DATE TRK lines in PP),
          "wins": number (Life W column),
          "starts": number (Life total starts column),
          "places": number (Life 2nd place count),
          "shows": number (Life 3rd place count),
          "daysSinceLast": number (Days Since L/R column),
          "lastFinishPosition": number (FIN column of most recent PP line, 0 if DNF),
          "jockeyWinPct": decimal 0-1 (jockey's 2025-2026 win%; e.g. 17% shown as 0.17),
          "trainerWinPct": decimal 0-1 (trainer's 2025-2026 win%),
          "weight": number (e.g. 118, 120, 124, 126),
          "scratched": boolean (true if listed on the scratch watch page OR annotated "MTO" or "PV-Illness" or "Also-Eligible" that won't run),
          "notes": "any important annotation like 'MTO' or 'layoff' or scratched reason, otherwise null"
        }
      ]
    }
  ]
}

RULES:
1. If a value is not visible, use null (not 0, not "unknown").
2. For ML odds like "7/2", return 3.5 (decimal form, NOT 3.5/1).
3. Do NOT fabricate numbers. Better to return null than guess.
4. Include scratched horses in the horses array with scratched: true so we know they were listed.
5. For style column "++E/P", map to "EP" — the ++ just means Brisnet's high confidence, we don't need it.
6. For a horse with no races yet, set last3Speeds to [], wins/starts to 0.
7. Watch for the scratch watch footer at the end of the PDF — it lists horses that won't run. Mark those scratched: true with notes explaining reason.

Return ONLY the JSON object. No \`\`\`json fences.`;

async function extractRaces(pdfPath) {
  const ai = new GoogleGenAI({ apiKey: loadKey() });
  const pdfBytes = fs.readFileSync(pdfPath);
  const pdfBase64 = pdfBytes.toString("base64");

  console.log(`[ingest] uploading ${path.basename(pdfPath)} (${(pdfBytes.length / 1024 / 1024).toFixed(1)} MB)`);

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
          { text: SCHEMA_PROMPT },
        ],
      },
    ],
    config: {
      temperature: 0.0,
      responseMimeType: "application/json",
      maxOutputTokens: 65536,  // Gemini 2.5 Flash max; default 8192 truncates a 46-page PP file
      thinkingConfig: { thinkingBudget: 0 },  // disable thinking to save output tokens
    },
  });

  const text = response.text ?? "";
  const rawDumpPath = `/tmp/gemini-raw-${path.basename(pdfPath, '.pdf').replace(/\s+/g, '_')}.txt`;
  fs.writeFileSync(rawDumpPath, text);
  console.log(`[ingest] response length: ${text.length} chars → raw saved: ${rawDumpPath}`);
  if (!text) throw new Error("empty response from Gemini");

  try {
    return JSON.parse(text);
  } catch (err) {
    // Try repair: find last balanced brace
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch (_) {
        // fall through to truncation recovery
      }
    }
    // Truncation recovery — find last valid horse entry and close the structure
    console.error(`[ingest] JSON truncated at char ${err.message.match(/position (\d+)/)?.[1]}, attempting recovery...`);
    let s = text;
    // Walk backward to find last complete horse object (ends in } possibly followed by comma)
    // then close races[].horses[], races[], and root
    const lastHorseClose = s.lastIndexOf('}');
    if (lastHorseClose > 0) {
      s = s.substring(0, lastHorseClose + 1);
      // Count open brackets/braces to compute closures needed
      const opens = (s.match(/[\[\{]/g) || []).length;
      const closes = (s.match(/[\]\}]/g) || []).length;
      const diff = opens - closes;
      // Close with assumption: inside horses array of races array of root object
      // Typical closure sequence: ] (horses) } (race) ] (races) } (root)
      let closure = "";
      // Remove trailing comma if any
      s = s.replace(/,\s*$/, "");
      for (let i = 0; i < diff; i++) {
        // Alternate based on nesting (brute force, try both)
        closure += (i % 2 === 0) ? "]" : "}";
      }
      // Heuristic: most PDFs end with diff = 4 (horse-close ]races ]root} + maybe another })
      // Just try closing with ], }, ], }
      const tries = [
        s + "]" + "}" + "]" + "}",
        s + "]" + "}" + "]" + "}" + "}",
        s + "}" + "]" + "}",
        s + closure,
      ];
      for (const candidate of tries) {
        try {
          const parsed = JSON.parse(candidate);
          console.warn(`[ingest] recovered truncated JSON (may be missing last few horses)`);
          return parsed;
        } catch (_) {}
      }
    }
    throw new Error(`Failed to parse JSON. Raw saved to ${rawDumpPath}. Parse error: ${err.message}`);
  }
}

const [, , pdfPath, outPath] = process.argv;
if (!pdfPath || !outPath) {
  console.error("Usage: node scripts/ingest-pp.mjs <pdf-path> <output-json-path>");
  process.exit(1);
}

(async () => {
  const start = Date.now();
  const data = await extractRaces(pdfPath);
  fs.writeFileSync(outPath, JSON.stringify(data, null, 2));
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  const raceCount = data.races?.length ?? 0;
  const horseCount = (data.races ?? []).reduce((sum, r) => sum + (r.horses?.length ?? 0), 0);
  console.log(`[ingest] ✓ ${raceCount} races / ${horseCount} horses in ${elapsed}s → ${outPath}`);
})();
