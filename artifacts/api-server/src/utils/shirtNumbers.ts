import { db, playersTable, shirtAssignmentsTable, shirtContextsTable, seasonsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

export async function shirtAssignments(playerIds: number[]) {
  if (!playerIds.length) return [];
  const rows = await db.select({ assignment: shirtAssignmentsTable, context: shirtContextsTable })
    .from(shirtAssignmentsTable).innerJoin(shirtContextsTable, eq(shirtAssignmentsTable.contextId, shirtContextsTable.id))
    .where(inArray(shirtAssignmentsTable.playerId, playerIds));
  return rows.map(({ assignment: a, context: c }) => ({
    ...a, contextName: c.name, kind: c.kind as "league" | "tournament", seasonName: c.seasonName,
    status: a.status as "current" | "historical" | "void", recordedAt: a.recordedAt.toISOString(),
  }));
}

export async function shirtSummaries(playerIds: number[]) {
  if (!playerIds.length) return new Map<number, { current: Awaited<ReturnType<typeof shirtAssignments>>; legacyNumber: number | null }>();
  const [assignments, players] = await Promise.all([
    shirtAssignments(playerIds),
    db.select({ id: playersTable.id, number: playersTable.shirtNumber, resolved: playersTable.shirtNumberLegacyResolved })
      .from(playersTable).where(inArray(playersTable.id, playerIds)),
  ]);
  return new Map(players.map((p) => [p.id, {
    current: assignments.filter((a) => a.playerId === p.id && a.status === "current").map((a) => ({ ...a, notes: null })),
    legacyNumber: p.resolved ? null : p.number,
  }]));
}

/** No legacy fallback: a global number is not evidence of competition ownership. */
export async function withLeagueNumbers<T extends { id: number; teamId: number | null; shirtNumber: number | null }>(
  players: T[], seasonId?: number,
): Promise<T[]> {
  if (!players.length) return players;
  const rows = await db.select({
    playerId: shirtAssignmentsTable.playerId, teamId: shirtAssignmentsTable.teamId, number: shirtAssignmentsTable.number,
  }).from(shirtAssignmentsTable)
    .innerJoin(shirtContextsTable, eq(shirtContextsTable.id, shirtAssignmentsTable.contextId))
    .innerJoin(seasonsTable, eq(seasonsTable.id, shirtContextsTable.seasonId))
    .where(and(inArray(shirtAssignmentsTable.playerId, players.map((p) => p.id)),
      eq(shirtAssignmentsTable.status, "current"), eq(shirtContextsTable.kind, "league"),
      seasonId === undefined ? eq(seasonsTable.slug, "membership-2026-27") : eq(seasonsTable.id, seasonId)));
  const numbers = new Map(rows.map((r) => [`${r.playerId}:${r.teamId}`, r.number]));
  return players.map((p) => ({ ...p, shirtNumber: numbers.get(`${p.id}:${p.teamId}`) ?? null }));
}

export async function withShirtSummary<T extends { id: number; shirtNumber?: number | null }>(player: T) {
  return { ...player, shirtNumber: undefined, shirtNumbers: (await shirtSummaries([player.id])).get(player.id) };
}
