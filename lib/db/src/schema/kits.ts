import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { playersTable } from "./players";

export const kitsTable = pgTable("kits", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => playersTable.id).notNull(),
  itemType: text("item_type").notNull(),
  itemName: text("item_name").notNull(),
  size: text("size").notNull(),
  quantity: integer("quantity").notNull().default(1),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull(),
  supplier: text("supplier"),
  orderStatus: text("order_status").notNull().default("not_ordered"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKitSchema = createInsertSchema(kitsTable).omit({ id: true, createdAt: true });
export type InsertKit = z.infer<typeof insertKitSchema>;
export type Kit = typeof kitsTable.$inferSelect;
