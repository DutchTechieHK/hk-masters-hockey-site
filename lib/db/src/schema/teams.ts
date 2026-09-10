import { sql } from "drizzle-orm";
import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  membershipSection: text("membership_section").default("not_set").notNull(),
  managerName: text("manager_name").notNull(),
  managerEmail: text("manager_email").notNull(),
  managerPhone: text("manager_phone").notNull(),
  assistantManagerName: text("assistant_manager_name"),
  assistantManagerContact: text("assistant_manager_contact"),
  whatsappGroupLink: text("whatsapp_group_link"),
  targetPlayerCount: integer("target_player_count"),
  kitNotes: text("kit_notes"),
  notes: text("notes"),
  coachName: text("coach_name"),
  captainName: text("captain_name"),
  description: text("description"),
  isInternal: boolean("is_internal").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  awaitingSelectionNameUnique: uniqueIndex("teams_awaiting_selection_name_unique")
    .on(t.name)
    .where(sql`${t.name} = 'Awaiting Selection'`),
  mastersDivisionOneNameUnique: uniqueIndex("teams_masters_division_one_name_unique")
    .on(t.name)
    .where(sql`${t.name} = 'Masters Div. 1'`),
}));

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
