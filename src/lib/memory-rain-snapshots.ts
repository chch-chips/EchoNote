import { randomInt } from "node:crypto";
import { prisma } from "@/lib/prisma";

export type MemoryRainFragment = {
  id: string;
  text: string;
  tone: string | null;
  weight: number;
  createdAt: Date;
  noteId?: string;
};

export type MemoryRainPayload = {
  seed: number;
  generatedAt: Date;
  refreshAfter: Date;
  fragments: MemoryRainFragment[];
};

function refreshHours() {
  const hours = Number(process.env.MEMORY_RAIN_REFRESH_HOURS ?? 24);
  return Number.isFinite(hours) && hours > 0 ? hours : 24;
}

function fragmentLimit() {
  const limit = Number(process.env.MEMORY_RAIN_FRAGMENT_LIMIT ?? 80);
  return Number.isFinite(limit) && limit > 0 ? Math.min(Math.floor(limit), 160) : 80;
}

function createRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function weightedSample(fragments: MemoryRainFragment[], seed: number, limit: number) {
  const rng = createRng(seed);
  return fragments
    .map((fragment) => {
      const weight = Math.max(fragment.weight || 1, 1);
      const u = Math.max(rng(), Number.EPSILON);
      return { fragment, key: -Math.log(u) / weight };
    })
    .sort((left, right) => left.key - right.key)
    .slice(0, limit)
    .map((entry) => entry.fragment);
}

async function findSnapshotFragments(fragmentIds: string[]) {
  if (fragmentIds.length === 0) return [];

  const fragments = await prisma.memoryFragment.findMany({ where: { id: { in: fragmentIds } } });
  const byId = new Map(fragments.map((fragment) => [fragment.id, fragment]));
  const ordered: MemoryRainFragment[] = [];
  for (const id of fragmentIds) {
    const fragment = byId.get(id);
    if (fragment) ordered.push(fragment);
  }
  return ordered;
}

async function fallbackFromNotes() {
  const notes = await prisma.note.findMany({ orderBy: { createdAt: "desc" }, take: Math.min(fragmentLimit(), 40) });
  return notes.map((note) => ({
    id: note.id,
    noteId: note.id,
    text: note.content.slice(0, 120),
    tone: null,
    weight: 1,
    createdAt: note.createdAt,
  }));
}

export async function getMemoryRainSnapshot(options: { force?: boolean } = {}): Promise<MemoryRainPayload> {
  const now = new Date();
  const limit = fragmentLimit();

  if (!options.force) {
    const current = await prisma.memoryRainSnapshot.findFirst({
      where: { refreshAfter: { gt: now } },
      orderBy: { generatedAt: "desc" },
    });

    if (current) {
      const fragments = await findSnapshotFragments(current.fragmentIds);
      if (fragments.length === current.fragmentIds.length) {
        return {
          seed: current.seed,
          generatedAt: current.generatedAt,
          refreshAfter: current.refreshAfter,
          fragments: fragments.length > 0 ? fragments : await fallbackFromNotes(),
        };
      }
    }
  }

  return generateMemoryRainSnapshot(options.force ?? false, now, limit);
}

export async function generateMemoryRainSnapshot(forcedRefresh = false, now = new Date(), limit = fragmentLimit()): Promise<MemoryRainPayload> {
  const seed = randomInt(1, 2_147_483_647);
  const refreshAfter = new Date(now.getTime() + refreshHours() * 60 * 60 * 1000);
  const candidates = await prisma.memoryFragment.findMany({
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(limit * 3, limit),
  });
  const fragments = weightedSample(candidates, seed, limit);

  const snapshot = await prisma.memoryRainSnapshot.create({
    data: {
      seed,
      fragmentIds: fragments.map((fragment) => fragment.id),
      generatedAt: now,
      refreshAfter,
      forcedRefresh,
    },
  });

  const oldSnapshots = await prisma.memoryRainSnapshot.findMany({
    orderBy: { generatedAt: "desc" },
    skip: 12,
    select: { id: true },
  });

  if (oldSnapshots.length > 0) {
    await prisma.memoryRainSnapshot.deleteMany({ where: { id: { in: oldSnapshots.map((snapshot) => snapshot.id) } } });
  }

  return {
    seed: snapshot.seed,
    generatedAt: snapshot.generatedAt,
    refreshAfter: snapshot.refreshAfter,
    fragments: fragments.length > 0 ? fragments : await fallbackFromNotes(),
  };
}
