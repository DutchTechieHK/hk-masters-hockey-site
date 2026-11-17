import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { db, squadMembershipsTable, playerCategoriesTable, teamStaffTable, teamCategoriesTable } from "@workspace/db";
import { playerParticipationsTable, playersTable, teamsTable } from "@workspace/db/schema";

vi.mock("../middleware/adminAuth", () => ({
  hasAdminAccess: vi.fn(async () => true),
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../utils/email", () => ({}));

const { default: teamsRouter } = await import("./teams");
const { default: playersRouter, ensureMembershipFoundation } = await import("./players");
const { autoLinkTypedStaffNames, ensureTeamSetupStorage } = await import("../utils/teamSetup");

const app = express();
app.use(express.json());
app.use("/api/teams", teamsRouter);
app.use("/api/players", playersRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

const runId = `${process.pid}-${Date.now()}`;
const LEAGUE = "masters_division_one";
const COMMUNITY = "community_member";
let seasonId: number;
const teamIds: number[] = [];
const memberIds: number[] = [];
let leaguePlayer: number, communityPlayer: number, awaitingPlayer: number, manager: number, coach: number;

async function addMember(label: string, tier: string, extra: object = {}) {
  const [row] = await db.insert(playersTable).values({
    teamId: teamIds[0], name: `${label} ${runId}`, email: `${label.toLowerCase().replaceAll(" ", "-")}-${runId}@example.com`,
    memberStatus: "active", currentMembershipSection: "men", currentMembershipTier: tier, ...extra,
  }).returning({ id: playersTable.id });
  memberIds.push(row.id);
  await db.insert(playerParticipationsTable).values({
    playerId: row.id, seasonId, teamId: null, participationStatus: "active", membershipSection: "men", membershipTier: tier, source: "team_setup_test",
  });
  return row.id;
}
const create = (body: object) => request(app).post("/api/teams").send(body);
const save = (id: number, body: object) => request(app).put(`/api/teams/${id}`).send(body);
const squadList = async (id: number) => (await request(app).get(`/api/teams/${id}/squad`)).body as any[];
const stored = async (id: number) => (await db.select().from(teamsTable).where(eq(teamsTable.id, id)))[0];

beforeAll(async () => {
  seasonId = (await ensureMembershipFoundation()).currentSeasonId;
  await ensureTeamSetupStorage(true);
  const [holder] = await db.insert(teamsTable).values({
    name: `Setup Holder ${runId}`, category: "Test", membershipSection: "men", managerName: "", managerEmail: "", managerPhone: "",
  }).returning({ id: teamsTable.id });
  teamIds.push(holder.id);
  leaguePlayer = await addMember("League Only", LEAGUE);
  communityPlayer = await addMember("Community Only", COMMUNITY);
  awaitingPlayer = await addMember("Still Awaiting", "awaiting_selection");
  manager = await addMember("Team Manager", COMMUNITY, { phone: "+852 5555 0001" });
  coach = await addMember("Team Coach", COMMUNITY);
  await ensureMembershipFoundation(); // copies the single categories into the category list
});

afterAll(async () => {
  if (memberIds.length) {
    await db.delete(teamStaffTable).where(inArray(teamStaffTable.playerId, memberIds));
    await db.delete(squadMembershipsTable).where(inArray(squadMembershipsTable.playerId, memberIds));
    await db.delete(playerCategoriesTable).where(inArray(playerCategoriesTable.playerId, memberIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, memberIds));
  }
  // Members point at the holder team, so they go before the teams.
  if (memberIds.length) await db.delete(playersTable).where(inArray(playersTable.id, memberIds));
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("team defined by section and categories, with linked staff", () => {
  let teamId: number;

  it("creates a team without a category or typed manager details", async () => {
    const response = await create({ name: `Tournament O50 ${runId}`, membershipSection: "men", eligibleCategories: [LEAGUE], managerPlayerId: manager });
    expect(response.status, JSON.stringify(response.body)).toBe(201);
    teamId = response.body.id;
    teamIds.push(teamId);
    expect(response.body).toMatchObject({
      membershipSection: "men", eligibleCategories: [LEAGUE], managerPlayerId: manager,
      coachPlayerId: null, managerName: `Team Manager ${runId}`, managerPhone: "+852 5555 0001",
    });
    expect((await stored(teamId)).category).toBe("Team");
  });

  it("offers only members of the section who hold one of the team's categories", async () => {
    const ids = (await squadList(teamId)).map((row) => row.playerId);
    expect(ids).toContain(leaguePlayer);
    expect(ids).not.toContain(communityPlayer);
    expect(ids).not.toContain(awaitingPlayer);
  });

  it("a team with no categories ticked offers the whole section, as before", async () => {
    expect((await save(teamId, { name: `Tournament O50 ${runId}`, eligibleCategories: [] })).status).toBe(200);
    const ids = (await squadList(teamId)).map((row) => row.playerId);
    expect(ids).toEqual(expect.arrayContaining([leaguePlayer, communityPlayer, awaitingPlayer]));
  });

  it("keeps a squad member who no longer fits, flagged as a category mismatch", async () => {
    expect((await request(app).put(`/api/teams/${teamId}/squad/${communityPlayer}`).send({ selected: true })).status).toBe(200);
    expect((await save(teamId, { name: `Tournament O50 ${runId}`, eligibleCategories: [LEAGUE] })).status).toBe(200);
    const list = await squadList(teamId);
    expect(list.find((row) => row.playerId === communityPlayer)).toMatchObject({ selected: true, categoryMismatch: true, membershipCategories: [COMMUNITY] });
    expect(list.find((row) => row.playerId === leaguePlayer)).toMatchObject({ selected: false, categoryMismatch: false });
    const rows = await db.select().from(squadMembershipsTable).where(and(eq(squadMembershipsTable.teamId, teamId), eq(squadMembershipsTable.playerId, communityPlayer)));
    expect(rows).toHaveLength(1);
  });

  it("refuses a status or an unknown key as a team category", async () => {
    expect((await save(teamId, { name: `Tournament O50 ${runId}`, eligibleCategories: ["trials"] })).status).toBe(400);
    expect((await save(teamId, { name: `Tournament O50 ${runId}`, eligibleCategories: ["nope"] })).status).toBe(400);
    expect((await db.select().from(teamCategoriesTable).where(eq(teamCategoriesTable.teamId, teamId))).map((row) => row.categoryKey)).toEqual([LEAGUE]);
  });

  it("links one member per role and fills the names shown elsewhere", async () => {
    const response = await save(teamId, { name: `Tournament O50 ${runId}`, coachPlayerId: coach, captainPlayerId: leaguePlayer, assistantManagerPlayerId: coach });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      managerPlayerId: manager, coachPlayerId: coach, captainPlayerId: leaguePlayer, assistantManagerPlayerId: coach,
      coachName: `Team Coach ${runId}`, captainName: `League Only ${runId}`, assistantManagerName: `Team Coach ${runId}`,
    });
    // Swapping the coach replaces the link, it does not add a second one.
    await save(teamId, { name: `Tournament O50 ${runId}`, coachPlayerId: manager });
    const coaches = await db.select().from(teamStaffTable).where(and(eq(teamStaffTable.teamId, teamId), eq(teamStaffTable.role, "coach")));
    expect(coaches.map((row) => row.playerId)).toEqual([manager]);
  });

  it("naming someone does not give them staff access", async () => {
    const { staffTeamGrantsTable } = await import("@workspace/db");
    const grants = await db.select().from(staffTeamGrantsTable).where(eq(staffTeamGrantsTable.teamId, teamId));
    expect(grants).toEqual([]);
  });

  it("follows the member when their name or phone changes", async () => {
    const response = await request(app).put(`/api/players/${manager}`).send({
      teamId: teamIds[0], name: `Renamed Manager ${runId}`, email: `renamed-${runId}@example.com`, phone: "+852 5555 0002",
    });
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(await stored(teamId)).toMatchObject({ managerName: `Renamed Manager ${runId}`, managerEmail: `renamed-${runId}@example.com`, managerPhone: "+852 5555 0002" });
  });

  it("removing a link clears that name; an archived member cannot be picked", async () => {
    const cleared = await save(teamId, { name: `Tournament O50 ${runId}`, captainPlayerId: null });
    expect(cleared.body).toMatchObject({ captainPlayerId: null });
    expect((await stored(teamId)).captainName).toBeNull();
    await db.update(playersTable).set({ memberStatus: "archived" }).where(eq(playersTable.id, awaitingPlayer));
    expect((await save(teamId, { name: `Tournament O50 ${runId}`, captainPlayerId: awaitingPlayer })).status).toBe(400);
    await db.update(playersTable).set({ memberStatus: "active" }).where(eq(playersTable.id, awaitingPlayer));
  });

  it("an older form that still sends a category and typed names keeps working", async () => {
    const response = await create({
      name: `Typed Staff ${runId}`, category: "League Team", managerName: `Team Coach ${runId}`, managerEmail: "typed@example.com",
      managerPhone: "123", coachName: "Somebody Unknown", captainName: `League Only ${runId}`,
    });
    expect(response.status).toBe(201);
    teamIds.push(response.body.id);
    expect(response.body).toMatchObject({ category: "League Team", managerPlayerId: null, coachName: "Somebody Unknown", eligibleCategories: [] });
  });

  it("links typed names that match exactly one member, and leaves the rest as typed", async () => {
    const typedTeam = teamIds[teamIds.length - 1];
    await autoLinkTypedStaffNames();
    await autoLinkTypedStaffNames();
    const links = await db.select().from(teamStaffTable).where(eq(teamStaffTable.teamId, typedTeam));
    expect(Object.fromEntries(links.map((row) => [row.role, row.playerId]))).toEqual({ manager: coach, captain: leaguePlayer });
    // Unmatched text is untouched, and linking never rewrites what was typed.
    expect(await stored(typedTeam)).toMatchObject({ coachName: "Somebody Unknown", managerEmail: "typed@example.com" });
    const listed = ((await request(app).get("/api/teams")).body as any[]).find((team) => team.id === typedTeam);
    expect(listed).toMatchObject({ managerPlayerId: coach, captainPlayerId: leaguePlayer, coachPlayerId: null, coachName: "Somebody Unknown" });
  });

  it("does not link a typed name shared by two members", async () => {
    const twin = await addMember("Team Coach", COMMUNITY); // same name as the coach
    const response = await create({ name: `Ambiguous ${runId}`, coachName: `Team Coach ${runId}` });
    teamIds.push(response.body.id);
    await autoLinkTypedStaffNames();
    expect(await db.select().from(teamStaffTable).where(eq(teamStaffTable.teamId, response.body.id))).toEqual([]);
    expect(twin).toBeGreaterThan(0);
  });
});
