import { db } from "@workspace/db";
import { contributionsTable } from "@workspace/db/schema";
import { isNull, eq } from "drizzle-orm";
import { generateUniqueSlug } from "./slug.js";

export async function backfillSlugs(): Promise<number> {
  const rows = await db
    .select({ id: contributionsTable.id, title: contributionsTable.title })
    .from(contributionsTable)
    .where(isNull(contributionsTable.slug));

  let updated = 0;
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

    updated++;
  }

  return updated;
}
