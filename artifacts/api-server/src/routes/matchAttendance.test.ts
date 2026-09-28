import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, matchesTable, matchRsvpsTable, playerParticipationsTable,
  playerSessionsTable, playersTable, seasonsTable, teamsTable,
  emailBlastsTable, emailBlastRecipientsTable,
} from "@workspace/db";
import { sendMatchReminderEmail } from "../utils/email";
import { createPlayerSession, requirePlayerSession } from "../middleware/playerSession";
import { adminMatchRsvps, adminMatchRsvpSummaries, playerMatchRsvps, submitMatchRsvp, remindMatchNonresponders } from "./matchAttendance";

vi.mock("../utils/email", () => ({
  sendMatchReminderEmail: vi.fn(async () => true),
}));

const app = express();
app.use(express.json());
app.get("/player/matches/rsvps", requirePlayerSession, playerMatchRsvps);
app.post("/player/matches/:id/rsvp", requirePlayerSession, submitMatchRsvp);
app.get("/matches/rsvps/summary", (req, res, next) => req.headers["x-session-token"] === "admin-test" ? next() : res.status(401).end(), adminMatchRsvpSummaries);
app.get("/matches/:id/rsvps", (req, res, next) => req.headers["x-session-token"] === "admin-test" ? next() : res.status(401).end(), adminMatchRsvps);
app.post("/matches/:id/rsvps/remind", (req, res, next) => req.headers["x-session-token"] === "admin-test" ? next() : res.status(401).end(), remindMatchNonresponders);
app.use((err: Error, _req: unknown, res: express.Response, _next: unknown) => res.status(500).json({ error: err.message }));

const tag = `match-attendance-${Date.now()}`;
const ids: number[] = [];
const playerIds: number[] = [];
const teamIds: number[] = [];
let token: string;
let otherToken: string;
let futureId: number;
let otherFutureId: number;
let pastId: number;
let cancelledId: number;
let archivedId: number;
let seasonId: number;

beforeAll(async () => {
  const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable)
    .where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!season) throw new Error("Current membership season not found");
  seasonId = season.id;
  for (let n = 0; n < 2; n++) {
    const [team] = await db.insert(teamsTable).values({
      name: `${tag}-${n}`, category: "MO35", managerName: "Test",
      managerEmail: `${tag}-${n}@example.com`, managerPhone: "000",
    }).returning({ id: teamsTable.id });
    teamIds.push(team.id);
  }
  for (let n = 0; n < 3; n++) {
    const [player] = await db.insert(playersTable).values({
      teamId: teamIds[n === 0 ? 1 : n === 1 ? 0 : 1], // legacy team differs for the RSVP player
      name: `${tag}-player-${n}`, email: `${tag}-player-${n}@example.com`,
      memberStatus: "active",
    }).returning({ id: playersTable.id });
    playerIds.push(player.id);
    await db.insert(playerParticipationsTable).values({
      playerId: player.id, seasonId, teamId: teamIds[n === 2 ? 1 : 0],
      participationStatus: "active", source: "match_attendance_test",
    });
  }
  token = await createPlayerSession(playerIds[0]);
  otherToken = await createPlayerSession(playerIds[2]);
  for (const [date, status, scope] of [
    ["2030-10-10T10:00:00.000Z", "scheduled", "local_2026_27"],
    ["2020-01-01T10:00:00.000Z", "scheduled", "local_2026_27"],
    ["2030-10-10T10:00:00.000Z", "cancelled", "local_2026_27"],
    ["2030-10-10T10:00:00.000Z", "scheduled", "world_cup_2026"],
  ]) {
    const [match] = await db.insert(matchesTable).values({
      teamId: teamIds[0], opponent: tag, kickoffAt: new Date(date),
      status, operationalScope: scope,
    }).returning({ id: matchesTable.id });
    ids.push(match.id);
  }
  [futureId, pastId, cancelledId, archivedId] = ids;
  const [otherFuture] = await db.insert(matchesTable).values({
    teamId: teamIds[1], opponent: `${tag}-other`, kickoffAt: new Date("2030-10-11T10:00:00.000Z"),
    status: "scheduled", operationalScope: "local_2026_27",
  }).returning({ id: matchesTable.id });
  otherFutureId = otherFuture.id;
  ids.push(otherFutureId);
});

afterAll(async () => {
  const blasts = await db.select({ id: emailBlastsTable.id }).from(emailBlastsTable)
    .where(eq(emailBlastsTable.audienceType, `match-rsvp-reminder:${futureId}`));
  if (blasts.length) {
    await db.delete(emailBlastRecipientsTable).where(inArray(emailBlastRecipientsTable.blastId, blasts.map((b) => b.id)));
    await db.delete(emailBlastsTable).where(inArray(emailBlastsTable.id, blasts.map((b) => b.id)));
  }
  if (ids.length) await db.delete(matchesTable).where(inArray(matchesTable.id, ids));
  if (playerIds.length) {
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamIds.length) await db.delete(teamsTable).where(inArray(teamsTable.id, teamIds));
});

describe("match attendance", () => {
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it("requires a player session and limits replies to the current squad", async () => {
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).send({ status: "yes" })).status).toBe(401);
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`)
      .set("Authorization", `Bearer ${otherToken}`).send({ status: "yes" })).status).toBe(403);
    expect((await request(app).get(`/matches/${futureId}/rsvps`)).status).toBe(401);
    expect((await request(app).get("/matches/rsvps/summary")).status).toBe(401);
    const listing = await request(app).get("/player/matches/rsvps").set(auth());
    expect(listing.status).toBe(200);
    expect(listing.body.matches.map((m: { matchId: number }) => m.matchId)).toEqual([futureId]);
  });

  it("requires reasons, saves changed replies, and counts only the invited squad", async () => {
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "maybe" })).status).toBe(400);
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(200);
    const changed = await request(app).post(`/player/matches/${futureId}/rsvp`)
      .set(auth()).send({ status: "maybe", note: "May be late" });
    expect(changed.body).toMatchObject({ status: "maybe", note: "May be late" });
    const listing = await request(app).get("/player/matches/rsvps").set(auth());
    expect(listing.body.matches[0]).toMatchObject({ myRsvp: "maybe", myNote: "May be late", rsvpCounts: { yes: 0, maybe: 1, no: 0 } });
    const roster = await request(app).get(`/matches/${futureId}/rsvps`).set("x-session-token", "admin-test");
    expect(roster.body.counts).toMatchObject({ invited: 2, maybe: 1, noResponse: 1 });
    const summaries = await request(app).get("/matches/rsvps/summary").set("x-session-token", "admin-test");
    expect(summaries.status).toBe(200);
    const summary = summaries.body.matches.find((item: { matchId: number }) => item.matchId === futureId);
    expect(summary.counts).toEqual(roster.body.counts);
    const otherReply = await request(app).post(`/player/matches/${otherFutureId}/rsvp`)
      .set("Authorization", `Bearer ${otherToken}`).send({ status: "yes" });
    expect(otherReply.status).toBe(200);
    const crossSquadSummaries = await request(app).get("/matches/rsvps/summary").set("x-session-token", "admin-test");
    const otherRoster = await request(app).get(`/matches/${otherFutureId}/rsvps`).set("x-session-token", "admin-test");
    expect(crossSquadSummaries.body.matches.find((item: { matchId: number }) => item.matchId === otherFutureId).counts)
      .toEqual(otherRoster.body.counts);
    expect(otherRoster.body.counts).toMatchObject({ invited: 1, yes: 1, noResponse: 0 });
    expect(crossSquadSummaries.body.matches.find((item: { matchId: number }) => item.matchId === futureId).counts)
      .toEqual(roster.body.counts);
    expect(summaries.body.matches.some((item: { matchId: number }) => [pastId, cancelledId, archivedId].includes(item.matchId))).toBe(false);
    expect(roster.body.responses[0]).toMatchObject({ playerId: playerIds[0], note: "May be late" });
    expect(roster.body.noResponse[0].playerId).toBe(playerIds[1]);
    const last = await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" });
    expect(last.body.note).toBeNull();
    const [saved] = await db.select().from(matchRsvpsTable)
      .where(and(eq(matchRsvpsTable.matchId, futureId), eq(matchRsvpsTable.playerId, playerIds[0])));
    expect(saved.status).toBe("yes");
    expect(saved.note).toBeNull();
    await db.update(playerParticipationsTable).set({ teamId: teamIds[1] })
      .where(and(eq(playerParticipationsTable.playerId, playerIds[0]), eq(playerParticipationsTable.seasonId, seasonId)));
    const movedRoster = await request(app).get(`/matches/${futureId}/rsvps`).set("x-session-token", "admin-test");
    expect(movedRoster.body.counts).toMatchObject({ yes: 0, noResponse: 1, invited: 1 });
    const movedSummaries = await request(app).get("/matches/rsvps/summary").set("x-session-token", "admin-test");
    expect(movedSummaries.body.matches.find((item: { matchId: number }) => item.matchId === futureId).counts)
      .toEqual(movedRoster.body.counts);
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(403);
    await db.update(playerParticipationsTable).set({ teamId: teamIds[0] })
      .where(and(eq(playerParticipationsTable.playerId, playerIds[0]), eq(playerParticipationsTable.seasonId, seasonId)));
  });

  it("records uncertain outcomes before delivery and never retries them automatically", async () => {
    vi.mocked(sendMatchReminderEmail).mockClear().mockResolvedValueOnce(false).mockResolvedValue(true);
    expect((await request(app).post(`/matches/${futureId}/rsvps/remind`)).status).toBe(401);
    for (const id of [pastId, cancelledId, archivedId]) {
      expect((await request(app).post(`/matches/${id}/rsvps/remind`).set("x-session-token", "admin-test")).status).toBe(409);
    }
    await db.insert(matchRsvpsTable).values({
      matchId: futureId, playerId: playerIds[0], status: "yes", respondedAt: new Date(),
    }).onConflictDoNothing();
    const endpoint = `/matches/${futureId}/rsvps/remind`;
    const first = await request(app).post(endpoint).set("x-session-token", "admin-test");
    expect(first.body).toMatchObject({ total: 1, sent: 0, failed: 1, historyRecorded: true });
    expect(sendMatchReminderEmail).toHaveBeenCalledTimes(1);
    expect(vi.mocked(sendMatchReminderEmail).mock.calls[0][0]).toMatchObject({
      playerEmail: `${tag}-player-1@example.com`, matchUrl: expect.stringContaining(`/schedule#match-${futureId}`),
    });
    const retry = await request(app).post(endpoint).set("x-session-token", "admin-test");
    expect(retry.body).toMatchObject({ sent: 0, skippedUncertain: 1, failed: 0, historyRecorded: true });
    expect(sendMatchReminderEmail).toHaveBeenCalledTimes(1);
    const [firstBlast] = await db.select().from(emailBlastsTable)
      .where(eq(emailBlastsTable.audienceType, `match-rsvp-reminder:${futureId}`));
    const [uncertain] = await db.select().from(emailBlastRecipientsTable)
      .where(eq(emailBlastRecipientsTable.blastId, firstBlast.id));
    expect(uncertain).toMatchObject({ sent: false, errorMessage: "delivery_uncertain" });

    // Only a separately verified non-delivery may be made retryable.
    await db.update(emailBlastRecipientsTable).set({ errorMessage: "confirmed_not_delivered" })
      .where(eq(emailBlastRecipientsTable.id, uncertain.id));
    const confirmedRetry = await request(app).post(endpoint).set("x-session-token", "admin-test");
    expect(confirmedRetry.body).toMatchObject({ sent: 1, failed: 0, historyRecorded: true });
    const again = await request(app).post(endpoint).set("x-session-token", "admin-test");
    expect(again.body).toMatchObject({ sent: 0, skippedAlreadySent: 1, failed: 0 });
    expect(sendMatchReminderEmail).toHaveBeenCalledTimes(2);
    const batches = await db.select().from(emailBlastsTable)
      .where(eq(emailBlastsTable.audienceType, `match-rsvp-reminder:${futureId}`));
    expect(batches).toHaveLength(2);
    expect(batches.map((b) => [b.sentCount, b.failedCount]).sort((a, b) => a[0] - b[0]))
      .toEqual([[0, 1], [1, 0]]);
    const recipients = await db.select().from(emailBlastRecipientsTable)
      .where(inArray(emailBlastRecipientsTable.blastId, batches.map((b) => b.id)));
    expect(recipients.map((r) => r.sent).sort()).toEqual([false, true]);
  });

  it("does not resend if delivery succeeded but recording the result failed", async () => {
    await db.delete(matchRsvpsTable).where(and(
      eq(matchRsvpsTable.matchId, futureId), eq(matchRsvpsTable.playerId, playerIds[0])));
    vi.mocked(sendMatchReminderEmail).mockClear().mockResolvedValue(true);
    const historyFailure = vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("history unavailable"));
    const endpoint = `/matches/${futureId}/rsvps/remind`;
    try {
      const first = await request(app).post(endpoint).set("x-session-token", "admin-test");
      expect(first.body).toMatchObject({ sent: 1, historyRecorded: false });
    } finally {
      historyFailure.mockRestore();
    }
    const second = await request(app).post(endpoint).set("x-session-token", "admin-test");
    expect(second.body).toMatchObject({ sent: 0, skippedUncertain: 1, skippedAlreadySent: 1 });
    expect(sendMatchReminderEmail).toHaveBeenCalledTimes(1);
    const rows = await db.select().from(emailBlastRecipientsTable)
      .innerJoin(emailBlastsTable, eq(emailBlastsTable.id, emailBlastRecipientsTable.blastId))
      .where(eq(emailBlastsTable.audienceType, `match-rsvp-reminder:${futureId}`));
    expect(rows.some((row) => row.email_blast_recipients.playerId === playerIds[0] &&
      row.email_blast_recipients.errorMessage === "delivery_pending")).toBe(true);
  });

  it("rejects old, cancelled, final, and archived matches", async () => {
    for (const id of [pastId, cancelledId, archivedId]) {
      expect((await request(app).post(`/player/matches/${id}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(409);
    }
    await db.update(matchesTable).set({ status: "final" }).where(eq(matchesTable.id, futureId));
    expect((await request(app).post(`/player/matches/${futureId}/rsvp`).set(auth()).send({ status: "yes" })).status).toBe(409);
    const roster = await request(app).get(`/matches/${archivedId}/rsvps`).set("x-session-token", "admin-test");
    expect(roster.status).toBe(409);
  });
});