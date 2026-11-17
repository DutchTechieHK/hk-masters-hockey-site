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
  SetSquadShirtNumberParams,
  SetSquadShirtNumberBody,
} from "@workspace/api-zod";
import { hasAdminAccess, requireAdminAccess } from "../middleware/adminAuth";
import { setSquadShirtNumber, withLeagueNumbers } from "../utils/shirtNumbers";
import { getSessionLabel } from "../middleware/adminSession";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";
import { squadMembershipsTable } from "@workspace/db";
import { endSquadShirtNumbers, ensureSquadStorage, inSquadOrPrimary, syncPrimarySquad } from "../utils/squads";
import {
  ensureTeamSetupStorage, setTeamCategories, setTeamStaff, teamCategoryKeys, teamStaffLinks, TeamSetupError,
  type TeamStaffLinks,
} from "../utils/teamSetup";
import { categoryKeysByPlayer } from "../utils/memberCategories";

const CURRENT_SEASON_SLUG = "membership-2026-27";
const CANONICAL_TEAM_NAMES = new Set(["Awaiting Selection", "Masters Div. 1"]);

const router = Router();

type TeamSetup = { eligibleCategories: string[]; staff: TeamStaffLinks | undefined };

/** Load the category list and linked staff for a set of teams in two queries. */
async function loadTeamSetup(teamIds: number[]): Promise<Map<number, TeamSetup>> {
  await ensureTeamSetupStorage();
  const [categories, staff] = await Promise.all([teamCategoryKeys(teamIds), teamStaffLinks(teamIds)]);
  return new Map(teamIds.map((id) => [id, { eligibleCategories: categories.get(id) ?? [], staff: staff.get(id) }]));
}

/** What the team form sends for categories and linked staff, split from the plain columns. */
function splitTeamBody<T extends {
  eligibleCategories?: string[];
  managerPlayerId?: number | null; assistantManagerPlayerId?: number | null;
  coachPlayerId?: number | null; captainPlayerId?: number | null;
}>(body: T) {
  const { eligibleCategories, managerPlayerId, assistantManagerPlayerId, coachPlayerId, captainPlayerId, ...columns } = body;
  const staff: Partial<TeamStaffLinks> = {};
  if (managerPlayerId !== undefined) staff.manager = managerPlayerId;
  if (assistantManagerPlayerId !== undefined) staff.assistant_manager = assistantManagerPlayerId;
  if (coachPlayerId !== undefined) staff.coach = coachPlayerId;
  if (captainPlayerId !== undefined) staff.captain = captainPlayerId;
  return { columns, eligibleCategories, staff };
}

function mapTeam(t: typeof teamsTable.$inferSelect, setup?: TeamSetup) {
  return {
    eligibleCategories: setup?.eligibleCategories ?? [],
    managerPlayerId: setup?.staff?.manager ?? null,
    assistantManagerPlayerId: setup?.staff?.assistant_manager ?? null,
    coachPlayerId: setup?.staff?.coach ?? null,
    captainPlayerId: setup?.staff?.captain ?? null,
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
  categories?: { held: string[]; mismatch: boolean },
) {
  return {
    membershipCategories: categories?.held ?? [],
    categoryMismatch: categories?.mismatch ?? false,
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
    return res.json(unique.map((team) => mapTeam(team)));
  }
  if (isAdmin) {
    const teams = await db.select().from(teamsTable).where(notExists(
      db.select({ id: playerParticipationsTable.id }).from(playerParticipationsTable)
        .innerJoin(seasonsTable, eq(seasonsTable.id, playerParticipationsTable.seasonId))
        .where(and(eq(playerParticipationsTable.teamId, teamsTable.id), eq(playerParticipationsTable.participationStatus, "active"), eq(seasonsTable.slug, "rotterdam-2026"))),
    )).orderBy(teamsTable.id);
    const setup = await loadTeamSetup(teams.map((team) => team.id));
    return res.json(teams.map((team) => mapTeam(team, setup.get(team.id))));
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
  const { columns: body, eligibleCategories, staff } = splitTeamBody(CreateTeamBody.parse(req.body));
  if (CANONICAL_TEAM_NAMES.has(body.name)) {
    res.status(409).json({ error: "This team name is reserved" });
    return;
  }
  await ensureTeamSetupStorage();
  try {
    const team = await db.transaction(async (tx) => {
      // The team form no longer asks for a category or typed manager details.
      // The columns stay, with neutral defaults, for older screens and the archive.
      const [created] = await tx.insert(teamsTable).values({
        ...(body as any),
        category: body.category?.trim() || "Team",
        managerName: body.managerName ?? "",
        managerEmail: body.managerEmail ?? "",
        managerPhone: body.managerPhone ?? "",
      }).returning();
      if (eligibleCategories !== undefined) await setTeamCategories(tx, created.id, eligibleCategories);
      await setTeamStaff(tx, created.id, staff);
      const [fresh] = await tx.select().from(teamsTable).where(eq(teamsTable.id, created.id));
      return fresh;
    });
    res.status(201).json(mapTeam(team, (await loadTeamSetup([team.id])).get(team.id)));
  } catch (error) {
    if (error instanceof TeamSetupError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateTeamParams.parse(req.params);
  const { columns: body, eligibleCategories, staff } = splitTeamBody(UpdateTeamBody.parse(req.body));
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
  await ensureTeamSetupStorage();
  try {
    const team = await db.transaction(async (tx) => {
      // A form that sends no category (the current team form) keeps the stored one.
      const { category, ...rest } = body as typeof body & { category?: string };
      await tx.update(teamsTable).set({
        ...(rest as any),
        ...(category?.trim() ? { category: category.trim() } : {}),
      }).where(eq(teamsTable.id, id));
      if (eligibleCategories !== undefined) await setTeamCategories(tx, id, eligibleCategories);
      // Linked staff are applied last so their member details win over typed text.
      await setTeamStaff(tx, id, staff);
      const [fresh] = await tx.select().from(teamsTable).where(eq(teamsTable.id, id));
      return fresh;
    });
    res.json(mapTeam(team, (await loadTeamSetup([id])).get(id)));
  } catch (error) {
    if (error instanceof TeamSetupError) { res.status(error.status).json({ error: error.message }); return; }
    throw error;
  }
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

async function adminActor(req: { headers: Record<string, unknown> }): Promise<string> {
  const token = req.headers["x-session-token"];
  return typeof token === "string" ? await getSessionLabel(token) ?? "Full admin" : "Admin API key";
}

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

  // A team may draw from certain membership categories only. Members of the
  // section who hold none of them are left out of the pick list. Anyone
  // already in the squad always stays listed, flagged as a mismatch.
  await ensureTeamSetupStorage();
  const teamCategories = (await teamCategoryKeys([id])).get(id) ?? [];
  const held = await categoryKeysByPlayer(currentSeason.id, rows.map(({ player }) => player.id));
  const listed = rows.map((row) => {
    const categories = held.get(row.player.id) ?? [];
    const fits = teamCategories.length === 0 || categories.some((key) => teamCategories.includes(key));
    return { ...row, categories, fits, inSquad: row.selected === true };
  }).filter((row) => row.inSquad || row.fits);

  const contextual = await withLeagueNumbers(listed.map(({ player }) => ({ ...player, teamId: id })), currentSeason.id);
  res.json(listed.map(({ participation, inSquad, categories, fits }, i) =>
    mapSquadCandidate(contextual[i], participation.membershipTier, inSquad, { held: categories, mismatch: inSquad && !fits })));
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
  const actor = await adminActor(req);

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
    if (!selected) await endSquadShirtNumbers(db, currentSeason.id, [{ playerId, teamId: id }], actor);
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
    // Leaving the squad closes the member's number for this team (kept in history).
    if (!selected) await endSquadShirtNumbers(tx, currentSeason.id, [{ playerId, teamId: id }], actor);
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

router.put("/:id/squad/:playerId/shirt-number", requireAdminAccess, async (req, res): Promise<void> => {
  const { id, playerId } = SetSquadShirtNumberParams.parse(req.params);
  const parsed = SetSquadShirtNumberBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Enter a whole shirt number from 1 to 99, or clear it." });
    return;
  }
  const number = parsed.data.number ?? null;
  if (number != null && (!Number.isInteger(number) || number < 1 || number > 99)) {
    res.status(400).json({ error: "Enter a whole shirt number from 1 to 99, or clear it." });
    return;
  }
  const loaded = await loadSquadTeam(id);
  if ("error" in loaded) {
    res.status(loaded.error!.status).json({ error: loaded.error!.message });
    return;
  }
  const { team, currentSeason } = loaded;
  await ensureSquadStorage();
  const actor = await adminActor(req);

  const outcome = await db.transaction(async (tx) => {
    // A number can only be given to someone who is in this team's squad.
    const [member] = await tx.select({ player: playersTable, membershipTier: playerParticipationsTable.membershipTier })
      .from(playerParticipationsTable)
      .innerJoin(playersTable, eq(playersTable.id, playerParticipationsTable.playerId))
      .where(and(
        eq(playerParticipationsTable.playerId, playerId),
        eq(playerParticipationsTable.seasonId, currentSeason.id),
        eq(playerParticipationsTable.participationStatus, "active"),
        inSquadOrPrimary(playerParticipationsTable.playerId, currentSeason.id, id),
      ));
    if (!member) return null;
    const warnings = await setSquadShirtNumber(tx, {
      playerId, team: { id: team.id, name: team.name }, season: { id: currentSeason.id, name: currentSeason.name }, number, actor,
    });
    return { ...member, warnings };
  });

  if (!outcome) {
    res.status(409).json({ error: "Add the member to this team's squad before giving them a number." });
    return;
  }
  res.json({
    candidate: mapSquadCandidate(
      (await withLeagueNumbers([{ ...outcome.player, teamId: id }], currentSeason.id))[0],
      outcome.membershipTier,
      true,
    ),
    warnings: outcome.warnings,
  });
});

export default router;
