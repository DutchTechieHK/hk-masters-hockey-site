import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, playerParticipationsTable, seasonsTable, worldCupTeamSnapshotsTable } from "@workspace/db/schema";
import { and, eq, isNull, or, sql, inArray, notExists } from "drizzle-orm";
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
    membershipSection: t.membershipSection,
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
    membershipSection: t.membershipSection,
    managerName: t.managerName || null,
    coachName: t.coachName || null,
    captainName: t.captainName || null,
    description: t.description || null,
    playerCount,
  };
}

function mapSquadCandidate(
  player: Pick<typeof playersTable.$inferSelect, "id" | "name" | "email" | "position" | "shirtNumber" | "currentMembershipSection">,
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
    membershipSection: player.currentMembershipSection,
    selected,
  };
}

router.get("/", async (req, res) => {
  const isAdmin = await hasAdminAccess(req);
  if (req.query.scope === "world_cup_2026") {
    if (!isAdmin) return res.status(403).json({ error: "Admin access required" });
    const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.slug, "rotterdam-2026"));
    if (!season) return res.json([]);
    const rows = await db.select({ team: teamsTable, snapshot: worldCupTeamSnapshotsTable.snapshot }).from(playerParticipationsTable)
      .innerJoin(teamsTable, eq(playerParticipationsTable.teamId, teamsTable.id))
      .leftJoin(worldCupTeamSnapshotsTable, eq(worldCupTeamSnapshotsTable.teamId, teamsTable.id))
      .where(and(eq(playerParticipationsTable.seasonId, season.id), eq(playerParticipationsTable.participationStatus, "active")));
    const unique = [...new Map(rows.map(({ team, snapshot }) => {
      const source = snapshot && typeof snapshot === "object" ? snapshot as Record<string, unknown> : {};
      const mapped = Object.fromEntries(Object.keys(team).map((key) => {
        const dbKey = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
        return [key, dbKey in source ? source[dbKey] : team[key as keyof typeof team]];
      })) as typeof team;
      // Snapshots are populated with to_jsonb, so timestamp fields arrive as
      // ISO strings rather than Drizzle's Date instances.
      if (typeof mapped.createdAt === "string") {
        mapped.createdAt = new Date(mapped.createdAt);
      }
      return [team.id, mapped];
    })).values()];
    return res.json(unique.map(mapTeam));
  }
  if (isAdmin) {
    const teams = await db.select().from(teamsTable).where(notExists(
      db.select({ id: playerParticipationsTable.id }).from(playerParticipationsTable)
        .innerJoin(seasonsTable, eq(seasonsTable.id, playerParticipationsTable.seasonId))
        .where(and(eq(playerParticipationsTable.teamId, teamsTable.id), eq(playerParticipationsTable.participationStatus, "active"), eq(seasonsTable.slug, "rotterdam-2026"))),
    )).orderBy(teamsTable.id);
    return res.json(teams.map(mapTeam));
  }
  const teams = await db.select().from(teamsTable)
    .where(and(eq(teamsTable.isInternal, false), notExists(
      db.select({ id: playerParticipationsTable.id }).from(playerParticipationsTable)
        .innerJoin(seasonsTable, eq(seasonsTable.id, playerParticipationsTable.seasonId))
        .where(and(eq(playerParticipationsTable.teamId, teamsTable.id), eq(playerParticipationsTable.participationStatus, "active"), eq(seasonsTable.slug, "rotterdam-2026"))),
    )))
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
  const [rotterdam] = await db.select({ id: playerParticipationsTable.id }).from(playerParticipationsTable)
    .innerJoin(seasonsTable, eq(playerParticipationsTable.seasonId, seasonsTable.id))
    .where(and(eq(playerParticipationsTable.teamId, id), eq(seasonsTable.slug, "rotterdam-2026"), eq(playerParticipationsTable.participationStatus, "active")))
    .limit(1);
  if (rotterdam) {
    res.status(409).json({ error: "Archived content is read-only" });
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
  const [rotterdam] = await db.select({ id: playerParticipationsTable.id }).from(playerParticipationsTable)
    .innerJoin(seasonsTable, eq(playerParticipationsTable.seasonId, seasonsTable.id))
    .where(and(eq(playerParticipationsTable.teamId, id), eq(seasonsTable.slug, "rotterdam-2026"), eq(playerParticipationsTable.participationStatus, "active")))
    .limit(1);
  if (rotterdam) {
    res.status(409).json({ error: "Archived content is read-only" });
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
      or(
        eq(playersTable.currentMembershipSection, team.membershipSection),
        eq(playerParticipationsTable.teamId, id),
      ),
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
        AND (
          ${selected} = false
          OR (
            ${playersTable.memberStatus} = 'active'
            AND ${playersTable.currentMembershipSection} = ${team.membershipSection}
          )
        )
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
