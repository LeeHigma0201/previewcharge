import { NextResponse } from "next/server";

// Hardcoded for Keeneland April 18, 2026 — static Brisnet build
export async function GET() {
  return NextResponse.json({
    date: "2026-04-18",
    tracks: [{ code: "KEE", name: "Keeneland" }],
    source: "brisnet_static_apr18",
  });
}
