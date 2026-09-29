import { pgTable, serial, text, integer, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { matchesTable } from "./matches";
import { playersTable } from "./players";

export const matchRsvpsTable = pgTable("match_rsvps", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matchesTable.id, { onDelete: "cascade" }).notNull(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  note: text("note"),
  respondedAt: timestamp("responded_at", { withTimezone: true }).defaultNow().notNull(),
  revision: integer("revision").notNull().default(1),
  source: text("source").notNull().default("player"),
}, (t) => ({
  uniqMatchPlayer: uniqueIndex("match_rsvps_match_player_uniq").on(t.matchId, t.playerId),
  matchIdx: index("match_rsvps_match_idx").on(t.matchId),
  statusCheck: check("match_rsvps_status_check", sql`${t.status} IN ('yes','no','maybe')`),
}));

export const insertMatchRsvpSchema = createInsertSchema(matchRsvpsTable).omit({ id: true, respondedAt: true });
export type MatchRsvp = typeof matchRsvpsTable.$inferSelect;

export const matchRsvpAdminChangesTable = pgTable("match_rsvp_admin_changes", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").references(() => matchesTable.id, { onDelete: "cascade" }).notNull(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  actor: text("actor").notNull(),
  previousStatus: text("previous_status"),
  previousNote: text("previous_note"),
  newStatus: text("new_status"),
  newNote: text("new_note"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  matchIdx: index("match_rsvp_admin_changes_match_idx").on(t.matchId),
}));