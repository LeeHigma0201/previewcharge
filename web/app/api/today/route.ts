import { NextResponse } from "next/server";

// Hardcoded for Keeneland April 17, 2026
export async function GET() {
  return NextResponse.json({
    date: "2026-04-17",
    tracks: [{ code: "KEE", name: "Keeneland" }],
    source: "hardcoded_keeneland",
  });
}
