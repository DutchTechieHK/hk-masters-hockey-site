import { pgTable, serial, integer, text, timestamp, boolean, uniqueIndex, check, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { playersTable } from "./players";
import { teamsTable } from "./teams";
import { seasonsTable } from "./memberships";

export const shirtContextsTable = pgTable("shirt_contexts", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  seasonId: integer("season_id").references(() => seasonsTable.id),
  seasonName: text("season_name"),
}, (t) => [
  uniqueIndex("shirt_context_season_kind").on(t.seasonId, t.kind),
  uniqueIndex("shirt_context_name_kind").on(t.name, t.kind),
  check("shirt_context_kind", sql`${t.kind} IN ('league', 'tournament')`),
]);

export const shirtAssignmentsTable = pgTable("shirt_assignments", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  contextId: integer("context_id").notNull().references(() => shirtContextsTable.id),
  teamId: integer("team_id").notNull().references(() => teamsTable.id),
  teamName: text("team_name").notNull(),
  number: integer("number").notNull(),
  status: text("status").notNull(),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("shirt_assignment_one_current").on(t.playerId, t.contextId, t.teamId).where(sql`${t.status} = 'current'`),
  check("shirt_assignment_number", sql`${t.number} BETWEEN 1 AND 99`),
  check("shirt_assignment_status", sql`${t.status} IN ('current', 'historical', 'void')`),
  check("shirt_assignment_dates", sql`${t.startsOn} IS NULL OR ${t.endsOn} IS NULL OR ${t.endsOn} >= ${t.startsOn}`),
  check("shirt_current_no_end", sql`${t.status} <> 'current' OR ${t.endsOn} IS NULL`),
]);

export const shirtAuditTable = pgTable("shirt_audit", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  actor: text("actor").notNull(),
  action: text("action").notNull(),
  reason: text("reason"),
  detail: text("detail").notNull(),
  before: jsonb("before"),
  after: jsonb("after"),
  recordedAt: timestamp("recorded_at").defaultNow().notNull(),
});
