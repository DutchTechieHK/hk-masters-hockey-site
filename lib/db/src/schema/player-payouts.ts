import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const playerPayoutsTable = pgTable("player_payouts", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "set null" }),
  recipientName: text("recipient_name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  payoutDate: text("payout_date").notNull(),
  method: text("method").notNull().default("fps"),
  source: text("source").notNull().default("fundraising"),
  reference: text("reference"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerPayoutSchema = createInsertSchema(playerPayoutsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlayerPayout = z.infer<typeof insertPlayerPayoutSchema>;
export type PlayerPayout = typeof playerPayoutsTable.$inferSelect;
