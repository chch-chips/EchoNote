import "dotenv/config";
import { analyzePendingNotes, recoverStaleProcessingNotes } from "../src/lib/ai";
import { prisma } from "../src/lib/prisma";

const limit = Number(process.env.AI_WORKER_LIMIT ?? 10);
const pollMs = Number(process.env.AI_WORKER_POLL_MS ?? 1000);
const mode = process.argv.includes("--once") ? "once" : "watch";
let stopping = false;

function safeLimit() {
  return Number.isFinite(limit) && limit > 0 ? limit : 10;
}

function safePollMs() {
  return Number.isFinite(pollMs) && pollMs >= 250 ? pollMs : 1000;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function processBatch() {
  const result = await analyzePendingNotes(safeLimit());
  if (result.claimed > 0) {
    console.log(`AI worker processed=${result.processed} failed=${result.failed} claimed=${result.claimed}`);
  }
  return result;
}

async function shutdown() {
  stopping = true;
  await prisma.$disconnect();
}

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

async function main() {
  const recovered = await recoverStaleProcessingNotes();
  if (recovered > 0) console.log(`AI worker recovered ${recovered} stale processing notes.`);

  if (mode === "once") {
    const result = await processBatch();
    console.log(`Processed ${result.processed} notes. Failed ${result.failed}.`);
    return;
  }

  console.log(`AI worker watching for pending notes every ${safePollMs()}ms.`);
  while (!stopping) {
    await processBatch();
    await sleep(safePollMs());
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mode === "once") await prisma.$disconnect();
  });
