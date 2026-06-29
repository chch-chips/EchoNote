import { NextRequest, NextResponse } from "next/server";
import { NoteSource } from "@/generated/prisma/enums";
import { isWebAuthenticated } from "@/lib/auth";
import { createNote, listNotes } from "@/lib/notes";

export async function GET(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const searchParams = request.nextUrl.searchParams;
  const sourceParam = searchParams.get("source");
  const source = sourceParam && sourceParam in NoteSource ? NoteSource[sourceParam as keyof typeof NoteSource] : undefined;
  const notes = await listNotes({
    query: searchParams.get("q") ?? undefined,
    source,
    take: Number(searchParams.get("take") ?? 40),
    cursor: searchParams.get("cursor") ?? undefined,
  });

  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { content?: string; clientCreatedAt?: string };
  const content = body.content?.trim();
  if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  const note = await createNote({
    content,
    source: NoteSource.WEB,
    clientCreatedAt: body.clientCreatedAt ? new Date(body.clientCreatedAt) : null,
  });

  return NextResponse.json({ note }, { status: 201 });
}
