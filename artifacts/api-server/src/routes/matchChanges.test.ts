import { beforeAll, afterAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import {
  db, matchesTable, matchChangeNoticesTable, teamsTable, playersTable,
  seasonsTable, playerParticipationsTable, emailBlastsTable, emailBlastRecipientsTable,
} from "@workspace/db";
import { sendMatchChangeEmail } from "../utils/email";
import { previewMatchChange, sendMatchChange } from "./matchChanges";
import matchesRouter from "./matches";

vi.mock("../utils/email", () => ({ sendMatchChangeEmail: vi.fn(async () => true) }));
vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
  hasAdminAccess: vi.fn(async () => true),
}));

const app = express();
app.use(express.json());
app.get("/:id/change-notice", previewMatchChange);
app.post("/:id/change-notice", sendMatchChange);
app.use("/matches", matchesRouter);
app.use((error: Error, _req: unknown, res: express.Response, _next: unknown) =>
  res.status(500).json({ error: error.message }));

const tag = `match-change-${Date.now()}`;
let teamId: number, playerId: number, matchId: number, revisionId: number, otherTeamId: number;

beforeAll(async () => {
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  if (!season) throw new Error("Missing membership season");
  const teams = await db.insert(teamsTable).values([0, 1].map((n) => ({
    name: `${tag}-${n}`, category: "MO35", managerName: tag,
    managerEmail: `${tag}-${n}@example.com`, managerPhone: "000",
  }))).returning();
  [teamId, otherTeamId] = teams.map((t) => t.id);
  const [player] = await db.insert(playersTable).values({
    teamId: otherTeamId, name: tag, email: `${tag}@example.com`, memberStatus: "active",
  }).returning();
  playerId = player.id;
  await db.insert(playerParticipationsTable).values({
    playerId, seasonId: season.id, teamId, participationStatus: "active",
    source: "match_change_test",
  });
  const [match] = await db.insert(matchesTable).values({
    teamId, opponent: tag, kickoffAt: new Date("2030-10-11T10:00:00Z"),
    status: "cancelled", operationalScope: "local_2026_27",
  }).returning();
  matchId = match.id;
  const [revision] = await db.insert(matchChangeNoticesTable).values({
    matchId, kind: "cancelled", teamId, opponent: tag,
    previousKickoffAt: new Date("2030-10-10T10:00:00Z"), kickoffAt: match.kickoffAt,
  }).returning();
  revisionId = revision.id;
});

afterAll(async () => {
  const revisions = await db.select({ id: matchChangeNoticesTable.id }).from(matchChangeNoticesTable)
    .where(eq(matchChangeNoticesTable.matchId, matchId));
  const blasts = await db.select({ id: emailBlastsTable.id }).from(emailBlastsTable)
    .where(inArray(emailBlastsTable.audienceType, revisions.map((r) => `match-change:${r.id}`)));
  if (blasts.length) {
    await db.delete(emailBlastRecipientsTable).where(inArray(emailBlastRecipientsTable.blastId, blasts.map((b) => b.id)));
    await db.delete(emailBlastsTable).where(inArray(emailBlastsTable.id, blasts.map((b) => b.id)));
  }
  await db.delete(matchChangeNoticesTable).where(eq(matchChangeNoticesTable.matchId, matchId));
  await db.delete(matchesTable).where(eq(matchesTable.id, matchId));
  await db.delete(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, playerId));
  await db.delete(playersTable).where(eq(playersTable.id, playerId));
  await db.delete(teamsTable).where(inArray(teamsTable.id, [teamId, otherTeamId]));
});

describe("fixture change notices", () => {
  it("previews the active squad, blocks stale confirmation, and preserves uncertain outcomes", async () => {
    const url = `/${matchId}/change-notice`;
    const first = await request(app).get(url);
    expect(first.body).toMatchObject({
      revisionId, kind: "cancelled", current: true, total: 1, ready: 1,
    });
    expect(first.body.message).toContain("cancelled");
    expect((await request(app).post(url).send({ revisionId: revisionId + 100 })).status).toBe(409);
    expect(sendMatchChangeEmail).not.toHaveBeenCalled();
    vi.mocked(sendMatchChangeEmail).mockResolvedValueOnce(false);
    const sent = await request(app).post(url).send({ revisionId });
    expect(sent.body).toMatchObject({ sent: 0, uncertain: 1, historyRecorded: true });
    expect(sendMatchChangeEmail).toHaveBeenCalledTimes(1);
    const retry = await request(app).post(url).send({ revisionId });
    expect(retry.body.preview).toMatchObject({ ready: 0, uncertain: 1 });
    expect(sendMatchChangeEmail).toHaveBeenCalledTimes(1);
    const [blast] = await db.select().from(emailBlastsTable)
      .where(eq(emailBlastsTable.audienceType, `match-change:${revisionId}`));
    const [recipient] = await db.select().from(emailBlastRecipientsTable)
      .where(eq(emailBlastRecipientsTable.blastId, blast.id));
    expect(recipient.errorMessage).toBe("delivery_uncertain");
    await db.update(emailBlastRecipientsTable).set({ errorMessage: "confirmed_not_delivered" })
      .where(eq(emailBlastRecipientsTable.id, recipient.id));
    const confirmed = await request(app).post(url).send({ revisionId });
    expect(confirmed.body).toMatchObject({ sent: 1, uncertain: 0 });
    expect((await request(app).get(url)).body).toMatchObject({ sent: 1, ready: 0 });
    expect(sendMatchChangeEmail).toHaveBeenCalledTimes(2);
  });

  it("rejects an outdated fixture and targets the new revision independently", async () => {
    const url = `/${matchId}/change-notice`;
    await db.update(matchesTable).set({ status: "scheduled", kickoffAt: new Date("2030-10-12T10:00:00Z") })
      .where(eq(matchesTable.id, matchId));
    expect((await request(app).post(url).send({ revisionId })).status).toBe(409);
    const [newRevision] = await db.insert(matchChangeNoticesTable).values({
      matchId, kind: "rescheduled", teamId, opponent: tag,
      previousKickoffAt: new Date("2030-10-11T10:00:00Z"),
      kickoffAt: new Date("2030-10-12T10:00:00Z"),
    }).returning();
    const preview = await request(app).get(url);
    expect(preview.body).toMatchObject({ revisionId: newRevision.id, kind: "rescheduled", ready: 1 });
    expect(preview.body.message).toContain("New kick-off");
    expect((await request(app).post(url).send({ revisionId })).status).toBe(409);
    await db.update(playerParticipationsTable).set({ teamId: otherTeamId })
      .where(eq(playerParticipationsTable.playerId, playerId));
    expect((await request(app).get(url)).body).toMatchObject({ total: 0, ready: 0 });
  });

  it("records changes atomically on match edits but not on unchanged saves", async () => {
    const url = `/matches/${matchId}`;
    const payload = {
      teamId, opponent: tag, kickoffAt: "2030-10-14T10:00:00.000Z",
      status: "scheduled", venue: "", ourScore: null, theirScore: null, notes: "",
    };
    expect((await request(app).put(url).send(payload)).status).toBe(200);
    const rescheduled = await request(app).get(`/${matchId}/change-notice`);
    expect(rescheduled.body).toMatchObject({
      kind: "rescheduled", current: true, message: expect.stringContaining("14 October"),
    });
    expect((await request(app).put(url).send(payload)).status).toBe(200);
    expect((await request(app).get(`/${matchId}/change-notice`)).body.revisionId)
      .toBe(rescheduled.body.revisionId);
    expect((await request(app).put(url).send({ ...payload, status: "cancelled" })).status).toBe(200);
    const cancelled = await request(app).get(`/${matchId}/change-notice`);
    expect(cancelled.body).toMatchObject({ kind: "cancelled", current: true });
    expect(cancelled.body.revisionId).toBeGreaterThan(rescheduled.body.revisionId);
  });

  it("notifies the current squad when a cancelled fixture is rebooked", async () => {
    await db.update(playerParticipationsTable).set({ teamId })
      .where(eq(playerParticipationsTable.playerId, playerId));
    const matchUrl = `/matches/${matchId}`;
    const noticeUrl = `/${matchId}/change-notice`;
    const cancelled = await request(app).get(noticeUrl);
    const restored = await request(app).put(matchUrl).send({
      teamId, opponent: tag, kickoffAt: "2030-10-16T10:00:00.000Z",
      status: "scheduled", venue: "King's Park", ourScore: null, theirScore: null, notes: "",
    });
    expect(restored.status).toBe(200);
    const preview = await request(app).get(noticeUrl);
    expect(preview.body).toMatchObject({ kind: "rescheduled", current: true, ready: 1 });
    expect(preview.body.revisionId).toBeGreaterThan(cancelled.body.revisionId);
    expect(preview.body.message).toContain("King's Park");
    expect((await request(app).post(noticeUrl).send({ revisionId: cancelled.body.revisionId })).status).toBe(409);
    const sent = await request(app).post(noticeUrl).send({ revisionId: preview.body.revisionId });
    expect(sent.body).toMatchObject({ sent: 1, uncertain: 0, historyRecorded: true });
    expect((await request(app).post(noticeUrl).send({ revisionId: preview.body.revisionId })).body.preview)
      .toMatchObject({ ready: 0, sent: 1 });
  });

  it("replaces stale notices after venue corrections without losing previous delivery history", async () => {
    const matchUrl = `/matches/${matchId}`;
    const noticeUrl = `/${matchId}/change-notice`;
    const payload = {
      teamId, opponent: tag, kickoffAt: "2030-10-17T10:00:00.000Z",
      status: "scheduled", venue: "Old pitch", ourScore: null, theirScore: null, notes: "",
    };
    expect((await request(app).put(matchUrl).send(payload)).status).toBe(200);
    const first = (await request(app).get(noticeUrl)).body;
    expect((await request(app).put(matchUrl).send({ ...payload, venue: "New pitch" })).status).toBe(200);
    const corrected = (await request(app).get(noticeUrl)).body;
    expect(corrected).toMatchObject({ kind: "rescheduled", current: true, ready: 1 });
    expect(corrected.revisionId).toBeGreaterThan(first.revisionId);
    expect(corrected.message).toContain("New pitch");
    expect((await request(app).post(noticeUrl).send({ revisionId: first.revisionId })).status).toBe(409);
    expect((await request(app).post(noticeUrl).send({ revisionId: corrected.revisionId })).body.sent).toBe(1);
    expect((await request(app).put(matchUrl).send({ ...payload, status: "cancelled", venue: "Old pitch" })).status).toBe(200);
    const cancelled = (await request(app).get(noticeUrl)).body;
    expect((await request(app).put(matchUrl).send({ ...payload, status: "cancelled", venue: "New pitch" })).status).toBe(200);
    const cancelledCorrection = (await request(app).get(noticeUrl)).body;
    expect(cancelledCorrection).toMatchObject({ kind: "cancelled", current: true, ready: 1 });
    expect(cancelledCorrection.revisionId).toBeGreaterThan(cancelled.revisionId);
    expect(cancelledCorrection.message).toContain("New pitch");
    expect((await request(app).post(noticeUrl).send({ revisionId: cancelledCorrection.revisionId })).body.sent).toBe(1);
    const history = await db.select().from(emailBlastsTable)
      .where(inArray(emailBlastsTable.audienceType, [
        `match-change:${corrected.revisionId}`, `match-change:${cancelledCorrection.revisionId}`,
      ]));
    expect(history).toHaveLength(2);
  });
});