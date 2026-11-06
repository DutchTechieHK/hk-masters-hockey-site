import { pgTable, serial, text, integer, timestamp, uuid, jsonb, check, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { seasonsTable } from "./memberships";

// Immutable per-member snapshots intentionally survive member deletion.
// Do not store session tokens or unrelated private profile fields in this audit.
export const memberBulkEditsTable = pgTable("member_bulk_edits", {
  id: serial("id").primaryKey(),
  requestId: uuid("request_id").notNull().unique(),
  inputHash: text("input_hash").notNull(),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id),
  seasonName: text("season_name").notNull(),
  field: text("field").notNull(),
  value: text("value").notNull(),
  actor: text("actor").notNull(),
  changed: integer("changed").notNull(),
  unchanged: integer("unchanged").notNull(),
  rows: jsonb("rows").notNull(),
  recordedAt: timestamp("recorded_at", { withTimezone: true }).defaultNow().notNull(),
}, t => [
  index("member_bulk_edits_season_idx").on(t.seasonId, t.id),
  check("member_bulk_edits_field_value", sql`(${t.field} = 'section' AND ${t.value} IN ('not_set', 'men', 'women')) OR (${t.field} = 'category' AND ${t.value} IN ('awaiting_selection', 'trials', 'community_member', 'social_player', 'masters_division_one'))`),
  check("member_bulk_edits_counts", sql`${t.changed} > 0 AND ${t.unchanged} >= 0`),
  check("member_bulk_edits_rows_array", sql`jsonb_typeof(${t.rows}) = 'array'`),
]);
export const insertMemberBulkEditSchema = createInsertSchema(memberBulkEditsTable).omit({ id: true, recordedAt: true });
export type MemberBulkEdit = typeof memberBulkEditsTable.$inferSelect;
