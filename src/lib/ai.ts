import OpenAI from "openai";
import type { Note } from "@/generated/prisma/client";
import { AiStatus, NoteKind } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

type AnalysisResult = {
  summary?: string;
  keywords?: string[];
  mood?: string;
  energy?: number | string;
  kind?: keyof typeof NoteKind;
  poeticFragment?: string;
};

export type AnalyzeBatchResult = {
  claimed: number;
  processed: number;
  failed: number;
};

function getClient() {
  const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("DEEPSEEK_API_KEY or OPENAI_API_KEY is not configured.");
  return new OpenAI({ apiKey, baseURL: process.env.AI_BASE_URL || "https://api.deepseek.com" });
}

function parseJson(content: string): AnalysisResult {
  const match = content.match(/\{[\s\S]*\}/u);
  return JSON.parse(match ? match[0] : content) as AnalysisResult;
}

function normalizeEnergy(value: AnalysisResult["energy"]) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.min(10, Math.round(value)));
  }

  if (typeof value !== "string") return null;

  const lowered = value.toLowerCase();
  if (["\u4f4e", "low", "calm", "quiet"].some((word) => lowered.includes(word))) return 3;
  if (["\u4e2d", "medium", "moderate"].some((word) => lowered.includes(word))) return 5;
  if (["\u9ad8", "high", "intense"].some((word) => lowered.includes(word))) return 8;

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(10, numeric)) : null;
}

function staleProcessingCutoff() {
  const minutes = Number(process.env.AI_WORKER_STALE_MINUTES ?? 15);
  const safeMinutes = Number.isFinite(minutes) && minutes > 0 ? minutes : 15;
  return new Date(Date.now() - safeMinutes * 60 * 1000);
}

export async function recoverStaleProcessingNotes() {
  const result = await prisma.note.updateMany({
    where: {
      aiStatus: AiStatus.PROCESSING,
      updatedAt: { lt: staleProcessingCutoff() },
    },
    data: { aiStatus: AiStatus.PENDING, aiError: "Recovered stale AI processing job." },
  });

  return result.count;
}

async function claimPendingNotes(limit: number) {
  const take = Math.min(Math.max(Math.floor(limit), 1), 50);

  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id"
      FROM "Note"
      WHERE "aiStatus" = 'PENDING'::"AiStatus"
      ORDER BY "createdAt" ASC
      LIMIT ${take}
      FOR UPDATE SKIP LOCKED
    `;

    const ids = rows.map((row) => row.id);
    if (ids.length === 0) return [];

    await tx.note.updateMany({
      where: { id: { in: ids }, aiStatus: AiStatus.PENDING },
      data: { aiStatus: AiStatus.PROCESSING, aiError: null },
    });

    const notes = await tx.note.findMany({ where: { id: { in: ids } } });
    const byId = new Map(notes.map((note) => [note.id, note]));
    return ids.map((id) => byId.get(id)).filter((note): note is Note => Boolean(note));
  });
}

export async function analyzePendingNotes(limit = 10): Promise<AnalyzeBatchResult> {
  const notes = await claimPendingNotes(limit);
  let processed = 0;
  let failed = 0;

  for (const note of notes) {
    try {
      await analyzeClaimedNote(note);
      processed += 1;
    } catch {
      failed += 1;
    }
  }

  return { claimed: notes.length, processed, failed };
}

export async function analyzeNote(noteId: string) {
  const note = await prisma.note.update({
    where: { id: noteId },
    data: { aiStatus: AiStatus.PROCESSING, aiError: null },
  });

  return analyzeClaimedNote(note);
}

async function analyzeClaimedNote(note: Note) {
  try {
    const client = getClient();
    const model = process.env.AI_MODEL || "deepseek-v4-flash";
    const completion = await client.chat.completions.create({
      model,
      stream: false,
      messages: [
        {
          role: "system",
          content: "You are EchoNote's quiet memory curator. Return strict JSON with keys: summary, keywords, mood, energy, kind, poeticFragment. kind must be one of THOUGHT, PLAN, REMINDER, QUOTE, OBSERVATION, INFO, OTHER. Be concise and poetic without being ornate.",
        },
        { role: "user", content: note.content },
      ],
    });

    const content = completion.choices[0]?.message.content ?? "{}";
    const parsed = parseJson(content);
    const kind = parsed.kind && parsed.kind in NoteKind ? NoteKind[parsed.kind] : NoteKind.OTHER;
    const fragment = (parsed.poeticFragment || parsed.summary || note.content).slice(0, 180);
    const energy = normalizeEnergy(parsed.energy);

    const analysis = await prisma.noteAiAnalysis.upsert({
      where: { noteId: note.id },
      create: {
        noteId: note.id,
        summary: parsed.summary,
        keywords: parsed.keywords ?? [],
        mood: parsed.mood,
        energy,
        kind,
        poeticFragment: fragment,
        model,
      },
      update: {
        summary: parsed.summary,
        keywords: parsed.keywords ?? [],
        mood: parsed.mood,
        energy,
        kind,
        poeticFragment: fragment,
        model,
        processedAt: new Date(),
      },
    });

    await prisma.memoryFragment.deleteMany({ where: { noteId: note.id } });
    await prisma.memoryFragment.create({ data: { noteId: note.id, text: fragment, tone: parsed.mood, weight: 2 } });
    await prisma.note.update({ where: { id: note.id }, data: { aiStatus: AiStatus.DONE } });
    return analysis;
  } catch (error) {
    await prisma.note.update({
      where: { id: note.id },
      data: { aiStatus: AiStatus.FAILED, aiError: error instanceof Error ? error.message : "Unknown AI error" },
    });
    throw error;
  }
}