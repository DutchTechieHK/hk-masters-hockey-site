import { pgTable, integer, jsonb, timestamp } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";

export const worldCupTeamSnapshotsTable = pgTable("world_cup_team_snapshots", {
  teamId: integer("team_id").primaryKey().references(() => teamsTable.id, { onDelete: "cascade" }),
  snapshot: jsonb("snapshot").notNull(),
  capturedAt: timestamp("captured_at").defaultNow().notNull(),
});