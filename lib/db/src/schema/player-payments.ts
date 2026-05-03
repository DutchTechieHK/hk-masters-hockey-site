import { pgTable, serial, integer, numeric, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const playerPaymentsTable = pgTable("player_payments", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .references(() => playersTable.id, { onDelete: "cascade" })
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paymentDate: text("payment_date").notNull(),
  method: text("method").notNull().default(""),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerPaymentSchema = createInsertSchema(playerPaymentsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlayerPayment = z.infer<typeof insertPlayerPaymentSchema>;
export type PlayerPayment = typeof playerPaymentsTable.$inferSelect;
