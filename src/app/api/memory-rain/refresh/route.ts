import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { analyzePendingNotes } from "@/lib/ai";
import { generateMemoryRainSnapshot } from "@/lib/memory-rain-snapshots";
import { consumeRateLimit, isDatabaseUnavailable, jsonError, rateLimitResponse } from "@/lib/request-guards";

export async function POST(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rateLimit = consumeRateLimit(request, { scope: "memory-rain-refresh", max: 6, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.ok) return rateLimitResponse(rateLimit.retryAfter);

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? process.env.AI_WORKER_LIMIT ?? 10);

  try {
    const result = await analyzePendingNotes(Number.isFinite(limit) ? limit : 10);
    const snapshot = await generateMemoryRainSnapshot(true);

    return NextResponse.json({
      processed: result.processed,
      failed: result.failed,
      seed: snapshot.seed,
      generatedAt: snapshot.generatedAt,
      refreshAfter: snapshot.refreshAfter,
      fragments: snapshot.fragments,
    });
  } catch (error) {
    if (isDatabaseUnavailable(error)) {
      return jsonError("Memory rain database is unavailable.", 503);
    }

    throw error;
  }
}
