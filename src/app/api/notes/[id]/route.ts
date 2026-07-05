import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isWebAuthenticated } from "@/lib/auth";
import { deleteNote, getNote, updateNoteContent } from "@/lib/notes";
import { parseJsonBody } from "@/lib/request-guards";

const updateNoteSchema = z.object({
  content: z.string().trim().min(1).max(8000),
});

type NoteRouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: NoteRouteContext) {
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
      contentUpdatedAt: note.contentUpdatedAt?.toISOString() ?? null,
      displayUpdatedAt: (note.contentUpdatedAt ?? note.createdAt).toISOString(),
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

export async function PATCH(request: NextRequest, context: NoteRouteContext) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });

  const parsed = await parseJsonBody(request, updateNoteSchema);
  if (!parsed.ok) return parsed.response;

  const note = await updateNoteContent(id, parsed.data.content);
  if (!note) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  return NextResponse.json({
    note: {
      id: note.id,
      content: note.content,
      source: note.source,
      aiStatus: note.aiStatus,
      createdAt: note.createdAt.toISOString(),
      contentUpdatedAt: note.contentUpdatedAt?.toISOString() ?? null,
      displayUpdatedAt: (note.contentUpdatedAt ?? note.createdAt).toISOString(),
      clientCreatedAt: note.clientCreatedAt?.toISOString() ?? null,
      analysis: null,
    },
  });
}

export async function DELETE(request: NextRequest, context: NoteRouteContext) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });

  const deleted = await deleteNote(id);
  if (!deleted) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}
