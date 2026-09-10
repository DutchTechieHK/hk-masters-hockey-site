import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, playerParticipationsTable, seasonsTable } from "@workspace/db/schema";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import {
  CreateTeamBody,
  UpdateTeamBody,
  UpdateTeamParams,
  DeleteTeamParams,
  ListCurrentSquadCandidatesParams,
  UpdateCurrentSquadSelectionParams,
  UpdateCurrentSquadSelectionBody,
} from "@workspace/api-zod";
import { hasAdminAccess, requireAdminAccess } from "../middleware/adminAuth";

const CURRENT_SEASON_SLUG = "membership-2026-27";
const CANONICAL_TEAM_NAMES = new Set(["Awaiting Selection", "Masters Div. 1"]);

const router = Router();

function mapTeam(t: typeof teamsTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    managerName: t.managerName,
    managerEmail: t.managerEmail,
    managerPhone: t.managerPhone,
    assistantManagerName: t.assistantManagerName,
    assistantManagerContact: t.assistantManagerContact,
    whatsappGroupLink: t.whatsappGroupLink,
    targetPlayerCount: t.targetPlayerCount,
    kitNotes: t.kitNotes,
    notes: t.notes,
    coachName: t.coachName,
    captainName: t.captainName,
    description: t.description,
    createdAt: t.createdAt?.toISOString(),
  };
}

function mapTeamPublic(t: typeof teamsTable.$inferSelect, playerCount: number) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    managerName: t.managerName || null,
    coachName: t.coachName || null,
    captainName: t.captainName || null,
    description: t.description || null,
    playerCount,
  };
}

function mapSquadCandidate(
  player: Pick<typeof playersTable.$inferSelect, "id" | "name" | "email" | "position" | "shirtNumber">,
  membershipTier: string | null,
  selected: boolean,
) {
  return {
    playerId: player.id,
    name: player.name,
    email: player.email,
    position: player.position || null,
    shirtNumber: player.shirtNumber,
    membershipTier,
    selected,
  };
}

router.get("/", async (req, res) => {
  const isAdmin = await hasAdminAccess(req);
  if (isAdmin) {
    const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
    return res.json(teams.map(mapTeam));
  }
  const teams = await db.select().from(teamsTable)
    .where(eq(teamsTable.isInternal, false))
    .orderBy(teamsTable.id);
  // For public: include live player counts
  const counts = await db
    .select({ teamId: playersTable.teamId, count: sql<number>`count(*)::int` })
    .from(playersTable)
    .groupBy(playersTable.teamId);
  const countMap = new Map(counts.map((r) => [r.teamId, r.count]));
  return res.json(teams.map((t) => mapTeamPublic(t, countMap.get(t.id) ?? 0)));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  if (CANONICAL_TEAM_NAMES.has(body.name)) {
    res.status(409).json({ error: "This team name is reserved" });
    return;
  }
  const [team] = await db.insert(teamsTable).values(body as any).returning();
  res.status(201).json(mapTeam(team));
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateTeamParams.parse(req.params);
  const body = UpdateTeamBody.parse(req.body);
  const [existing] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (
    (CANONICAL_TEAM_NAMES.has(existing.name) && body.name !== existing.name) ||
    (!CANONICAL_TEAM_NAMES.has(existing.name) && CANONICAL_TEAM_NAMES.has(body.name))
  ) {
    res.status(409).json({ error: "Canonical team names cannot be changed or reused" });
    return;
  }
  const [team] = await db.update(teamsTable).set(body as any).where(eq(teamsTable.id, id)).returning();
  res.json(mapTeam(team));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteTeamParams.parse(req.params);
  const [existing] = await db.select().from(teamsTable).where(eq(teamsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Team not found" });
    return;
  }
  if (CANONICAL_TEAM_NAMES.has(existing.name)) {
    res.status(409).json({ error: "Canonical teams cannot be deleted" });
    return;
  }
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

router.get("/:id/squad", requireAdminAccess, async (req, res): Promise<void> => {
  const { id } = ListCurrentSquadCandidatesParams.parse(req.params);
  const [[team], [currentSeason]] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, id)),
    db.select().from(seasonsTable).where(eq(seasonsTable.slug, CURRENT_SEASON_SLUG)),
  ]);
  if (!team || team.name !== "Masters Div. 1") {
    res.status(404).json({ error: "Masters Div. 1 squad not found" });
    return;
  }
  if (!currentSeason) {
    res.status(409).json({ error: "Current membership season is not configured" });
    return;
  }

  const rows = await db.select({
    player: playersTable,
    participation: playerParticipationsTable,
  }).from(playerParticipationsTable)
    .innerJoin(playersTable, eq(playerParticipationsTable.playerId, playersTable.id))
    .where(and(
      eq(playerParticipationsTable.seasonId, currentSeason.id),
      eq(playerParticipationsTable.participationStatus, "active"),
      eq(playersTable.memberStatus, "active"),
    ))
    .orderBy(playersTable.name);

  res.json(rows.map(({ player, participation }) =>
    mapSquadCandidate(player, participation.membershipTier, participation.teamId === id)));
});

router.put("/:id/squad/:playerId", requireAdminAccess, async (req, res): Promise<void> => {
  const { id, playerId } = UpdateCurrentSquadSelectionParams.parse(req.params);
  const { selected } = UpdateCurrentSquadSelectionBody.parse(req.body);
  const [[team], [currentSeason]] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, id)),
    db.select().from(seasonsTable).where(eq(seasonsTable.slug, CURRENT_SEASON_SLUG)),
  ]);
  if (!team || team.name !== "Masters Div. 1") {
    res.status(404).json({ error: "Masters Div. 1 squad not found" });
    return;
  }
  if (!currentSeason) {
    res.status(409).json({ error: "Current membership season is not configured" });
    return;
  }

  const [updated] = await db.update(playerParticipationsTable).set({
    teamId: selected ? id : null,
    source: "admin_squad_selection",
    updatedAt: new Date(),
  }).where(and(
    eq(playerParticipationsTable.playerId, playerId),
    eq(playerParticipationsTable.seasonId, currentSeason.id),
    eq(playerParticipationsTable.participationStatus, "active"),
    selected
      ? undefined
      : or(eq(playerParticipationsTable.teamId, id), isNull(playerParticipationsTable.teamId)),
    sql`EXISTS (
      SELECT 1 FROM ${playersTable}
      WHERE ${playersTable.id} = ${playerParticipationsTable.playerId}
        AND ${playersTable.memberStatus} = 'active'
    )`,
  )).returning();
  if (!updated) {
    res.status(409).json({ error: "Squad selection changed or member is no longer current" });
    return;
  }
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) {
    res.status(404).json({ error: "Current member not found" });
    return;
  }

  res.json(mapSquadCandidate(
    player,
    updated.membershipTier,
    updated.teamId === id,
  ));
});

export default router;
