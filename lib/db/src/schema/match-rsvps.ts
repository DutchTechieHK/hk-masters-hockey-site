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
}, (t) => ({
  uniqMatchPlayer: uniqueIndex("match_rsvps_match_player_uniq").on(t.matchId, t.playerId),
  matchIdx: index("match_rsvps_match_idx").on(t.matchId),
  statusCheck: check("match_rsvps_status_check", sql`${t.status} IN ('yes','no','maybe')`),
}));

export const insertMatchRsvpSchema = createInsertSchema(matchRsvpsTable).omit({ id: true, respondedAt: true });
export type MatchRsvp = typeof matchRsvpsTable.$inferSelect;