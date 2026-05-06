import { pgTable, serial, text, integer, numeric, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const kitOrdersTable = pgTable("kit_orders", {
  id: serial("id").primaryKey(),
  itemName: text("item_name").notNull(),
  itemType: text("item_type").notNull().default("playing_kit"),
  supplier: text("supplier"),
  quantity: integer("quantity").notNull().default(1),
  unitCostHKD: numeric("unit_cost_hkd", { precision: 10, scale: 2 }).notNull().default("0"),
  depositAmountHKD: numeric("deposit_amount_hkd", { precision: 10, scale: 2 }),
  depositPaidDate: text("deposit_paid_date"),
  balanceDueDate: text("balance_due_date"),
  balancePaidDate: text("balance_paid_date"),
  orderPlacedDate: text("order_placed_date"),
  artworkApprovedDate: text("artwork_approved_date"),
  expectedDeliveryDate: text("expected_delivery_date"),
  actualDeliveryDate: text("actual_delivery_date"),
  orderStatus: text("order_status").notNull().default("not_ordered"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertKitOrderSchema = createInsertSchema(kitOrdersTable).omit({ id: true, createdAt: true });
export type InsertKitOrder = z.infer<typeof insertKitOrderSchema>;
export type KitOrderRow = typeof kitOrdersTable.$inferSelect;
