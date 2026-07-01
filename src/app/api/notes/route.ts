import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { NoteSource } from "@/generated/prisma/enums";
import { isWebAuthenticated } from "@/lib/auth";
import { createNote, listNotes } from "@/lib/notes";
import { parseClientDate, parseJsonBody } from "@/lib/request-guards";

const noteSchema = z.object({
  content: z.string().trim().min(1).max(8000),
  clientCreatedAt: z
    .string()
    .max(80)
    .refine((value) => !Number.isNaN(new Date(value).getTime()), "Invalid date.")
    .optional(),
});

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

  const parsed = await parseJsonBody(request, noteSchema);
  if (!parsed.ok) return parsed.response;

  const note = await createNote({
    content: parsed.data.content,
    source: NoteSource.WEB,
    clientCreatedAt: parseClientDate(parsed.data.clientCreatedAt),
  });

  return NextResponse.json({ note }, { status: 201 });
}
