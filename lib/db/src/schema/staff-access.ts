import { sql } from "drizzle-orm";
import { pgTable, serial, integer, text, timestamp, boolean, uniqueIndex, check, index } from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { teamsTable } from "./teams";
import { seasonsTable } from "./memberships";

export const staffTeamGrantsTable = pgTable("staff_team_grants", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id, { onDelete: "cascade" }),
  roleLabel: text("role_label").notNull().default("Coach"),
  manageAttendance: boolean("manage_attendance").notNull().default(false),
  manageSchedule: boolean("manage_schedule").notNull().default(false),
  version: integer("version").notNull().default(1),
  revokedAt: timestamp("revoked_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  uniqueGrant: uniqueIndex("staff_team_grants_person_team_season").on(t.playerId, t.teamId, t.seasonId),
  versionCheck: check("staff_team_grants_version_positive", sql`${t.version} > 0`),
}));

// Separate token namespace: these tokens must NEVER validate as full-admin
// sessions or ordinary player sessions.
export const staffSessionsTable = pgTable("staff_sessions", {
  token: text("token").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const staffAuditTable = pgTable("staff_audit", {
  id: serial("id").primaryKey(),
  actor: text("actor").notNull(),
  actorPlayerId: integer("actor_player_id"),
  teamId: integer("team_id"),
  action: text("action").notNull(),
  target: text("target").notNull(),
  status: integer("status"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({ createdIdx: index("staff_audit_created_idx").on(t.createdAt) }));
