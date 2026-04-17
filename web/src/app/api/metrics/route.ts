import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({ note: "Metrics endpoint — populated in Phase 5" });
}
