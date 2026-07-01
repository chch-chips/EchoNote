import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { deleteNote, getNote } from "@/lib/notes";

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });

  const note = await getNote(id);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  return NextResponse.json({
    note: {
      id: note.id,
      content: note.content,
      source: note.source,
      aiStatus: note.aiStatus,
      createdAt: note.createdAt.toISOString(),
      clientCreatedAt: note.clientCreatedAt?.toISOString() ?? null,
      analysis: note.analysis
        ? {
            summary: note.analysis.summary,
            poeticFragment: note.analysis.poeticFragment,
            mood: note.analysis.mood,
            keywords: note.analysis.keywords,
          }
        : null,
    },
  });
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });

  const deleted = await deleteNote(id);
  if (!deleted) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
