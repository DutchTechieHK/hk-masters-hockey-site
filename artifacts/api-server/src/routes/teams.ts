import { Router } from "express";
import { visibleMember } from "../utils/memberVisibility";
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
import { withLeagueNumbers } from "../utils/shirtNumbers";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";
import { squadMembershipsTable } from "@workspace/db";
import { ensureSquadStorage, inSquadOrPrimary, syncPrimarySquad } from "../utils/squads";

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
    .where(visibleMember())
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
  const [squadMember] = !await ensureSquadStorage() ? [] : await db.select({ id: squadMembershipsTable.id }).from(squadMembershipsTable)
    .where(eq(squadMembershipsTable.teamId, id)).limit(1);
  if (squadMember) {
    res.status(409).json({ error: "This team still has members in its squad. Remove them from the squad before deleting the team." });
    return;
  }
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

/**
 * A squad can be managed for every current team. The internal holding team
 * and the archived Rotterdam teams have no squad.
 */
async function loadSquadTeam(id: number) {
  const [[team], [currentSeason]] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.id, id)),
    db.select().from(seasonsTable).where(eq(seasonsTable.slug, CURRENT_SEASON_SLUG)),
  ]);
  if (!team || team.isInternal || await isArchivedRotterdamTeam(team.id)) {
    return { error: { status: 404, message: "This team has no current squad" } } as const;
  }
  if (!currentSeason) {
    return { error: { status: 409, message: "Current membership season is not configured" } } as const;
  }
  return { team, currentSeason } as const;
}

router.get("/:id/squad", requireAdminAccess, async (req, res): Promise<void> => {
  const { id } = ListCurrentSquadCandidatesParams.parse(req.params);
  const loaded = await loadSquadTeam(id);
  if ("error" in loaded) {
    res.status(loaded.error!.status).json({ error: loaded.error!.message });
    return;
  }
  const { team, currentSeason } = loaded;
  await ensureSquadStorage();
  const selectedInThisSquad = inSquadOrPrimary(playersTable.id, currentSeason.id, id);

  // Eligible members: active this season and in the team's section, plus
  // anyone already in this squad. Being in another squad does not exclude.
  const rows = await db.select({
    player: playersTable,
    participation: playerParticipationsTable,
    selected: sql<boolean>`${selectedInThisSquad}`,
  }).from(playerParticipationsTable)
    .innerJoin(playersTable, eq(playerParticipationsTable.playerId, playersTable.id))
    .where(and(
      eq(playerParticipationsTable.seasonId, currentSeason.id),
      eq(playerParticipationsTable.participationStatus, "active"),
      eq(playersTable.memberStatus, "active"),
      or(
        eq(playersTable.currentMembershipSection, team.membershipSection),
        selectedInThisSquad,
      ),
    ))
    .orderBy(playersTable.name);

  const contextual = await withLeagueNumbers(rows.map(({ player }) => ({ ...player, teamId: id })), currentSeason.id);
  res.json(rows.map(({ participation, selected }, i) =>
    mapSquadCandidate(contextual[i], participation.membershipTier, selected === true)));
});

router.put("/:id/squad/:playerId", requireAdminAccess, async (req, res): Promise<void> => {
  const { id, playerId } = UpdateCurrentSquadSelectionParams.parse(req.params);
  const { selected } = UpdateCurrentSquadSelectionBody.parse(req.body);
  const loaded = await loadSquadTeam(id);
  if ("error" in loaded) {
    res.status(loaded.error!.status).json({ error: loaded.error!.message });
    return;
  }
  const { team, currentSeason } = loaded;

  if (!await ensureSquadStorage()) {
    // Safety net: without the squad table, fall back to the original
    // behaviour of one squad per member, stored on the season record.
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
    const [fallbackPlayer] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (!updated || !fallbackPlayer) {
      res.status(409).json({ error: "Squad selection changed or member is no longer current" });
      return;
    }
    res.json(mapSquadCandidate(
      (await withLeagueNumbers([{ ...fallbackPlayer, teamId: id }], currentSeason.id))[0],
      updated.membershipTier,
      updated.teamId === id,
    ));
    return;
  }

  const outcome = await db.transaction(async (tx) => {
    // Lock the member's season record so two squad changes for the same
    // member cannot interleave.
    const [participation] = await tx.select().from(playerParticipationsTable).where(and(
      eq(playerParticipationsTable.playerId, playerId),
      eq(playerParticipationsTable.seasonId, currentSeason.id),
      eq(playerParticipationsTable.participationStatus, "active"),
    )).for("update");
    const [player] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (!participation || !player) return null;

    // A squad still recorded the old way (only on the season record) is
    // written into the squad list first, so it cannot be lost by this change.
    if (participation.teamId != null) {
      await tx.insert(squadMembershipsTable).values({
        playerId, teamId: participation.teamId, seasonId: currentSeason.id, source: "backfill_primary_team",
      }).onConflictDoNothing();
    }

    if (selected) {
      // Adding needs a current, active member in the team's section.
      if (player.memberStatus !== "active" || player.currentMembershipSection !== team.membershipSection) return null;
      await tx.insert(squadMembershipsTable).values({
        playerId, teamId: id, seasonId: currentSeason.id, source: "admin_squad_selection",
      }).onConflictDoNothing();
    } else {
      // Removing only ever touches this team's squad, never another squad.
      await tx.delete(squadMembershipsTable).where(and(
        eq(squadMembershipsTable.playerId, playerId),
        eq(squadMembershipsTable.teamId, id),
        eq(squadMembershipsTable.seasonId, currentSeason.id),
      ));
    }
    await syncPrimarySquad(tx, currentSeason.id, [playerId]);
    await tx.update(playerParticipationsTable)
      .set({ source: "admin_squad_selection", updatedAt: new Date() })
      .where(eq(playerParticipationsTable.id, participation.id));
    return { player, membershipTier: participation.membershipTier };
  });

  if (!outcome) {
    res.status(409).json({ error: "Squad selection changed or member is no longer current" });
    return;
  }

  res.json(mapSquadCandidate(
    (await withLeagueNumbers([{ ...outcome.player, teamId: id }], currentSeason.id))[0],
    outcome.membershipTier,
    selected,
  ));
});

export default router;
