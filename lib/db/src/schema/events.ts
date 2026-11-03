import { pgTable, serial, text, integer, timestamp, index, boolean, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  audienceMode: text("audience_mode").notNull().default("squad"),
  isPublic: boolean("is_public").notNull().default(false),
  photoUrl: text("photo_url"),
  operationalScope: text("operational_scope"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  startsAtIdx: index("events_starts_at_idx").on(t.startsAt),
  audienceCheck: check("events_audience_check", sql`${t.audienceMode} = 'squad' OR (${t.audienceMode} = 'groups' AND ${t.teamId} IS NULL AND ${t.isPublic} = false)`),
}));

export type EventRow = typeof eventsTable.$inferSelect;
