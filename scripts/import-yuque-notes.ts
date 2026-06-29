import "dotenv/config";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { AiStatus, NoteSource } from "../src/generated/prisma/enums";
import { ensureOwnerUser } from "../src/lib/notes";
import { prisma } from "../src/lib/prisma";

type YuqueNote = {
  exportedAt: string;
  content: string;
  createdAt: Date;
};

const DEFAULT_FILE = "yuque-notes-export.md";

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  const fileArg = process.argv.slice(2).find((arg) => arg.startsWith("--file="));
  return {
    execute: args.has("--execute"),
    file: fileArg ? fileArg.slice("--file=".length) : DEFAULT_FILE,
  };
}

function parseChinaTime(value: string) {
  const normalized = value.replace(" ", "T") + ":00+08:00";
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(`Invalid Yuque note time: ${value}`);
  return date;
}

function trimMarkdownBoundaryWhitespace(value: string) {
  return value.replace(/^\s+/, "").replace(/\s+$/, "");
}

export function parseYuqueNotes(markdown: string): YuqueNote[] {
  const segments = markdown.split(/^---\s*$/mu);
  const notes: YuqueNote[] = [];

  for (const segment of segments) {
    const match = segment.match(/^\s*##\s+(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})\s*\r?\n/u);
    const exportedAt = match?.[1];
    if (!match || !exportedAt) continue;

    const rawContent = segment.slice(match[0].length);
    const content = trimMarkdownBoundaryWhitespace(rawContent);
    if (!content) throw new Error(`Yuque note at ${exportedAt} is empty after parsing.`);

    notes.push({
      exportedAt,
      content,
      createdAt: parseChinaTime(exportedAt),
    });
  }

  return notes;
}

function readExpectedCount(markdown: string) {
  const match = markdown.match(/总数：(\d+)\s*条/u);
  return match?.[1] ? Number(match[1]) : null;
}

function summarize(notes: YuqueNote[]) {
  const duplicateTimes = new Map<string, number>();
  for (const note of notes) duplicateTimes.set(note.exportedAt, (duplicateTimes.get(note.exportedAt) ?? 0) + 1);

  return {
    count: notes.length,
    first: notes.at(-1)?.exportedAt ?? null,
    last: notes[0]?.exportedAt ?? null,
    duplicateTimes: [...duplicateTimes.entries()].filter(([, count]) => count > 1).length,
  };
}

async function importNotes(notes: YuqueNote[]) {
  const owner = await ensureOwnerUser();
  let created = 0;
  let skipped = 0;

  for (const note of notes.slice().reverse()) {
    const existing = await prisma.note.findFirst({
      where: {
        userId: owner.id,
        source: NoteSource.IMPORT,
        clientCreatedAt: note.createdAt,
        content: note.content,
      },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.note.create({
      data: {
        userId: owner.id,
        content: note.content,
        source: NoteSource.IMPORT,
        rawMessage: note.content,
        clientCreatedAt: note.createdAt,
        createdAt: note.createdAt,
        aiStatus: AiStatus.PENDING,
      },
    });
    created += 1;
  }

  return { created, skipped };
}

async function main() {
  const args = parseArgs();
  const filePath = resolve(process.cwd(), args.file);
  const markdown = await readFile(filePath, "utf8");
  const notes = parseYuqueNotes(markdown);
  const expectedCount = readExpectedCount(markdown);
  const summary = summarize(notes);

  if (expectedCount != null && expectedCount !== notes.length) {
    throw new Error(`Expected ${expectedCount} notes from export header, parsed ${notes.length}.`);
  }

  console.log(`Yuque import ${args.execute ? "execute" : "dry-run"}: parsed=${summary.count} first=${summary.first} last=${summary.last} duplicateTimes=${summary.duplicateTimes}`);

  if (!args.execute) {
    console.log("Dry run only. Re-run with --execute to write IMPORT notes into the configured database.");
    return;
  }

  const result = await importNotes(notes);
  console.log(`Yuque import complete: created=${result.created} skipped=${result.skipped}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });