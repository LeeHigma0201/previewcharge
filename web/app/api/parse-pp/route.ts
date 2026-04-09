import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

// Each TVG screenshot category extracts different data
const PROMPTS: Record<string, string> = {
  summary: `Extract race and horse data from this TVG "Advanced Summary" screenshot.

For each horse visible, return:
- name, program_number, morning_line_odds (decimal: 5/1=5.0, 3/2=1.5)
- jockey, trainer, weight
- wins, starts (career record if shown)
- any scratched horses (marked SCR or crossed out)

Return JSON:
{
  "race": { "track_code":"","track_name":"","race_number":0,"race_date":"","distance":"","surface":"","race_type":"","purse":0,"condition":"" },
  "horses": [
    { "name":"","program_number":"","morning_line_odds":5.0,"jockey":"","trainer":"","weight":122,"wins":0,"starts":0,"scratched":false }
  ]
}
ONLY return valid JSON. No markdown.`,

  snapshot: `Extract horse data from this TVG "Snapshot" screenshot.

This view shows a quick overview of each horse. Extract:
- name, program_number
- morning_line_odds (decimal)
- any power rating or ranking number shown
- any comment or description about the horse
- last race finish position if shown
- days since last race if shown

Return JSON array:
[
  { "name":"","program_number":"","morning_line_odds":5.0,"power_rating":null,"comment":"","last_finish_position":null,"days_since_last":null }
]
ONLY return valid JSON. No markdown.`,

  speed: `Extract speed and class data from this TVG "Speed and Class" screenshot.

This is the most important view for the algorithm. Extract for each horse:
- name, program_number
- speed figures / speed ratings (ALL numbers shown — these are our primary data)
- class rating or level
- best speed figure
- average speed figure from last 3 races
- any distance/surface specific figures
- purse levels of recent races (for class calculation)

Return JSON array:
[
  { "name":"","program_number":"","speed_figures":[85,82,88],"best_speed":88,"avg_speed":85,"class_rating":null,"recent_purses":[] }
]
ONLY return valid JSON. No markdown.`,

  pace: `Extract pace data from this TVG "Pace" screenshot.

This tells us how each horse runs — early speed, mid-race position, closing ability. Extract:
- name, program_number
- early pace figure or early speed rating
- mid-race pace figure
- late pace / closing figure
- running style classification if shown
- position at 1st call in recent races
- lengths behind at 1st call

From the pace data, determine running style:
- Led or within 1 length at 1st call = "E" (early speed)
- 1-3 lengths off at 1st call = "EP" (early presser)
- 3-7 lengths off = "P" (presser/stalker)
- 7-10 lengths off = "S" (sustained closer)
- 10+ lengths off = "C" (deep closer)

Return JSON array:
[
  { "name":"","program_number":"","early_pace":null,"late_pace":null,"running_style":"P","avg_1st_call_position":null,"avg_lengths_off_lead":null }
]
ONLY return valid JSON. No markdown.`,

  jockey: `Extract jockey and trainer statistics from this TVG "Jockey/Trainer" screenshot.

For each horse, extract:
- name, program_number
- jockey name and their statistics (win%, place%, show%, ROI, current meet record)
- trainer name and their statistics (win%, place%, show%, ROI, current meet record)
- jockey/trainer combo stats if shown
- any trainer patterns noted (1st time starters, layoffs, surface switches)

Return JSON array:
[
  { "name":"","program_number":"","jockey":"","jockey_win_pct":0.18,"jockey_starts":50,"trainer":"","trainer_win_pct":0.22,"trainer_starts":30,"combo_win_pct":null,"trainer_notes":"" }
]
ONLY return valid JSON. No markdown.`,
};

function cleanJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    s = s.split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim();
  }
  return s;
}

// Compute running style from pace data
function computeRunningStyle(pos: number | null, lengthsOff: number | null): string {
  if (pos === null || lengthsOff === null) return "P";
  if (pos <= 2 && lengthsOff <= 1) return "E";
  if (pos <= 4 && lengthsOff <= 3) return "EP";
  if (lengthsOff <= 7) return "P";
  if (lengthsOff <= 10) return "S";
  return "C";
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const category = String(formData.get("category") ?? "summary");
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const prompt = PROMPTS[category];
    if (!prompt) {
      return NextResponse.json({ error: `Unknown category: ${category}` }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "image/png";

    const ai = new GoogleGenAI({ apiKey });

    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: prompt },
          ],
        },
      ],
    });

    const raw = cleanJson(response.text ?? "");
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: `Failed to parse ${category} data. Response: ${raw.substring(0, 300)}` },
        { status: 422 },
      );
    }

    return NextResponse.json({ category, data });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
