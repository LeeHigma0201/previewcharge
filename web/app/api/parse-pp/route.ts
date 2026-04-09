import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

const CHART_EXTRACT_PROMPT = `Extract ALL horse data from this Equibase race chart PDF.

For EACH horse in the chart, extract exactly what is printed — do not guess or estimate:

Return a JSON object:
{
  "race": {
    "track_code": "3-letter code",
    "track_name": "Full name",
    "race_number": 3,
    "race_date": "YYYY-MM-DD",
    "distance": "6 Furlongs",
    "surface": "Dirt",
    "race_type": "Starter Allowance",
    "purse": 55000,
    "condition": "Fast",
    "winner_final_time": "1:10.45"
  },
  "horses": [
    {
      "name": "Exact Horse Name",
      "program_number": "1",
      "finish_position": 1,
      "jockey": "Jockey Name",
      "trainer": "Trainer Name",
      "weight": 122,
      "odds": 3.5,
      "lengths_behind": 0,
      "position_1st_call": 2,
      "lengths_off_lead_1st_call": 0.5,
      "position_2nd_call": 1,
      "position_stretch": 1,
      "margin": "2 1/4",
      "comment": "stalked pace, drew off"
    }
  ]
}

RULES:
- Extract EVERY horse in the chart, from 1st to last
- Copy names EXACTLY as printed — no modifications
- odds should be decimal (e.g. 7/2 = 3.5, 5/1 = 5.0)
- lengths_behind: 0 for winner, actual beaten lengths for others
- position_1st_call and lengths_off_lead_1st_call are critical — read carefully from the running line
- If a horse is listed as scratched, do NOT include them
- Return ONLY valid JSON, no markdown, no explanation`;

function cleanJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const lines = s.split("\n");
    const filtered = lines.filter((l) => !l.trim().startsWith("```"));
    s = filtered.join("\n").trim();
  }
  return s;
}

// Compute running style from 1st call position
function computeRunningStyle(pos: number | null, lengthsOff: number | null): string {
  if (pos === null || lengthsOff === null) return "P"; // default
  if (pos <= 2 && lengthsOff <= 1) return "E";
  if (pos <= 4 && lengthsOff <= 3) return "EP";
  if (lengthsOff <= 7) return "P";
  if (lengthsOff <= 10) return "S";
  return "C";
}

// Compute speed figure from final time
// Formula: 100 + ((par_time - horse_final_time) × 10) + track_variant
// For now, use standard par times by distance. These get refined over time.
const PAR_TIMES: Record<string, number> = {
  "4.5f": 52.0, "5f": 58.0, "5.5f": 64.0, "6f": 70.0, "6.5f": 76.5,
  "7f": 83.0, "1m": 96.0, "1m70y": 97.5, "1 1/16m": 103.0,
  "1 1/8m": 109.0, "1 3/16m": 115.0, "1 1/4m": 121.0,
  "1 3/8m": 134.0, "1 1/2m": 147.0, "1 3/4m": 173.0,
};

function parseTimeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  // Format: "1:10.45" or "58.20"
  const parts = timeStr.replace(/[^\d:.]/g, "").split(":");
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return parseFloat(parts[0]) || null;
}

function normalizeDistance(dist: string): string {
  const d = dist.toLowerCase().trim();
  if (d.includes("4") && d.includes("half")) return "4.5f";
  if (d.includes("5") && d.includes("half")) return "5.5f";
  if (d.includes("6") && d.includes("half")) return "6.5f";
  if (/\b4\s*f/.test(d)) return "4.5f";
  if (/\b5\s*f/.test(d)) return "5f";
  if (/\b6\s*f/.test(d)) return "6f";
  if (/\b7\s*f/.test(d)) return "7f";
  if (/1\s*1\/16/.test(d)) return "1 1/16m";
  if (/1\s*1\/8/.test(d)) return "1 1/8m";
  if (/1\s*3\/16/.test(d)) return "1 3/16m";
  if (/1\s*1\/4/.test(d)) return "1 1/4m";
  if (/1\s*1\/2/.test(d)) return "1 1/2m";
  if (/\b1\s*mile|1m\b/.test(d)) return "1m";
  if (/\b6\b/.test(d)) return "6f";
  if (/\b7\b/.test(d)) return "7f";
  return "6f"; // fallback
}

function computeSpeedFigure(
  winnerTime: string | null,
  lengthsBehind: number,
  distance: string,
): number | null {
  if (!winnerTime) return null;
  const winSec = parseTimeToSeconds(winnerTime);
  if (!winSec) return null;

  const horseSec = winSec + lengthsBehind * 0.20;
  const distKey = normalizeDistance(distance);
  const par = PAR_TIMES[distKey];
  if (!par) return null;

  // 100 + ((par - horse_time) × 10) — faster than par = higher figure
  return Math.round(100 + (par - horseSec) * 10);
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    // Read file as base64
    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString("base64");
    const mimeType = file.type || "application/pdf";

    const ai = new GoogleGenAI({ apiKey });

    // Send file to Gemini for extraction
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: base64 } },
            { text: CHART_EXTRACT_PROMPT },
          ],
        },
      ],
    });

    const raw = cleanJson(response.text ?? "");
    let chartData: Record<string, unknown>;
    try {
      chartData = JSON.parse(raw);
    } catch {
      return NextResponse.json(
        { error: `Failed to parse chart. Gemini response: ${raw.substring(0, 300)}` },
        { status: 422 },
      );
    }

    const race = chartData.race as Record<string, unknown> | undefined;
    const horses = chartData.horses as Record<string, unknown>[] | undefined;

    if (!horses || horses.length === 0) {
      return NextResponse.json({ error: "No horses found in chart" }, { status: 404 });
    }

    // Compute derived fields for each horse
    const winnerTime = race?.winner_final_time as string | null;
    const distance = String(race?.distance ?? "6f");

    const enrichedHorses = horses.map((h) => {
      const pos1st = h.position_1st_call as number | null;
      const lenOff = h.lengths_off_lead_1st_call as number | null;
      const lenBehind = Number(h.lengths_behind ?? 0);

      const runningStyle = computeRunningStyle(pos1st, lenOff);
      const speedFigure = computeSpeedFigure(winnerTime, lenBehind, distance);

      return {
        ...h,
        running_style: runningStyle,
        speed_figure: speedFigure,
        data_source: "equibase_chart",
      };
    });

    return NextResponse.json({
      race,
      horses: enrichedHorses,
      computed: {
        speed_figures_calculated: enrichedHorses.filter((h) => h.speed_figure !== null).length,
        running_styles_computed: enrichedHorses.length,
        par_time_used: PAR_TIMES[normalizeDistance(distance)] ?? null,
        winner_time: winnerTime,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
