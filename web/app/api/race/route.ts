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

// Gemini prompt: focused enrichment — search for specific, verifiable data
const ENRICH_PROMPT = `TODAY IS {today}. I need REAL past performance data for horses in {race_label}.

For each horse below, search equibase.com, drf.com, bloodhorse.com, or timeform.com for their ACTUAL race record.

HORSES:
{horse_list}

For EACH horse, find and return:

1. **running_style** — Look at their last 3 races. Where did they run at the first call?
   - If they led or were within 1 length of the lead: "E" (early speed)
   - If they were 1-3 lengths off the lead: "EP" (early presser)
   - If they were 3-6 lengths back: "P" (stalker/presser)
   - If they were 6-10 lengths back: "S" (sustained closer)
   - If they were 10+ lengths back: "C" (deep closer)

2. **last_3_beyer** — Their 3 most recent Beyer Speed Figures. These are published by Daily Racing Form. Search "[horse name] beyer speed figure" or check their DRF past performances.

3. **wins** and **starts** — Career totals. Search "[horse name] equibase" for their career record.

4. **days_since_last** — Days between their last race date and {today}.

5. **last_race_class** — The race type of their last start (e.g. "MSW", "CLM 25000", "ALW", "STK")

6. **current_race_class** — This race is a {race_type} with purse {purse}

7. **is_class_drop** — true if last_race_class was higher than current_race_class

8. **last_finish_position** — What position they finished in their last race (1, 2, 3, etc.)

9. **weight** — Weight assigned for this race (from the entries)

10. **jockey_current_meet_wins** and **jockey_current_meet_starts** — The jockey's record at this meet

11. **trainer_current_meet_wins** and **trainer_current_meet_starts** — The trainer's record at this meet

Return a JSON array with one object per horse:
[
  {
    "name": "Horse Name",
    "running_style": "P",
    "last_3_beyer": [82, 79, 85],
    "wins": 3,
    "starts": 12,
    "days_since_last": 21,
    "is_class_drop": false,
    "last_finish_position": 3,
    "jockey_win_pct": 0.18,
    "trainer_win_pct": 0.22,
    "weight": 122
  }
]

CRITICAL RULES:
- Search for EACH horse individually. Do not guess or estimate.
- If you genuinely cannot find a specific stat after searching, use null.
- Beyer figures are published by Daily Racing Form — they are real numbers, not estimates.
- Running style must be determined from actual race charts, not guessed from the name.
- Return ONLY valid JSON. No markdown, no explanation.`;

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
    const searchConfig = { tools: [{ googleSearch: {} }] };

    // --- Parse the query ---
    const parsed = parseQuery(query);
    if (!parsed) {
      return NextResponse.json(
        { error: "Could not parse track and race number. Try: 'Keeneland Race 5 today' or 'CD R3 tomorrow'" },
        { status: 400 },
      );
    }

    const { trackCode, raceNumber, date: isoDate } = parsed;

    // =================================================================
    // STEP 1: Get race entries — fetch Equibase HTML, parse with Gemini
    // Falls back to Gemini search only if Equibase fetch fails
    // =================================================================

    const dateCompact = isoDate.replaceAll("-", "");
    let raceData: Record<string, unknown> | null = null;
    let horses: Record<string, unknown>[] = [];
    let _dataSource = "equibase_html";

    // --- Part A: Try fetching actual Equibase entries HTML ---
    try {
      const equibaseUrl = `${EQUIBASE_BASE}/static/entry/${trackCode}/${dateCompact}.html`;
      const htmlRes = await fetch(equibaseUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; HorseGPT/3.14; research)",
          Accept: "text/html",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (htmlRes.ok) {
        let html = await htmlRes.text();
        // Truncate to avoid token limits — keep first 80K chars which covers entries
        if (html.length > 80000) html = html.substring(0, 80000);

        if (html.length > 3000 && html.toLowerCase().includes("race")) {
          const parsePrompt = PARSE_HTML_PROMPT
            .replaceAll("{race_number}", String(raceNumber))
            .replaceAll("{date}", isoDate)
            .replaceAll("{html}", html);

          const parseResponse = await ai.models.generateContent({
            model: GEMINI_MODEL,
            contents: parsePrompt,
          });

          const parseRaw = cleanJson(parseResponse.text ?? "");
          const parsed = JSON.parse(parseRaw);

          if (parsed.horses && parsed.horses.length > 0) {
            raceData = parsed;
            horses = parsed.horses;
          }
        }
      }
    } catch {
      // Equibase fetch/parse failed — will fall back to Gemini search
    }

    // --- Part B: Fallback to Gemini search if Equibase didn't work ---
    if (!raceData || horses.length === 0) {
      _dataSource = "gemini_search";
      const searchPrompt = `TODAY IS ${isoDate}. I need the entries for ${trackCode} Race ${raceNumber} on ${isoDate}.

Search for this race on equibase.com, drf.com, or tvg.com.

Return a JSON object with ALL entered horses (exclude scratches):
{
  "track_code": "${trackCode}",
  "track_name": "Full track name",
  "race_number": ${raceNumber},
  "race_date": "${isoDate}",
  "distance": "distance text",
  "surface": "Dirt or Turf or Synthetic",
  "race_type": "race type",
  "purse": 0,
  "condition": "",
  "horses": [
    {
      "name": "Horse Name exactly as listed",
      "program_number": "1",
      "post_position": 1,
      "morning_line_odds": 5.0,
      "jockey": "Jockey Name",
      "trainer": "Trainer Name",
      "weight": 122
    }
  ]
}

RULES:
- Extract EVERY horse still entered — do NOT skip any
- morning_line_odds: "5-2" = 2.5, "8-1" = 8.0, "even" = 1.0
- Copy names EXACTLY from the source — do not invent names
- If you cannot find this race, return {"error": "No entries found"}
- Return ONLY valid JSON, no markdown`;

      const searchResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: searchPrompt,
        config: searchConfig,
      });

      const searchRaw = cleanJson(searchResponse.text ?? "");
      try {
        raceData = JSON.parse(searchRaw);
      } catch {
        return NextResponse.json(
          { error: `Could not parse race data. Response: ${searchRaw.substring(0, 300)}` },
          { status: 422 },
        );
      }

      if (raceData!.error) {
        return NextResponse.json({ error: raceData!.error }, { status: 404 });
      }

      horses = (raceData!.horses as Record<string, unknown>[]) ?? [];
    }

    if (!raceData || horses.length === 0) {
      return NextResponse.json({ error: `No horses found for ${trackCode} Race ${raceNumber}` }, { status: 404 });
    }

    raceData._dataSource = _dataSource;

    // =================================================================
    // STEP 2: Verify scratches with a dedicated search
    // Scratches happen after entries are drawn. This catches late scratches.
    // =================================================================
    try {
      const horseNames = horses.map((h) => String(h.name)).join(", ");
      const scratchPrompt = `TODAY IS ${isoDate}. Check for scratches in ${trackCode} Race ${raceNumber} on ${isoDate}.

Search for "${trackCode} scratches ${isoDate}" or "equibase scratches today"

These horses are currently entered: ${horseNames}

Return ONLY a JSON object:
{
  "scratches": ["Horse Name 1", "Horse Name 2"],
  "source": "where you found this info"
}

If NO scratches found, return: {"scratches": [], "source": "no scratches found"}
Return ONLY valid JSON.`;

      const scratchResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: scratchPrompt,
        config: searchConfig,
      });

      const scratchRaw = cleanJson(scratchResponse.text ?? "");
      const scratchData = JSON.parse(scratchRaw);
      const scratchNames: string[] = (scratchData.scratches ?? []).map((s: string) => s.toLowerCase().trim());

      if (scratchNames.length > 0) {
        const before = horses.length;
        horses = horses.filter((h) => {
          const name = String(h.name ?? "").toLowerCase().trim();
          return !scratchNames.includes(name);
        });
        raceData.horses = horses;
        raceData._scratches = `${before - horses.length} horse(s) scratched: ${scratchData.scratches.join(", ")}`;
      }
    } catch {
      // Scratch check failed — proceed with original entries
    }

    // =================================================================
    // STEP 3: Enrich with past performance data
    // Search for each horse's actual racing record.
    // =================================================================
    try {
      const horseList = horses.map((h, i) =>
        `${i + 1}. ${h.name} (Jockey: ${h.jockey}, Trainer: ${h.trainer})`
      ).join("\n");

      const raceLabel = `${raceData.track_name ?? trackCode} Race ${raceNumber} on ${isoDate}`;
      const enrichPrompt = ENRICH_PROMPT
        .replaceAll("{today}", isoDate)
        .replaceAll("{race_label}", raceLabel)
        .replaceAll("{race_type}", String(raceData.race_type ?? "ALW"))
        .replaceAll("{purse}", String(raceData.purse ?? 0))
        .replaceAll("{horse_list}", horseList);

      const enrichResponse = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: enrichPrompt,
        config: searchConfig,
      });

      const enrichRaw = cleanJson(enrichResponse.text ?? "");
      const details: Record<string, unknown>[] = JSON.parse(enrichRaw);

      if (Array.isArray(details)) {
        for (let i = 0; i < horses.length; i++) {
          const detail = details.find((d) => d.name === horses[i].name) ?? details[i];
          if (detail) {
            for (const [k, v] of Object.entries(detail)) {
              if (v !== null && v !== undefined && k !== "name") {
                horses[i][k] = v;
              }
            }
          }
        }
      }
    } catch {
      // Enrichment failed — model works with base data
    }

    return NextResponse.json(raceData);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
