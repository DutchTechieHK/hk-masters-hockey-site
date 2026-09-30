import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const { default: playersRouter } = await import("./players");
const app = express();
app.use(express.json());
app.use("/api/players", playersRouter);

let playerId: number;
const firstCopy = "https://res.cloudinary.com/djyvdrhal/image/upload/test-first.jpg";
const newerCopy = "https://res.cloudinary.com/djyvdrhal/image/upload/test-newer.jpg";

describe("admin passport copy updates", () => {
  beforeAll(async () => {
    const [team] = await db.select({ id: teamsTable.id }).from(teamsTable)
      .where(eq(teamsTable.name, "Awaiting Selection")).limit(1);
    if (!team) throw new Error("Awaiting Selection team is required for this test");
    const [player] = await db.insert(playersTable).values({
      name: "Passport Copy Test Member",
      email: "passport-copy-test@example.invalid",
      teamId: team.id,
    }).returning({ id: playersTable.id });
    playerId = player.id;
  });

  afterAll(async () => {
    if (playerId) await db.delete(playersTable).where(eq(playersTable.id, playerId));
  });

  it("updates only passport fields and rejects a stale review or archived member", async () => {
    const upload = await request(app).patch(`/api/players/${playerId}/passport-copy`).send({
      expectedCopyUrl: null, expectedReviewed: false, copyUrl: firstCopy, reviewed: true,
    });
    expect(upload.status).toBe(204);

    await db.update(playersTable).set({ name: "Changed by another admin" }).where(eq(playersTable.id, playerId));
    const unreview = await request(app).patch(`/api/players/${playerId}/passport-copy`).send({
      expectedCopyUrl: firstCopy, expectedReviewed: true, reviewed: false,
    });
    expect(unreview.status).toBe(204);

    // A player upload replaces the copy while an admin still has the old row open.
    await db.update(playersTable).set({ passportCopyUrl: newerCopy }).where(eq(playersTable.id, playerId));
    const staleReview = await request(app).patch(`/api/players/${playerId}/passport-copy`).send({
      expectedCopyUrl: firstCopy, expectedReviewed: false, reviewed: true,
    });
    expect(staleReview.status).toBe(409);
    const [unchanged] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
    expect(unchanged.passportCopyUrl).toBe(newerCopy);
    expect(unchanged.passportCopyReviewed).toBe(false);
    expect(unchanged.name).toBe("Changed by another admin");

    await db.update(playersTable).set({ memberStatus: "archived" }).where(eq(playersTable.id, playerId));
    const archived = await request(app).patch(`/api/players/${playerId}/passport-copy`).send({
      expectedCopyUrl: newerCopy, expectedReviewed: false, reviewed: true,
    });
    expect(archived.status).toBe(409);
  });
});