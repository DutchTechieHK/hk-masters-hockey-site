import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

async function main() {
  console.log("Adding beneficiary column to fundraising table...");
  await db.execute(sql`ALTER TABLE fundraising ADD COLUMN IF NOT EXISTS beneficiary text`);
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
