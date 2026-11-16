import {
  db, playerCategoriesTable, playerParticipationsTable, playersTable, membershipCategoriesTable,
} from "@workspace/db";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { CategoryError } from "./membershipCategories";

/**
 * Several membership categories per member.
 *
 * - "Real" categories (League Player, Social Player, ...) live in
 *   player_categories, one row per member, season and category.
 * - The protected categories (Awaiting Selection, Trials) are a status. A
 *   member either has a status, or one or more real categories, never both.
 * - players.current_membership_tier / player_participations.membership_tier
 *   hold the member's MAIN category: the real category with the highest
 *   default fee, or the status when the member has no real category.
 * - The fee due is the highest default fee among the member's categories.
 *   A fee set by hand is kept when the categories change.
 */

export const DEFAULT_STATUS_KEY = "awaiting_selection";

type CatalogueRow = { key: string; defaultFee: string | number | null; protected: boolean; retired: boolean };
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type Reader = Pick<typeof db, "select">;

// ---------------------------------------------------------------------------
// Storage safety net (same idea as utils/squads.ts): if the table is missing
// the app keeps working with one category per member and never crashes.
// ---------------------------------------------------------------------------
let storageReady = false;
let lastStorageCheck = 0;
const STORAGE_RECHECK_MS = 60_000;

export function categoryListStorageReady(): boolean {
  return storageReady;
}

/** Idempotent. Mirrors lib/db/src/schema/player-categories.ts exactly. */
export async function ensureCategoryListStorage(force = false): Promise<boolean> {
  if (storageReady) return true;
  const now = Date.now();
  if (!force && now - lastStorageCheck < STORAGE_RECHECK_MS) return false;
  lastStorageCheck = now;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS player_categories (
        id serial PRIMARY KEY,
        player_id integer NOT NULL,
        season_id integer NOT NULL,
        category_key text NOT NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT player_categories_player_id_players_id_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        CONSTRAINT player_categories_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES seasons(id),
        CONSTRAINT player_categories_category_key_membership_categories_key_fk FOREIGN KEY (category_key) REFERENCES membership_categories(key)
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS player_categories_player_season_category_unique ON player_categories (player_id, season_id, category_key)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS player_categories_season_category_idx ON player_categories (season_id, category_key)`);
  } catch (error) {
    console.error("[categories] could not create the category list table; continuing with one category per member:", error);
  }
  try {
    const result = await db.execute(sql`SELECT to_regclass('public.player_categories') IS NOT NULL AS present`);
    storageReady = (result.rows[0] as { present?: boolean } | undefined)?.present === true;
  } catch (error) {
    console.error("[categories] could not check for the category list table:", error);
    storageReady = false;
  }
  if (!storageReady) console.error("[categories] category list table unavailable: one category per member until it exists");
  return storageReady;
}

// ---------------------------------------------------------------------------
// Pure rules
// ---------------------------------------------------------------------------
const feeOf = (row: CatalogueRow | undefined) => (row?.defaultFee == null ? null : Number(row.defaultFee));

export function sameMoney(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  return Math.abs(a - b) < 0.005;
}

/** Highest default fee among the categories, or null when none of them has a fee. */
export function standardFee(keys: readonly string[], catalogue: readonly CatalogueRow[]): number | null {
  const fees = keys.map((key) => feeOf(catalogue.find((row) => row.key === key))).filter((fee): fee is number => fee != null);
  return fees.length ? Math.max(...fees) : null;
}

/** Categories ordered main first: highest fee, then the order they were given in. */
export function orderMainFirst(keys: readonly string[], catalogue: readonly CatalogueRow[]): string[] {
  return keys
    .map((key, index) => ({ key, index, fee: feeOf(catalogue.find((row) => row.key === key)) }))
    .sort((a, b) => (b.fee ?? -1) - (a.fee ?? -1) || a.index - b.index)
    .map((entry) => entry.key);
}

const isStatus = (key: string, catalogue: readonly CatalogueRow[]) => catalogue.find((row) => row.key === key)?.protected === true;
const isReal = (key: string, catalogue: readonly CatalogueRow[]) => catalogue.find((row) => row.key === key)?.protected === false;

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------
async function loadCatalogue(reader: Reader): Promise<CatalogueRow[]> {
  return reader.select({
    key: membershipCategoriesTable.key, defaultFee: membershipCategoriesTable.defaultFee,
    protected: membershipCategoriesTable.protected, retired: membershipCategoriesTable.retired,
  }).from(membershipCategoriesTable);
}

/**
 * Real categories per member for one season, main category first.
 * A member whose category is still recorded only the old way (one value on
 * the member record) is reported with that single category.
 */
export async function categoryKeysByPlayer(
  seasonId: number, playerIds: number[], reader: Reader = db, catalogue?: readonly CatalogueRow[],
): Promise<Map<number, string[]>> {
  const result = new Map<number, string[]>();
  if (playerIds.length === 0) return result;
  const rowsCatalogue = catalogue ?? await loadCatalogue(reader);
  const members = await reader.select({ id: playersTable.id, tier: playersTable.currentMembershipTier })
    .from(playersTable).where(inArray(playersTable.id, playerIds));
  const stored = !storageReady ? [] : await reader.select({ playerId: playerCategoriesTable.playerId, key: playerCategoriesTable.categoryKey })
    .from(playerCategoriesTable)
    .where(and(eq(playerCategoriesTable.seasonId, seasonId), inArray(playerCategoriesTable.playerId, playerIds)))
    .orderBy(asc(playerCategoriesTable.id));
  const byPlayer = new Map<number, string[]>();
  for (const row of stored) byPlayer.set(row.playerId, [...(byPlayer.get(row.playerId) ?? []), row.key]);
  for (const member of members) {
    const keys = byPlayer.get(member.id) ?? [];
    // The value on the member record wins when the list does not contain it:
    // an older code path set exactly that one category (or a status).
    if (isStatus(member.tier, rowsCatalogue)) result.set(member.id, []);
    else if (isReal(member.tier, rowsCatalogue) && !keys.includes(member.tier)) result.set(member.id, [member.tier]);
    else result.set(member.id, orderMainFirst(keys, rowsCatalogue));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------
export type CategoryChangeResult = {
  mainCategory: string;
  categories: string[];
  amountDue: number | null;
  standardFee: number | null;
  /** True when a hand-set fee was kept although the standard fee would differ. */
  customFeeKept: boolean;
  changed: boolean;
};

/**
 * Work out the result of giving a member exactly this list of categories,
 * without writing anything. `requested` may mix real categories and a status;
 * real categories win, and a status only applies when there is no real one.
 */
export function planCategoryChange(input: {
  requested: readonly string[];
  previous: readonly string[];
  currentTier: string;
  currentDue: number | null;
  catalogue: readonly CatalogueRow[];
  /** A fee typed in by the administrator in the same save. Wins over everything. */
  explicitDue?: number | null;
  /** Used only when it is a status and the member ends up with no real category. */
  statusHint?: string;
}): CategoryChangeResult {
  const { requested, previous, currentTier, currentDue, catalogue, explicitDue, statusHint } = input;
  const unknown = requested.find((key) => !catalogue.some((row) => row.key === key));
  if (unknown) throw new CategoryError(400, "Choose an active membership category. Reload categories and try again.");
  // Categories already held come first, in the order they were added, so a
  // tie on fee resolves the same way here as in reconcileMemberCategories.
  const wanted = [...new Set(requested.filter((key) => isReal(key, catalogue)))];
  const real = orderMainFirst(
    [...previous.filter((key) => wanted.includes(key)), ...wanted.filter((key) => !previous.includes(key))], catalogue,
  );
  const newlyRetired = real.find((key) => !previous.includes(key) && catalogue.find((row) => row.key === key)?.retired);
  if (newlyRetired) throw new CategoryError(400, "Choose an active membership category. Reload categories and try again.");
  const requestedStatus = requested.find((key) => isStatus(key, catalogue))
    ?? (statusHint && isStatus(statusHint, catalogue) ? statusHint : undefined);
  const status = requestedStatus ?? (isStatus(currentTier, catalogue) ? currentTier : DEFAULT_STATUS_KEY);
  const mainCategory = real[0] ?? status;

  const sameSet = real.length === previous.length && real.every((key) => previous.includes(key));
  const changed = !sameSet || mainCategory !== currentTier;
  const previousStandard = standardFee(previous, catalogue);
  const nextStandard = standardFee(real, catalogue);
  const handSet = !sameMoney(currentDue, previousStandard);

  let amountDue = currentDue;
  if (explicitDue !== undefined) amountDue = explicitDue;
  else if (!sameSet && !handSet) amountDue = nextStandard;

  return {
    mainCategory, categories: real, amountDue, standardFee: nextStandard, changed,
    customFeeKept: explicitDue === undefined && !sameSet && handSet && !sameMoney(currentDue, nextStandard),
  };
}

/**
 * Give a member exactly this list of categories for the season and keep the
 * main category and the fee due in step. The caller must hold the category
 * lock (lockCategories) so catalogue edits cannot interleave.
 */
export async function setMemberCategories(tx: Transaction, input: {
  playerId: number; seasonId: number; requested: readonly string[]; explicitDue?: number | null; statusHint?: string;
}): Promise<CategoryChangeResult | null> {
  const { playerId, seasonId, requested, explicitDue, statusHint } = input;
  const catalogue = await loadCatalogue(tx);
  const [member] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId)).for("update");
  if (!member) return null;
  const [participation] = await tx.select().from(playerParticipationsTable).where(and(
    eq(playerParticipationsTable.playerId, playerId), eq(playerParticipationsTable.seasonId, seasonId),
  )).for("update");
  const previous = (await categoryKeysByPlayer(seasonId, [playerId], tx, catalogue)).get(playerId) ?? [];
  const currentDue = participation?.amountDue == null ? null : Number(participation.amountDue);
  const plan = planCategoryChange({
    requested, previous, currentTier: member.currentMembershipTier, currentDue, catalogue, explicitDue, statusHint,
  });

  if (storageReady) {
    await tx.delete(playerCategoriesTable).where(and(
      eq(playerCategoriesTable.playerId, playerId), eq(playerCategoriesTable.seasonId, seasonId),
      plan.categories.length ? sql`${playerCategoriesTable.categoryKey} NOT IN (${sql.join(plan.categories.map((key) => sql`${key}`), sql`, `)})` : undefined,
    ));
    if (plan.categories.length) {
      await tx.insert(playerCategoriesTable)
        .values(plan.categories.map((categoryKey) => ({ playerId, seasonId, categoryKey }))).onConflictDoNothing();
    }
  }
  if (plan.changed) {
    await tx.update(playersTable)
      .set({ currentMembershipTier: plan.mainCategory, membershipTierUpdatedAt: new Date() })
      .where(eq(playersTable.id, playerId));
  }
  if (participation && (plan.changed || !sameMoney(plan.amountDue, currentDue))) {
    await tx.update(playerParticipationsTable).set({
      membershipTier: plan.mainCategory,
      amountDue: plan.amountDue == null ? null : plan.amountDue.toFixed(2),
      updatedAt: new Date(),
    }).where(eq(playerParticipationsTable.id, participation.id));
  }
  // Without the list table only the main category can be stored.
  return storageReady ? plan : { ...plan, categories: plan.categories.slice(0, 1) };
}

/**
 * Idempotent upkeep, run with the membership foundation. Brings the category
 * list in line with the single value on the member record, which older code
 * paths (sign-up import, interest review) still write:
 *
 * 1. A member whose record holds a status has no real categories.
 * 2. A member whose record holds a real category that is not in their list
 *    gets exactly that one category. This is also the one-time copy of
 *    everybody's existing category into the list.
 * 3. The main category on the record is re-pointed at the highest-fee
 *    category in the list. The fee due is never touched here.
 */
export async function reconcileMemberCategories(executor: Pick<typeof db, "execute">, seasonId: number) {
  // Uses its own connection, so a failure here cannot abort the caller's transaction.
  if (!await ensureCategoryListStorage()) return;
  await executor.execute(sql`
    DELETE FROM ${playerCategoriesTable} held
    USING ${playersTable} member, ${membershipCategoriesTable} category
    WHERE held.season_id = ${seasonId}
      AND member.id = held.player_id
      AND category.key = member.current_membership_tier
      AND category.protected
  `);
  await executor.execute(sql`
    DELETE FROM ${playerCategoriesTable} held
    USING ${playersTable} member, ${membershipCategoriesTable} category
    WHERE held.season_id = ${seasonId}
      AND member.id = held.player_id
      AND category.key = member.current_membership_tier
      AND NOT category.protected
      AND NOT EXISTS (
        SELECT 1 FROM ${playerCategoriesTable} same
        WHERE same.player_id = held.player_id AND same.season_id = held.season_id
          AND same.category_key = member.current_membership_tier
      )
  `);
  const copied = await executor.execute(sql`
    INSERT INTO ${playerCategoriesTable} (player_id, season_id, category_key)
    SELECT member.id, ${seasonId}, member.current_membership_tier
    FROM ${playersTable} member
    JOIN ${membershipCategoriesTable} category ON category.key = member.current_membership_tier AND NOT category.protected
    WHERE EXISTS (
        SELECT 1 FROM ${playerParticipationsTable} participation
        WHERE participation.player_id = member.id AND participation.season_id = ${seasonId}
      )
      AND NOT EXISTS (
        SELECT 1 FROM ${playerCategoriesTable} held
        WHERE held.player_id = member.id AND held.season_id = ${seasonId}
      )
    ON CONFLICT DO NOTHING
  `);
  const copiedCount = (copied as { rowCount?: number | null }).rowCount ?? 0;
  if (copiedCount > 0) console.log(`[categories] copied ${copiedCount} existing member categor${copiedCount === 1 ? "y" : "ies"} into the category list`);
  // Re-point the main category at the highest-fee category in the list.
  await executor.execute(sql`
    WITH main AS (
      SELECT DISTINCT ON (held.player_id) held.player_id, held.category_key
      FROM ${playerCategoriesTable} held
      JOIN ${membershipCategoriesTable} category ON category.key = held.category_key
      WHERE held.season_id = ${seasonId}
      ORDER BY held.player_id, category.default_fee DESC NULLS LAST, held.id
    ), moved AS (
      UPDATE ${playersTable} member
      SET current_membership_tier = main.category_key, membership_tier_updated_at = NOW()
      FROM main
      WHERE member.id = main.player_id AND member.current_membership_tier IS DISTINCT FROM main.category_key
      RETURNING member.id, main.category_key
    )
    UPDATE ${playerParticipationsTable} participation
    SET membership_tier = moved.category_key, updated_at = NOW()
    FROM moved
    WHERE participation.player_id = moved.id AND participation.season_id = ${seasonId}
  `);
}
