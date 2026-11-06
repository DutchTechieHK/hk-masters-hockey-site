import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import crypto from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import { db, pool, playersTable, teamsTable, seasonsTable, playerParticipationsTable, playerPaymentsTable,
  memberBulkEditsTable, adminSessionsTable, playerSessionsTable, staffTeamGrantsTable, staffSessionsTable,
  worldCupPlayerSnapshotsTable } from "@workspace/db";
import { createSession } from "../middleware/adminSession";
import { createPlayerSession } from "../middleware/playerSession";
import { membershipCategoryAmountDue, MEMBERSHIP_CATEGORIES } from "../utils/membershipFees";
import { shouldApplyImportedTier } from "../lib/notionMemberSync";

vi.mock("../utils/email", () => ({}));
vi.mock("../utils/push", () => ({ sendPushToPlayers: vi.fn(async () => {}) }));
const { default: app } = await import("../app");
const tag = `bulk-test-${crypto.randomUUID()}`;
const actor = tag;
let admin: string, playerToken: string, staff: string;
let seasonId: number, archiveId: number, teamId: number, a: number, b: number, other: number;
let archiveBefore: unknown, archivePaymentBefore: unknown;
const post = (path: string, body: object, token = admin) => request(app).post(`/api/member-bulk-edits/${path}`).set("x-session-token", token).send(body);
const chosen = (field = "category", value = "social_player", playerIds = [a, b]) => ({ playerIds, field, value });
const view = (body = chosen()) => post("preview", body);
const save = (body: object, previewToken: string, requestId = crypto.randomUUID()) => post("apply", { ...body, previewToken, requestId });
const participation = async (id: number) => (await db.select().from(playerParticipationsTable).where(and(eq(playerParticipationsTable.playerId, id), eq(playerParticipationsTable.seasonId, seasonId))))[0];
const member = async (id: number) => (await db.select().from(playersTable).where(eq(playersTable.id, id)))[0];
async function setMember(id: number, tier: string, section = "men", amount = membershipCategoryAmountDue(tier)?.toFixed(2) ?? null) {
  await db.update(playersTable).set({ currentMembershipTier: tier, currentMembershipSection: section, membershipTierUpdatedAt: null }).where(eq(playersTable.id, id));
  await db.update(playerParticipationsTable).set({ membershipTier: tier, membershipSection: section, amountDue: amount, teamId, updatedAt: new Date() })
    .where(and(eq(playerParticipationsTable.playerId, id), eq(playerParticipationsTable.seasonId, seasonId)));
}
beforeAll(async () => {
  seasonId = (await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27")))[0].id;
  archiveId = (await db.insert(seasonsTable).values({ slug: tag, name: tag, kind: "tournament", status: "archived", isCurrent: false }).returning())[0].id;
  teamId = (await db.insert(teamsTable).values({ name: tag, category: "Test", membershipSection: "men", managerName: "", managerEmail: "", managerPhone: "" }).returning())[0].id;
  const created = await db.insert(playersTable).values([0, 1, 2].map(i => ({ name: `${tag}-${i}`, email: `${tag}-${i}@example.invalid`, teamId, currentMembershipSection: "men", currentMembershipTier: "community_member" }))).returning();
  [a, b, other] = created.map(p => p.id);
  await db.insert(playerParticipationsTable).values(created.map(p => ({
    playerId: p.id, seasonId, membershipSection: "men", membershipTier: "community_member", amountDue: "100.00", teamId, source: "admin",
  })));
  archiveBefore = (await db.insert(playerParticipationsTable).values({
    playerId: a, seasonId: archiveId, membershipSection: "men", membershipTier: "legacy_world_cup", amountDue: "987.00",
    teamId, participationStatus: "archived", legacySnapshot: { evidence: tag },
  }).returning())[0];
  archivePaymentBefore = (await db.insert(playerPaymentsTable).values({ playerId: a, seasonId: archiveId, amount: "999.00", paymentDate: "2026-01-01", notes: tag }).returning())[0];
  admin = await createSession(actor);
  playerToken = await createPlayerSession(a);
  await db.insert(staffTeamGrantsTable).values({ playerId: a, teamId, seasonId, manageAttendance: true });
  staff = (await request(app).post("/api/staff/session").set("x-player-session", playerToken)).body.token;
  expect(staff).toBeTruthy();
});
beforeEach(async () => {
  await setMember(a, "community_member", "men", "125.00");
  await setMember(b, "social_player");
  await setMember(other, "community_member");
  await db.delete(playerPaymentsTable).where(and(inArray(playerPaymentsTable.playerId, [a, b, other]), eq(playerPaymentsTable.seasonId, seasonId)));
  await db.insert(playerPaymentsTable).values({ playerId: a, seasonId, amount: "80.00", paymentDate: "2026-11-01", notes: tag });
});
afterAll(async () => {
  const playerIds = [a, b, other].filter(Boolean);
  await db.delete(memberBulkEditsTable).where(eq(memberBulkEditsTable.actor, actor));
  if (playerIds.length) {
    for (const table of [staffSessionsTable, staffTeamGrantsTable, playerSessionsTable, playerPaymentsTable, playerParticipationsTable, worldCupPlayerSnapshotsTable])
      await db.delete(table).where(inArray(table.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
  if (teamId) await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  if (archiveId) await db.delete(seasonsTable).where(eq(seasonsTable.id, archiveId));
  if (admin) await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, admin));
});
describe("safe current-membership bulk edits", () => {
  it("protects preview, apply and history from anonymous, player and scoped staff access", async () => {
    for (const path of ["preview", "apply", "history"]) {
      const call = () => path === "history" ? request(app).get("/api/member-bulk-edits/history") : request(app).post(`/api/member-bulk-edits/${path}`).send(chosen());
      expect((await call()).status).toBe(401);
      expect((await call().set("x-player-session", playerToken)).status).toBe(401);
      expect((await call().set("x-session-token", staff)).status).toBe(403);
    }
    const response = await view();
    expect(response.status).toBe(200);
    expect(response.headers["cache-control"]).toContain("no-store");
    expect((await request(app).patch("/api/players/membership-sections").set("x-session-token", admin).send({ playerIds: [a], membershipSection: "women" })).status).toBe(410);
  });
  it("rejects empty, duplicate, fractional and unsupported fields/values and arbitrary extra fields", async () => {
    for (const body of [
      chosen("category", "social_player", []), chosen("category", "social_player", [a, a]),
      chosen("category", "social_player", [a + 0.1]), chosen("memberStatus", "inactive"), chosen("category", "men"),
      chosen("section", "social_player"), { ...chosen(), email: "bad@example.invalid" },
      chosen("category", "social_player", Array.from({ length: 501 }, (_, i) => i + 1)),
    ]) expect((await view(body)).status).toBe(400);
    expect((await view(chosen("category", "social_player", [2147483647]))).status).toBe(409);
  });
  it("previews exact names, custom fee replacement, current-only payments and changed/no-op counts without writing", async () => {
    const original = await participation(a);
    const r = await view();
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ changed: 1, unchanged: 1, total: 2, seasonId });
    expect(r.body.rows).toHaveLength(2);
    expect(r.body.rows[0]).toMatchObject({ playerId: a, name: `${tag}-0`, oldValue: "community_member", newValue: "social_player", oldAmountDue: 125, newAmountDue: 300, amountPaid: 80, balanceBefore: 45, balanceAfter: 220, customFee: true, teamIdAfter: teamId });
    expect(r.body.rows[0].warnings.join(" ")).toContain("nonstandard/custom");
    expect(r.body.rows[1].changed).toBe(false);
    expect(await participation(a)).toEqual(original);
  });
  it.each(MEMBERSHIP_CATEGORIES)("applies category %s using shared fee rules, without squad, payment, archive or unselected changes", async target => {
    await setMember(a, target === "trials" ? "awaiting_selection" : "trials");
    const otherBefore = await member(other), unchangedBefore = await participation(other);
    const paymentsBefore = await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, a));
    const body = chosen("category", target, [a]), p = await view(body);
    expect(p.status).toBe(200);
    const r = await save(body, p.body.previewToken);
    expect(r.status).toBe(200);
    expect(r.body.changed).toBe(1);
    expect(await member(a)).toMatchObject({ currentMembershipTier: target, currentMembershipSection: "men" });
    expect((await member(a)).membershipTierUpdatedAt).toBeInstanceOf(Date);
    expect(await participation(a)).toMatchObject({ membershipTier: target, amountDue: membershipCategoryAmountDue(target)?.toFixed(2) ?? null, teamId, membershipSection: "men" });
    expect(await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, a))).toEqual(paymentsBefore);
    expect((await db.select().from(playerParticipationsTable).where(eq(playerParticipationsTable.seasonId, archiveId)))[0]).toEqual(archiveBefore);
    expect((await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.seasonId, archiveId)))[0]).toEqual(archivePaymentBefore);
    expect(await member(other)).toEqual(otherBefore);
    expect(await participation(other)).toEqual(unchangedBefore);
    if (!["trials", "awaiting_selection"].includes(target)) expect(shouldApplyImportedTier("notion_join", target)).toBe(false);
  });
  it.each(["not_set", "men", "women"])("applies section %s only and previews compatible/incompatible squad consequences", async section => {
    if (section === "men") await setMember(a, "community_member", "women", "125.00");
    const body = chosen("section", section, [a]);
    const p = await view(body);
    expect(p.status).toBe(200);
    expect(p.body.rows[0]).toMatchObject({ oldAmountDue: 125, newAmountDue: 125, balanceAfter: 45, teamIdAfter: section === "men" ? teamId : null });
    expect(p.body.rows[0].warnings.length).toBe(section === "men" ? 0 : 1);
    const r = await save(body, p.body.previewToken);
    expect(r.status).toBe(200);
    expect(await member(a)).toMatchObject({ currentMembershipSection: section, currentMembershipTier: "community_member", membershipTierUpdatedAt: null });
    expect(await participation(a)).toMatchObject({ amountDue: "125.00", membershipTier: "community_member", membershipSection: section, teamId: section === "men" ? teamId : null });
  });
  it("preserves custom fees and no-op rows even after Members is reloaded", async () => {
    const noOpBefore = await participation(b), memberBefore = await member(b);
    const body = chosen("section", "women", [a]), p = await view(body);
    expect((await save(body, p.body.previewToken)).status).toBe(200);
    expect((await request(app).get("/api/players").set("x-session-token", admin)).status).toBe(200);
    expect((await participation(a)).amountDue).toBe("125.00");
    const category = chosen(), cp = await view(category);
    expect((await save(category, cp.body.previewToken)).status).toBe(200);
    expect(await participation(b)).toEqual(noOpBefore);
    expect(await member(b)).toEqual(memberBefore);
  });
  it("rejects a zero-change batch and never creates its audit", async () => {
    const body = chosen("category", "social_player", [b]), p = await view(body);
    expect(p.body.changed).toBe(0);
    const requestId = crypto.randomUUID();
    expect((await save(body, p.body.previewToken, requestId)).status).toBe(409);
    expect(await db.select().from(memberBulkEditsTable).where(eq(memberBulkEditsTable.requestId, requestId))).toHaveLength(0);
  });
  it.each(["member", "fee", "payment", "squad", "selection", "target"])("rejects a stale %s preview without partially applying the batch", async change => {
    const body = chosen("category", "masters_division_one"), p = await view(body);
    if (change === "member") await db.update(playersTable).set({ name: `${tag}-changed` }).where(eq(playersTable.id, a));
    if (change === "fee") await db.update(playerParticipationsTable).set({ amountDue: "199.00" }).where(and(eq(playerParticipationsTable.playerId, a), eq(playerParticipationsTable.seasonId, seasonId)));
    if (change === "payment") await db.insert(playerPaymentsTable).values({ playerId: a, seasonId, amount: "10.00", paymentDate: "2026-11-02" });
    if (change === "squad") await db.update(playerParticipationsTable).set({ teamId: null }).where(and(eq(playerParticipationsTable.playerId, a), eq(playerParticipationsTable.seasonId, seasonId)));
    const changedBody = change === "selection" ? { ...body, playerIds: [a] } : change === "target" ? { ...body, value: "trials" } : body;
    const r = await save(changedBody, p.body.previewToken);
    expect(r.status).toBe(409);
    expect((await member(a)).currentMembershipTier).toBe("community_member");
    expect((await member(b)).currentMembershipTier).toBe("social_player");
    if (change === "member") await db.update(playersTable).set({ name: `${tag}-0` }).where(eq(playersTable.id, a));
  });
  it("records an atomic audit with actor and consequences and safely replays the same request once", async () => {
    const body = chosen(), p = await view(body), requestId = crypto.randomUUID();
    const [first, concurrent] = await Promise.all([save(body, p.body.previewToken, requestId), save(body, p.body.previewToken, requestId)]);
    expect(first.status).toBe(200); expect(concurrent.status).toBe(200);
    expect(first.body).toEqual(concurrent.body);
    expect(first.body).toMatchObject({ actor, changed: 1, unchanged: 1, total: 2 });
    const batches = await db.select().from(memberBulkEditsTable).where(eq(memberBulkEditsTable.requestId, requestId));
    expect(batches).toHaveLength(1);
    expect((await save({ ...body, value: "trials" }, p.body.previewToken, requestId)).status).toBe(409);
    const history = await request(app).get("/api/member-bulk-edits/history").set("x-session-token", admin);
    expect(history.status).toBe(200);
    expect(history.body.items.find((item: any) => item.batchId === first.body.batchId)).toEqual(first.body);
    const earlier = await request(app).get(`/api/member-bulk-edits/history?beforeId=${first.body.batchId}`).set("x-session-token", admin);
    expect(earlier.body.items.every((item: any) => item.batchId < first.body.batchId)).toBe(true);
    expect(JSON.stringify(first.body)).not.toContain(admin);
    expect(JSON.stringify(first.body)).not.toContain("@example.invalid");
  });
  it("rejects overlapping concurrent stale batches rather than overwriting the winner", async () => {
    const body1 = chosen("category", "masters_division_one"), body2 = chosen("category", "trials");
    const [p1, p2] = await Promise.all([view(body1), view(body2)]);
    const responses = await Promise.all([save(body1, p1.body.previewToken), save(body2, p2.body.previewToken)]);
    expect(responses.map(r => r.status).sort()).toEqual([200, 409]);
    const winner = responses[0].status === 200 ? body1.value : body2.value;
    expect((await member(a)).currentMembershipTier).toBe(winner);
    expect((await participation(b)).membershipTier).toBe(winner);
  });
  it("rejects an old preview when the current season becomes ambiguous", async () => {
    const body = chosen(), p = await view(body);
    const [temporarySeason] = await db.insert(seasonsTable).values({
      slug: `${tag}-current`, name: `${tag}-current`, kind: "membership", status: "current", isCurrent: true,
    }).returning();
    try {
      expect((await save(body, p.body.previewToken)).status).toBe(409);
      expect((await member(a)).currentMembershipTier).toBe("community_member");
      expect((await member(b)).currentMembershipTier).toBe("social_player");
    } finally {
      await db.delete(seasonsTable).where(eq(seasonsTable.id, temporarySeason.id));
    }
  });
  it("reduces amount due without refunding an overpayment or creating negative arrears", async () => {
    await setMember(a, "masters_division_one");
    await db.insert(playerPaymentsTable).values({ playerId: a, seasonId, amount: "150.00", paymentDate: "2026-11-02" });
    const payments = await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, a));
    const body = chosen("category", "community_member", [a]), p = await view(body);
    expect(p.body.rows[0]).toMatchObject({ oldAmountDue: 500, newAmountDue: 100, amountPaid: 230, balanceBefore: 270, balanceAfter: 0 });
    expect((await save(body, p.body.previewToken)).status).toBe(200);
    expect(await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, a))).toEqual(payments);
  });
  it("rolls back all member/participation changes if the audit insert fails", async () => {
    const requestId = crypto.randomUUID(), suffix = crypto.randomBytes(8).toString("hex");
    const trigger = `bulk_test_${suffix}`, fn = `bulk_fail_${suffix}`;
    const body = chosen("category", "masters_division_one"), p = await view(body);
    const before = [await member(a), await member(b), await participation(a), await participation(b)];
    try {
      await pool.query(`CREATE FUNCTION ${fn}() RETURNS trigger AS $$ BEGIN IF NEW.request_id = '${requestId}'::uuid THEN RAISE EXCEPTION 'isolated audit test failure'; END IF; RETURN NEW; END; $$ LANGUAGE plpgsql`);
      await pool.query(`CREATE TRIGGER ${trigger} BEFORE INSERT ON member_bulk_edits FOR EACH ROW EXECUTE FUNCTION ${fn}()`);
      expect((await save(body, p.body.previewToken, requestId)).status).toBe(500);
      expect([await member(a), await member(b), await participation(a), await participation(b)]).toEqual(before);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS ${trigger} ON member_bulk_edits`);
      await pool.query(`DROP FUNCTION IF EXISTS ${fn}()`);
    }
  });
  it("refuses archived members and missing current-season participation without writing backfills", async () => {
    await db.update(playersTable).set({ memberStatus: "archived" }).where(eq(playersTable.id, a));
    expect((await view(chosen("section", "women", [a]))).status).toBe(409);
    await db.update(playersTable).set({ memberStatus: "active" }).where(eq(playersTable.id, a));
    await db.delete(playerParticipationsTable).where(and(eq(playerParticipationsTable.playerId, a), eq(playerParticipationsTable.seasonId, seasonId)));
    expect((await view(chosen("section", "women", [a]))).status).toBe(409);
    expect(await participation(a)).toBeUndefined();
    await db.insert(playerParticipationsTable).values({ playerId: a, seasonId, membershipTier: "community_member", membershipSection: "men", amountDue: "125.00", teamId, source: "admin" });
  });
});
