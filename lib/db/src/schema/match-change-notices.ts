import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";

// A revision survives later edits (and even deletion) so delivery history retains its context.
export const matchChangeNoticesTable = pgTable("match_change_notices", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id").notNull(),
  kind: text("kind").notNull(),
  teamId: integer("team_id").notNull(),
  opponent: text("opponent").notNull(),
  previousKickoffAt: timestamp("previous_kickoff_at").notNull(),
  kickoffAt: timestamp("kickoff_at").notNull(),
  venue: text("venue"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchIdx: index("match_change_notices_match_id_idx").on(t.matchId, t.id),
}));