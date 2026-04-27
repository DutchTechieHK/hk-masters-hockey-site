import { db } from "@workspace/db";
import { contributionsTable } from "@workspace/db/schema";
import { isNull, eq } from "drizzle-orm";
import { generateUniqueSlug } from "../utils/slug.js";

async function backfillSlugs() {
  const rows = await db
    .select({ id: contributionsTable.id, title: contributionsTable.title })
    .from(contributionsTable)
    .where(isNull(contributionsTable.slug));

  if (rows.length === 0) {
    console.log("No contributions with missing slugs found. Nothing to do.");
    return;
  }

  console.log(`Found ${rows.length} contribution(s) with missing slugs. Backfilling...`);

  for (const row of rows) {
    const slug = await generateUniqueSlug(row.title, async (candidate) => {
      const [existing] = await db
        .select({ id: contributionsTable.id })
        .from(contributionsTable)
        .where(eq(contributionsTable.slug, candidate));
      return !!existing;
    });

    await db
      .update(contributionsTable)
      .set({ slug })
      .where(eq(contributionsTable.id, row.id));

    console.log(`  Updated contribution #${row.id}: "${row.title}" → slug "${slug}"`);
  }

  console.log("Done. All missing slugs have been backfilled.");
}

backfillSlugs().catch((err) => {
  console.error("Backfill failed:", err);
  process.exit(1);
});
