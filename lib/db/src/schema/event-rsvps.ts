import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { eventsTable } from "./events";
import { playersTable } from "./players";

export const eventRsvpsTable = pgTable("event_rsvps", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  status: text("status").notNull(),
  respondedAt: timestamp("responded_at").defaultNow().notNull(),
}, (t) => ({
  eventPlayerUnique: uniqueIndex("event_rsvps_event_player_unique").on(t.eventId, t.playerId),
  eventIdx: index("event_rsvps_event_idx").on(t.eventId),
  playerIdx: index("event_rsvps_player_idx").on(t.playerId),
}));

export type EventRsvpRow = typeof eventRsvpsTable.$inferSelect;
