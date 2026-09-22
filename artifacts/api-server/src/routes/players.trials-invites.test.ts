import crypto from "crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  emailBlastRecipientsTable,
  emailBlastsTable,
  playerParticipationsTable,
  playersTable,
  teamsTable,
} from "@workspace/db/schema";

const sendTrialsAppInviteEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true));

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
  hasAdminAccess: async () => true,
}));
vi.mock("../utils/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../utils/email")>()),
  sendTrialsAppInviteEmail,
}));

const { default: playersRouter } = await import("./players");
const app = express();
app.use(express.json());
app.use("/api/players", playersRouter);
app.use((error: Error, _req: any, res: any, _next: any) => res.status(500).json({ error: error.message }));

const runId = `${process.pid}-${Date.now()}`;
const validEmail = `trials-invite-${runId}@example.com`;
const storedValidEmail = `  ${validEmail.toUpperCase()}  `;
const invalidEmail = `trials-invite-invalid-${runId}`;
const otherEmail = `trials-invite-other-${runId}@example.com`;
const duplicateEmail = `trials-invite-duplicate-${runId}@example.com`;
let playerIds: number[] = [];
let blastIds: number[] = [];

beforeAll(async () => {
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).limit(1);
  if (!team) throw new Error("A team is required for Trials invitation tests");
  const players = await db.insert(playersTable).values([
    {
      teamId: team.id,
      name: "Eligible Trials Invite",
      email: storedValidEmail,
      memberStatus: "active",
      currentMembershipTier: "trials",
      accessToken: crypto.randomUUID(),
    },
    {
      teamId: team.id,
      name: "Invalid Trials Invite",
      email: invalidEmail,
      memberStatus: "active",
      currentMembershipTier: "trials",
      accessToken: crypto.randomUUID(),
    },
    {
      teamId: team.id,
      name: "Other Category",
      email: otherEmail,
      memberStatus: "active",
      currentMembershipTier: "awaiting_selection",
      accessToken: crypto.randomUUID(),
    },
    {
      teamId: team.id,
      name: "Ambiguous Trials Invite",
      email: ` ${duplicateEmail.toUpperCase()} `,
      memberStatus: "active",
      currentMembershipTier: "trials",
      accessToken: crypto.randomUUID(),
    },
    {
      teamId: team.id,
      name: "Ambiguous Other Category",
      email: duplicateEmail,
      memberStatus: "active",
      currentMembershipTier: "social_player",
      accessToken: crypto.randomUUID(),
    },
  ]).returning({ id: playersTable.id });
  playerIds = players.map((player) => player.id);
});

afterAll(async () => {
  if (blastIds.length > 0) {
    await db.delete(emailBlastRecipientsTable).where(inArray(emailBlastRecipientsTable.blastId, blastIds));
    await db.delete(emailBlastsTable).where(inArray(emailBlastsTable.id, blastIds));
  }
  await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
  await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
});

describe("Trials app invitations", () => {
  it("previews only active Trials members and skips invalid email addresses", async () => {
    const response = await request(app).get("/api/players/membership/trials-invites");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    expect(response.body.eligible).toBeGreaterThanOrEqual(1);
    expect(response.body.skipped).toBeGreaterThanOrEqual(2);
  });

  it("sends only to eligible Trials members and records the delivery", async () => {
    sendTrialsAppInviteEmail.mockClear();
    const response = await request(app).post("/api/players/membership/trials-invites");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    blastIds.push(response.body.blastId);
    expect(sendTrialsAppInviteEmail).toHaveBeenCalledWith({
      playerName: "Eligible Trials Invite",
      playerEmail: validEmail,
    });
    expect(sendTrialsAppInviteEmail).toHaveBeenCalledTimes(response.body.sent + response.body.failed);
    expect(sendTrialsAppInviteEmail).not.toHaveBeenCalledWith(expect.objectContaining({ playerEmail: invalidEmail }));
    expect(sendTrialsAppInviteEmail).not.toHaveBeenCalledWith(expect.objectContaining({ playerEmail: otherEmail }));
    expect(sendTrialsAppInviteEmail).not.toHaveBeenCalledWith(expect.objectContaining({ playerName: "Ambiguous Trials Invite" }));

    sendTrialsAppInviteEmail.mockClear();
    const repeatedResponse = await request(app).post("/api/players/membership/trials-invites");
    expect(repeatedResponse.status, JSON.stringify(repeatedResponse.body)).toBe(200);
    blastIds.push(repeatedResponse.body.blastId);
    expect(repeatedResponse.body.alreadyInvited).toBeGreaterThanOrEqual(1);
    expect(sendTrialsAppInviteEmail).not.toHaveBeenCalledWith(expect.objectContaining({
      playerEmail: validEmail,
    }));
  }, 60_000);

  it("records failed delivery and keeps that recipient eligible for retry", async () => {
    const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).limit(1);
    if (!team) throw new Error("A team is required for Trials invitation tests");
    const retryEmail = `trials-invite-retry-${runId}@example.com`;
    const [retryPlayer] = await db.insert(playersTable).values({
      teamId: team.id,
      name: "Retry Trials Invite",
      email: retryEmail,
      memberStatus: "active",
      currentMembershipTier: "trials",
      accessToken: crypto.randomUUID(),
    }).returning({ id: playersTable.id });
    playerIds.push(retryPlayer.id);

    sendTrialsAppInviteEmail.mockImplementation(async ({ playerEmail }) => {
      if (playerEmail === retryEmail) throw new Error("temporary transport error");
      return true;
    });
    const response = await request(app).post("/api/players/membership/trials-invites");
    expect(response.status, JSON.stringify(response.body)).toBe(200);
    blastIds.push(response.body.blastId);
    expect(response.body.failed).toBe(1);
    expect(response.body.sent).toBe(0);
    const [failure] = await db.select().from(emailBlastRecipientsTable).where(and(
      eq(emailBlastRecipientsTable.blastId, response.body.blastId),
      eq(emailBlastRecipientsTable.playerId, retryPlayer.id),
    ));
    expect(failure).toMatchObject({
      blastId: response.body.blastId,
      sent: false,
      errorMessage: "temporary transport error",
    });

    sendTrialsAppInviteEmail.mockResolvedValue(true);
    sendTrialsAppInviteEmail.mockClear();
    const retryResponse = await request(app).post("/api/players/membership/trials-invites");
    expect(retryResponse.status, JSON.stringify(retryResponse.body)).toBe(200);
    blastIds.push(retryResponse.body.blastId);
    expect(sendTrialsAppInviteEmail).toHaveBeenCalledWith({
      playerName: "Retry Trials Invite",
      playerEmail: retryEmail,
    });
  }, 60_000);
});