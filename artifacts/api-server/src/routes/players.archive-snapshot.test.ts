import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { playersTable, teamsTable, seasonsTable, playerParticipationsTable, worldCupPlayerSnapshotsTable } from "@workspace/db/schema";
import { and, eq, ne } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({ requireAdminAccess: (_req: any, _res: any, next: any) => next() }));
const { default: playersRouter } = await import("./players");
const app = express();
app.use(express.json());
app.use("/api/players", playersRouter);

let playerId = 0;
let original: typeof playersTable.$inferSelect;
let archiveTeamId: number | null = null;

describe("World Cup player archive snapshots", () => {
  beforeAll(async () => {
    const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable).where(eq(seasonsTable.slug, "rotterdam-2026"));
    if (!season) return;
    const [row] = await db.select({ player: playersTable }).from(playerParticipationsTable)
      .innerJoin(playersTable, eq(playerParticipationsTable.playerId, playersTable.id))
      .where(and(eq(playerParticipationsTable.seasonId, season.id), eq(playerParticipationsTable.participationStatus, "active")))
      .limit(1);
    if (!row) return;
    playerId = row.player.id;
    original = row.player;
    const [participation] = await db.select({ teamId: playerParticipationsTable.teamId }).from(playerParticipationsTable)
      .where(and(eq(playerParticipationsTable.playerId, playerId), eq(playerParticipationsTable.seasonId, season.id)));
    archiveTeamId = participation?.teamId ?? null;
    await db.insert(worldCupPlayerSnapshotsTable).values({
      playerId,
      snapshot: row.player,
    }).onConflictDoNothing();
  });

  afterAll(async () => {
    if (!playerId) return;
    await db.update(playersTable).set({
      flightArrivalDateTime: original.flightArrivalDateTime,
      passportNumber: original.passportNumber,
      teamId: original.teamId,
    }).where(eq(playersTable.id, playerId));
    await db.delete(worldCupPlayerSnapshotsTable).where(eq(worldCupPlayerSnapshotsTable.playerId, playerId));
  });

  it("keeps archive response stable while current response reflects live edits", async () => {
    if (!playerId) return;
    const before = await request(app).get("/api/players?scope=world_cup_2026");
    const archivedBefore = before.body.find((p: { id: number }) => p.id === playerId);
    expect(archivedBefore.flightArrivalDateTime).toBe(original.flightArrivalDateTime);
    expect(archivedBefore.passportNumber).toBe(original.passportNumber);

    await db.update(playersTable).set({
      flightArrivalDateTime: "2099-01-01T00:00:00Z",
      passportNumber: "LIVE-CHANGED",
      teamId: (await db.select({ id: teamsTable.id }).from(teamsTable).where(ne(teamsTable.id, original.teamId)).limit(1))[0]?.id ?? original.teamId,
    }).where(eq(playersTable.id, playerId));

    const after = await request(app).get("/api/players?scope=world_cup_2026");
    const archivedAfter = after.body.find((p: { id: number }) => p.id === playerId);
    expect(archivedAfter.flightArrivalDateTime).toBe(original.flightArrivalDateTime);
    expect(archivedAfter.passportNumber).toBe(original.passportNumber);
    expect(archivedAfter.teamId).toBe(archiveTeamId);
    const current = await request(app).get("/api/players");
    const currentPlayer = current.body.find((p: { id: number }) => p.id === playerId);
    expect(currentPlayer.flightArrivalDateTime).toBe("2099-01-01T00:00:00Z");
    expect(currentPlayer.passportNumber).toBe("LIVE-CHANGED");
  });
});