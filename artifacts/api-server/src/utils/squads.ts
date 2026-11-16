import {
  db, squadMembershipsTable, playerParticipationsTable, playersTable, seasonsTable, teamsTable,
} from "@workspace/db";
import { and, asc, eq, inArray, sql, type SQL, type AnyColumn } from "drizzle-orm";

export const CURRENT_MEMBERSHIP_SEASON_SLUG = "membership-2026-27";

type Executor = Pick<typeof db, "execute" | "select">;
type Column = AnyColumn | SQL;

// ---------------------------------------------------------------------------
// Storage safety net
//
// The squad list lives in its own table. If that table is missing (for
// example a deployment where the schema step did not run), the app must keep
// working exactly as it did with one team per member, and must not crash.
// ensureSquadStorage() creates the table when it can and records whether it
// is usable. Every helper below degrades to "primary team only" when it is
// not.
// ---------------------------------------------------------------------------
let storageReady = false;
let lastStorageCheck = 0;
const STORAGE_RECHECK_MS = 60_000;

export function squadStorageReady(): boolean {
  return storageReady;
}

/** Idempotent. The definition mirrors lib/db/src/schema/squad-memberships.ts exactly. */
export async function ensureSquadStorage(force = false): Promise<boolean> {
  if (storageReady) return true;
  const now = Date.now();
  if (!force && now - lastStorageCheck < STORAGE_RECHECK_MS) return false;
  lastStorageCheck = now;
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS squad_memberships (
        id serial PRIMARY KEY,
        player_id integer NOT NULL,
        team_id integer NOT NULL,
        season_id integer NOT NULL,
        source text NOT NULL DEFAULT 'admin',
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT squad_memberships_player_id_players_id_fk FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE,
        CONSTRAINT squad_memberships_team_id_teams_id_fk FOREIGN KEY (team_id) REFERENCES teams(id),
        CONSTRAINT squad_memberships_season_id_seasons_id_fk FOREIGN KEY (season_id) REFERENCES seasons(id)
      )
    `);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS squad_memberships_player_team_season_unique ON squad_memberships (player_id, team_id, season_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS squad_memberships_team_season_idx ON squad_memberships (team_id, season_id)`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS squad_memberships_player_season_idx ON squad_memberships (player_id, season_id)`);
  } catch (error) {
    console.error("[squads] could not create the squad table; continuing with one team per member:", error);
  }
  try {
    const result = await db.execute(sql`SELECT to_regclass('public.squad_memberships') IS NOT NULL AS present`);
    storageReady = (result.rows[0] as { present?: boolean } | undefined)?.present === true;
  } catch (error) {
    console.error("[squads] could not check for the squad table:", error);
    storageReady = false;
  }
  if (!storageReady) console.error("[squads] squad table unavailable: squads limited to one team per member until it exists");
  return storageReady;
}

/**
 * SQL condition: the member is in this team's squad for this season.
 * Use it next to the usual "active participation / active member" checks.
 */
export function inSquad(playerId: Column, seasonId: Column | number, teamId: Column | number): SQL {
  if (!storageReady) return sql`false`;
  return sql`EXISTS (
    SELECT 1 FROM ${squadMembershipsTable} squad_link
    WHERE squad_link.player_id = ${playerId}
      AND squad_link.season_id = ${seasonId}
      AND squad_link.team_id = ${teamId}
  )`;
}

/**
 * SQL condition for queries that already read the member's season record:
 * in this team's squad, or this team is the primary team on that record.
 * The two always agree once reconcileSquads has run; accepting either keeps
 * a squad recorded the old single-team way working until it has been copied.
 */
export function inSquadOrPrimary(playerId: Column, seasonId: Column | number, teamId: Column | number): SQL {
  return sql`(${playerParticipationsTable.teamId} = ${teamId} OR ${inSquad(playerId, seasonId, teamId)})`;
}

/** SQL condition: the member is in no squad at all for this season. */
export function inNoSquad(playerId: Column, seasonId: Column | number): SQL {
  if (!storageReady) return sql`true`;
  return sql`NOT EXISTS (
    SELECT 1 FROM ${squadMembershipsTable} squad_link
    WHERE squad_link.player_id = ${playerId}
      AND squad_link.season_id = ${seasonId}
  )`;
}

async function currentSeasonId(executor: Executor = db): Promise<number | null> {
  const [season] = await executor.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, CURRENT_MEMBERSHIP_SEASON_SLUG)).limit(1);
  return season?.id ?? null;
}

/**
 * Squad team ids per member for one season, oldest squad first. Only counts
 * members whose season record is active, matching every other squad check.
 */
export async function squadTeamIdsByPlayer(
  seasonId: number, playerIds?: number[], executor: Executor = db,
): Promise<Map<number, number[]>> {
  const result = new Map<number, number[]>();
  if (playerIds && playerIds.length === 0) return result;
  const rows = !storageReady ? [] : await executor.select({ playerId: squadMembershipsTable.playerId, teamId: squadMembershipsTable.teamId })
    .from(squadMembershipsTable)
    .innerJoin(playerParticipationsTable, and(
      eq(playerParticipationsTable.playerId, squadMembershipsTable.playerId),
      eq(playerParticipationsTable.seasonId, squadMembershipsTable.seasonId),
      eq(playerParticipationsTable.participationStatus, "active"),
    ))
    .where(and(
      eq(squadMembershipsTable.seasonId, seasonId),
      playerIds ? inArray(squadMembershipsTable.playerId, playerIds) : undefined,
    ))
    .orderBy(asc(squadMembershipsTable.id));
  // The primary team on the season record counts too, and comes first.
  const primaries = await executor.select({ playerId: playerParticipationsTable.playerId, teamId: playerParticipationsTable.teamId })
    .from(playerParticipationsTable)
    .where(and(
      eq(playerParticipationsTable.seasonId, seasonId),
      eq(playerParticipationsTable.participationStatus, "active"),
      playerIds ? inArray(playerParticipationsTable.playerId, playerIds) : undefined,
    ));
  for (const row of primaries) if (row.teamId != null) result.set(row.playerId, [row.teamId]);
  for (const row of rows) {
    const list = result.get(row.playerId) ?? [];
    if (!list.includes(row.teamId)) list.push(row.teamId);
    result.set(row.playerId, list);
  }
  return result;
}

/** Every squad the member is in this membership season (may be empty). */
export async function currentSquadTeamIds(playerId: number, executor: Executor = db): Promise<number[]> {
  const seasonId = await currentSeasonId(executor);
  if (seasonId == null) return [];
  return (await squadTeamIdsByPlayer(seasonId, [playerId], executor)).get(playerId) ?? [];
}

/** Squads with team names per member, for display. */
export async function squadTeamsByPlayer(
  seasonId: number, playerIds?: number[], executor: Executor = db,
): Promise<Map<number, Array<{ teamId: number; teamName: string }>>> {
  const result = new Map<number, Array<{ teamId: number; teamName: string }>>();
  if (!storageReady || (playerIds && playerIds.length === 0)) return result;
  const rows = await executor.select({
    playerId: squadMembershipsTable.playerId, teamId: squadMembershipsTable.teamId, teamName: teamsTable.name,
  }).from(squadMembershipsTable)
    .innerJoin(teamsTable, eq(teamsTable.id, squadMembershipsTable.teamId))
    .where(and(
      eq(squadMembershipsTable.seasonId, seasonId),
      playerIds ? inArray(squadMembershipsTable.playerId, playerIds) : undefined,
    ))
    .orderBy(asc(squadMembershipsTable.id));
  for (const row of rows) {
    const list = result.get(row.playerId) ?? [];
    list.push({ teamId: row.teamId, teamName: row.teamName });
    result.set(row.playerId, list);
  }
  return result;
}

/**
 * Keep player_participations.team_id equal to the member's primary squad:
 * the squad they joined first, or NULL when they are in no squad.
 */
export async function syncPrimarySquad(executor: Pick<typeof db, "execute">, seasonId: number, playerIds?: number[]) {
  if (!storageReady || (playerIds && playerIds.length === 0)) return;
  const scope = playerIds ? sql`AND participation.player_id IN (${sql.join(playerIds.map((id) => sql`${id}`), sql`, `)})` : sql``;
  await executor.execute(sql`
    UPDATE ${playerParticipationsTable} AS participation
    SET team_id = primary_squad.team_id, updated_at = NOW()
    FROM (
      SELECT pp.id AS participation_id, (
        SELECT squad_link.team_id FROM ${squadMembershipsTable} squad_link
        WHERE squad_link.player_id = pp.player_id AND squad_link.season_id = pp.season_id
        ORDER BY squad_link.id LIMIT 1
      ) AS team_id
      FROM ${playerParticipationsTable} pp
      WHERE pp.season_id = ${seasonId}
    ) AS primary_squad
    WHERE participation.id = primary_squad.participation_id
      AND participation.team_id IS DISTINCT FROM primary_squad.team_id
      ${scope}
  `);
}

/** Remove a set of members from every squad of the season (e.g. after a section change). */
export async function removeFromAllSquads(executor: Pick<typeof db, "execute">, seasonId: number, playerIds: number[]) {
  if (!storageReady || playerIds.length === 0) return;
  await executor.execute(sql`
    DELETE FROM ${squadMembershipsTable}
    WHERE season_id = ${seasonId}
      AND player_id IN (${sql.join(playerIds.map((id) => sql`${id}`), sql`, `)})
  `);
  await syncPrimarySquad(executor, seasonId, playerIds);
}

/**
 * A member's squads must be in teams of their own section. Call after a
 * member's section changes: squads in other sections are removed.
 */
export async function removeSquadsOutsideSection(
  executor: Pick<typeof db, "execute">, seasonId: number, playerId: number, section: string,
) {
  if (!storageReady) return;
  await executor.execute(sql`
    DELETE FROM ${squadMembershipsTable} squad_link
    USING ${teamsTable} team
    WHERE squad_link.season_id = ${seasonId}
      AND squad_link.player_id = ${playerId}
      AND team.id = squad_link.team_id
      AND team.membership_section IS DISTINCT FROM ${section}
  `);
  await syncPrimarySquad(executor, seasonId, [playerId]);
}

/**
 * Idempotent upkeep, run with the membership foundation on start-up and on
 * membership reads. Safe to run any number of times.
 *
 * 1. Copy squads recorded the old way (one team on the season record) into
 *    the squad list, for members who have no squad rows yet.
 * 2. Re-point the season record's primary team at the member's first squad.
 *
 * It never removes anyone from a squad.
 */
export async function reconcileSquads(executor: Pick<typeof db, "execute">, seasonId: number) {
  // Uses its own connection, so a failure here cannot abort the caller's transaction.
  if (!await ensureSquadStorage()) return;
  const copied = await executor.execute(sql`
    INSERT INTO ${squadMembershipsTable} (player_id, team_id, season_id, source)
    SELECT pp.player_id, pp.team_id, pp.season_id, 'backfill_primary_team'
    FROM ${playerParticipationsTable} pp
    WHERE pp.season_id = ${seasonId}
      AND pp.team_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM ${squadMembershipsTable} existing
        WHERE existing.player_id = pp.player_id AND existing.season_id = pp.season_id
      )
    ON CONFLICT DO NOTHING
  `);
  const copiedCount = (copied as { rowCount?: number | null }).rowCount ?? 0;
  if (copiedCount > 0) console.log(`[squads] copied ${copiedCount} existing squad selection(s) into the squad list`);
  await syncPrimarySquad(executor, seasonId);
}
