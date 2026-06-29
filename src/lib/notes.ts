import { NoteSource } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export type CreateNoteInput = {
  content: string;
  source?: NoteSource;
  rawMessage?: string;
  clientCreatedAt?: Date | null;
};

export function normalizeCaptureContent(content: string) {
  return content.replace(/s*#s*$/u, "").trim();
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

export async function listNotes(options: { query?: string; source?: NoteSource; take?: number; cursor?: string }) {
  const take = Math.min(Math.max(options.take ?? 40, 1), 100);
  return prisma.note.findMany({
    where: {
      source: options.source,
      content: options.query ? { contains: options.query, mode: "insensitive" } : undefined,
    },
    include: { analysis: true },
    orderBy: { createdAt: "desc" },
    take,
    ...(options.cursor ? { skip: 1, cursor: { id: options.cursor } } : {}),
  });
}
