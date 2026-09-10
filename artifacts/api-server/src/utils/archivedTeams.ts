import { and, eq } from "drizzle-orm";
import { db, playerParticipationsTable, seasonsTable, worldCupTeamSnapshotsTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

export async function isArchivedRotterdamTeam(teamId: number): Promise<boolean> {
  const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "rotterdam-2026"));
  if (!season) return false;
  const [row] = await db.select({ teamId: playerParticipationsTable.teamId })
    .from(playerParticipationsTable)
    .where(and(
      eq(playerParticipationsTable.seasonId, season.id),
      eq(playerParticipationsTable.teamId, teamId),
      eq(playerParticipationsTable.participationStatus, "active"),
    )).limit(1);
  return row != null;
}

export async function getWorldCupTeamSnapshots(teamIds: number[]) {
  if (!teamIds.length) return new Map<number, { name: string | null; category: string | null }>();
  const rows = await db.select({ teamId: worldCupTeamSnapshotsTable.teamId, snapshot: worldCupTeamSnapshotsTable.snapshot })
    .from(worldCupTeamSnapshotsTable).where(inArray(worldCupTeamSnapshotsTable.teamId, teamIds));
  return new Map(rows.map(({ teamId, snapshot }) => {
    const source = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
    return [teamId, { name: source.name as string | null ?? null, category: source.category as string | null ?? null }];
  }));
}