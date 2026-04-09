import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

const RACE_DATA_PROMPT = `You are a horse racing data researcher. Given a race query, research and return ONLY factual race card data in JSON format.

QUERY: {query}

Return a JSON object with this exact structure:
{
  "track_code": "3-letter code (e.g. SAR, CD, GP, BEL, AQU, KEE, DMR)",
  "track_name": "Full track name",
  "race_number": integer,
  "race_date": "YYYY-MM-DD",
  "distance": "e.g. 6f, 1m, 1 1/16m",
  "surface": "Dirt or Turf or Synthetic",
  "race_type": "e.g. ALW, CLM, STK, MSW, MCL, GRD",
  "purse": integer in dollars,
  "condition": "Fast, Firm, Good, etc.",
  "track_bias": "Description of known track bias (e.g. speed-favoring, closer-friendly, inside rail advantage)",
  "weather": "Current or expected weather conditions",
  "horses": [
    {
      "name": "Horse Name",
      "program_number": "1",
      "post_position": 1,
      "morning_line_odds": 5.0,
      "jockey": "Jockey Name",
      "trainer": "Trainer Name",
      "running_style": "E or EP or P or S or C",
      "weight": 122,
      "last_3_beyer": [85, 82, 88],
      "wins": 3,
      "starts": 10,
      "jockey_win_pct": 0.18,
      "trainer_win_pct": 0.22,
      "distance_wins": 2,
      "distance_starts": 5,
      "surface_wins": 3,
      "surface_starts": 8,
      "is_class_drop": false,
      "is_class_raise": false,
      "days_since_last": 21,
      "equipment_change": false
    }
  ]
}

IMPORTANT RULES:
- Return ONLY the JSON object, no other text
- Use real, factual data only — do not fabricate horse names or statistics
- morning_line_odds should be decimal (e.g. 5.0 for 5/1, 2.0 for 2/1)
- running_style: E=early speed, EP=early presser, P=presser/stalker, S=sustained closer, C=deep closer
- If you cannot find the exact race, return {"error": "Race not found: [reason]"}
- last_3_beyer should be the 3 most recent Beyer Speed Figures (estimate from class level if exact figures unavailable)`;

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid query" },
        { status: 400 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY not configured on server" },
        { status: 500 },
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = RACE_DATA_PROMPT.replace("{query}", query);
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
    });

    let raw = response.text?.trim() ?? "";

    // Strip markdown code fences if present
    if (raw.startsWith("```")) {
      const lines = raw.split("\n");
      const filtered = lines.filter((l) => !l.trim().startsWith("```"));
      raw = filtered.join("\n");
    }

    const data = JSON.parse(raw);

    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
