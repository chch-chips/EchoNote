import { NextRequest, NextResponse } from "next/server";
import { isWebAuthenticated } from "@/lib/auth";
import { deleteNote } from "@/lib/notes";

export async function DELETE(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  if (!isWebAuthenticated(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Note id is required." }, { status: 400 });

  const deleted = await deleteNote(id);
  if (!deleted) return NextResponse.json({ error: "Note not found." }, { status: 404 });

  return NextResponse.json({ ok: true });
}