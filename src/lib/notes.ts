import { Prisma } from "@/generated/prisma/client";
import { AiStatus, NoteSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type CreateNoteInput = {
  content: string;
  source?: NoteSource;
  rawMessage?: string;
  clientCreatedAt?: Date | null;
};

export type NoteSort = "created" | "updated";

export function normalizeCaptureContent(content: string) {
  return content.replace(/\s*#\s*$/u, "").trim();
}

export async function ensureOwnerUser() {
  return prisma.user.upsert({
    where: { email: "owner@echonote.local" },
    create: { email: "owner@echonote.local", displayName: "EchoNote Owner" },
    update: {},
  });
}

export async function createNote(input: CreateNoteInput) {
  const content = input.content.trim();
  if (!content) throw new Error("Note content cannot be empty.");

  const owner = await ensureOwnerUser();
  return prisma.note.create({
    data: {
      userId: owner.id,
      content,
      source: input.source ?? NoteSource.WEB,
      rawMessage: input.rawMessage,
      clientCreatedAt: input.clientCreatedAt ?? null,
    },
  });
}

export async function deleteNote(noteId: string) {
  const owner = await ensureOwnerUser();
  const result = await prisma.note.deleteMany({
    where: {
      id: noteId,
      userId: owner.id,
    },
  });

  return result.count === 1;
}

export async function updateNoteContent(noteId: string, contentInput: string) {
  const content = contentInput.trim();
  if (!content) throw new Error("Note content cannot be empty.");

  const owner = await ensureOwnerUser();
  const existing = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId: owner.id,
    },
    select: { id: true },
  });

  if (!existing) return null;

  const editedAt = new Date();
  return prisma.$transaction(async (tx) => {
    await tx.noteAiAnalysis.deleteMany({ where: { noteId } });
    await tx.memoryFragment.deleteMany({ where: { noteId } });

    return tx.note.update({
      where: { id: noteId },
      data: {
        content,
        contentUpdatedAt: editedAt,
        aiStatus: AiStatus.PENDING,
        aiError: null,
      },
      include: { analysis: true },
    });
  });
}

export async function getNote(noteId: string) {
  return prisma.note.findUnique({
    where: { id: noteId },
    include: { analysis: true },
  });
}

export async function listNotes(options: { query?: string; source?: NoteSource; take?: number; cursor?: string; sort?: NoteSort }) {
  const take = Math.min(Math.max(options.take ?? 40, 1), 250);
  if (options.sort === "updated" && !options.cursor) {
    const filters: Prisma.Sql[] = [];
    if (options.source) filters.push(Prisma.sql`"source" = ${options.source}::"NoteSource"`);
    if (options.query) filters.push(Prisma.sql`"content" ILIKE ${`%${options.query}%`}`);
    const where = filters.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}` : Prisma.empty;
    const rows = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
      SELECT "id"
      FROM "Note"
      ${where}
      ORDER BY COALESCE("contentUpdatedAt", "createdAt") DESC, "createdAt" DESC
      LIMIT ${take}
    `);
    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return [];

    const notes = await prisma.note.findMany({
      where: { id: { in: ids } },
      include: { analysis: true },
    });
    const byId = new Map(notes.map((note) => [note.id, note]));
    return ids.flatMap((id) => {
      const note = byId.get(id);
      return note ? [note] : [];
    });
  }

  const notes = await prisma.note.findMany({
    where: {
      source: options.source,
      content: options.query ? { contains: options.query, mode: "insensitive" } : undefined,
    },
    include: { analysis: true },
    orderBy: { createdAt: "desc" },
    take,
    ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });

  if (options.sort !== "updated") return notes;

  return [...notes].sort((left, right) => {
    const leftTime = (left.contentUpdatedAt ?? left.createdAt).getTime();
    const rightTime = (right.contentUpdatedAt ?? right.createdAt).getTime();
    if (rightTime !== leftTime) return rightTime - leftTime;
    return right.createdAt.getTime() - left.createdAt.getTime();
  });
}
