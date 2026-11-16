import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { teamsTable } from "./teams";
import { seasonsTable } from "./memberships";

/**
 * One row per member per team per season: "this member is in this team's
 * squad this season". A member may be in several squads in one season.
 *
 * player_participations.team_id is kept as the member's primary squad (the
 * squad they were added to first) so older single-team screens keep working.
 */
export const squadMembershipsTable = pgTable("squad_memberships", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id),
  source: text("source").default("admin").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("squad_memberships_player_team_season_unique").on(t.playerId, t.teamId, t.seasonId),
  index("squad_memberships_team_season_idx").on(t.teamId, t.seasonId),
  index("squad_memberships_player_season_idx").on(t.playerId, t.seasonId),
]);

export type SquadMembership = typeof squadMembershipsTable.$inferSelect;
