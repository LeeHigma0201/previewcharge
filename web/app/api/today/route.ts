import { NextResponse } from "next/server";

// Hardcoded for Churchill Downs Thursday, April 30, 2026 — static Brisnet build
export async function GET() {
  return NextResponse.json({
    date: "2026-04-30",
    tracks: [{ code: "CD", name: "Churchill Downs" }],
    source: "brisnet_static_cd_apr30",
  });
}
