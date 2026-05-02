import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const matchesTable = pgTable("matches", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teamsTable.id).notNull(),
  opponent: text("opponent").notNull(),
  kickoffAt: timestamp("kickoff_at").notNull(),
  venue: text("venue"),
  ourScore: integer("our_score"),
  theirScore: integer("their_score"),
  status: text("status").notNull().default("scheduled"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ id: true, createdAt: true });
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matchesTable.$inferSelect;
