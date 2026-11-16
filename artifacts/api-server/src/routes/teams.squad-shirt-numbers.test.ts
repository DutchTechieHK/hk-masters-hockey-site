import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { db, squadMembershipsTable, shirtAssignmentsTable, shirtAuditTable, shirtContextsTable } from "@workspace/db";
import { playerParticipationsTable, playersTable, teamsTable } from "@workspace/db/schema";

vi.mock("../middleware/adminAuth", () => ({
  hasAdminAccess: vi.fn(async () => true),
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: teamsRouter } = await import("./teams");
const { default: shirtNumbersRouter } = await import("./shirtNumbers");
const { ensureMembershipFoundation } = await import("./players");
const { withLeagueNumbers } = await import("../utils/shirtNumbers");

const app = express();
app.use(express.json());
app.use("/api/teams", teamsRouter);
app.use("/api/shirt-numbers", shirtNumbersRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 500;
  res.status(status).json({ error: error instanceof Error ? error.message : String(error) });
});

const runId = `${process.pid}-${Date.now()}`;
let seasonId: number;
let teamA: number;
let teamB: number;
let memberId: number;
let otherId: number;
let outsiderId: number;

const setNumber = (teamId: number, playerId: number, number: number | null) =>
  request(app).put(`/api/teams/${teamId}/squad/${playerId}/shirt-number`).send({ number });
const squad = (teamId: number, playerId: number, selected: boolean) =>
  request(app).put(`/api/teams/${teamId}/squad/${playerId}`).send({ selected });
async function assignments(playerId: number) {
  return db.select().from(shirtAssignmentsTable).where(eq(shirtAssignmentsTable.playerId, playerId)).orderBy(shirtAssignmentsTable.id);
}
async function numberIn(teamId: number, playerId: number) {
  const [row] = await withLeagueNumbers([{ id: playerId, teamId, shirtNumber: null as number | null }], seasonId);
  return row.shirtNumber;
}

beforeAll(async () => {
  seasonId = (await ensureMembershipFoundation()).currentSeasonId;
  const team = (name: string) => ({
    name: `${name} ${runId}`, category: "League Team", membershipSection: "men",
    managerName: "", managerEmail: "", managerPhone: "",
  });
  const teams = await db.insert(teamsTable).values([team("Numbers A"), team("Numbers B")]).returning({ id: teamsTable.id });
  [teamA, teamB] = teams.map((row) => row.id);
  const member = (label: string) => ({
    teamId: teamA, name: `${label} ${runId}`, email: `${label.toLowerCase()}-${runId}@example.com`,
    memberStatus: "active", currentMembershipSection: "men", currentMembershipTier: "social_player",
  });
  const players = await db.insert(playersTable).values([member("Wearer"), member("Rival"), member("Outsider")]).returning({ id: playersTable.id });
  [memberId, otherId, outsiderId] = players.map((row) => row.id);
  await db.insert(playerParticipationsTable).values(players.map((row) => ({
    playerId: row.id, seasonId, teamId: null, participationStatus: "active", membershipSection: "men",
    membershipTier: "social_player", source: "squad_shirt_test",
  })));
  for (const [teamId, playerId] of [[teamA, memberId], [teamB, memberId], [teamA, otherId]]) {
    expect((await squad(teamId, playerId, true)).status).toBe(200);
  }
});

afterAll(async () => {
  const ids = [memberId, otherId, outsiderId].filter(Boolean);
  if (ids.length) {
    await db.delete(shirtAuditTable).where(inArray(shirtAuditTable.playerId, ids));
    await db.delete(shirtAssignmentsTable).where(inArray(shirtAssignmentsTable.playerId, ids));
    await db.delete(squadMembershipsTable).where(inArray(squadMembershipsTable.playerId, ids));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, ids));
    await db.delete(playersTable).where(inArray(playersTable.id, ids));
  }
  const teamIds = [teamA, teamB].filter(Boolean);
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("shirt numbers set on the squad", () => {
  it("gives one member a different number in each squad", async () => {
    const a = await setNumber(teamA, memberId, 7);
    expect(a.status).toBe(200);
    expect(a.body.candidate).toMatchObject({ playerId: memberId, shirtNumber: 7, selected: true });
    expect(a.body.warnings).toEqual([]);
    expect((await setNumber(teamB, memberId, 12)).status).toBe(200);
    expect(await numberIn(teamA, memberId)).toBe(7);
    expect(await numberIn(teamB, memberId)).toBe(12);
  });

  it("shows the number in the squad list", async () => {
    const list = await request(app).get(`/api/teams/${teamA}/squad`);
    expect(list.body).toContainEqual(expect.objectContaining({ playerId: memberId, shirtNumber: 7, selected: true }));
  });

  it("changing a number keeps the old one in the history and writes an audit entry", async () => {
    expect((await setNumber(teamA, memberId, 9)).status).toBe(200);
    const rows = (await assignments(memberId)).filter((row) => row.teamId === teamA);
    expect(rows.map((row) => [row.number, row.status])).toEqual([[7, "historical"], [9, "current"]]);
    const audit = await db.select().from(shirtAuditTable).where(eq(shirtAuditTable.playerId, memberId));
    expect(audit.some((entry) => entry.action === "change" && entry.detail.includes("#9"))).toBe(true);
  });

  it("saving the same number again changes nothing", async () => {
    const before = (await assignments(memberId)).length;
    expect((await setNumber(teamA, memberId, 9)).status).toBe(200);
    expect((await assignments(memberId)).length).toBe(before);
  });

  it("warns about a duplicate number in the same squad but still saves it", async () => {
    const response = await setNumber(teamA, otherId, 9);
    expect(response.status).toBe(200);
    expect(response.body.warnings.join(" ")).toContain("#9");
    // The same number in a different squad is not a duplicate.
    expect((await setNumber(teamB, memberId, 9)).body.warnings).toEqual([]);
  });

  it("rejects numbers outside 1 to 99", async () => {
    for (const number of [0, 100, 1.5]) expect((await setNumber(teamA, memberId, number)).status).toBe(400);
  });

  it("refuses a number for someone who is not in the squad, on the squad list and in the member profile", async () => {
    expect((await setNumber(teamA, outsiderId, 3)).status).toBe(409);

    const [context] = await db.select().from(shirtContextsTable)
      .where(and(eq(shirtContextsTable.seasonId, seasonId), eq(shirtContextsTable.kind, "league")));
    const [outsider] = await db.select({ revision: playersTable.shirtNumberRevision }).from(playersTable).where(eq(playersTable.id, outsiderId));
    const viaProfile = await request(app).post(`/api/shirt-numbers/players/${outsiderId}`)
      .send({ revision: outsider.revision, action: "assign", contextId: context.id, teamId: teamA, number: 3 });
    expect(viaProfile.status).toBe(409);
    expect(await assignments(outsiderId)).toEqual([]);
  });

  it("clearing a number closes it and keeps it in the history", async () => {
    expect((await setNumber(teamB, memberId, null)).status).toBe(200);
    expect(await numberIn(teamB, memberId)).toBeNull();
    const rows = (await assignments(memberId)).filter((row) => row.teamId === teamB);
    expect(rows.every((row) => row.status === "historical")).toBe(true);
  });

  it("leaving a squad closes that squad's number only", async () => {
    expect((await setNumber(teamB, memberId, 12)).status).toBe(200);
    expect((await squad(teamA, memberId, false)).status).toBe(200);

    expect(await numberIn(teamA, memberId)).toBeNull();
    expect(await numberIn(teamB, memberId)).toBe(12);
    const closed = (await assignments(memberId)).filter((row) => row.teamId === teamA);
    expect(closed.length).toBeGreaterThan(0);
    expect(closed.every((row) => row.status === "historical" && row.endsOn != null)).toBe(true);
    const audit = await db.select().from(shirtAuditTable).where(eq(shirtAuditTable.playerId, memberId));
    expect(audit.some((entry) => entry.action === "end" && entry.reason === "Removed from the squad")).toBe(true);
  });

  it("coming back to the squad starts without a number", async () => {
    expect((await squad(teamA, memberId, true)).status).toBe(200);
    expect(await numberIn(teamA, memberId)).toBeNull();
  });
});
