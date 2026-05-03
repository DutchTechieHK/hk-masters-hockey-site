import { pgTable, serial, text, integer, timestamp, uniqueIndex, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { eventsTable } from "./events";
import { playersTable } from "./players";

export const eventRsvpsTable = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }).notNull(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull(),
  respondedAt: timestamp("responded_at").defaultNow().notNull(),
}, (t) => ({
  uniqEventPlayer: uniqueIndex("event_rsvps_event_player_uniq").on(t.eventId, t.playerId),
  eventIdx: index("event_rsvps_event_idx").on(t.eventId),
  statusCheck: check("event_rsvps_status_check", sql`${t.status} IN ('yes','no','maybe')`),
}));

export type EventRsvpRow = typeof eventRsvpsTable.$inferSelect;
export const RSVP_STATUSES = ["yes", "no", "maybe"] as const;
export type RsvpStatus = typeof RSVP_STATUSES[number];
