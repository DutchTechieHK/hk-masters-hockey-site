import { afterAll, beforeAll, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db,
  eventRsvpsTable,
  eventsTable,
  matchRsvpsTable,
  matchesTable,
  playerParticipationsTable,
  playerPaymentsTable,
  playersTable,
  seasonsTable,
  teamsTable,
} from "@workspace/db";
import reportsRouter from "./reports";

const app = express();
app.use("/api", reportsRouter);
app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: error instanceof Error ? error.message : String(error) });
});

const tag = `reports-current-${process.pid}-${Date.now()}`;
const playerIds: number[] = [];
const teamIds: number[] = [];
const eventIds: number[] = [];
const matchIds: number[] = [];
let currentSeasonId: number;
let rotterdamSeasonId: number;
let originalAdminKey: string | undefined;
let memberId: number;
let inactiveId: number;
let fallbackId: number;
let zeroDueId: number;
let noDuePaidId: number;
let eventId: number;
let matchId: number;

beforeAll(async () => {
  originalAdminKey = process.env.ADMIN_API_KEY;
  process.env.ADMIN_API_KEY = `${tag}-admin-key`;
  const [currentSeason] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "membership-2026-27"));
  const [rotterdamSeason] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "rotterdam-2026"));
  if (!currentSeason || !rotterdamSeason) throw new Error("Required report seasons were not found");
  currentSeasonId = currentSeason.id;
  rotterdamSeasonId = rotterdamSeason.id;

  for (const suffix of ["squad", "legacy"]) {
    const [team] = await db.insert(teamsTable).values({
      name: `${tag}-${suffix}`,
      category: "MO50",
      managerName: "Report Test",
      managerEmail: `${tag}-${suffix}@example.com`,
      managerPhone: "000",
    }).returning({ id: teamsTable.id });
    teamIds.push(team.id);
  }

  const createPlayer = async (name: string, teamId: number, memberStatus: string) => {
    const [player] = await db.insert(playersTable).values({
      teamId,
      name: `${tag}-${name}`,
      email: `${tag}-${name}@example.com`,
      memberStatus,
      currentMembershipSection: "men",
      currentMembershipTier: "social_player",
      passportNumber: "should-not-be-returned",
      notes: "should-not-be-returned",
    }).returning({ id: playersTable.id });
    playerIds.push(player.id);
    return player.id;
  };

  memberId = await createPlayer("member", teamIds[1], "active");
  inactiveId = await createPlayer("inactive", teamIds[1], "inactive");
  fallbackId = await createPlayer("legacy-fallback", teamIds[0], "active");
  zeroDueId = await createPlayer("zero-due", teamIds[1], "active");
  noDuePaidId = await createPlayer("no-due-paid", teamIds[1], "active");
  await db.insert(playerParticipationsTable).values([
    {
      playerId: memberId,
      seasonId: currentSeasonId,
      teamId: teamIds[0],
      participationStatus: "active",
      membershipSection: "women",
      membershipTier: "full_player",
      amountDue: "100.00",
      source: "reports_current_test",
    },
    {
      playerId: inactiveId,
      seasonId: currentSeasonId,
      teamId: teamIds[0],
      participationStatus: "active",
      membershipSection: "men",
      membershipTier: "social_player",
      amountDue: "50.00",
      source: "reports_current_test",
    },
    {
      playerId: zeroDueId,
      seasonId: currentSeasonId,
      teamId: teamIds[0],
      participationStatus: "active",
      membershipSection: "men",
      membershipTier: "social_player",
      amountDue: "0.00",
      source: "reports_current_test",
    },
    {
      playerId: noDuePaidId,
      seasonId: currentSeasonId,
      teamId: teamIds[0],
      participationStatus: "active",
      membershipSection: "men",
      membershipTier: "awaiting_selection",
      amountDue: null,
      source: "reports_current_test",
    },
    {
      playerId: memberId,
      seasonId: rotterdamSeasonId,
      teamId: teamIds[1],
      participationStatus: "active",
      membershipSection: "men",
      membershipTier: "full_player",
      amountDue: "999.00",
      source: "reports_current_test",
    },
  ]);

  await db.insert(playerPaymentsTable).values([
    { playerId: memberId, seasonId: currentSeasonId, amount: "80.00", paymentDate: "2026-08-01", method: "bank" },
    { playerId: memberId, seasonId: currentSeasonId, amount: "25.00", paymentDate: "2026-08-15", method: "" },
    { playerId: memberId, seasonId: rotterdamSeasonId, amount: "999.00", paymentDate: "2026-01-01", method: "cash" },
    { playerId: noDuePaidId, seasonId: currentSeasonId, amount: "10.00", paymentDate: "2026-08-10", method: "cash" },
  ]);

  const [training] = await db.insert(eventsTable).values({
    kind: "training",
    title: `${tag}-training`,
    startsAt: new Date("2026-09-01T10:00:00.000Z"),
    teamId: teamIds[0],
    operationalScope: "local_2026_27",
  }).returning({ id: eventsTable.id });
  eventId = training.id;
  eventIds.push(training.id);
  await db.insert(eventRsvpsTable).values([
    { eventId, playerId: memberId, status: "yes" },
    { eventId, playerId: inactiveId, status: "maybe" },
  ]);

  const [match] = await db.insert(matchesTable).values({
    teamId: teamIds[0],
    opponent: `${tag}-opponent`,
    kickoffAt: new Date("2026-09-02T11:00:00.000Z"),
    status: "cancelled",
    operationalScope: "local_2026_27",
  }).returning({ id: matchesTable.id });
  matchId = match.id;
  matchIds.push(match.id);
  await db.insert(matchRsvpsTable).values([
    { matchId, playerId: memberId, status: "no" },
    { matchId, playerId: inactiveId, status: "yes" },
  ]);

  const [archivedMatch] = await db.insert(matchesTable).values({
    teamId: teamIds[0],
    opponent: `${tag}-archived`,
    kickoffAt: new Date("2026-09-03T11:00:00.000Z"),
    status: "scheduled",
    operationalScope: "world_cup_2026",
  }).returning({ id: matchesTable.id });
  matchIds.push(archivedMatch.id);
});

afterAll(async () => {
  if (eventIds.length) {
    await db.delete(eventRsvpsTable).where(inArray(eventRsvpsTable.eventId, eventIds));
    await db.delete(eventsTable).where(inArray(eventsTable.id, eventIds));
  }
  if (matchIds.length) {
    await db.delete(matchRsvpsTable).where(inArray(matchRsvpsTable.matchId, matchIds));
    await db.delete(matchesTable).where(inArray(matchesTable.id, matchIds));
  }
  if (playerIds.length) {
    await db.delete(playerPaymentsTable).where(inArray(playerPaymentsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
  if (originalAdminKey == null) delete process.env.ADMIN_API_KEY;
  else process.env.ADMIN_API_KEY = originalAdminKey;
});

describe("GET /api/reports/current", () => {
  it("requires admin authorization", async () => {
    expect((await request(app).get("/api/reports/current")).status).toBe(401);
    expect((await request(app).get("/api/reports/current").set("x-admin-key", `${tag}-admin-key`)).status).toBe(200);
  });

  it("returns current-season member fees, local sessions, and limited fields", async () => {
    const response = await request(app).get("/api/reports/current").set("x-admin-key", `${tag}-admin-key`);
    expect(response.status).toBe(200);
    expect(response.body.season).toBe("2026/27");

    const member = response.body.members.find((row: { id: number }) => row.id === memberId);
    expect(member).toEqual({
      id: memberId,
      name: `${tag}-member`,
      email: `${tag}-member@example.com`,
      memberStatus: "active",
      section: "women",
      tier: "full_player",
      teamId: teamIds[0],
      teamName: `${tag}-squad`,
      due: 100,
      paid: 105,
      feePaid: true,
      lastPaymentDate: "2026-08-15",
    });
    expect(response.body.members.some((row: { id: number }) => row.id === fallbackId)).toBe(false);
    expect(response.body.members.some((row: { id: number }) => row.id === inactiveId)).toBe(true);

    const memberPayments = response.body.payments.filter((row: { playerId: number }) => row.playerId === memberId);
    expect(memberPayments.map((row: { method: string; amount: number }) => [row.method, row.amount]))
      .toEqual([["", 25], ["bank", 80]]);

    expect(response.body.members.find((row: { id: number }) => row.id === zeroDueId)).toMatchObject({
      due: 0,
      paid: 0,
      feePaid: false,
    });
    expect(response.body.members.find((row: { id: number }) => row.id === noDuePaidId)).toMatchObject({
      due: null,
      paid: 10,
      feePaid: true,
    });

    const training = response.body.training.find((row: { id: number }) => row.id === eventId);
    expect(training).toMatchObject({
      date: "2026-09-01T10:00:00.000Z",
      counts: { yes: 1, maybe: 1, no: 0, noResponse: 3, invited: 5 },
    });
    expect(training.responses).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: memberId, status: "yes" }),
      expect.objectContaining({ playerId: inactiveId, status: "maybe" }),
      expect.objectContaining({ playerId: fallbackId, status: "none", respondedAt: null }),
      expect.objectContaining({ playerId: zeroDueId, status: "none", respondedAt: null }),
      expect.objectContaining({ playerId: noDuePaidId, status: "none", respondedAt: null }),
    ]));

    const match = response.body.matches.find((row: { id: number }) => row.id === matchId);
    expect(match).toMatchObject({
      title: `${tag}-opponent (Cancelled)`,
      date: "2026-09-02T11:00:00.000Z",
      counts: { yes: 0, maybe: 0, no: 1, noResponse: 2, invited: 3 },
    });
    expect(match.responses).toEqual(expect.arrayContaining([
      expect.objectContaining({ playerId: memberId, status: "no" }),
    ]));
    expect(match.responses.some((row: { playerId: number }) => row.playerId === inactiveId)).toBe(false);
    expect(response.body.matches.some((row: { id: number }) => matchIds.includes(row.id) && row.id !== matchId))
      .toBe(false);

    expect(JSON.stringify(response.body)).not.toContain("should-not-be-returned");
    for (const row of response.body.members) {
      expect(Object.keys(row).sort()).toEqual([
        "due", "email", "feePaid", "id", "lastPaymentDate", "memberStatus",
        "name", "paid", "section", "teamId", "teamName", "tier",
      ].sort());
    }
  });
});