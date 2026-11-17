import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { teamsTable } from "./teams";
import { playersTable } from "./players";
import { membershipCategoriesTable } from "./membership-categories";

/**
 * The membership categories a team draws its squad from. A team with no rows
 * draws from every member of its section.
 */
export const teamCategoriesTable = pgTable("team_categories", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  categoryKey: text("category_key").notNull().references(() => membershipCategoriesTable.key),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("team_categories_team_category_unique").on(t.teamId, t.categoryKey),
]);

/**
 * The member who fills a role on a team: one person per role per team.
 * The matching text columns on teams (manager_name, coach_name, ...) are kept
 * filled from the member record so older screens and the public site work.
 * Holding a role does not grant staff access; that stays a separate step.
 */
export const teamStaffTable = pgTable("team_staff", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").notNull().references(() => teamsTable.id, { onDelete: "cascade" }),
  // manager | assistant_manager | coach | captain (validated in the API)
  role: text("role").notNull(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("team_staff_team_role_unique").on(t.teamId, t.role),
  index("team_staff_player_idx").on(t.playerId),
]);

export type TeamCategory = typeof teamCategoriesTable.$inferSelect;
export type TeamStaff = typeof teamStaffTable.$inferSelect;
