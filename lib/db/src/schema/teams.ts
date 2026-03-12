import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  managerName: text("manager_name").notNull(),
  managerEmail: text("manager_email").notNull(),
  managerPhone: text("manager_phone").notNull(),
  assistantManagerName: text("assistant_manager_name"),
  assistantManagerContact: text("assistant_manager_contact"),
  whatsappGroupLink: text("whatsapp_group_link"),
  targetPlayerCount: integer("target_player_count"),
  kitNotes: text("kit_notes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
