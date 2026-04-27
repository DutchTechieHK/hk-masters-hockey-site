import { backfillSlugs } from "../utils/backfillSlugs.js";

async function main() {
  console.log("Checking for contributions with missing slugs...");
  const updated = await backfillSlugs();
  if (updated === 0) {
    console.log("No contributions with missing slugs found. Nothing to do.");
  } else {
    console.log(`Done. Backfilled ${updated} slug${updated !== 1 ? "s" : ""}.`);
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
