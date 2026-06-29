import "dotenv/config";
import { analyzePendingNotes } from "../src/lib/ai";

const limit = Number(process.env.AI_WORKER_LIMIT ?? 10);

analyzePendingNotes(limit)
  .then((results) => {
    console.log("Processed " + results.length + " notes.");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
