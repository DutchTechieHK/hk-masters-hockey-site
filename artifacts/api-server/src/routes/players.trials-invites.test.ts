import crypto from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { eq, inArray } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  adminSessionsTable, emailBlastRecipientsTable, emailBlastsTable, playerParticipationsTable,
  playerSessionsTable, playersTable, seasonsTable, staffSessionsTable, staffTeamGrantsTable, teamsTable,
} from "@workspace/db/schema";
import { createSession } from "../middleware/adminSession";
import { createPlayerSession } from "../middleware/playerSession";

const sendPortalInviteEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true));
const sendBulkAnnouncementEmail = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("../utils/email", async importOriginal => ({
  ...(await importOriginal<typeof import("../utils/email")>()),
  sendPortalInviteEmail, sendBulkAnnouncementEmail,
}));
const { default: app } = await import("../app");
const tag = `portal-invite-test-${crypto.randomUUID()}`;
const playerIds: number[] = [];
const blastIds: number[] = [];
let teamId: number, admin: string, playerToken: string, staff: string;
const headers = () => ({ "x-session-token": admin });
const preview = (ids: number[], resend = false) => request(app).post("/api/portal-invitations/preview").set(headers()).send({ playerIds: ids, resend });
const payload = (ids: number[], token: string, resend = false, requestId = crypto.randomUUID()) => ({ playerIds: ids, previewToken: token, resend, requestId });
const send = (data: object) => request(app).post("/api/portal-invitations/send").set(headers()).send(data);
async function member(suffix: string, extra: Partial<typeof playersTable.$inferInsert> = {}) {
  const [row] = await db.insert(playersTable).values({
    teamId, name: `${tag}-${suffix}`, email: `${tag}-${suffix}@example.invalid`, memberStatus: "active",
    accessToken: crypto.randomUUID(), ...extra,
  }).returning();
  playerIds.push(row.id);
  return row;
}
async function record(r: { body: { blastId?: number } }) {
  if (r.body.blastId && !blastIds.includes(r.body.blastId)) blastIds.push(r.body.blastId);
}
async function prior(playerId: number, audienceType = "trials_invite", sent = true, errorMessage: string | null = null) {
  const [blast] = await db.insert(emailBlastsTable).values({
    subject: tag, body: tag, audienceType, operationalScope: "local_2026_27", recipientCount: 1, sentCount: sent ? 1 : 0, failedCount: sent ? 0 : 1,
  }).returning();
  blastIds.push(blast.id);
  const [p] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  await db.insert(emailBlastRecipientsTable).values({
    blastId: blast.id, playerId, playerName: p.name, playerEmail: p.email, sent, errorMessage,
  });
}
beforeAll(async () => {
  teamId = (await db.insert(teamsTable).values({ name: tag, category: "Test", managerName: "", managerEmail: "", managerPhone: "" }).returning())[0].id;
  admin = await createSession(tag);
  const p = await member("staff");
  playerToken = await createPlayerSession(p.id);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27"));
  await db.insert(staffTeamGrantsTable).values({ playerId: p.id, teamId, seasonId: season.id, manageAttendance: true });
  const r = await request(app).post("/api/staff/session").set("x-player-session", playerToken);
  expect(r.status).toBe(200);
  staff = r.body.token;
});
afterAll(async () => {
  if (blastIds.length) {
    await db.delete(emailBlastRecipientsTable).where(inArray(emailBlastRecipientsTable.blastId, blastIds));
    await db.delete(emailBlastsTable).where(inArray(emailBlastsTable.id, blastIds));
  }
  if (playerIds.length) {
    await db.delete(staffSessionsTable).where(inArray(staffSessionsTable.playerId, playerIds));
    await db.delete(staffTeamGrantsTable).where(inArray(staffTeamGrantsTable.playerId, playerIds));
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, playerIds));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamId) await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  if (admin) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, admin));
});

describe("Selective portal invitations", () => {
  it("requires full admin access and rejects staff/player/anonymous callers", async () => {
    for (const route of ["preview", "send"]) {
      expect((await request(app).post(`/api/portal-invitations/${route}`).send({})).status).toBe(401);
      expect((await request(app).post(`/api/portal-invitations/${route}`).set("x-player-session", playerToken).send({})).status).toBe(401);
      expect((await request(app).post(`/api/portal-invitations/${route}`).set("x-session-token", staff).send({})).status).toBe(403);
    }
  });
  it("requires explicit nonempty selection and resend choice; retires broad legacy sends", async () => {
    sendPortalInviteEmail.mockClear();
    for (const data of [{}, { playerIds: [], resend: false }, { playerIds: [1] }, { playerIds: [1.5], resend: false }]) {
      expect((await request(app).post("/api/portal-invitations/preview").set(headers()).send(data)).status).toBe(400);
    }
    expect((await send({})).status).toBe(400);
    expect((await request(app).post("/api/players/membership/trials-invites").set(headers())).status).toBe(410);
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
  });
  it("previews selected members across categories with skipped reasons and globally ambiguous emails", async () => {
    const trial = await member("trial", { currentMembershipTier: "trials" });
    const other = await member("community", { currentMembershipTier: "community_member" });
    const invalid = await member("invalid", { email: "not-an-email" });
    const inactive = await member("inactive", { memberStatus: "inactive" });
    const ambiguous = await member("ambiguous");
    await member("outside-selection", { email: `  ${ambiguous.email.toUpperCase()}  ` });
    const r = await preview([trial.id, other.id, invalid.id, inactive.id, ambiguous.id, trial.id]);
    expect(r.status, JSON.stringify(r.body)).toBe(200);
    expect(r.headers["cache-control"]).toContain("no-store");
    expect(r.body).toMatchObject({ total: 5, eligible: 2, skipped: 3, alreadyInvited: 0, blocked: 0 });
    expect(r.body.recipients.find((row: any) => row.playerId === ambiguous.id).reason).toMatch(/multiple active/);
    expect(r.body.subject).not.toMatch(/trial/i);
    expect(r.body.body).not.toMatch(/trial/i);
    expect(new URL(r.body.loginUrl).pathname).toBe("/login");
    expect(r.body.recipients.map((row: any) => row.playerId)).not.toContain(playerIds.at(-1));
  });
  it("sends only selected eligible members, normalises emails, and preserves recipient snapshots", async () => {
    const p = await member("selected", { email: `  ${tag}-SELECTED@example.invalid  ` });
    const other = await member("unselected");
    const invalid = await member("selected-invalid", { email: "" });
    const r = await preview([p.id, invalid.id]);
    sendPortalInviteEmail.mockClear();
    const result = await send(payload([p.id, invalid.id], r.body.previewToken));
    await record(result);
    expect(result.status, JSON.stringify(result.body)).toBe(200);
    expect(result.body).toMatchObject({ total: 2, sent: 1, skipped: 1, failed: 0, pending: 0 });
    expect(sendPortalInviteEmail).toHaveBeenCalledExactlyOnceWith({ playerName: p.name, playerEmail: p.email.trim().toLowerCase() });
    expect(sendPortalInviteEmail).not.toHaveBeenCalledWith(expect.objectContaining({ playerEmail: other.email }));
    const rows = await db.select().from(emailBlastRecipientsTable).where(eq(emailBlastRecipientsTable.blastId, result.body.blastId));
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ playerId: p.id, playerName: p.name, sent: true, errorMessage: null });
    const history = await request(app).get(`/api/players/email-blasts/${result.body.blastId}/recipients`).set(headers());
    expect(history.status).toBe(200); expect(history.body[0].playerId).toBe(p.id);
    expect(history.body[0].deliveryStatus).toBe("sent");
  });
  it("recognises both successful legacy invitation types, requires resend, and never sends zero eligible", async () => {
    const a = await member("legacy-auto"), b = await member("legacy-manual");
    await prior(a.id); await prior(b.id, "trials_invite_manual");
    const r = await preview([a.id, b.id]);
    expect(r.body).toMatchObject({ eligible: 0, alreadyInvited: 2 });
    sendPortalInviteEmail.mockClear();
    expect((await send(payload([a.id, b.id], r.body.previewToken))).status).toBe(409);
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
    const explicit = await preview([a.id], true);
    expect(explicit.body).toMatchObject({ eligible: 1, alreadyInvited: 1 });
    const result = await send(payload([a.id], explicit.body.previewToken, true));
    await record(result);
    expect(result.status).toBe(200); expect(result.body.sent).toBe(1);
  });
  it("keeps confirmed old failures eligible, but blocks pending/uncertain even with resend", async () => {
    const oldFailure = await member("old-failure"), pending = await member("pending"), uncertain = await member("uncertain");
    await prior(oldFailure.id, "trials_invite", false, "delivery_failed");
    await prior(pending.id, `portal_invite:${crypto.randomUUID()}`, false, "portal_invite_pending");
    await prior(uncertain.id, `portal_invite:${crypto.randomUUID()}`, false, "portal_invite_uncertain");
    for (const resend of [false, true]) {
      const r = await preview([oldFailure.id, pending.id, uncertain.id], resend);
      expect(r.body).toMatchObject({ eligible: 1, blocked: 2 });
    }
  });
  it("rejects stale previews when member email, status, or invitation history changes", async () => {
    const p = await member("stale");
    const r = await preview([p.id]);
    await db.update(playersTable).set({ email: `${tag}-stale-new@example.invalid` }).where(eq(playersTable.id, p.id));
    sendPortalInviteEmail.mockClear();
    expect((await send(payload([p.id], r.body.previewToken))).status).toBe(409);
    const newer = await preview([p.id]);
    await db.update(playersTable).set({ memberStatus: "inactive" }).where(eq(playersTable.id, p.id));
    expect((await send(payload([p.id], newer.body.previewToken))).status).toBe(409);
    expect(sendPortalInviteEmail).not.toHaveBeenCalled();
  });
  it("claims before provider contact and prevents overlapping concurrent sends and idempotency-key reuse", async () => {
    const p = await member("concurrent");
    const r = await preview([p.id]);
    const data = payload([p.id], r.body.previewToken);
    let release!: () => void, contacted!: () => void;
    const providerContact = new Promise<void>(resolve => { contacted = resolve; });
    const providerRelease = new Promise<void>(resolve => { release = resolve; });
    sendPortalInviteEmail.mockClear();
    sendPortalInviteEmail.mockImplementationOnce(async () => { contacted(); await providerRelease; return true; });
    const first = send(data).then(result => result);
    await providerContact;
    const claimed = await db.select().from(emailBlastsTable).where(eq(emailBlastsTable.audienceType, `portal_invite:${data.requestId}`));
    blastIds.push(claimed[0].id);
    const ledger = await db.select().from(emailBlastRecipientsTable).where(eq(emailBlastRecipientsTable.blastId, claimed[0].id));
    expect(ledger[0]).toMatchObject({ sent: false, errorMessage: "portal_invite_pending" });
    const history = await request(app).get(`/api/players/email-blasts/${claimed[0].id}/recipients`).set(headers());
    expect(history.body[0].deliveryStatus).toBe("pending");
    const replay = await send(data);
    expect(replay.status).toBe(200); expect(replay.body.pending).toBe(1);
    expect((await send(payload([p.id], r.body.previewToken))).status).toBe(409);
    expect((await send({ ...data, resend: true })).status).toBe(409);
    release();
    expect((await first).body.sent).toBe(1);
    const completedReplay = await send(data);
    expect(completedReplay.body).toMatchObject({ sent: 1, pending: 0, blastId: claimed[0].id });
    expect(sendPortalInviteEmail).toHaveBeenCalledTimes(1);
  });
  it("reports partial transport failures as uncertain and blocks automatic retry after reload", async () => {
    const a = await member("partial-good"), b = await member("partial-error"), c = await member("partial-false");
    const ids = [a.id, b.id, c.id];
    const r = await preview(ids);
    sendPortalInviteEmail.mockReset();
    sendPortalInviteEmail.mockImplementation(async ({ playerEmail }) => {
      if (playerEmail === b.email) throw new Error("timeout after possible acceptance");
      return playerEmail !== c.email;
    });
    const result = await send(payload(ids, r.body.previewToken)); await record(result);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({ sent: 1, failed: 2, uncertain: 2, pending: 0 });
    const next = await preview(ids, true);
    expect(next.body).toMatchObject({ eligible: 1, alreadyInvited: 1, blocked: 2 });
    const [blast] = await db.select().from(emailBlastsTable).where(eq(emailBlastsTable.id, result.body.blastId));
    expect(blast).toMatchObject({ sentCount: 1, failedCount: 2, recipientCount: 3 });
    const history = await request(app).get(`/api/players/email-blasts/${result.body.blastId}/recipients`).set(headers());
    expect(history.body.filter((row: any) => row.deliveryStatus === "uncertain")).toHaveLength(2);
    sendPortalInviteEmail.mockResolvedValue(true);
  });
  it("rejects old invitation-purpose composer sends instead of bypassing the selective tool", async () => {
    sendBulkAnnouncementEmail.mockClear();
    const r = await request(app).post("/api/players/send-bulk-email").set(headers())
      .field("audienceType", "all").field("subject", "Invite").field("body", "Hello")
      .field("emailPurpose", "trials_app_invitation");
    expect(r.status).toBe(410); expect(sendBulkAnnouncementEmail).not.toHaveBeenCalled();
  });
});

describe("Announcement email sender selection", () => {
  const sendAs = (fromEmail?: string) => {
    const form = request(app).post("/api/players/send-bulk-email").set(headers())
      .field("audienceType", "individuals").field("playerIds", JSON.stringify([playerIds[0]]))
      .field("subject", "Sender choice test").field("body", "Hello");
    return fromEmail === undefined ? form : form.field("fromEmail", fromEmail);
  };
  it.each(["play@hkmastershockey.com", "mens@hkmastershockey.com"])("persists approved sender %s", async fromEmail => {
    sendBulkAnnouncementEmail.mockClear();
    const r = await sendAs(fromEmail); await record(r);
    expect(r.status).toBe(200);
    expect(sendBulkAnnouncementEmail).toHaveBeenCalledWith(expect.objectContaining({ fromEmail }));
    const [blast] = await db.select().from(emailBlastsTable).where(eq(emailBlastsTable.id, r.body.blastId));
    expect(blast.sentByEmail).toBe(fromEmail);
  });
  it("defaults old callers to PLAY and rejects unapproved senders", async () => {
    sendBulkAnnouncementEmail.mockClear();
    const r = await sendAs(); await record(r);
    expect(r.status).toBe(200);
    expect(sendBulkAnnouncementEmail).toHaveBeenCalledWith(expect.objectContaining({ fromEmail: "play@hkmastershockey.com" }));
    sendBulkAnnouncementEmail.mockClear();
    expect((await sendAs("other@hkmastershockey.com")).status).toBe(400);
    expect(sendBulkAnnouncementEmail).not.toHaveBeenCalled();
  });
});
