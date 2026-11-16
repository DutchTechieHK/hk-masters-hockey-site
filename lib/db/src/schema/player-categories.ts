import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { seasonsTable } from "./memberships";
import { membershipCategoriesTable } from "./membership-categories";

/**
 * One row per member, season and membership category the member holds.
 * A member can hold several categories in one season.
 *
 * Only "real" categories are stored here. Awaiting Selection and Trials
 * (the protected categories) are a status: a member with no rows has one of
 * those on players.current_membership_tier instead.
 *
 * players.current_membership_tier and player_participations.membership_tier
 * are kept as the member's main category (the one with the highest fee) so
 * older single-category screens keep working.
 */
export const playerCategoriesTable = pgTable("player_categories", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
  seasonId: integer("season_id").notNull().references(() => seasonsTable.id),
  categoryKey: text("category_key").notNull().references(() => membershipCategoriesTable.key),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [
  uniqueIndex("player_categories_player_season_category_unique").on(t.playerId, t.seasonId, t.categoryKey),
  index("player_categories_season_category_idx").on(t.seasonId, t.categoryKey),
]);

export type PlayerCategory = typeof playerCategoriesTable.$inferSelect;
