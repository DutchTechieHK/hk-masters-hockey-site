import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  teamId: integer("team_id").references(() => teamsTable.id, { onDelete: "set null" }),
  pinned: boolean("pinned").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  createdAtIdx: index("announcements_created_at_idx").on(t.createdAt),
  teamIdx: index("announcements_team_idx").on(t.teamId),
}));

export type AnnouncementRow = typeof announcementsTable.$inferSelect;
