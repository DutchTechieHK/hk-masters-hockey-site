import { db } from "@workspace/db";
import { sponsorsTable } from "@workspace/db/schema";
import { isNotNull, eq } from "drizzle-orm";

const TRANSFORMATION = "c_limit,w_400,q_auto,f_auto";

function applyCloudinaryTransformation(url: string): string | null {
  if (!url.includes("cloudinary.com")) return null;
  if (url.includes(`/upload/${TRANSFORMATION}/`)) return null;
  return url.replace("/upload/", `/upload/${TRANSFORMATION}/`);
}

export async function backfillSponsorLogos(): Promise<number> {
  const rows = await db
    .select({ id: sponsorsTable.id, logoUrl: sponsorsTable.logoUrl })
    .from(sponsorsTable)
    .where(isNotNull(sponsorsTable.logoUrl));

  let updated = 0;
  for (const row of rows) {
    if (!row.logoUrl) continue;
    const optimised = applyCloudinaryTransformation(row.logoUrl);
    if (!optimised) continue;

    await db
      .update(sponsorsTable)
      .set({ logoUrl: optimised })
      .where(eq(sponsorsTable.id, row.id));

    updated++;
  }

  return updated;
}
