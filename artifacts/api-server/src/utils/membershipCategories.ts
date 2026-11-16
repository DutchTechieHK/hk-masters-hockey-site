import { db, membershipCategoriesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";

export type CategoryExecutor = Pick<typeof db, "select" | "execute" | "insert">;
// DML only: Publish creates the schema; insert missing defaults without
// overwriting any administrator edits. Also covers newly published databases.
export async function seedMissingCategories(tx: CategoryExecutor) {
  await tx.insert(membershipCategoriesTable).values([
    { key: "awaiting_selection", name: "Awaiting Selection", defaultFee: null, protected: true },
    { key: "trials", name: "Trials", defaultFee: null, protected: true },
    { key: "community_member", name: "Community Member", defaultFee: "100.00" },
    { key: "social_player", name: "Social Player", defaultFee: "300.00" },
    { key: "masters_division_one", name: "League Player", defaultFee: "500.00" },
  ]).onConflictDoNothing();
}
export const categoryInput = z.object({
  name: z.string().trim().min(1, "Enter a category name.").max(100).transform(v => v.replace(/\s+/g, " ")),
  defaultFee: z.number().finite().min(0).max(99999999.99).multipleOf(0.01).nullable(),
});
export class CategoryError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
// All catalogue edits and assignment transactions take this lock before reading
// fees. Thus a retirement/default edit cannot race an assignment using old data.
export async function lockCategories(tx: CategoryExecutor) {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hk-masters-membership-foundation'))`);
}
export async function categoryRows(tx: CategoryExecutor = db) {
  return tx.select().from(membershipCategoriesTable).orderBy(membershipCategoriesTable.key);
}
export async function resolveCategory(key: string, tx: CategoryExecutor = db, unchanged = false) {
  const [row] = await tx.select().from(membershipCategoriesTable).where(eq(membershipCategoriesTable.key, key));
  if (!row || (row.retired && !unchanged)) throw new CategoryError(400, "Choose an active membership category. Reload categories and try again.");
  return row;
}
export function categoryJson(row: typeof membershipCategoriesTable.$inferSelect) {
  return { ...row, defaultFee: row.defaultFee == null ? null : Number(row.defaultFee) };
}
