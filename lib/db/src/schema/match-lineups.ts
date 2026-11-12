import { sql } from "drizzle-orm";
import { pgTable, integer, jsonb, text, timestamp, check } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { matchesTable } from "./matches";
import { teamsTable } from "./teams";
import { seasonsTable } from "./memberships";

export type LineupPerson = {
  playerId: number; name: string; shirtNumber: number | null; position: string | null;
  status: "yes" | "maybe" | "no" | null;
};
export type LineupPlacement = { playerId: number; area: "pitch" | "bench"; x: number; y: number };
export type LineupBoard = { formation: "4-3-3" | "3-4-3"; players: (LineupPerson & LineupPlacement)[] };

export const matchLineupsTable = pgTable("match_lineups", {
  matchId: integer("match_id").primaryKey().references(() => matchesTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id),
  revision: integer("revision").notNull().default(1),
  draft: jsonb("draft").$type<LineupBoard>().notNull(),
  published: jsonb("published").$type<LineupBoard>(),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text("updated_by").notNull(),
}, (t) => [
  check("match_lineups_revision_positive", sql`${t.revision} > 0`),
  check("match_lineups_publication_pair", sql`(${t.published} IS NULL) = (${t.publishedAt} IS NULL)`),
]);

export const insertMatchLineupSchema = createInsertSchema(matchLineupsTable);
export type InsertMatchLineup = z.infer<typeof insertMatchLineupSchema>;
