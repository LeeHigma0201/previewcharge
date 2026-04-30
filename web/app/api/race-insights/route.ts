import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";
import { CD_2026_04_30 } from "../../lib/cd-2026-04-30";

const GEMINI_MODEL = "gemini-2.5-flash";
const TODAYS_DATE = "2026-04-30";
const TRACK_CODE = "CD";
const TRACK_NAME = "Churchill Downs";

/**
 * Per-race intelligence call. Returns:
 *   - liveOdds: { [program]: number }  (TwinSpires current odds)
 *   - paceScenario: short narrative
 *   - sharpMoves: list of horses with notable ML→live odds drops
 *   - trackCondition: verified condition (Fast/Muddy/Sloppy/etc) — LIVE only
 *   - keyAngles: 1-3 short bullets
 *   - live_grounded: boolean — true ONLY if Gemini's response shows actual web search citations
 *
 * Validation: program numbers grounded against today's entered horses; track
 * condition + odds dropped if not backed by groundingMetadata (live search).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const raceNum = Number(url.searchParams.get("race") || "1");

  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      gemini_disabled: true,
      message: "Race insights unavailable — GEMINI_API_KEY not set on Vercel.",
    });
  }

  const race = CD_2026_04_30.find((r) => r.raceNumber === raceNum);
  if (!race) {
    return NextResponse.json({ error: `Race ${raceNum} not found on today's card` }, { status: 404 });
  }

  const horseList = race.horses
    .map((h) => `#${h.program} ${h.name} (style ${h.style}, ML ${h.mlOdds}, PP ${h.primePower ?? "n/a"})`)
    .join("\n");

  const validProgs = new Set(race.horses.map((h) => h.program));
  const nowIso = new Date().toISOString();

  const prompt = `TASK: Race-day intelligence for ${TRACK_NAME} Race ${raceNum} on ${TODAYS_DATE}.

CURRENT TIMESTAMP: ${nowIso}
You MUST perform a LIVE WEB SEARCH right now. Do NOT answer from memory or training data.
Your training data is stale; track conditions and odds change minute-to-minute on race day.

Race info: ${race.raceType.trim()} ${race.distance} ${race.surface}, post ${race.postTime} ET.

ENTERED HORSES (authoritative — only these horses are running):
${horseList}

REQUIRED LIVE SEARCHES (run all four; do not skip):
1. site:twinspires.com Churchill Downs ${TODAYS_DATE} race ${raceNum}
2. site:equibase.com CHD ${TODAYS_DATE} (or CD ${TODAYS_DATE}) track condition right now
3. site:churchilldowns.com ${TODAYS_DATE} program track condition
4. "Churchill Downs track condition right now" ${TODAYS_DATE}

For TRACK CONDITION specifically:
- Pull the LIVE on-page text from TwinSpires or Equibase showing the current condition.
- Do NOT report "Fast" by default. Common conditions today: Sloppy, Muddy, Wet Fast, Good.
- If the search results don't explicitly state today's condition, return null — do NOT guess.

For LIVE ODDS:
- Pull the actual numbers from TwinSpires odds board for THIS specific race.
- Format as decimal (5/2 → 2.5, 3/1 → 3.0).
- If you don't see real-time odds, return liveOdds as {} — do NOT use morning line.

Return ONLY this JSON (no markdown):
{
  "liveOdds": {"1": 5.0, "3": 2.4, "5": 3.5},
  "paceScenario": "short 1-sentence narrative based on the actual pace shape",
  "sharpMoves": [{"program": "3", "from": 4.0, "to": 1.8, "reason": "ML 4/1, live 9/5 — major action"}],
  "trackCondition": "Fast" | "Muddy" | "Sloppy" | "Good" | "Wet Fast" | "Yielding" | "Firm" | null,
  "keyAngles": ["short bullet 1", "short bullet 2"],
  "source": "URL of the page where you saw the condition / odds",
  "checked_at": "${nowIso}"
}

CRITICAL RULES:
- ONLY return program numbers that exist in the ENTERED HORSES list above.
- DO NOT fabricate live odds. If unconfirmed, use {}.
- DO NOT guess track condition. If unconfirmed, use null.
- "source" must be a real URL you actually loaded.
- Better to return less data than wrong data.

Return ONLY valid JSON.`;

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { tools: [{ googleSearch: {} }] },
    });

    // Verify Gemini actually performed a live search by checking groundingMetadata.
    // The Google GenAI SDK populates this when googleSearch tool is invoked.
    type GroundingChunk = { web?: { uri?: string; title?: string } };
    type GroundingMetadata = {
      webSearchQueries?: string[];
      groundingChunks?: GroundingChunk[];
      groundingSupports?: unknown[];
    };
    const candidates = (response as unknown as { candidates?: Array<{ groundingMetadata?: GroundingMetadata }> }).candidates;
    const grounding = candidates?.[0]?.groundingMetadata;
    const queries = grounding?.webSearchQueries ?? [];
    const chunks = grounding?.groundingChunks ?? [];
    const liveGrounded = queries.length > 0 && chunks.length > 0;
    const groundedUrls: string[] = chunks
      .map((c) => c?.web?.uri ?? "")
      .filter((u): u is string => Boolean(u))
      .slice(0, 5);

    const raw = (response.text ?? "")
      .trim()
      .replace(/^```(?:json)?\s*/, "")
      .replace(/```\s*$/, "");
    const parsed = JSON.parse(raw);

    // Validate liveOdds programs — ALSO drop if not live-grounded
    const liveOdds: Record<string, number> = {};
    if (liveGrounded && parsed.liveOdds && typeof parsed.liveOdds === "object") {
      for (const [k, v] of Object.entries(parsed.liveOdds)) {
        const prog = String(k).trim();
        const odds = Number(v);
        if (validProgs.has(prog) && Number.isFinite(odds) && odds > 0) {
          liveOdds[prog] = odds;
        }
      }
    }

    // Validate sharpMoves programs — ALSO drop if not live-grounded
    const sharpMoves: Array<{ program: string; from: number; to: number; reason: string }> = [];
    if (liveGrounded && Array.isArray(parsed.sharpMoves)) {
      for (const m of parsed.sharpMoves) {
        const prog = String((m as { program?: string }).program ?? "").trim();
        const from = Number((m as { from?: number }).from);
        const to = Number((m as { to?: number }).to);
        const reason = String((m as { reason?: string }).reason ?? "").trim();
        if (validProgs.has(prog) && Number.isFinite(from) && Number.isFinite(to)) {
          sharpMoves.push({ program: prog, from, to, reason });
        }
      }
    }

    // Track condition: if not live-grounded, return null (do NOT trust training-data value)
    const trackCondition = liveGrounded && typeof parsed.trackCondition === "string"
      ? parsed.trackCondition
      : null;

    return NextResponse.json({
      raceNumber: raceNum,
      liveOdds,
      paceScenario: typeof parsed.paceScenario === "string" ? parsed.paceScenario.slice(0, 240) : "",
      sharpMoves,
      trackCondition,
      keyAngles: Array.isArray(parsed.keyAngles)
        ? parsed.keyAngles.map((a: unknown) => String(a).slice(0, 160)).slice(0, 4)
        : [],
      source: String(parsed.source ?? "gemini"),
      checked_at: String(parsed.checked_at ?? nowIso),
      fetched_at: new Date().toISOString(),
      live_grounded: liveGrounded,
      grounded_queries: queries.slice(0, 6),
      grounded_urls: groundedUrls,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message, source: "error" }, { status: 500 });
  }
}
