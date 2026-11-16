import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { db, squadMembershipsTable } from "@workspace/db";
import { playerParticipationsTable, playersTable, seasonsTable, teamsTable } from "@workspace/db/schema";

vi.mock("../middleware/adminAuth", () => ({
  hasAdminAccess: vi.fn(async () => true),
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: teamsRouter } = await import("./teams");
const { default: publicSquadRouter } = await import("./publicSquad");
const { ensureMembershipFoundation } = await import("./players");
const { eligiblePlayersForTeams } = await import("./matchAttendance");
const { currentSquadTeamIds, reconcileSquads } = await import("../utils/squads");

const app = express();
app.use(express.json());
app.use("/api/teams", teamsRouter);
app.use("/api/public", publicSquadRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

const runId = `${process.pid}-${Date.now()}`;
let seasonId: number;
let leagueTeamId: number;
let tournamentTeamId: number;
let womenTeamId: number;
let memberId: number;
let oldStyleMemberId: number;

async function primaryTeam(playerId: number) {
  const [row] = await db.select({ teamId: playerParticipationsTable.teamId }).from(playerParticipationsTable)
    .where(and(eq(playerParticipationsTable.playerId, playerId), eq(playerParticipationsTable.seasonId, seasonId)));
  return row?.teamId ?? null;
}
async function squadRows(playerId: number) {
  const rows = await db.select({ teamId: squadMembershipsTable.teamId }).from(squadMembershipsTable)
    .where(and(eq(squadMembershipsTable.playerId, playerId), eq(squadMembershipsTable.seasonId, seasonId)))
    .orderBy(squadMembershipsTable.id);
  return rows.map((row) => row.teamId);
}

beforeAll(async () => {
  const foundation = await ensureMembershipFoundation();
  seasonId = foundation.currentSeasonId;
  const [league] = await db.select().from(teamsTable).where(eq(teamsTable.name, "Masters Div. 1"));
  leagueTeamId = league.id;
  const team = (name: string, membershipSection: string) => ({
    name: `${name} ${runId}`, category: "League Team", membershipSection,
    managerName: "", managerEmail: "", managerPhone: "",
  });
  const [tournament, women] = await db.insert(teamsTable)
    .values([team("Tournament Men", "men"), team("Tournament Women", "women")]).returning({ id: teamsTable.id });
  tournamentTeamId = tournament.id;
  womenTeamId = women.id;

  const member = (label: string) => ({
    teamId: leagueTeamId, name: `${label} ${runId}`, email: `${label.toLowerCase().replaceAll(" ", "-")}-${runId}@example.com`,
    memberStatus: "active", currentMembershipSection: "men", currentMembershipTier: "social_player",
  });
  const players = await db.insert(playersTable).values([member("Multi Squad"), member("Old Style")]).returning({ id: playersTable.id });
  memberId = players[0].id;
  oldStyleMemberId = players[1].id;
  await db.insert(playerParticipationsTable).values([
    { playerId: memberId, seasonId, teamId: null, participationStatus: "active", membershipSection: "men", membershipTier: "social_player", source: "multi_squad_test" },
    // Recorded the old way: one team on the season record, no squad row yet.
    { playerId: oldStyleMemberId, seasonId, teamId: leagueTeamId, participationStatus: "active", membershipSection: "men", membershipTier: "social_player", source: "multi_squad_test" },
  ]);
});

afterAll(async () => {
  const ids = [memberId, oldStyleMemberId].filter(Boolean);
  if (ids.length) {
    await db.delete(squadMembershipsTable).where(inArray(squadMembershipsTable.playerId, ids));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, ids));
    await db.delete(playersTable).where(inArray(playersTable.id, ids));
  }
  const teamIds = [tournamentTeamId, womenTeamId].filter(Boolean);
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("squads for every team, several squads per member", () => {
  it("offers a squad picker on any current team, not only Masters Div. 1", async () => {
    const response = await request(app).get(`/api/teams/${tournamentTeamId}/squad`);
    expect(response.status).toBe(200);
    expect(response.body).toContainEqual(expect.objectContaining({ playerId: memberId, selected: false }));
  });

  it("has no squad for the internal holding team", async () => {
    const [holding] = await db.select().from(teamsTable).where(eq(teamsTable.name, "Awaiting Selection"));
    expect((await request(app).get(`/api/teams/${holding.id}/squad`)).status).toBe(404);
  });

  it("lets one member join two squads and keeps the first as the primary team", async () => {
    expect((await request(app).put(`/api/teams/${leagueTeamId}/squad/${memberId}`).send({ selected: true })).status).toBe(200);
    expect((await request(app).put(`/api/teams/${tournamentTeamId}/squad/${memberId}`).send({ selected: true })).status).toBe(200);

    expect(await squadRows(memberId)).toEqual([leagueTeamId, tournamentTeamId]);
    expect(await primaryTeam(memberId)).toBe(leagueTeamId);
    expect(await currentSquadTeamIds(memberId)).toEqual([leagueTeamId, tournamentTeamId]);

    for (const teamId of [leagueTeamId, tournamentTeamId]) {
      const list = await request(app).get(`/api/teams/${teamId}/squad`);
      expect(list.body).toContainEqual(expect.objectContaining({ playerId: memberId, selected: true }));
    }
  });

  it("counts the member in both teams' match attendance lists", async () => {
    const eligible = await eligiblePlayersForTeams([leagueTeamId, tournamentTeamId]);
    const teams = eligible.filter((player) => player.id === memberId).map((player) => player.teamId).sort();
    expect(teams).toEqual([leagueTeamId, tournamentTeamId].sort());
  });

  it("lists the member under both teams on the public squad page", async () => {
    const response = await request(app).get("/api/public/squad");
    expect(response.status).toBe(200);
    const teams = (response.body as Array<{ id: number; teamId: number }>)
      .filter((row) => row.id === memberId).map((row) => row.teamId).sort();
    expect(teams).toEqual([leagueTeamId, tournamentTeamId].sort());
  });

  it("removing one squad leaves the other and moves the primary team", async () => {
    const removed = await request(app).put(`/api/teams/${leagueTeamId}/squad/${memberId}`).send({ selected: false });
    expect(removed.status).toBe(200);
    expect(removed.body.selected).toBe(false);
    expect(await squadRows(memberId)).toEqual([tournamentTeamId]);
    expect(await primaryTeam(memberId)).toBe(tournamentTeamId);

    await request(app).put(`/api/teams/${tournamentTeamId}/squad/${memberId}`).send({ selected: false });
    expect(await squadRows(memberId)).toEqual([]);
    expect(await primaryTeam(memberId)).toBeNull();
  });

  it("refuses a squad in another section", async () => {
    const response = await request(app).put(`/api/teams/${womenTeamId}/squad/${memberId}`).send({ selected: true });
    expect(response.status).toBe(409);
    expect(await squadRows(memberId)).toEqual([]);
  });

  it("copies a squad recorded the old way exactly once, and never removes squads", async () => {
    // Before the copy, the old-style member already counts as selected.
    const before = await request(app).get(`/api/teams/${leagueTeamId}/squad`);
    expect(before.body).toContainEqual(expect.objectContaining({ playerId: oldStyleMemberId, selected: true }));

    await db.transaction((tx) => reconcileSquads(tx, seasonId));
    await db.transaction((tx) => reconcileSquads(tx, seasonId));
    expect(await squadRows(oldStyleMemberId)).toEqual([leagueTeamId]);
    expect(await primaryTeam(oldStyleMemberId)).toBe(leagueTeamId);

    // A member who was deliberately removed is not put back by the upkeep.
    expect(await squadRows(memberId)).toEqual([]);
    expect(await primaryTeam(memberId)).toBeNull();
  });

  it("keeps an old-style squad when a second squad is added before the copy has run", async () => {
    // Put the old-style member back to "only on the season record".
    await db.delete(squadMembershipsTable).where(eq(squadMembershipsTable.playerId, oldStyleMemberId));
    expect(await primaryTeam(oldStyleMemberId)).toBe(leagueTeamId);

    const added = await request(app).put(`/api/teams/${tournamentTeamId}/squad/${oldStyleMemberId}`).send({ selected: true });
    expect(added.status).toBe(200);
    expect(await squadRows(oldStyleMemberId)).toEqual([leagueTeamId, tournamentTeamId]);
    expect(await primaryTeam(oldStyleMemberId)).toBe(leagueTeamId);

    await request(app).put(`/api/teams/${tournamentTeamId}/squad/${oldStyleMemberId}`).send({ selected: false });
    expect(await squadRows(oldStyleMemberId)).toEqual([leagueTeamId]);
  });

  it("will not delete a team that still has a squad", async () => {
    await request(app).put(`/api/teams/${tournamentTeamId}/squad/${memberId}`).send({ selected: true });
    const blocked = await request(app).delete(`/api/teams/${tournamentTeamId}`);
    expect(blocked.status).toBe(409);
    await request(app).put(`/api/teams/${tournamentTeamId}/squad/${memberId}`).send({ selected: false });
  });
});
