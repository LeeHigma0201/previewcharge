import { GoogleGenAI } from "@google/genai";
import { NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash";

// Known US tracks with typical racing days
const ALL_TRACKS = [
  { code: "KEE", name: "Keeneland", months: [4, 10] },
  { code: "CD", name: "Churchill Downs", months: [4, 5, 6, 9, 10, 11] },
  { code: "SAR", name: "Saratoga", months: [7, 8, 9] },
  { code: "BEL", name: "Belmont", months: [4, 5, 6, 9, 10] },
  { code: "AQU", name: "Aqueduct", months: [1, 2, 3, 11, 12] },
  { code: "GP", name: "Gulfstream Park", months: [1, 2, 3, 4, 12] },
  { code: "SA", name: "Santa Anita", months: [1, 2, 3, 4, 12] },
  { code: "DMR", name: "Del Mar", months: [7, 8, 11] },
  { code: "OP", name: "Oaklawn Park", months: [1, 2, 3, 4] },
  { code: "LRL", name: "Laurel Park", months: [1, 2, 3, 4, 5, 9, 10, 11, 12] },
  { code: "TAM", name: "Tampa Bay Downs", months: [1, 2, 3, 4, 11, 12] },
  { code: "FG", name: "Fair Grounds", months: [1, 2, 3, 11, 12] },
  { code: "PIM", name: "Pimlico", months: [5] },
  { code: "PRX", name: "Parx Racing", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: "CT", name: "Charles Town", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: "PEN", name: "Penn National", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: "TP", name: "Turfway Park", months: [1, 2, 3, 12] },
  { code: "HAW", name: "Hawthorne", months: [2, 3, 4, 10, 11, 12] },
  { code: "WO", name: "Woodbine", months: [4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: "GG", name: "Golden Gate Fields", months: [1, 2, 3, 4, 5, 10, 11, 12] },
  { code: "MTH", name: "Monmouth Park", months: [5, 6, 7, 8, 9] },
  { code: "IND", name: "Indiana Grand", months: [4, 5, 6, 7, 8, 9, 10, 11] },
  { code: "MNR", name: "Mountaineer", months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
  { code: "FL", name: "Finger Lakes", months: [4, 5, 6, 7, 8, 9, 10, 11] },
];

const EQUIBASE_BASE = "https://www.equibase.com";

export async function GET() {
  const today = new Date();
  const month = today.getMonth() + 1;
  const dateCompact = `${today.getFullYear()}${String(month).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  const isoDate = `${today.getFullYear()}-${String(month).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  // Filter to tracks that typically race this month
  const candidates = ALL_TRACKS.filter((t) => t.months.includes(month));

  // Try fetching Equibase entries for each candidate in parallel
  const checks = await Promise.allSettled(
    candidates.map(async (track) => {
      const url = `${EQUIBASE_BASE}/static/entry/${track.code}/${dateCompact}.html`;
      try {
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; HorseGPT/3.14; research)",
            Accept: "text/html",
          },
          signal: AbortSignal.timeout(5000),
        });
        // Check if the page has actual entry content (not just a shell)
        if (res.ok) {
          const text = await res.text();
          // Equibase entry pages with real data are typically 10K+ chars
          if (text.length > 5000 && text.toLowerCase().includes("race")) {
            return { ...track, hasEntries: true, url };
          }
        }
        return { ...track, hasEntries: false, url };
      } catch {
        return { ...track, hasEntries: false, url };
      }
    }),
  );

  const racing = checks
    .filter((r) => r.status === "fulfilled" && r.value.hasEntries)
    .map((r) => {
      const v = (r as PromiseFulfilledResult<{ code: string; name: string; hasEntries: boolean }>).value;
      return { code: v.code, name: v.name };
    });

  // If we found tracks via Equibase, return those
  if (racing.length > 0) {
    return NextResponse.json({ date: isoDate, tracks: racing, source: "equibase" });
  }

  // Fallback: use Gemini search to find today's US racing schedule
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      date: isoDate,
      tracks: candidates.map((t) => ({ code: t.code, name: t.name })),
      source: "seasonal_estimate",
      note: "Could not verify live — showing tracks that typically race this month",
    });
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `TODAY IS ${isoDate}. Which US horse racing tracks have live thoroughbred racing today? Search for today's racing schedule. Return ONLY a JSON array of objects: [{"code":"KEE","name":"Keeneland"}]. No markdown, no explanation.`,
      config: { tools: [{ googleSearch: {} }] },
    });

    let raw = response.text?.trim() ?? "";
    if (raw.startsWith("```")) {
      raw = raw.split("\n").filter((l) => !l.trim().startsWith("```")).join("\n").trim();
    }

    const tracks = JSON.parse(raw);
    return NextResponse.json({ date: isoDate, tracks, source: "gemini_search" });
  } catch {
    return NextResponse.json({
      date: isoDate,
      tracks: candidates.map((t) => ({ code: t.code, name: t.name })),
      source: "seasonal_estimate",
      note: "Could not verify live — showing tracks that typically race this month",
    });
  }
}
