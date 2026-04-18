import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

// Fetch live Keeneland results for April 18, 2026 via Gemini web search.
// Returns { results: { [raceNumber]: [1st, 2nd, 3rd, 4th] } }.
// Used by the race-day ResultsPanel to auto-populate finishes as races go off.

const RESULTS_PROMPT = `TODAY IS 2026-04-18. Find the current race results for Keeneland on 2026-04-18.

Search these sources:
- equibase.com results
- twinspires.com Keeneland results
- keeneland.com results today
- drf.com results

For each race that has FINISHED (official or unofficial), report the
program numbers of the top 4 finishers in order.

Return ONLY this JSON:
{
  "results": {
    "1": ["3", "4", "5", "2"],
    "2": ["8", "4", "9", "1"]
  },
  "source": "where you found this",
  "last_updated": "time you saw the data"
}

RULES:
- Use program numbers (strings). Do NOT use horse names.
- Only include races that have run — skip races with no results yet.
- If you cannot find ANY results, return {"results": {}, "source": "none", "last_updated": ""}.
- Return ONLY valid JSON, no markdown.`;

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
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured", results: {}, source: "none" },
      { status: 500 },
    );
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

    // Normalize: ensure keys are numeric-string, values are arrays of program strings
    const results: Record<string, string[]> = {};
    if (parsed.results && typeof parsed.results === "object") {
      for (const [k, v] of Object.entries(parsed.results)) {
        if (Array.isArray(v)) {
          results[String(k)] = v.map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
        }
      }
    }

    return NextResponse.json({
      results,
      source: String(parsed.source ?? "gemini"),
      last_updated: String(parsed.last_updated ?? ""),
      fetched_at: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, results: {}, source: "error" }, { status: 500 });
  }
}
