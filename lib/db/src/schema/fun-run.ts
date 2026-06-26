import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const funRunIncomeTable = pgTable("fun_run_income", {
  id: serial("id").primaryKey(),
  date: text("date").notNull().default(""),
  payerName: text("payer_name").notNull(),
  description: text("description"),
  category: text("category").notNull().default("entry_fee"),
  amountHkd: numeric("amount_hkd", { precision: 10, scale: 2 }).notNull().default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
