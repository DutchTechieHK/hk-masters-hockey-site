import { pgTable, text, numeric, boolean, integer, check, uniqueIndex } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";

export const membershipCategoriesTable = pgTable("membership_categories", {
  key: text("key").primaryKey(),
  name: text("name").notNull(),
  // Keep the index on a column: identifier-typed index introspection can
  // truncate a long expression to 63 characters when producing Publish SQL.
  normalizedName: text("normalized_name").generatedAlwaysAs(
    sql`lower(regexp_replace(trim(name), '\\s+', ' ', 'g'))`,
  ),
  defaultFee: numeric("default_fee", { precision: 10, scale: 2 }),
  retired: boolean("retired").notNull().default(false),
  protected: boolean("protected").notNull().default(false),
  version: integer("version").notNull().default(1),
}, t => [
  uniqueIndex("membership_categories_normalized_name_unique").on(t.normalizedName),
  check("membership_categories_name", sql`length(trim(${t.name})) BETWEEN 1 AND 100`),
  check("membership_categories_fee", sql`${t.defaultFee} IS NULL OR (${t.defaultFee} >= 0 AND ${t.defaultFee} <= 99999999.99)`),
  check("membership_categories_protected", sql`NOT ${t.protected} OR NOT ${t.retired}`),
]);
export const insertMembershipCategorySchema = createInsertSchema(membershipCategoriesTable);
export type MembershipCategoryRecord = typeof membershipCategoriesTable.$inferSelect;
