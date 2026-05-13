import { pgTable, serial, integer, text, timestamp, index, unique } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  playerIdx: index("push_subscriptions_player_idx").on(t.playerId),
  uniqueEndpoint: unique("push_subscriptions_endpoint_unique").on(t.endpoint),
}));

export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;
