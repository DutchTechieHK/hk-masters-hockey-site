import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const worldCupPlayerSnapshotsTable = pgTable("world_cup_player_snapshots", {
  playerId: integer("player_id").primaryKey().references(() => playersTable.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});

export type WorldCupPlayerSnapshot = typeof worldCupPlayerSnapshotsTable.$inferSelect;