import OpenAI from "openai";
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
  if (["低", "low", "calm", "quiet"].some((word) => lowered.includes(word))) return 3;
  if (["中", "medium", "moderate"].some((word) => lowered.includes(word))) return 5;
  if (["高", "high", "intense"].some((word) => lowered.includes(word))) return 8;

  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(10, numeric)) : null;
}

export async function analyzePendingNotes(limit = 10) {
  const notes = await prisma.note.findMany({
    where: { aiStatus: AiStatus.PENDING },
    orderBy: { createdAt: "asc" },
    take: limit,
  });

  const results = [];
  for (const note of notes) results.push(await analyzeNote(note.id));
  return results;
}

export async function analyzeNote(noteId: string) {
  const note = await prisma.note.update({
    where: { id: noteId },
    data: { aiStatus: AiStatus.PROCESSING, aiError: null },
  });

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
      where: { noteId },
      create: {
        noteId,
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

    await prisma.memoryFragment.create({ data: { noteId, text: fragment, tone: parsed.mood, weight: 2 } });
    await prisma.note.update({ where: { id: noteId }, data: { aiStatus: AiStatus.DONE } });
    return analysis;
  } catch (error) {
    await prisma.note.update({
      where: { id: noteId },
      data: { aiStatus: AiStatus.FAILED, aiError: error instanceof Error ? error.message : "Unknown AI error" },
    });
    throw error;
  }
}


