import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const fragments = await prisma.memoryFragment.findMany({
    orderBy: [{ weight: "desc" }, { createdAt: "desc" }],
    take: 80,
  });

  if (fragments.length > 0) return NextResponse.json({ fragments });

  const notes = await prisma.note.findMany({ orderBy: { createdAt: "desc" }, take: 40 });
  return NextResponse.json({
    fragments: notes.map((note) => ({
      id: note.id,
      text: note.content.slice(0, 120),
      tone: null,
      weight: 1,
      createdAt: note.createdAt,
    })),
  });
}
