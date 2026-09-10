import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  playerParticipationsTable,
  playersTable,
  seasonsTable,
  teamsTable,
} from "@workspace/db/schema";

vi.mock("../middleware/adminAuth", () => ({
  hasAdminAccess: vi.fn(async () => true),
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: teamsRouter } = await import("./teams");
const { clearLegacyCopiedCurrentTeamLinks } = await import("./players");

const app = express();
app.use(express.json());
app.use("/api/teams", teamsRouter);

const runId = `${process.pid}-${Date.now()}`;
let playerId: number;
let squadTeamId: number;
let legacyTeamId: number;
let currentSeasonId: number;
let rotterdamSeasonId: number;

beforeAll(async () => {
  const [squadTeams, legacyTeams, currentSeasons, rotterdamSeasons] = await Promise.all([
    db.select().from(teamsTable).where(eq(teamsTable.name, "Masters Div. 1")),
    db.select().from(teamsTable).where(eq(teamsTable.name, "Awaiting Selection")),
    db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27")),
    db.select().from(seasonsTable).where(eq(seasonsTable.slug, "rotterdam-2026")),
  ]);
  if (squadTeams.length !== 1) throw new Error("Exactly one Masters Div. 1 team is required");
  if (legacyTeams.length !== 1) throw new Error("Exactly one legacy team is required");
  if (currentSeasons.length !== 1 || rotterdamSeasons.length !== 1) {
    throw new Error("Current and Rotterdam seasons are required");
  }

  squadTeamId = squadTeams[0].id;
  legacyTeamId = legacyTeams[0].id;
  currentSeasonId = currentSeasons[0].id;
  rotterdamSeasonId = rotterdamSeasons[0].id;

  const [player] = await db.insert(playersTable).values({
    teamId: legacyTeamId,
    name: `Squad Selection Member ${runId}`,
    email: `squad-selection-${runId}@example.com`,
    memberStatus: "active",
    currentMembershipTier: "social_player",
    paymentAmountDue: "975.00",
    paymentAmountPaid: "125.00",
    feePaid: false,
  }).returning({ id: playersTable.id });
  playerId = player.id;

  await db.insert(playerParticipationsTable).values([
    {
      playerId,
      seasonId: currentSeasonId,
      teamId: null,
      participationStatus: "active",
      membershipTier: "social_player",
      amountDue: "300.00",
      source: "squad_selection_test",
    },
    {
      playerId,
      seasonId: rotterdamSeasonId,
      teamId: legacyTeamId,
      participationStatus: "archived",
      membershipTier: null,
      amountDue: "975.00",
      source: "squad_selection_test",
      legacySnapshot: { teamId: legacyTeamId, marker: runId },
    },
  ]);
});

afterAll(async () => {
  if (!playerId) return;
  await db.delete(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, playerId));
  await db.delete(playersTable).where(eq(playersTable.id, playerId));
});

describe("Masters Div. 1 current squad selection", () => {
  it("lists only current active members as candidates", async () => {
    const response = await request(app).get(`/api/teams/${squadTeamId}/squad`);
    expect(response.status).toBe(200);
    expect(response.body).toContainEqual(expect.objectContaining({
      playerId,
      selected: false,
      membershipTier: "social_player",
    }));
  });

  it("adds and removes a member without changing membership, fees, or Rotterdam history", async () => {
    const beforePlayer = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    const beforeRotterdam = await db.select().from(playerParticipationsTable).where(and(
      eq(playerParticipationsTable.playerId, playerId),
      eq(playerParticipationsTable.seasonId, rotterdamSeasonId),
    ));

    const added = await request(app)
      .put(`/api/teams/${squadTeamId}/squad/${playerId}`)
      .send({ selected: true });
    expect(added.status).toBe(200);
    expect(added.body.selected).toBe(true);

    const addedAgain = await request(app)
      .put(`/api/teams/${squadTeamId}/squad/${playerId}`)
      .send({ selected: true });
    expect(addedAgain.status).toBe(200);

    await clearLegacyCopiedCurrentTeamLinks(db, currentSeasonId, playerId);
    const current = await db.select().from(playerParticipationsTable).where(and(
      eq(playerParticipationsTable.playerId, playerId),
      eq(playerParticipationsTable.seasonId, currentSeasonId),
    ));
    expect(current[0]).toMatchObject({
      teamId: squadTeamId,
      membershipTier: "social_player",
      amountDue: "300.00",
      participationStatus: "active",
    });

    const afterPlayer = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    expect(afterPlayer[0]).toMatchObject({
      teamId: beforePlayer[0].teamId,
      currentMembershipTier: beforePlayer[0].currentMembershipTier,
      paymentAmountDue: beforePlayer[0].paymentAmountDue,
      paymentAmountPaid: beforePlayer[0].paymentAmountPaid,
      feePaid: beforePlayer[0].feePaid,
    });
    const afterRotterdam = await db.select().from(playerParticipationsTable).where(and(
      eq(playerParticipationsTable.playerId, playerId),
      eq(playerParticipationsTable.seasonId, rotterdamSeasonId),
    ));
    expect(afterRotterdam[0]).toEqual(beforeRotterdam[0]);

    const removed = await request(app)
      .put(`/api/teams/${squadTeamId}/squad/${playerId}`)
      .send({ selected: false });
    expect(removed.status).toBe(200);
    expect(removed.body.selected).toBe(false);

    const removedAgain = await request(app)
      .put(`/api/teams/${squadTeamId}/squad/${playerId}`)
      .send({ selected: false });
    expect(removedAgain.status).toBe(200);
  });

  it("rejects selection after the member becomes inactive", async () => {
    await db.update(playersTable).set({ memberStatus: "inactive" }).where(eq(playersTable.id, playerId));
    const response = await request(app)
      .put(`/api/teams/${squadTeamId}/squad/${playerId}`)
      .send({ selected: true });
    expect(response.status).toBe(409);

    const candidates = await request(app).get(`/api/teams/${squadTeamId}/squad`);
    expect(candidates.body).not.toContainEqual(expect.objectContaining({ playerId }));
    await db.update(playersTable).set({ memberStatus: "active" }).where(eq(playersTable.id, playerId));
  });

  it("prevents the canonical squad from being renamed, deleted, or duplicated", async () => {
    const [squad] = await db.select().from(teamsTable).where(eq(teamsTable.id, squadTeamId));
    const rename = await request(app)
      .put(`/api/teams/${squadTeamId}`)
      .send({
        name: "Renamed League Squad",
        category: squad.category,
        managerName: squad.managerName,
        managerEmail: squad.managerEmail,
        managerPhone: squad.managerPhone,
      });
    expect(rename.status).toBe(409);

    const deletion = await request(app).delete(`/api/teams/${squadTeamId}`);
    expect(deletion.status).toBe(409);

    const duplicate = await request(app)
      .post("/api/teams")
      .send({
        name: "Masters Div. 1",
        category: "Men's Squad",
        managerName: "",
        managerEmail: "",
        managerPhone: "",
      });
    expect(duplicate.status).toBe(409);

    const [unchanged] = await db.select().from(teamsTable).where(eq(teamsTable.id, squadTeamId));
    expect(unchanged.name).toBe("Masters Div. 1");
  });
});