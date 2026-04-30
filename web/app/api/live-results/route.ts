import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { CD_2026_04_30 } from "../../lib/cd-2026-04-30";

const GEMINI_MODEL = "gemini-2.5-flash";

// Fetch live Churchill Downs results for today's card via Gemini web search.
// Returns { results: { [raceNumber]: [1st, 2nd, 3rd, 4th] } }.
// Used by the race-day ResultsPanel to auto-populate finishes as races go off.

const TODAYS_DATE = "2026-04-30";
const TRACK_CODE = "CD";
const TRACK_NAME = "Churchill Downs";

// Build a context block giving Gemini the actual card so it grounds its
// program numbers against entered horses, not hallucinated ones.
const CARD_CONTEXT = (() => {
  const lines = CD_2026_04_30.map((r) => {
    const horses = r.horses.map((h) => `#${h.program} ${h.name}`).join(", ");
    return `Race ${r.raceNumber} (${r.raceType.trim()} ${r.distance} ${r.surface}, post ${r.postTime}): ${horses}`;
  }).join("\n");
  return lines;
})();

const VALID_PROGRAMS_BY_RACE = new Map<string, Set<string>>(
  CD_2026_04_30.map((r) => [String(r.raceNumber), new Set(r.horses.map((h) => h.program))]),
);

const RESULTS_PROMPT = `TASK: Find official or unofficial results for ${TRACK_NAME} on ${TODAYS_DATE}.

Today: ${TODAYS_DATE} (Wednesday). Track: ${TRACK_NAME} (${TRACK_CODE}).

ENTERED CARD (this is authoritative — only these horses ran today):
${CARD_CONTEXT}

Search for finished races in this order:
1. site:equibase.com ${TRACK_CODE} results ${TODAYS_DATE}
2. twinspires.com ${TRACK_CODE} results ${TODAYS_DATE}
3. churchilldowns.com results ${TODAYS_DATE}
4. drf.com ${TRACK_CODE} ${TODAYS_DATE} results
5. horseracingnation.com ${TRACK_CODE} results ${TODAYS_DATE}

For each race that has FINISHED, return the program numbers of the top 4 finishers in order.

CRITICAL RULES:
- ONLY return program numbers that exist in the ENTERED CARD above.
- Do NOT invent program numbers. If a result source shows a program not on today's card,
  it's a different date — IGNORE it.
- Better to return zero results than wrong ones.
- Use program numbers as STRINGS. No horse names in the result arrays.
- Skip races that haven't run yet.

Return ONLY this JSON:
{
  "results": {
    "1": ["3", "4", "5", "2"],
    "2": ["8", "4", "9", "1"]
  },
  "source": "url or site",
  "last_updated": "ISO timestamp you saw the data"
}

If no results available, return {"results": {}, "source": "none", "last_updated": ""}.
Return ONLY valid JSON, no markdown.`;

function cleanJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const lines = s.split("\n").filter((l) => !l.trim().startsWith("```"));
    s = lines.join("\n").trim();
  }
  return s;
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      results: {},
      source: "none",
      gemini_disabled: true,
      message: "Live results unavailable — GEMINI_API_KEY not set on Vercel. Log finishes manually.",
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: RESULTS_PROMPT,
      config: { tools: [{ googleSearch: {} }] },
    });
    const raw = cleanJson(response.text ?? "");
    const parsed = JSON.parse(raw);

    // Validate: every program must exist in the entered card for that race.
    // Drop entire race-result if any program is invalid (likely wrong-day data).
    const results: Record<string, string[]> = {};
    const rejected: Array<{ race: string; programs: string[]; reason: string }> = [];
    if (parsed.results && typeof parsed.results === "object") {
      for (const [k, v] of Object.entries(parsed.results)) {
        if (!Array.isArray(v)) continue;
        const programs = (v as unknown[]).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
        const valid = VALID_PROGRAMS_BY_RACE.get(String(k));
        if (!valid) {
          rejected.push({ race: String(k), programs, reason: "race number not on card" });
          continue;
        }
        const allValid = programs.every((p) => valid.has(p));
        if (!allValid) {
          rejected.push({ race: String(k), programs, reason: "contains program(s) not on card" });
          continue;
        }
        if (programs.length > 0) {
          results[String(k)] = programs;
        }
      }
    }

    return NextResponse.json({
      results,
      source: String(parsed.source ?? "gemini"),
      last_updated: String(parsed.last_updated ?? ""),
      fetched_at: new Date().toISOString(),
      rejected_count: rejected.length,
      rejected: rejected.slice(0, 20),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, results: {}, source: "error" }, { status: 500 });
  }
}
