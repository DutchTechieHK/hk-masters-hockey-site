import app from "./app";
import { db } from "@workspace/db";
import { playersTable } from "@workspace/db/schema";
import { isNull, isNotNull, sql } from "drizzle-orm";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function backfillPortalAccess() {
  try {
    const result = await db
      .update(playersTable)
      .set({ lastPortalAccessAt: sql`passport_copy_uploaded_at` })
      .where(
        sql`last_portal_access_at IS NULL AND passport_copy_uploaded_at IS NOT NULL`,
      );
    console.log("[backfill] last_portal_access_at from passport uploads done");
  } catch (err) {
    console.error("[backfill] last_portal_access_at backfill failed:", err);
  }
}

backfillPortalAccess().then(() => {
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
});
