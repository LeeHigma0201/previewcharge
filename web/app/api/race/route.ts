import { GoogleGenAI } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";
const EQUIBASE_BASE = "https://www.equibase.com";

// Track alias map — ported from src/data/scrapers/equibase.py
const TRACK_ALIASES: Record<string, string> = {
  saratoga: "SAR", belmont: "BEL", aqueduct: "AQU",
  churchill: "CD", "churchill downs": "CD", keeneland: "KEE",
  "santa anita": "SA", gulfstream: "GP", "gulfstream park": "GP",
  "del mar": "DMR", pimlico: "PIM", oaklawn: "OP",
  "oaklawn park": "OP", laurel: "LRL", "laurel park": "LRL",
  monmouth: "MTH", "monmouth park": "MTH", parx: "PRX",
  "tampa bay": "TAM", "tampa bay downs": "TAM", "fair grounds": "FG",
  woodbine: "WO", "los alamitos": "LA", turfway: "TP",
  "turfway park": "TP", "penn national": "PEN", "charles town": "CT",
  "finger lakes": "FL", "golden gate": "GG", "golden gate fields": "GG",
  "ellis park": "ELP", remington: "RP", "remington park": "RP",
  "lone star": "LS", "sam houston": "HOU", "turf paradise": "TUP",
  sunland: "SUN", "sunland park": "SUN", mountaineer: "MNR",
  "prairie meadows": "PRM", hawthorne: "HAW", arlington: "AP",
  "indiana grand": "IND",
  // Direct codes
  sar: "SAR", bel: "BEL", aqu: "AQU", cd: "CD", kee: "KEE",
  sa: "SA", gp: "GP", dmr: "DMR", pim: "PIM", op: "OP",
  lrl: "LRL", mth: "MTH", prx: "PRX", tam: "TAM", fg: "FG",
  wo: "WO", tp: "TP", pen: "PEN", ct: "CT", fl: "FL",
  gg: "GG", elp: "ELP", rp: "RP", hou: "HOU", tup: "TUP",
  sun: "SUN", mnr: "MNR", haw: "HAW", ind: "IND",
};

// Gemini prompt: parse Equibase HTML into structured JSON
const PARSE_HTML_PROMPT = `Extract ALL horse entries from this Equibase race card HTML for Race {race_number}.

Return ONLY a JSON object:
{
  "track_code": "3-letter code",
  "track_name": "Full track name",
  "race_number": {race_number},
  "race_date": "{date}",
  "distance": "distance text from the page",
  "surface": "Dirt or Turf or Synthetic",
  "race_type": "race type from the page",
  "purse": purse amount as integer,
  "condition": "track condition",
  "horses": [
    {
      "name": "Horse Name exactly as shown",
      "program_number": "1",
      "post_position": 1,
      "morning_line_odds": 5.0,
      "jockey": "Jockey Name",
      "trainer": "Trainer Name",
      "weight": 122,
      "medication": "L" or "",
      "equipment": "b" or ""
    }
  ]
}

RULES:
- Extract EVERY horse in Race {race_number} that is STILL ENTERED (not scratched)
- EXCLUDE any horse marked as scratched, withdrawn, or with strikethrough text
- If a horse's name has "SCR", "(S)", strikethrough, or is listed under "Scratches" — DO NOT include it
- morning_line_odds must be decimal: "5-2" = 2.5, "8-1" = 8.0, "3-1" = 3.0, "even" = 1.0, "6-5" = 1.2
- Copy names, jockeys, trainers EXACTLY from the HTML — do not invent or change any names
- Only include horses that appear in this specific race's section of the HTML
- If you are not certain a horse is in Race {race_number}, do not include it
- Return ONLY valid JSON, no markdown, no explanation

HTML CONTENT:
{html}`;

// Gemini prompt: enrich with past performance data via web search
const ENRICH_PROMPT = `TODAY IS {today}. Find REAL past performance data for these horses racing at {track_name} Race {race_number} on {date}.

HORSES:
{horse_list}

For EACH horse, search the web for their actual racing record. Return a JSON array:
[
  {
    "name": "Horse Name",
    "running_style": "E/EP/P/S/C based on their actual race history",
    "last_3_beyer": [82, 79, 85],
    "wins": 3,
    "starts": 12,
    "jockey_win_pct": 0.18,
    "trainer_win_pct": 0.22,
    "days_since_last": 21,
    "is_class_drop": false
  }
]

RULES:
- Use REAL data only. If you cannot find a stat, use null.
- running_style: E=front runner, EP=presses pace, P=stalker, S=sustained rally, C=deep closer
- Return ONLY valid JSON, no markdown, no explanation`;

function parseQuery(query: string): { trackCode: string; raceNumber: number; date: string } | null {
  const q = query.toLowerCase().trim();
  const today = new Date();

  // Extract race number
  const raceMatch = q.match(/race\s*#?\s*(\d+)|r(\d+)/i);
  const raceNumber = raceMatch ? parseInt(raceMatch[1] ?? raceMatch[2]) : 0;

  // Extract date
  let date = today;
  if (q.includes("tomorrow")) {
    date = new Date(today.getTime() + 86400000);
  }
  // Check for explicit date like "april 12" or "4/12"
  const dateMatch = q.match(
    /(\w+)\s+(\d{1,2})(?:\s*,?\s*(\d{4}))?|(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?/,
  );
  if (dateMatch) {
    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
      july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
      jan: 0, feb: 1, mar: 2, apr: 3, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
    };
    if (dateMatch[1] && months[dateMatch[1].toLowerCase()] !== undefined) {
      const m = months[dateMatch[1].toLowerCase()];
      const d = parseInt(dateMatch[2]);
      const y = dateMatch[3] ? parseInt(dateMatch[3]) : today.getFullYear();
      date = new Date(y, m, d);
    } else if (dateMatch[4]) {
      const m = parseInt(dateMatch[4]) - 1;
      const d = parseInt(dateMatch[5]);
      const y = dateMatch[6] ? parseInt(dateMatch[6]) : today.getFullYear();
      date = new Date(y < 100 ? y + 2000 : y, m, d);
    }
  }

  // Extract track — try longest match first
  let trackCode = "";
  const sortedAliases = Object.keys(TRACK_ALIASES).sort((a, b) => b.length - a.length);
  for (const alias of sortedAliases) {
    if (q.includes(alias)) {
      trackCode = TRACK_ALIASES[alias];
      break;
    }
  }

  if (!trackCode || !raceNumber) return null;

  const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  const isoDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return { trackCode, raceNumber, date: isoDate };
}

function cleanJson(raw: string): string {
  let s = raw.trim();
  if (s.startsWith("```")) {
    const lines = s.split("\n");
    const filtered = lines.filter((l) => !l.trim().startsWith("```"));
    s = filtered.join("\n").trim();
  }
  return s;
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();
    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Missing or invalid query" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    }

    const ai = new GoogleGenAI({ apiKey });

    // --- Parse the query ---
    const parsed = parseQuery(query);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse track and race number. Try: 'Keeneland Race 5 today' or 'CD R3 tomorrow'" },
        { status: 400 },
      );
    }

    const { trackCode, raceNumber, date: isoDate } = parsed;
    const dateCompact = isoDate.replace(/-/g, "");

    // --- Step 1: Fetch Equibase entries HTML directly ---
    const equibaseUrl = `${EQUIBASE_BASE}/static/entry/${trackCode}/${dateCompact}.html`;
    let html: string;
    try {
      const res = await fetch(equibaseUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HorseGPT/3.14; research)",
          Accept: "text/html",
        },
      });
      if (!res.ok) {
        // Fallback: try Gemini search if Equibase page not found
        return await fallbackGeminiSearch(ai, query, isoDate, apiKey);
      }
      html = await res.text();
      if (!html || html.length < 500) {
        return await fallbackGeminiSearch(ai, query, isoDate, apiKey);
      }
    } catch {
      return await fallbackGeminiSearch(ai, query, isoDate, apiKey);
    }

    // --- Step 2: Parse HTML with Gemini (no search, just extraction) ---
    // Truncate HTML to avoid token limits — keep first 80K chars
    const trimmedHtml = html.length > 80000 ? html.substring(0, 80000) : html;

    const parsePrompt = PARSE_HTML_PROMPT
      .replaceAll("{race_number}", String(raceNumber))
      .replaceAll("{date}", isoDate)
      .replaceAll("{html}", trimmedHtml);

    const parseResponse = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: parsePrompt,
    });

    const parseRaw = cleanJson(parseResponse.text ?? "");
    let raceData: Record<string, unknown>;
    try {
      raceData = JSON.parse(parseRaw);
    } catch {
      return NextResponse.json(
        { error: `Failed to parse Equibase data. The entries page was fetched but Gemini couldn't extract structured data.` },
        { status: 422 },
      );
    }

    let horses = raceData.horses as Record<string, unknown>[];
    if (!horses || horses.length === 0) {
      return NextResponse.json({ error: `No horses found in Race ${raceNumber} at ${trackCode}` }, { status: 404 });
    }

    // --- VALIDATION: reject hallucinated horses ---
    // Every horse name Gemini returns MUST appear in the raw HTML source.
    // If a name isn't in the HTML, Gemini made it up — remove it.
    const htmlLower = html.toLowerCase();
    const beforeCount = horses.length;
    horses = horses.filter((h) => {
      const name = String(h.name ?? "").toLowerCase().trim();
      if (!name || name.length < 2) return false;
      // Check if this horse name appears in the actual HTML
      return htmlLower.includes(name);
    });

    if (horses.length === 0) {
      return NextResponse.json(
        { error: `Validation failed: none of the parsed horses were found in the source HTML. Gemini may have parsed the wrong race.` },
        { status: 422 },
      );
    }

    // Report if any were removed
    if (horses.length < beforeCount) {
      raceData._validation = `${beforeCount - horses.length} horse(s) removed — not found in source HTML`;
    }
    raceData.horses = horses;

    // --- Step 3: Enrich with past performance data via Gemini search ---
    try {
      const horseList = horses.map((h, i) => `${i + 1}. ${h.name} (Jockey: ${h.jockey}, Trainer: ${h.trainer})`).join("\n");

      const enrichPrompt = ENRICH_PROMPT
        .replaceAll("{today}", isoDate)
        .replaceAll("{track_name}", String(raceData.track_name ?? trackCode))
        .replaceAll("{race_number}", String(raceNumber))
        .replaceAll("{date}", isoDate)
        .replaceAll("{horse_list}", horseList);

      const enrichResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: enrichPrompt,
        config: { tools: [{ googleSearch: {} }] },
      });

      const enrichRaw = cleanJson(enrichResponse.text ?? "");
      const details: Record<string, unknown>[] = JSON.parse(enrichRaw);

      if (Array.isArray(details)) {
        for (let i = 0; i < horses.length; i++) {
          const detail = details.find((d) => d.name === horses[i].name) ?? details[i];
          if (detail) {
            // Merge but don't overwrite existing fields with null
            for (const [k, v] of Object.entries(detail)) {
              if (v !== null && v !== undefined && k !== "name") {
                horses[i][k] = v;
              }
            }
          }
        }
      }
    } catch {
      // Enrichment failed — algo still works with base data (layers 1-2 + Monte Carlo)
    }

    return NextResponse.json(raceData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Fallback: if Equibase fetch fails, try Gemini with search grounding
async function fallbackGeminiSearch(
  ai: GoogleGenAI,
  query: string,
  date: string,
  _apiKey: string,
): Promise<Response> {
  const prompt = `TODAY IS ${date}. Search the web for the ACTUAL race entries for: "${query}"

Search equibase.com, drf.com, tvg.com for the real entries.

Return ONLY a JSON object with the real data:
{
  "track_code": "3-letter code",
  "track_name": "Full track name",
  "race_number": 5,
  "race_date": "${date}",
  "distance": "6f",
  "surface": "Dirt",
  "race_type": "ALW",
  "purse": 50000,
  "condition": "Fast",
  "horses": [
    {
      "name": "Real Horse Name",
      "program_number": "1",
      "post_position": 1,
      "morning_line_odds": 5.0,
      "jockey": "Real Jockey Name",
      "trainer": "Real Trainer Name"
    }
  ]
}

If the track has NO racing on ${date}, return:
{"error": "No racing at [track] on ${date}. Tracks racing today include: [list tracks that ARE running]"}

Return ONLY valid JSON.`;

  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: { tools: [{ googleSearch: {} }] },
  });

  const raw = cleanJson(response.text ?? "");
  try {
    const data = JSON.parse(raw);
    if (data.error) {
      return NextResponse.json({ error: data.error }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: `Could not find race data. Gemini response: ${raw.substring(0, 200)}` },
      { status: 422 },
    );
  }
}
