/**
 * Winner-announcement gating tests for the LEGO Jar public API.
 *
 * Contest integrity requires two guarantees:
 * 1. The actual count is never disclosed publicly before the winner is
 *    announced (otherwise a guaranteed-winning guess could be submitted).
 * 2. Public guess submission is rejected once the winner is announced or the
 *    challenge is completed.
 *
 * Hits the real routes (real DB); the lego_jar_config row is snapshotted and
 * restored afterwards.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { legoJarConfigTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const { legoJarPublicRouter } = await import("./lego-jar");

const app = express();
app.use(express.json());
app.use("/api/lego-jar", legoJarPublicRouter);

let original: typeof legoJarConfigTable.$inferSelect | undefined;

async function setConfig(values: Partial<typeof legoJarConfigTable.$inferInsert>) {
  if (original) {
    await db.update(legoJarConfigTable).set(values).where(eq(legoJarConfigTable.id, original.id));
  } else {
    const rows = await db.select().from(legoJarConfigTable).limit(1);
    if (rows[0]) {
      await db.update(legoJarConfigTable).set(values).where(eq(legoJarConfigTable.id, rows[0].id));
    } else {
      await db.insert(legoJarConfigTable).values({ pricePerGuess: "50", status: "active", ...values } as any);
    }
  }
}

beforeAll(async () => {
  const rows = await db.select().from(legoJarConfigTable).limit(1);
  original = rows[0];
});

afterAll(async () => {
  if (!original) {
    await db.delete(legoJarConfigTable);
    return;
  }
  await db
    .update(legoJarConfigTable)
    .set({
      actualCount: original.actualCount,
      status: original.status,
      winnerAnnounced: original.winnerAnnounced,
      winnerName: original.winnerName,
      winnerGuess: original.winnerGuess,
      winnerMessage: original.winnerMessage,
    })
    .where(eq(legoJarConfigTable.id, original.id));
});

const guessPayload = {
  guesserName: "Test Guesser",
  guesserEmail: "test@example.com",
  guesserPhone: "+852 1234 5678",
  guessNumbers: [1234],
  paymentMethod: "cash",
};

describe("LEGO Jar winner announcement gating", () => {
  it("hides actualCount from public stats before the winner is announced", async () => {
    await setConfig({ actualCount: 1847, winnerAnnounced: false, status: "active" });
    const res = await request(app).get("/api/lego-jar/stats");
    expect(res.status).toBe(200);
    expect(res.body.config.actualCount).toBeNull();
    expect(res.body.winner).toBeNull();
  });

  it("exposes actualCount and winner details once announced", async () => {
    await setConfig({
      actualCount: 1847,
      winnerAnnounced: true,
      winnerName: "Jane Chan",
      winnerGuess: 1850,
      status: "active",
    });
    const res = await request(app).get("/api/lego-jar/stats");
    expect(res.status).toBe(200);
    expect(res.body.config.actualCount).toBe(1847);
    expect(res.body.winner).toMatchObject({ name: "Jane Chan", guess: 1850, actualCount: 1847 });
  });

  it("rejects public guess submissions once the winner is announced", async () => {
    await setConfig({ winnerAnnounced: true, status: "active" });
    const res = await request(app).post("/api/lego-jar/guesses").send(guessPayload);
    expect(res.status).toBe(409);
  });

  it("rejects public guess submissions when the challenge is completed", async () => {
    await setConfig({ winnerAnnounced: false, status: "completed" });
    const res = await request(app).post("/api/lego-jar/guesses").send(guessPayload);
    expect(res.status).toBe(409);
  });
});
