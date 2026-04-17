import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Serves the per-card feature matrix JSON that the Python pipeline writes to
// web/public/preview/. This route exists to normalize a few types (purse as
// integer, etc.) and to keep the client code provider-agnostic.

type Cell = string | number | null | { prompt: string };

interface HorseRow {
  race_number: number;
  post_time?: string;
  distance?: string;
  surface?: string;
  race_type?: string;
  purse?: number | string | null;
  program_number?: string;
  pp?: number;
  horse_name?: string;
  sire?: string;
  dam?: string;
  dam_sire?: string;
  age?: number | null;
  sex?: string;
  jockey?: string;
  trainer?: string;
  morning_line_odds_raw?: string;
  ml_odds_decimal?: number;
  unresolved_specs?: string;
  n_pps_fetched?: number;
  [feature: string]: Cell | number | undefined;
}

interface RaceBlock {
  race: {
    race_number: number;
    post_time?: string;
    distance?: string;
    surface?: string;
    race_type?: string;
    purse?: number | string | null;
  };
  horses: HorseRow[];
}

interface CardDoc {
  track_code: string;
  race_date: string;
  generated_at: string;
  races: RaceBlock[];
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const track = (url.searchParams.get("track") || "KEE").toUpperCase();
  const date = url.searchParams.get("date") || "2026-04-17";

  const file = path.join(process.cwd(), "public", "preview", `${track}_${date}.json`);
  try {
    const raw = await readFile(file, "utf8");
    const doc = JSON.parse(raw) as CardDoc;

    // Normalize ints where the python side stringified them.
    for (const r of doc.races) {
      const p = toNumber(r.race.purse);
      if (p !== null) r.race.purse = p;
      for (const h of r.horses) {
        const hp = toNumber(h.purse);
        if (hp !== null) h.purse = hp;
      }
    }
    return NextResponse.json(doc, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: `No preview found for ${track} on ${date}`, detail: String(err) },
      { status: 404 },
    );
  }
}
