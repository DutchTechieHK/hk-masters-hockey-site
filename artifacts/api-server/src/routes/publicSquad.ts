import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable, seasonsTable, playerParticipationsTable, worldCupPlayerSnapshotsTable, worldCupTeamSnapshotsTable } from "@workspace/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { withLeagueNumbers } from "../utils/shirtNumbers";

const router = Router();

router.get("/squad", async (req, res) => {
  if (req.query.scope === "world_cup_2026") {
    const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.slug, "rotterdam-2026"));
    if (!season) return res.json([]);
    const rows = await db.select({ participation: playerParticipationsTable, playerSnapshot: worldCupPlayerSnapshotsTable.snapshot, teamSnapshot: worldCupTeamSnapshotsTable.snapshot })
      .from(playerParticipationsTable)
      .innerJoin(worldCupPlayerSnapshotsTable, eq(worldCupPlayerSnapshotsTable.playerId, playerParticipationsTable.playerId))
      .leftJoin(worldCupTeamSnapshotsTable, eq(worldCupTeamSnapshotsTable.teamId, playerParticipationsTable.teamId))
      .where(and(eq(playerParticipationsTable.seasonId, season.id), eq(playerParticipationsTable.participationStatus, "active")))
      .orderBy(playerParticipationsTable.playerId);
    const mapped = rows.map(({ participation, playerSnapshot, teamSnapshot }) => {
      const player = playerSnapshot as Record<string, unknown>;
      const team = teamSnapshot && typeof teamSnapshot === "object" ? teamSnapshot as Record<string, unknown> : {};
      return {
        id: participation.playerId,
        name: String(player.name ?? ""),
        shirtNumber: (player.shirt_number as number | null) ?? null,
        position: (player.position as string | null) ?? null,
        teamId: participation.teamId,
        teamName: participation.teamId == null ? null : (team.name as string | null) ?? null,
        teamCategory: participation.teamId == null ? null : (team.category as string | null) ?? null,
      };
    });
    res.set("Cache-Control", "public, max-age=60");
    return res.json(mapped);
  }
  const rows = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      shirtNumber: playersTable.shirtNumber,
      position: playersTable.position,
      teamId: teamsTable.id,
      teamName: teamsTable.name,
      teamCategory: teamsTable.category,
    })
    .from(playersTable)
    .leftJoin(seasonsTable, eq(seasonsTable.slug, "membership-2026-27"))
    .leftJoin(playerParticipationsTable, and(eq(playerParticipationsTable.playerId, playersTable.id),
      eq(playerParticipationsTable.seasonId, seasonsTable.id), eq(playerParticipationsTable.participationStatus, "active")))
    .leftJoin(teamsTable, sql`${teamsTable.id} = coalesce(${playerParticipationsTable.teamId}, ${playersTable.teamId})`)
    .where(eq(teamsTable.isInternal, false))
    .orderBy(playersTable.id);

  res.set("Cache-Control", "public, max-age=60");
  res.json(
    (await withLeagueNumbers(rows)).map((r) => ({
      id: r.id,
      name: r.name,
      shirtNumber: r.shirtNumber ?? null,
      position: r.position ?? null,
      teamId: r.teamId,
      teamName: r.teamName ?? null,
      teamCategory: r.teamCategory ?? null,
    })),
  );
  return;
});

router.get("/teams", async (_req, res) => {
  const teams = await db.select().from(teamsTable)
    .where(eq(teamsTable.isInternal, false))
    .orderBy(teamsTable.id);
  res.set("Cache-Control", "public, max-age=60");
  res.json(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
    })),
  );
});

export default router;
