import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { getMemoryRainSnapshot } from "@/lib/memory-rain-snapshots";
import { isDatabaseUnavailable, jsonError } from "@/lib/request-guards";

export async function GET(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const snapshot = await getMemoryRainSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Memory rain database is unavailable.", 503);
    }

    throw error;
  }
}
