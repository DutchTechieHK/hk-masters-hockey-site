import { pgTable, serial, text, integer, timestamp, index, boolean } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const eventsTable = pgTable("events", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  location: text("location"),
  description: text("description"),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  isPublic: boolean("is_public").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  startsAtIdx: index("events_starts_at_idx").on(t.startsAt),
}));

export type EventRow = typeof eventsTable.$inferSelect;
