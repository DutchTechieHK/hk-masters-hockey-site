import crypto from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  playerLoginCodesTable,
  playerParticipationsTable,
  playerSessionsTable,
  playersTable,
  teamsTable,
} from "@workspace/db/schema";

const emailLoginCode = vi.hoisted(() => vi.fn());

vi.mock("../utils/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/email")>()),
  sendPlayerLoginCodeEmail: emailLoginCode,
}));

const [{ default: playerAuthRouter }, { default: playersRouter }] = await Promise.all([
  import("./playerAuth"),
  import("./players"),
]);

const app = express();
app.use(express.json());
app.use("/api/player-auth", playerAuthRouter);
app.use("/api/players", playersRouter);

const runId = `${process.pid}-${Date.now()}`;
const activeEmail = `Identity.Active.${runId}@example.com`;
const duplicateEmail = `identity-duplicate-${runId}@example.com`;
const inactiveEmail = `identity-inactive-${runId}@example.com`;
const archivedEmail = `identity-archived-${runId}@example.com`;
const normalizedActiveEmail = activeEmail.trim().toLowerCase();
const duplicateNormalizedEmail = duplicateEmail.toLowerCase();
const testEmails = [
  normalizedActiveEmail,
  duplicateNormalizedEmail,
  inactiveEmail,
  archivedEmail,
];

let activePlayerId: number;
let activeAccessToken: string;
let duplicatePlayerIds: number[];
let inactivePlayerId: number;
let archivedPlayerId: number;
let inactiveAccessToken: string;
let archivedAccessToken: string;

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

async function sessionsFor(playerIds: number[]) {
  return db
    .select()
    .from(playerSessionsTable)
    .where(inArray(playerSessionsTable.playerId, playerIds));
}

beforeAll(async () => {
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).limit(1);
  if (!team) throw new Error("A team is required for player identity-safety tests");

  inactiveAccessToken = crypto.randomUUID();
  archivedAccessToken = crypto.randomUUID();
  activeAccessToken = crypto.randomUUID();
  const inserted = await db.insert(playersTable).values([
    {
      teamId: team.id,
      name: "Identity Active",
      email: `  ${activeEmail}  `,
      memberStatus: "active",
      currentMembershipTier: "social_player",
      accessToken: activeAccessToken,
    },
    {
      teamId: team.id,
      name: "Identity Duplicate One",
      email: duplicateEmail.toUpperCase(),
      memberStatus: "active",
      accessToken: crypto.randomUUID(),
    },
    {
      teamId: team.id,
      name: "Identity Duplicate Two",
      email: ` ${duplicateEmail.toLowerCase()} `,
      memberStatus: "active",
      accessToken: crypto.randomUUID(),
    },
    {
      teamId: team.id,
      name: "Identity Inactive",
      email: inactiveEmail,
      memberStatus: "inactive",
      accessToken: inactiveAccessToken,
    },
    {
      teamId: team.id,
      name: "Identity Archived",
      email: archivedEmail,
      memberStatus: "archived",
      accessToken: archivedAccessToken,
    },
  ]).returning({ id: playersTable.id, memberStatus: playersTable.memberStatus });

  activePlayerId = inserted[0].id;
  duplicatePlayerIds = [inserted[1].id, inserted[2].id];
  inactivePlayerId = inserted[3].id;
  archivedPlayerId = inserted[4].id;
});

afterAll(async () => {
  const playerIds = [activePlayerId, ...duplicatePlayerIds, inactivePlayerId, archivedPlayerId]
    .filter(Number.isFinite);
  await db.delete(playerLoginCodesTable).where(inArray(playerLoginCodesTable.email, testEmails));
  if (playerIds.length) {
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
});

describe("player login identity safety", () => {
  it("returns the current category fee in the member portal response", async () => {
    const response = await request(app).get(`/api/players/self/${activeAccessToken}`);
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      currentMembershipTier: "social_player",
      paymentAmountDue: 300,
      paymentAmountPaid: 0,
      paymentBalance: 300,
      feePaid: false,
    });
  });

  it("does not issue or email a code when a normalized email matches multiple active members", async () => {
    emailLoginCode.mockClear();

    const response = await request(app)
      .post("/api/player-auth/request-code")
      .send({ email: `  ${duplicateEmail.toUpperCase()}  ` });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ ok: true });
    expect(emailLoginCode).not.toHaveBeenCalled();
    const codes = await db.select().from(playerLoginCodesTable)
      .where(eq(playerLoginCodesTable.email, duplicateNormalizedEmail));
    expect(codes).toHaveLength(0);
  });

  it("does not redeem a valid code into an arbitrary duplicate member session", async () => {
    const code = "482913";
    await db.insert(playerLoginCodesTable).values({
      email: duplicateNormalizedEmail,
      codeHash: hashCode(code),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await request(app)
      .post("/api/player-auth/verify-code")
      .send({ email: duplicateEmail.toUpperCase(), code });

    expect(response.status).toBe(401);
    expect(response.body.error).toMatch(/one active member/i);
    expect(await sessionsFor(duplicatePlayerIds)).toHaveLength(0);
  });

  it("normalizes whitespace and case while active members sign in normally", async () => {
    emailLoginCode.mockClear();
    const requestResponse = await request(app)
      .post("/api/player-auth/request-code")
      .send({ email: ` ${activeEmail.toUpperCase()} ` });

    expect(requestResponse.status).toBe(200);
    expect(emailLoginCode).toHaveBeenCalledTimes(1);
    const sent = emailLoginCode.mock.calls[0][0] as { code: string; playerEmail: string };
    expect(sent.playerEmail).toBe(`  ${activeEmail}  `);

    const verifyResponse = await request(app)
      .post("/api/player-auth/verify-code")
      .send({ email: normalizedActiveEmail, code: sent.code });

    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.player.id).toBe(activePlayerId);
    expect(verifyResponse.body.sessionToken).toMatch(/^[a-f0-9]{64}$/);

    const meResponse = await request(app)
      .get("/api/player-auth/me")
      .set("x-player-session", verifyResponse.body.sessionToken);
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.id).toBe(activePlayerId);
  });

  it.each([
    ["inactive", () => inactiveEmail],
    ["archived", () => archivedEmail],
  ])("%s members cannot request a login code", async (_status, getEmail) => {
    emailLoginCode.mockClear();

    const response = await request(app)
      .post("/api/player-auth/request-code")
      .send({ email: getEmail() });

    expect(response.status).toBe(200);
    expect(emailLoginCode).not.toHaveBeenCalled();
    const codes = await db.select().from(playerLoginCodesTable)
      .where(eq(playerLoginCodesTable.email, getEmail()));
    expect(codes).toHaveLength(0);
  });

  it.each([
    ["inactive", () => inactivePlayerId],
    ["archived", () => archivedPlayerId],
  ])("%s members cannot continue an existing portal session", async (_status, getPlayerId) => {
    const token = crypto.randomBytes(32).toString("hex");
    await db.insert(playerSessionsTable).values({
      token,
      playerId: getPlayerId(),
      expiresAt: new Date(Date.now() + 60_000),
    });

    const response = await request(app)
      .get("/api/player-auth/me")
      .set("authorization", `Bearer ${token}`);

    expect(response.status).toBe(403);
    expect(response.body.error).toMatch(/not active/i);
    const remaining = await db.select().from(playerSessionsTable)
      .where(and(
        eq(playerSessionsTable.token, token),
        eq(playerSessionsTable.playerId, getPlayerId()),
      ));
    expect(remaining).toHaveLength(0);
  });

  it.each([
    ["inactive", () => inactiveAccessToken],
    ["archived", () => archivedAccessToken],
  ])("%s members cannot use a legacy portal access link", async (_status, getToken) => {
    const getResponse = await request(app).get(`/api/players/self/${getToken()}`);
    expect(getResponse.status).toBe(403);

    const patchResponse = await request(app)
      .patch(`/api/players/self/${getToken()}`)
      .send({ phone: "12345678" });
    expect(patchResponse.status).toBe(403);
  });
});