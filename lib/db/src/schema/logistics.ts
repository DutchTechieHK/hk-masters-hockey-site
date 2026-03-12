import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const logisticsTable = pgTable("logistics", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teamsTable.id),
  title: text("title").notNull(),
  category: text("category").notNull(),
  status: text("status").notNull().default("todo"),
  dueDate: text("due_date"),
  assignedTo: text("assigned_to"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertLogisticsSchema = createInsertSchema(logisticsTable).omit({ id: true, createdAt: true });
export type InsertLogistics = z.infer<typeof insertLogisticsSchema>;
export type Logistics = typeof logisticsTable.$inferSelect;
