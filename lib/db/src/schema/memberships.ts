import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  numeric,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { playersTable } from "./players";
import { teamsTable } from "./teams";

export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  isCurrent: boolean("is_current").default(false).notNull(),
  startsOn: text("starts_on"),
  endsOn: text("ends_on"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const playerParticipationsTable = pgTable("player_participations", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id").references(() => playersTable.id).notNull(),
  seasonId: integer("season_id").references(() => seasonsTable.id).notNull(),
  teamId: integer("team_id").references(() => teamsTable.id),
  participationStatus: text("participation_status").default("active").notNull(),
  membershipSection: text("membership_section"),
  membershipTier: text("membership_tier"),
  amountDue: numeric("amount_due", { precision: 10, scale: 2 }),
  source: text("source").default("admin").notNull(),
  legacySnapshot: jsonb("legacy_snapshot"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  playerSeasonUnique: uniqueIndex("player_participations_player_season_unique").on(t.playerId, t.seasonId),
  playerIdx: index("player_participations_player_idx").on(t.playerId),
  seasonIdx: index("player_participations_season_idx").on(t.seasonId),
}));

export const membershipInterestSubmissionsTable = pgTable("membership_interest_submissions", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id").references(() => seasonsTable.id).notNull(),
  submittedName: text("submitted_name").notNull(),
  submittedEmail: text("submitted_email").notNull(),
  submittedPhone: text("submitted_phone"),
  membershipSection: text("membership_section").default("not_set").notNull(),
  membershipTier: text("membership_tier").notNull(),
  matchedPlayerId: integer("matched_player_id").references(() => playersTable.id),
  matchStatus: text("match_status").default("pending").notNull(),
  rawData: jsonb("raw_data"),
  source: text("source").default("manual_import").notNull(),
  externalId: text("external_id"),
  sourceUpdatedAt: timestamp("source_updated_at"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
}, (t) => ({
  seasonIdx: index("membership_interest_submissions_season_idx").on(t.seasonId),
  statusIdx: index("membership_interest_submissions_status_idx").on(t.matchStatus),
  emailIdx: index("membership_interest_submissions_email_idx").on(t.submittedEmail),
  sourceExternalUnique: uniqueIndex("membership_interest_submissions_source_external_unique").on(t.source, t.externalId),
}));

export const membershipSyncRunsTable = pgTable("membership_sync_runs", {
  id: serial("id").primaryKey(),
  source: text("source").notNull(),
  status: text("status").notNull(),
  importedCount: integer("imported_count").default(0).notNull(),
  createdCount: integer("created_count").default(0).notNull(),
  matchedCount: integer("matched_count").default(0).notNull(),
  reviewCount: integer("review_count").default(0).notNull(),
  skippedCount: integer("skipped_count").default(0).notNull(),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
}, (t) => ({
  sourceStartedIdx: index("membership_sync_runs_source_started_idx").on(t.source, t.startedAt),
}));

export type Season = typeof seasonsTable.$inferSelect;
export type PlayerParticipation = typeof playerParticipationsTable.$inferSelect;
export type MembershipInterestSubmission = typeof membershipInterestSubmissionsTable.$inferSelect;
export type MembershipSyncRun = typeof membershipSyncRunsTable.$inferSelect;