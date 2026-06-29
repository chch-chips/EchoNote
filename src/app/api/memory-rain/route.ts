import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { getMemoryRainSnapshot } from "@/lib/memory-rain-snapshots";

export async function GET(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const snapshot = await getMemoryRainSnapshot();
  return NextResponse.json(snapshot);
}
