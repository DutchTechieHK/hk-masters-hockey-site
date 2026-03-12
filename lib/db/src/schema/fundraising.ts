import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const fundraisingTable = pgTable("fundraising", {
  id: serial("id").primaryKey(),
  donorName: text("donor_name").notNull(),
  amountPledged: numeric("amount_pledged", { precision: 10, scale: 2 }).notNull(),
  amountReceived: numeric("amount_received", { precision: 10, scale: 2 }).notNull().default("0"),
  date: text("date"),
  teamId: integer("team_id").references(() => teamsTable.id),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFundraisingSchema = createInsertSchema(fundraisingTable).omit({ id: true, createdAt: true });
export type InsertFundraising = z.infer<typeof insertFundraisingSchema>;
export type Fundraising = typeof fundraisingTable.$inferSelect;
