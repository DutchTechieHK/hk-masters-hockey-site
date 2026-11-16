import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { and, eq, inArray, like } from "drizzle-orm";
import {
  db, pool, membershipCategoriesTable, playersTable, teamsTable, seasonsTable,
  playerParticipationsTable, playerPaymentsTable, memberBulkEditsTable,
  membershipInterestSubmissionsTable, adminSessionsTable, playerSessionsTable, staffSessionsTable,
} from "@workspace/db";
import { createSession } from "../middleware/adminSession";
import { createPlayerSession } from "../middleware/playerSession";
import { CreatePlayerBody, UpdatePlayerBody, ListPlayersResponse, ImportMembershipInterestSubmissionsBody } from "@workspace/api-zod";
import { seedMissingCategories } from "../utils/membershipCategories";

vi.mock("../utils/email", () => ({}));
vi.mock("../utils/push", () => ({ sendPushToPlayers: vi.fn(async () => {}) }));
const { default: app } = await import("../app");
const tag = `catalogue-test-${randomUUID()}`;
let admin: string, playerToken: string, staff: string, teamId: number, seasonId: number;
const members: number[] = [];
const keys: string[] = [];
const api = (method: "get" | "post" | "put" | "patch", path: string, body?: object, token = admin) =>
  request(app)[method](`/api${path}`).set("x-session-token", token).send(body);
const catalogue = () => api("get", "/membership-categories");
const create = (name: string, defaultFee: number | null) => api("post", "/membership-categories", { name, defaultFee });
const edit = (row: any, changes: object) => api("patch", `/membership-categories/${row.key}`, {
  name: row.name, defaultFee: row.defaultFee, retired: row.retired, version: row.version, ...changes,
});
const part = async (playerId: number) => (await db.select().from(playerParticipationsTable)
  .where(and(eq(playerParticipationsTable.playerId, playerId), eq(playerParticipationsTable.seasonId, seasonId))))[0];
const playerBody = (name: string, tier = "awaiting_selection") => ({
  name, email: `${randomUUID()}@example.invalid`, teamId,
  currentMembershipTier: tier, currentMembershipSection: "men",
});
async function newMember(tier = "awaiting_selection") {
  const response = await api("post", "/players", playerBody(`${tag}-${members.length}`, tier));
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  members.push(response.body.id);
  return response.body;
}
beforeAll(async () => {
  admin = await createSession(tag);
  const [team] = await db.insert(teamsTable).values({
    name: tag, category: "Men", membershipSection: "men", managerName: "", managerEmail: "", managerPhone: "",
  }).returning();
  teamId = team.id;
  expect((await api("post", "/players/membership/initialize", {})).status).toBe(200);
  seasonId = (await db.select().from(seasonsTable).where(eq(seasonsTable.slug, "membership-2026-27")))[0].id;
});
afterAll(async () => {
  await db.delete(memberBulkEditsTable).where(eq(memberBulkEditsTable.actor, tag));
  if (members.length) {
    await db.delete(membershipInterestSubmissionsTable).where(inArray(membershipInterestSubmissionsTable.matchedPlayerId, members));
    await db.delete(playerPaymentsTable).where(inArray(playerPaymentsTable.playerId, members));
    await db.delete(playerSessionsTable).where(inArray(playerSessionsTable.playerId, members));
    await db.delete(staffSessionsTable).where(inArray(staffSessionsTable.playerId, members));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, members));
    await db.delete(playersTable).where(inArray(playersTable.id, members));
  }
  await db.delete(membershipInterestSubmissionsTable).where(like(membershipInterestSubmissionsTable.submittedName, `${tag}%`));
  if (keys.length) await db.delete(membershipCategoriesTable).where(inArray(membershipCategoriesTable.key, keys));
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, admin));
});

describe("membership category catalogue", () => {
  let custom: any;
  it("seeds only existing categories, with the new league label and unchanged team", async () => {
    const response = await catalogue();
    expect(response.status).toBe(200);
    expect(response.body.find((c: any) => c.key === "masters_division_one")).toMatchObject({ name: "League Player", defaultFee: 500 });
    const league = await db.select().from(teamsTable).where(eq(teamsTable.name, "Masters Div. 1"));
    expect(league).toHaveLength(1);
  });
  it("creates named categories with immutable generated string keys and nullable/zero fees", async () => {
    for (const fee of [null, 0, 245.75]) {
      const response = await create(`${tag}-${fee}`, fee);
      expect(response.status, JSON.stringify(response.body)).toBe(201);
      keys.push(response.body.key);
      expect(response.body).toMatchObject({ defaultFee: fee, retired: false, protected: false, version: 1 });
      custom = response.body;
    }
  });
  it("rejects blank/duplicate names, negative/imprecise/invalid fees and key edits", async () => {
    for (const body of [
      { name: " \t ", defaultFee: null }, { name: `${tag}-invalid`, defaultFee: -1 },
      { name: `${tag}-invalid`, defaultFee: 1.111 }, { name: `${tag}-invalid`, defaultFee: "500" },
      { name: `${tag}-invalid`, defaultFee: 100000000 },
      { name: `  ${custom.name.toUpperCase()}  `, defaultFee: 0 },
      { name: `${tag}-invalid` },
    ]) expect((await api("post", "/membership-categories", body)).status).toBe(400);
    expect((await edit(custom, { key: "replacement" })).status).toBe(400);
  });
  it("normalizes duplicate internal whitespace", async () => {
    const response = await create(`${tag}  multiple spaces`, null);
    keys.push(response.body.key);
    expect(response.status).toBe(201);
    expect((await create(`${tag} \t multiple   spaces`, 0)).status).toBe(400);
  });
  it("round-trips custom keys without stripping unrelated request/response fields", async () => {
    const body = { ...playerBody(tag, custom.key), nationality: "HK", passportCopyUrl: "/api/test-copy",
      passportCopyReviewed: true, hkidCopyUrl: "/api/test-hkid", insurancePolicyHolder: tag, notes: tag };
    expect(CreatePlayerBody.parse(body)).toMatchObject(body);
    expect(UpdatePlayerBody.parse(body)).toMatchObject(body);
    expect(ImportMembershipInterestSubmissionsBody.parse({ submissions: [{ name: tag, email: "test@example.invalid", membershipTier: custom.key }] }).submissions[0].membershipTier).toBe(custom.key);
    const created = await api("post", "/players", body);
    expect(created.status, JSON.stringify(created.body)).toBe(201);
    members.push(created.body.id);
    expect(created.body.currentMembershipTier).toBe(custom.key);
    expect((await part(created.body.id)).amountDue).toBe("245.75");
    const directory = await api("get", "/players");
    expect(directory.status).toBe(200);
    const listed = directory.body.find((p: any) => p.id === created.body.id);
    // Exercise the changed response contract without the unrelated, pre-existing
    // optional-versus-null mismatch on legacy travel fields.
    expect(ListPlayersResponse.element.pick({
      currentMembershipTier: true, passportCopyUrl: true, nationality: true, notes: true, membershipFeeAmountDue: true,
    }).parse(listed)).toMatchObject({
      currentMembershipTier: custom.key, passportCopyUrl: "/api/test-copy", nationality: "HK", notes: tag,
      membershipFeeAmountDue: 245.75,
    });
  });
  it("rejects missing/retired categories but allows unchanged retired members to save unrelated data", async () => {
    const player = await newMember(custom.key);
    expect((await api("post", "/players", playerBody(tag, "unknown-category"))).status).toBe(400);
    custom = (await edit(custom, { retired: true })).body;
    expect(custom.retired).toBe(true);
    expect((await api("post", "/players", playerBody(tag, custom.key))).status).toBe(400);
    await db.update(playerParticipationsTable).set({ amountDue: "777.00" }).where(eq(playerParticipationsTable.playerId, player.id));
    const updated = await api("put", `/players/${player.id}`, { ...playerBody(player.name, custom.key), email: player.email, notes: "unrelated" });
    expect(updated.status, JSON.stringify(updated.body)).toBe(200);
    expect(await part(player.id)).toMatchObject({ membershipTier: custom.key, amountDue: "777.00" });
    expect((await catalogue()).body.find((r: any) => r.key === custom.key)).toMatchObject({ retired: true });
    custom = (await edit(custom, { retired: false })).body;
    expect((await newMember(custom.key)).currentMembershipTier).toBe(custom.key);
  });
  it("rejects stale simultaneous saves without overwriting the winning change", async () => {
    const [first, second] = await Promise.all([edit(custom, { name: `${tag}-renamed` }), edit(custom, { defaultFee: 999 })]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    custom = (first.status === 200 ? first : second).body;
    expect(custom.version).toBeGreaterThan(1);
  });
  it("keeps automated onboarding categories active", async () => {
    const rows = (await catalogue()).body;
    for (const key of ["trials", "awaiting_selection"]) {
      const protectedRow = rows.find((c: any) => c.key === key);
      expect(protectedRow.protected).toBe(true);
      expect((await edit(protectedRow, { retired: true })).status).toBe(400);
    }
  });
  it("applies new defaults prospectively, preserving assignments, dues, payments, teams and history", async () => {
    const player = await newMember(custom.key);
    await db.update(playerParticipationsTable).set({ amountDue: "123.45", teamId }).where(and(
      eq(playerParticipationsTable.playerId, player.id), eq(playerParticipationsTable.seasonId, seasonId)));
    await db.insert(playerPaymentsTable).values({ playerId: player.id, seasonId, amount: "88.00", paymentDate: "2026-11-01" });
    const before = {
      member: await db.select().from(playersTable).where(eq(playersTable.id, player.id)),
      parts: await db.select().from(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, player.id)),
      payments: await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, player.id)),
    };
    custom = (await edit(custom, { defaultFee: 432.10, name: `${tag}-final` })).body;
    expect(await db.select().from(playersTable).where(eq(playersTable.id, player.id))).toEqual(before.member);
    expect(await db.select().from(playerParticipationsTable).where(eq(playerParticipationsTable.playerId, player.id))).toEqual(before.parts);
    expect(await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, player.id))).toEqual(before.payments);
    await api("put", `/players/${player.id}`, { ...playerBody(player.name, custom.key), email: player.email });
    expect((await part(player.id)).amountDue).toBe("123.45");
    const prospective = await newMember(custom.key);
    expect((await part(prospective.id)).amountDue).toBe("432.10");
    playerToken = await createPlayerSession(player.id);
    const me = await request(app).get("/api/player-auth/me").set("x-player-session", playerToken);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject({ currentMembershipCategoryName: custom.name, currentMembershipTier: custom.key, membershipFeeAmountDue: 123.45 });
    expect(me.headers["cache-control"]).toContain("no-store");
    const self = await request(app).get(`/api/players/self/${before.member[0].accessToken}`);
    expect(self.status).toBe(200);
    expect(self.body.paymentAmountDue).toBe(123.45);
  });
  it("requires fresh bulk confirmation after a default or availability change", async () => {
    const player = await newMember();
    const selection = { playerIds: [player.id], field: "category", value: custom.key };
    const preview = () => api("post", "/member-bulk-edits/preview", selection);
    const apply = (previewToken: string) => api("post", "/member-bulk-edits/apply", { ...selection, previewToken, requestId: randomUUID() });
    const first = await preview();
    expect(first.status).toBe(200);
    custom = (await edit(custom, { defaultFee: 321.99 })).body;
    expect((await apply(first.body.previewToken)).status).toBe(409);
    const fresh = await preview();
    expect(fresh.body.rows[0].newAmountDue).toBe(321.99);
    expect((await apply(fresh.body.previewToken)).status).toBe(200);
    expect(await part(player.id)).toMatchObject({ membershipTier: custom.key, amountDue: "321.99" });
    const other = await newMember();
    const otherSelection = { ...selection, playerIds: [other.id] };
    const old = await api("post", "/member-bulk-edits/preview", otherSelection);
    custom = (await edit(custom, { retired: true })).body;
    expect((await api("post", "/member-bulk-edits/apply", { ...otherSelection, previewToken: old.body.previewToken, requestId: randomUUID() })).status).toBe(409);
    expect((await part(other.id)).membershipTier).toBe("awaiting_selection");
    custom = (await edit(custom, { retired: false })).body;
  });
  it("supports dynamic categories in imports and explicit resolution without resetting same-category dues", async () => {
    const player = await newMember();
    const input = { name: `${tag}-import`, email: player.email, membershipTier: custom.key, membershipSection: "men" };
    expect((await api("post", "/players/membership/interest-submissions", { submissions: [input] })).body.matched).toBe(1);
    expect((await part(player.id)).membershipTier).toBe(custom.key);
    await db.update(playerParticipationsTable).set({ amountDue: "765.00" }).where(eq(playerParticipationsTable.playerId, player.id));
    await api("post", "/players/membership/interest-submissions", { submissions: [input] });
    expect((await part(player.id)).amountDue).toBe("765.00");
    const unmatched = { ...input, name: `${tag}-resolve`, email: `${randomUUID()}@example.invalid` };
    expect((await api("post", "/players/membership/interest-submissions", { submissions: [unmatched] })).body.needsReview).toBe(1);
    const [submission] = await db.select().from(membershipInterestSubmissionsTable).where(eq(membershipInterestSubmissionsTable.submittedEmail, unmatched.email));
    const target = await newMember();
    expect((await api("patch", `/players/membership/interest-submissions/${submission.id}`, { playerId: target.id, membershipTier: custom.key })).status).toBe(200);
    expect((await part(target.id)).membershipTier).toBe(custom.key);
  });
  it("denies anonymous, player and restricted staff management access", async () => {
    const playerId = members[0];
    staff = randomUUID();
    await db.insert(staffSessionsTable).values({ playerId, token: staff, expiresAt: new Date(Date.now() + 60000) });
    for (const method of ["get", "post", "patch"] as const) {
      const path = method === "patch" ? `/membership-categories/${custom.key}` : "/membership-categories";
      for (const token of ["", staff, playerToken]) {
        const response = await api(method, path, { name: tag, defaultFee: 1 }, token);
        expect([401, 403]).toContain(response.status);
      }
    }
    expect((await request(app).get("/api/membership-categories").set("x-player-session", playerToken)).status).toBe(401);
  });
  it("repeats seed and deployment SQL without overwriting edited defaults or custom categories", async () => {
    const before = (await catalogue()).body;
    await seedMissingCategories(db);
    const migration = await readFile(new URL("../../../../lib/db/migrations/20261116_membership_categories.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query(migration);
    expect((await catalogue()).body).toEqual(before);
  });
});
