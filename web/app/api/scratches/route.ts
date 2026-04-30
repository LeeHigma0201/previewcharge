import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { CD_2026_04_30 } from "../../lib/cd-2026-04-30";

const GEMINI_MODEL = "gemini-2.5-flash";

// Today's card lookup. Add a new entry per date when the active card changes.
const CARD_BY_DATE: Record<string, { track: string; trackName: string; postTime: string; races: Array<{ raceNumber: number; raceType: string; distance: string; surface: string; postTime: string; horses: Array<{ program: string; name: string }> }> }> = {
  "2026-04-30": {
    track: "CD",
    trackName: "Churchill Downs",
    postTime: "12:45 PM ET (R1)",
    races: CD_2026_04_30.map((r) => ({
      raceNumber: r.raceNumber,
      raceType: r.raceType,
      distance: r.distance,
      surface: r.surface,
      postTime: r.postTime,
      horses: r.horses.map((h) => ({ program: h.program, name: h.name })),
    })),
  },
};

function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/\([^)]*\)/g, "")
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// Returns { byRace: { [raceNumber]: ["1", "5"] }, source, checked_at }
// Scratches are returned as PROGRAM NUMBERS (strings) for stable matching against
// the static card. The prompt feeds Gemini the entered horse list and we
// validate every returned scratch against that list — drop hallucinations.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const track = (url.searchParams.get("track") || "CD").toUpperCase();
  const date = url.searchParams.get("date") || "2026-04-30";

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      byRace: {},
      gemini_disabled: true,
      message: "Scratches unavailable — GEMINI_API_KEY not set on Vercel.",
    });
  }

  const card = CARD_BY_DATE[date];
  if (!card || card.track !== track) {
    return NextResponse.json(
      {
        byRace: {},
        error: `No card data for ${track} ${date} — context required for accurate scratch detection`,
        source: "no-context",
      },
      { status: 400 },
    );
  }

  const trackName = card.trackName;
  const nowIso = new Date().toISOString();

  // Build a per-race entered-horses block — gives Gemini the EXACT set of horses to verify against.
  // This prevents the model from returning names from other tracks/dates (the failure we saw).
  const cardBlock = card.races
    .map((r) => {
      const horses = r.horses.map((h) => `#${h.program} ${h.name}`).join(", ");
      return `Race ${r.raceNumber} (${r.raceType.trim()} ${r.distance} ${r.surface}, post ${r.postTime}):\n  ${horses}`;
    })
    .join("\n\n");

  const prompt = `TASK: For ${trackName} on ${date}, identify which horses on the card below have been SCRATCHED.

CURRENT TIMESTAMP: ${nowIso}
You MUST perform a LIVE WEB SEARCH right now. Do NOT answer from memory or training data.
Scratches happen minute-to-minute on race day; only LIVE data is useful.

Today's date: ${date}. Track: ${trackName} (${track}). First post: ${card.postTime}.

ENTERED HORSES (this is the authoritative card — only these horses exist today):

${cardBlock}

A horse is scratched if marked "SCR", "Scratched", "Late Scratch", strikethrough, or excluded
from race-day entries on Equibase, TwinSpires, ChurchillDowns.com, DRF, or HorseRacingNation.

Search the web for scratch info:
1. site:equibase.com ${track} entries ${date}
2. twinspires.com ${track} ${date} live odds (look for SCR badges)
3. horseracingnation.com ${trackName} ${date} entries
4. churchilldowns.com program ${date}

CRITICAL RULES:
- ONLY return horses that appear in the ENTERED HORSES list above. Do NOT invent names or
  return horses from other tracks/dates.
- The "name" you return MUST match a name from that list verbatim.
- The "program" you return MUST match the program number from that list.
- If a search result mentions a horse name not in the list above, IGNORE it — it's a different
  card or stale data.
- If you cannot confirm a scratch from a current source, do NOT report it.
- Better to return zero scratches than incorrect ones.

Return ONLY this JSON (no markdown, no preamble):
{
  "byRace": {
    "1": [{"program": "3", "name": "Exact Horse Name From List"}],
    "2": [],
    "3": [{"program": "7", "name": "Other Horse From List"}]
  },
  "source": "url or site where confirmed",
  "checked_at": "ISO timestamp you saw the data"
}

For races with no scratches, use an empty array.
If no scratch info available at all, return {"byRace": {}, "source": "none", "checked_at": ""}.
Return ONLY valid JSON.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    // Verify Gemini actually performed a live search. If not, refuse to return scratches —
    // they'd be from training data and likely wrong (we saw "Sheila's Lion" hallucinations).
    type GroundingChunk = { web?: { uri?: string } };
    type GroundingMetadata = { webSearchQueries?: string[]; groundingChunks?: GroundingChunk[] };
    const candidates = (response as unknown as { candidates?: Array<{ groundingMetadata?: GroundingMetadata }> }).candidates;
    const grounding = candidates?.[0]?.groundingMetadata;
    const queries = grounding?.webSearchQueries ?? [];
    const chunks = grounding?.groundingChunks ?? [];
    const liveGrounded = queries.length > 0 && chunks.length > 0;
    const groundedUrls: string[] = chunks.map((c) => c?.web?.uri ?? "").filter((u): u is string => Boolean(u)).slice(0, 5);

    if (!liveGrounded) {
      return NextResponse.json({
        byRace: {},
        byRaceDetail: {},
        source: "no-live-search",
        checked_at: nowIso,
        fetched_at: new Date().toISOString(),
        live_grounded: false,
        message: "Gemini did not perform a live web search — refusing to return scratch data from training memory.",
      });
    }

    const raw = (response.text ?? "").trim().replace(/^```(?:json)?\s*/, "").replace(/```\s*$/, "");
    const parsed = JSON.parse(raw);

    // Build a per-race lookup of valid (program, name) pairs from the actual card
    const validByRace = new Map<string, Map<string, string>>(); // race -> (prog -> name)
    const validNamesByRace = new Map<string, Map<string, string>>(); // race -> (normName -> prog)
    for (const r of card.races) {
      const progMap = new Map<string, string>();
      const nameMap = new Map<string, string>();
      for (const h of r.horses) {
        progMap.set(h.program, h.name);
        nameMap.set(normalizeName(h.name), h.program);
      }
      validByRace.set(String(r.raceNumber), progMap);
      validNamesByRace.set(String(r.raceNumber), nameMap);
    }

    const byRace: Record<string, string[]> = {};
    const byRaceDetail: Record<string, Array<{ program: string; name: string }>> = {};
    const rejected: Array<{ race: string; program: string; name: string; reason: string }> = [];

    if (parsed.byRace && typeof parsed.byRace === "object") {
      for (const [raceKey, v] of Object.entries(parsed.byRace)) {
        const r = String(raceKey);
        if (!Array.isArray(v)) continue;
        const validProgs = validByRace.get(r);
        const validNames = validNamesByRace.get(r);
        if (!validProgs || !validNames) {
          for (const s of v as Array<{ program?: string; name?: string }>) {
            rejected.push({ race: r, program: String(s.program ?? ""), name: String(s.name ?? ""), reason: "race not on card" });
          }
          continue;
        }
        const accepted: Array<{ program: string; name: string }> = [];
        for (const s of v as Array<{ program?: string; name?: string }>) {
          const prog = String(s.program ?? "").trim();
          const name = String(s.name ?? "").trim();
          // Validate: program must match a horse on the card AND name must match that horse
          if (prog && validProgs.has(prog)) {
            const cardName = validProgs.get(prog)!;
            if (normalizeName(name) === normalizeName(cardName) || !name) {
              accepted.push({ program: prog, name: cardName });
              continue;
            }
            // Program matches but name doesn't — Gemini may have right program, wrong name
            rejected.push({ race: r, program: prog, name, reason: `name mismatch (card has "${cardName}")` });
            continue;
          }
          // Program didn't match — try name lookup
          const normName = normalizeName(name);
          if (normName && validNames.has(normName)) {
            const realProg = validNames.get(normName)!;
            accepted.push({ program: realProg, name: validProgs.get(realProg) ?? name });
            continue;
          }
          rejected.push({ race: r, program: prog, name, reason: "neither program nor name found on card" });
        }
        if (accepted.length > 0) {
          byRaceDetail[r] = accepted;
          byRace[r] = accepted.map((s) => s.program);
        } else {
          byRace[r] = [];
        }
      }
    }

    return NextResponse.json({
      byRace,
      byRaceDetail,
      source: String(parsed.source ?? "gemini"),
      checked_at: String(parsed.checked_at ?? new Date().toISOString()),
      fetched_at: new Date().toISOString(),
      live_grounded: true,
      grounded_queries: queries.slice(0, 6),
      grounded_urls: groundedUrls,
      rejected_count: rejected.length,
      rejected: rejected.slice(0, 20), // show what got dropped, for debugging
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { byRace: {}, error: message, source: "error" },
      { status: 500 },
    );
  }
}
