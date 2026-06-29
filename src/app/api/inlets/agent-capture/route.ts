import { NextRequest, NextResponse } from "next/server";
import { NoteSource } from "@/generated/prisma/enums";
import { verifyCaptureToken } from "@/lib/auth";
import { createNote, normalizeCaptureContent } from "@/lib/notes";

export async function POST(request: NextRequest) {
  if (!verifyCaptureToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = (await request.json()) as { content?: string; rawMessage?: string; clientCreatedAt?: string };
  const raw = body.rawMessage ?? body.content ?? "";
  const content = normalizeCaptureContent(body.content ?? raw);
  if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  const note = await createNote({
    content,
    rawMessage: raw,
    source: NoteSource.WECHAT_CC_CONNECT,
    clientCreatedAt: body.clientCreatedAt ? new Date(body.clientCreatedAt) : null,
  });

  return NextResponse.json({ ok: true, message: "已收下", noteId: note.id }, { status: 201 });
}
