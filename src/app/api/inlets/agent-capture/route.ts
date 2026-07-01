import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NoteSource } from "@/generated/prisma/enums";
import { verifyCaptureToken } from "@/lib/auth";
import { createNote, normalizeCaptureContent } from "@/lib/notes";
import { parseClientDate, parseJsonBody } from "@/lib/request-guards";

const captureSchema = z.object({
  content: z.string().max(8000).optional(),
  rawMessage: z.string().max(12000).optional(),
  clientCreatedAt: z
    .string()
    .max(80)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
    .optional(),
});

export async function POST(request: NextRequest) {
  if (!verifyCaptureToken(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(request, captureSchema);
  if (!parsed.ok) return parsed.response;

  const body = parsed.data;
  const raw = body.rawMessage ?? body.content ?? "";
  const content = normalizeCaptureContent(body.content ?? raw);
  if (!content) return NextResponse.json({ error: "Content is required." }, { status: 400 });

  const note = await createNote({
    content,
    rawMessage: raw,
    source: NoteSource.WECHAT_CC_CONNECT,
    clientCreatedAt: parseClientDate(body.clientCreatedAt),
  });

  return NextResponse.json({ ok: true, message: "已收下", noteId: note.id }, { status: 201 });
}
