import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import {
  emailBlastRecipientsTable,
  emailBlastsTable,
  eventsTable,
  playerParticipationsTable,
  playersTable,
  seasonsTable,
  teamsTable,
} from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { sendRsvpReminderEmail } from "../utils/email";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
  hasAdminAccess: async () => true,
}));
vi.mock("../middleware/playerSession", () => ({
  requirePlayerSession: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
vi.mock("../utils/email", () => ({
  sendRsvpReminderEmail: vi.fn(async () => true),
  sendNewEventEmail: vi.fn(async () => true),
}));

const { default: eventsRouter } = await import("./events");

const app = express();
app.use(express.json());
app.use("/api/events", eventsRouter);

const tag = `reminder-history-${process.pid}-${Date.now()}`;
let teamId: number;
let playerId: number;
let eventId: number;
let blastId: number;

beforeAll(async () => {
  const [currentSeason] = await db
    .select({ id: seasonsTable.id })
    .from(seasonsTable)
    .where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!currentSeason) throw new Error("Current membership season is required");

  const [team] = await db.insert(teamsTable).values({
    name: `${tag}-team`,
    category: "test",
    membershipSection: "men",
    managerName: "",
    managerEmail: "",
    managerPhone: "",
  }).returning({ id: teamsTable.id });
  teamId = team.id;

  const [player] = await db.insert(playersTable).values({
    teamId,
    name: `${tag}-player`,
    email: `${tag}@example.com`,
    memberStatus: "active",
    currentMembershipSection: "men",
  }).returning({ id: playersTable.id });
  playerId = player.id;

  await db.insert(playerParticipationsTable).values({
    playerId,
    seasonId: currentSeason.id,
    teamId,
    participationStatus: "active",
    membershipSection: "men",
    source: "event_reminder_history_test",
  });

  const [event] = await db.insert(eventsTable).values({
    kind: "training",
    title: `${tag}-trial`,
    startsAt: new Date("2026-09-25T11:00:00Z"),
    location: "Test pitch",
    teamId,
    operationalScope: "local_2026_27",
  }).returning({ id: eventsTable.id });
  eventId = event.id;
});

afterAll(async () => {
  if (blastId) {
    await db.delete(emailBlastRecipientsTable).where(eq(emailBlastRecipientsTable.blastId, blastId));
    await db.delete(emailBlastsTable).where(eq(emailBlastsTable.id, blastId));
  }
  if (eventId) await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
  if (playerId) {
    await db.delete(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, playerId));
    await db.delete(playersTable).where(eq(playersTable.id, playerId));
  }
  if (teamId) await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
});

describe("event RSVP reminder history", () => {
  it("records the batch and recipient delivery without sending twice", async () => {
    const response = await request(app)
      .post(`/api/events/${eventId}/rsvps/remind`)
      .expect(200);

    expect(response.body).toEqual(expect.objectContaining({
      sent: 1,
      failed: 0,
      historyRecorded: true,
    }));
    expect(sendRsvpReminderEmail).toHaveBeenCalledTimes(1);

    const [blast] = await db
      .select()
      .from(emailBlastsTable)
      .where(eq(emailBlastsTable.subject, `Quick reply needed: ${tag}-trial`));
    expect(blast).toEqual(expect.objectContaining({
      audienceType: "event-rsvp-reminder",
      recipientCount: 1,
      sentCount: 1,
      failedCount: 0,
      operationalScope: "local_2026_27",
    }));
    blastId = blast.id;

    const recipients = await db
      .select()
      .from(emailBlastRecipientsTable)
      .where(eq(emailBlastRecipientsTable.blastId, blastId));
    expect(recipients).toEqual([
      expect.objectContaining({
        playerId,
        playerName: `${tag}-player`,
        playerEmail: `${tag}@example.com`,
        sent: true,
      }),
    ]);
    expect(sendRsvpReminderEmail).toHaveBeenCalledTimes(1);
  });
});