import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

// Race-day intelligence: weather at Keeneland, last-minute scratches,
// jockey changes, track bias observations, sharp bettor chatter.
// Uses Gemini with Google Search grounding to pull live info.
export async function POST(req: NextRequest) {
  try {
    const { raceNumber, postTime, distance, surface } = await req.json();

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not set" },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const prompt = `You are a horse racing intelligence analyst. Today is Saturday April 18, 2026. Search for the latest information about Keeneland Race ${raceNumber} (post time ${postTime}, ${distance} on ${surface}).

Return a JSON object with exactly this shape — no markdown, no extra text:

{
  "weather": {
    "temperature_f": number,
    "conditions": "string (e.g. 'Clear', 'Light rain', 'Overcast')",
    "wind_mph": number,
    "precipitation_chance_pct": number,
    "impact_summary": "1 sentence on how this affects the race"
  },
  "track_condition": {
    "dirt": "string (Fast/Good/Muddy/Sloppy)",
    "turf": "string (Firm/Good/Yielding/Soft)",
    "bias_today": "1-2 sentences on observed track bias from today's earlier races"
  },
  "late_scratches": ["horse name if scratched today (not already on the official scratch list), else []"],
  "jockey_changes": ["e.g. 'Horse X: Jockey A replaces Jockey B'"],
  "sharp_money": ["1-3 bullet observations — unusual odds movement, trainer intent, paddock reports, etc."],
  "key_insight": "1-2 sentence takeaway — what matters most for betting this race"
}

Rules:
- If you cannot verify a field, return null or an empty array — never fabricate.
- Base temperature/conditions on live Lexington KY weather.
- For track bias, use any earlier Keeneland races today as signal.
- Keep it tight — terse, actionable, no fluff.`;

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        temperature: 0.1,
      },
    });

    const text = response.text ?? "";

    // Extract JSON — Gemini may wrap in markdown fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Gemini returned no parseable JSON", raw: text },
        { status: 502 },
      );
    }

    const intel = JSON.parse(jsonMatch[0]);
    return NextResponse.json({ intel, timestamp: Date.now() });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
