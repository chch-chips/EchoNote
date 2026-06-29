import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { analyzePendingNotes } from "@/lib/ai";
import { generateMemoryRainSnapshot } from "@/lib/memory-rain-snapshots";

export async function POST(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = Number(request.nextUrl.searchParams.get("limit") ?? process.env.AI_WORKER_LIMIT ?? 10);
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
}
