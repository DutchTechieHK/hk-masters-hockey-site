import { backfillSponsorLogos } from "../utils/backfillSponsorLogos.js";

async function main() {
  console.log("Checking for sponsor logos without Cloudinary optimisation...");
  const updated = await backfillSponsorLogos();
  if (updated === 0) {
    console.log("No unoptimised sponsor logos found. Nothing to do.");
  } else {
    console.log(`Done. Backfilled ${updated} sponsor logo${updated !== 1 ? "s" : ""}.`);
  }
}

main().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
