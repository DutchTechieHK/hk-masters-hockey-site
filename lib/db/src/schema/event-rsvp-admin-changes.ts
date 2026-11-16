import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { eventsTable } from "./events";
import { playersTable } from "./players";

export const eventRsvpAdminChangesTable = pgTable("event_rsvp_admin_changes", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").references(() => eventsTable.id, { onDelete: "cascade" }).notNull(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  actor: text("actor").notNull(),
  previousStatus: text("previous_status"),
  previousNote: text("previous_note"),
  newStatus: text("new_status"),
  newNote: text("new_note"),
  changedAt: timestamp("changed_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  eventIdx: index("event_rsvp_admin_changes_event_idx").on(t.eventId),
}));

export const insertEventRsvpAdminChangeSchema = createInsertSchema(eventRsvpAdminChangesTable).omit({ id: true });
export type EventRsvpAdminChange = typeof eventRsvpAdminChangesTable.$inferSelect;
