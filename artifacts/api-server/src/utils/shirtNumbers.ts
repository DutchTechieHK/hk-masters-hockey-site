import { db, playersTable, shirtAssignmentsTable, shirtContextsTable, shirtAuditTable, seasonsTable } from "@workspace/db";
import { and, eq, inArray, ne, sql } from "drizzle-orm";

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


type ShirtTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** The league competition that holds this membership season's squad numbers. Created on first use. */
export async function leagueContextForSeason(tx: ShirtTransaction, season: { id: number; name: string }) {
  const find = () => tx.select().from(shirtContextsTable)
    .where(and(eq(shirtContextsTable.seasonId, season.id), eq(shirtContextsTable.kind, "league"))).limit(1);
  const [existing] = await find();
  if (existing) return existing;
  for (const name of [season.name, `${season.name} squads`]) {
    await tx.insert(shirtContextsTable)
      .values({ name, kind: "league", seasonId: season.id, seasonName: season.name }).onConflictDoNothing();
    const [created] = await find();
    if (created) return created;
  }
  throw new Error("Could not prepare the shirt number competition for this season");
}

/**
 * Set, change or clear (number = null) a member's squad number for one team
 * in one membership season. Uses the same records, history and audit trail
 * as the member's shirt history. Returns duplicate-number warnings.
 */
export async function setSquadShirtNumber(tx: ShirtTransaction, input: {
  playerId: number; team: { id: number; name: string }; season: { id: number; name: string };
  number: number | null; actor: string;
}): Promise<string[]> {
  const { playerId, team, season, number, actor } = input;
  await tx.execute(sql`SELECT id FROM players WHERE id = ${playerId} FOR UPDATE`);
  const context = await leagueContextForSeason(tx, season);
  const [current] = await tx.select().from(shirtAssignmentsTable).where(and(
    eq(shirtAssignmentsTable.playerId, playerId), eq(shirtAssignmentsTable.contextId, context.id),
    eq(shirtAssignmentsTable.teamId, team.id), eq(shirtAssignmentsTable.status, "current"),
  ));
  if ((current?.number ?? null) === number) return duplicateWarnings(tx, playerId, context.id, team, number);

  const [{ today }] = (await tx.execute(sql`SELECT to_char(now() AT TIME ZONE 'Asia/Hong_Kong', 'YYYY-MM-DD') AS today`)).rows as Array<{ today: string }>;
  let after: unknown = null;
  if (current) {
    const endsOn = current.startsOn && current.startsOn > today ? current.startsOn : today;
    await tx.update(shirtAssignmentsTable).set({ status: "historical", endsOn }).where(eq(shirtAssignmentsTable.id, current.id));
  }
  if (number != null) {
    const [created] = await tx.insert(shirtAssignmentsTable).values({
      playerId, contextId: context.id, teamId: team.id, teamName: team.name, number, status: "current", startsOn: today,
    }).returning();
    after = created;
  }
  const action = number == null ? "end" : current ? "change" : "assign";
  await tx.update(playersTable).set({ shirtNumberRevision: sql`${playersTable.shirtNumberRevision} + 1` }).where(eq(playersTable.id, playerId));
  await tx.insert(shirtAuditTable).values({
    playerId, actor, action, reason: null, before: current ?? null, after,
    detail: `${action} ${number == null ? `#${current!.number}` : `#${number}`}, competition ${context.id}, ${team.name}; set in the squad list`,
  });
  return duplicateWarnings(tx, playerId, context.id, team, number);
}

async function duplicateWarnings(
  tx: ShirtTransaction, playerId: number, contextId: number, team: { id: number; name: string }, number: number | null,
): Promise<string[]> {
  if (number == null) return [];
  const others = await tx.select({
    name: sql<string>`CASE WHEN ${playersTable.memberStatus} = 'archived' THEN 'an archived member' ELSE ${playersTable.name} END`,
  }).from(shirtAssignmentsTable)
    .innerJoin(playersTable, eq(playersTable.id, shirtAssignmentsTable.playerId))
    .where(and(eq(shirtAssignmentsTable.contextId, contextId), eq(shirtAssignmentsTable.teamId, team.id),
      eq(shirtAssignmentsTable.number, number), eq(shirtAssignmentsTable.status, "current"), ne(shirtAssignmentsTable.playerId, playerId)));
  return others.length ? [`#${number} is also worn by ${others.map((o) => o.name).join(", ")} in ${team.name}.`] : [];
}
