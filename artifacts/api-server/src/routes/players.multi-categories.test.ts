import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { randomUUID } from "node:crypto";
import { and, eq, inArray } from "drizzle-orm";
import {
  db, membershipCategoriesTable, playersTable, teamsTable, seasonsTable, playerCategoriesTable,
  playerParticipationsTable, playerPaymentsTable, memberBulkEditsTable, adminSessionsTable,
} from "@workspace/db";
import { createSession } from "../middleware/adminSession";

vi.mock("../utils/email", () => ({}));
vi.mock("../utils/push", () => ({ sendPushToPlayers: vi.fn(async () => {}) }));
const { default: app } = await import("../app");
const { ensureMembershipFoundation } = await import("./players");
const { planCategoryChange } = await import("../utils/memberCategories");

const tag = `multi-category-test-${randomUUID()}`;
const LEAGUE = "masters_division_one"; // HK$500
const SOCIAL = "social_player"; // HK$300
const COMMUNITY = "community_member"; // HK$100
let admin: string, teamId: number, seasonId: number;
const members: number[] = [];
const keys: string[] = [];

const api = (method: "get" | "post" | "put" | "patch", path: string, body?: object) =>
  request(app)[method](`/api${path}`).set("x-session-token", admin).send(body);
const base = (name: string) => ({ name, email: `${randomUUID()}@example.invalid`, teamId, currentMembershipSection: "men" });
async function newMember(extra: object = {}) {
  const body = { ...base(`${tag}-${members.length}`), currentMembershipTier: "awaiting_selection", ...extra };
  const response = await api("post", "/players", body);
  expect(response.status, JSON.stringify(response.body)).toBe(201);
  members.push(response.body.id);
  return { body, member: response.body };
}
const save = (id: number, body: object, changes: object) => api("put", `/players/${id}`, { ...body, ...changes });
const storedRows = async (id: number) => (await db.select().from(playerCategoriesTable)
  .where(and(eq(playerCategoriesTable.playerId, id), eq(playerCategoriesTable.seasonId, seasonId)))
  .orderBy(playerCategoriesTable.id)).map((row) => row.categoryKey);
const record = async (id: number) => (await db.select().from(playersTable).where(eq(playersTable.id, id)))[0];
const due = async (id: number) => (await db.select().from(playerParticipationsTable)
  .where(and(eq(playerParticipationsTable.playerId, id), eq(playerParticipationsTable.seasonId, seasonId))))[0];
const listed = async (id: number) => ((await api("get", "/players")).body as any[]).find((row) => row.id === id);
const bulk = async (playerIds: number[], value: string) => {
  const selection = { playerIds, field: "category", value };
  const preview = await api("post", "/member-bulk-edits/preview", selection);
  if (preview.status !== 200) return { preview };
  const applied = await api("post", "/member-bulk-edits/apply", { ...selection, previewToken: preview.body.previewToken, requestId: randomUUID() });
  return { preview, applied };
};

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
    await db.delete(playerCategoriesTable).where(inArray(playerCategoriesTable.playerId, members));
    await db.delete(playerPaymentsTable).where(inArray(playerPaymentsTable.playerId, members));
    await db.delete(playerParticipationsTable).where(inArray(playerParticipationsTable.playerId, members));
    await db.delete(playersTable).where(inArray(playersTable.id, members));
  }
  if (keys.length) await db.delete(membershipCategoriesTable).where(inArray(membershipCategoriesTable.key, keys));
  await db.delete(teamsTable).where(eq(teamsTable.id, teamId));
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, admin));
});

describe("several membership categories per member", () => {
  it("creates a member with two categories: highest fee is the main category and the fee due", async () => {
    const { member } = await newMember({ membershipCategories: [COMMUNITY, LEAGUE] });
    expect(member.membershipCategories).toEqual([LEAGUE, COMMUNITY]);
    expect(member.currentMembershipTier).toBe(LEAGUE);
    expect(member.membershipFeeStandard).toBe(500);
    expect((await due(member.id)).amountDue).toBe("500.00");
    expect((await due(member.id)).membershipTier).toBe(LEAGUE);
    expect((await storedRows(member.id)).sort()).toEqual([COMMUNITY, LEAGUE].sort());
  });

  it("lists every category in the members list", async () => {
    expect((await listed(members[0])).membershipCategories).toEqual([LEAGUE, COMMUNITY]);
  });

  it("removing the highest category lowers the fee due and never touches payments", async () => {
    const { body, member } = await newMember({ membershipCategories: [LEAGUE, SOCIAL] });
    await db.insert(playerPaymentsTable).values({ playerId: member.id, seasonId, amount: "500.00", paymentDate: "2026-10-01" });
    const response = await save(member.id, body, { membershipCategories: [SOCIAL] });
    expect(response.status).toBe(200);
    expect(response.body.membershipCategories).toEqual([SOCIAL]);
    expect(response.body.currentMembershipTier).toBe(SOCIAL);
    expect((await due(member.id)).amountDue).toBe("300.00");
    const payments = await db.select().from(playerPaymentsTable).where(eq(playerPaymentsTable.playerId, member.id));
    expect(payments.map((payment) => payment.amount)).toEqual(["500.00"]);
    expect(response.body.membershipFeePaid).toBe(true);
  });

  it("keeps a fee that was set by hand when categories change, and reports the standard fee", async () => {
    const { body, member } = await newMember({ membershipCategories: [COMMUNITY] });
    const custom = await save(member.id, body, { membershipCategories: [COMMUNITY], membershipFeeAmountDue: 250 });
    expect(custom.body.membershipFeeAmountDue).toBe(250);

    // The form sends the unchanged fee back together with the new categories.
    const added = await save(member.id, body, { membershipCategories: [COMMUNITY, SOCIAL], membershipFeeAmountDue: 250 });
    expect(added.status).toBe(200);
    expect(added.body.membershipCategories).toEqual([SOCIAL, COMMUNITY]);
    expect(added.body.membershipFeeAmountDue).toBe(250);
    expect(added.body.membershipFeeStandard).toBe(300);
  });

  it("a fee typed in during the same save wins", async () => {
    const { body, member } = await newMember({ membershipCategories: [COMMUNITY] });
    const response = await save(member.id, body, { membershipCategories: [LEAGUE], membershipFeeAmountDue: 420 });
    expect(response.body.membershipFeeAmountDue).toBe(420);
    expect(response.body.membershipFeeStandard).toBe(500);
  });

  it("treats Awaiting Selection and Trials as a status that excludes real categories", async () => {
    const { body, member } = await newMember({ membershipCategories: [SOCIAL] });
    const onTrial = await save(member.id, body, { membershipCategories: [], currentMembershipTier: "trials" });
    expect(onTrial.body.membershipCategories).toEqual([]);
    expect(onTrial.body.currentMembershipTier).toBe("trials");
    expect(await storedRows(member.id)).toEqual([]);
    expect((await due(member.id)).amountDue).toBeNull();

    // Real categories replace the status, even if the status is sent along.
    const placed = await save(member.id, body, { membershipCategories: [COMMUNITY], currentMembershipTier: "trials" });
    expect(placed.body.membershipCategories).toEqual([COMMUNITY]);
    expect(placed.body.currentMembershipTier).toBe(COMMUNITY);

    // Removing the last category returns the member to Awaiting Selection.
    const emptied = await save(member.id, body, { membershipCategories: [], currentMembershipTier: COMMUNITY });
    expect(emptied.body.currentMembershipTier).toBe("awaiting_selection");
    expect(emptied.body.membershipCategories).toEqual([]);
  });

  it("an older single-category save still means exactly that one category", async () => {
    const { body, member } = await newMember({ membershipCategories: [LEAGUE, COMMUNITY] });
    // An older screen sends no list at all, only the single value.
    const { membershipCategories: _list, ...withoutList } = body as typeof body & { membershipCategories?: string[] };
    const response = await save(member.id, withoutList, { currentMembershipTier: SOCIAL });
    expect(response.status).toBe(200);
    expect(response.body.membershipCategories).toEqual([SOCIAL]);
    expect(await storedRows(member.id)).toEqual([SOCIAL]);
    expect((await due(member.id)).amountDue).toBe("300.00");
  });

  it("a stale single value sent next to a list does not sneak in as a category", async () => {
    const { body, member } = await newMember({ membershipCategories: [SOCIAL] });
    const response = await save(member.id, body, { membershipCategories: [LEAGUE], currentMembershipTier: SOCIAL });
    expect(response.body.membershipCategories).toEqual([LEAGUE]);
  });

  it("copies a category recorded the old way exactly once and follows older code paths", async () => {
    const { member } = await newMember();
    // Old code path: only the single value on the member record is written.
    await db.update(playersTable).set({ currentMembershipTier: SOCIAL }).where(eq(playersTable.id, member.id));
    expect((await listed(member.id)).membershipCategories).toEqual([SOCIAL]);
    await ensureMembershipFoundation();
    await ensureMembershipFoundation();
    expect(await storedRows(member.id)).toEqual([SOCIAL]);

    // Old code path moves the member to a status: the list empties.
    await db.update(playersTable).set({ currentMembershipTier: "trials" }).where(eq(playersTable.id, member.id));
    await ensureMembershipFoundation();
    expect(await storedRows(member.id)).toEqual([]);
  });

  it("upkeep never changes a fee and never drops a category from a multi-category member", async () => {
    const { member } = await newMember({ membershipCategories: [LEAGUE, COMMUNITY] });
    const before = await due(member.id);
    await ensureMembershipFoundation();
    expect((await storedRows(member.id)).sort()).toEqual([COMMUNITY, LEAGUE].sort());
    expect((await due(member.id)).amountDue).toBe(before.amountDue);
    expect((await record(member.id)).currentMembershipTier).toBe(LEAGUE);
  });

  it("refuses an unknown category and a newly added retired one, but keeps a retired one already held", async () => {
    const created = await api("post", "/membership-categories", { name: `${tag} retiring`, defaultFee: 50 });
    expect(created.status).toBe(201);
    keys.push(created.body.key);
    const { body, member } = await newMember({ membershipCategories: [created.body.key] });
    const retired = await api("patch", `/membership-categories/${created.body.key}`, {
      name: created.body.name, defaultFee: 50, retired: true, version: created.body.version,
    });
    expect(retired.status).toBe(200);

    const kept = await save(member.id, body, { membershipCategories: [created.body.key, COMMUNITY] });
    expect(kept.status).toBe(200);
    expect(kept.body.membershipCategories.sort()).toEqual([COMMUNITY, created.body.key].sort());

    const { body: otherBody, member: other } = await newMember();
    expect((await save(other.id, otherBody, { membershipCategories: [created.body.key] })).status).toBe(400);
    expect((await save(other.id, otherBody, { membershipCategories: ["no_such_category"] })).status).toBe(400);
    expect(await storedRows(other.id)).toEqual([]);
  });

  it("bulk edit adds a category to what each member already has", async () => {
    const first = await newMember({ membershipCategories: [LEAGUE] });
    const second = await newMember({ membershipCategories: [COMMUNITY] });
    const { preview, applied } = await bulk([first.member.id, second.member.id], `add:${COMMUNITY}`);
    expect(preview.status, JSON.stringify(preview.body)).toBe(200);
    expect(preview.body).toMatchObject({ changed: 1, unchanged: 1 });
    expect(preview.body.rows.find((row: any) => row.playerId === first.member.id))
      .toMatchObject({ oldValue: LEAGUE, newValue: `${LEAGUE},${COMMUNITY}`, oldAmountDue: 500, newAmountDue: 500, changed: true });
    expect(applied!.status, JSON.stringify(applied!.body)).toBe(200);
    expect((await storedRows(first.member.id)).sort()).toEqual([COMMUNITY, LEAGUE].sort());
    expect(await storedRows(second.member.id)).toEqual([COMMUNITY]);
    expect((await due(first.member.id)).amountDue).toBe("500.00");
  });

  it("bulk edit removes a category and the fee follows the highest one left", async () => {
    const { member } = await newMember({ membershipCategories: [LEAGUE, COMMUNITY] });
    const { preview, applied } = await bulk([member.id], `remove:${LEAGUE}`);
    expect(preview.body.rows[0]).toMatchObject({ oldValue: `${LEAGUE},${COMMUNITY}`, newValue: COMMUNITY, oldAmountDue: 500, newAmountDue: 100 });
    expect(applied!.status).toBe(200);
    expect(await storedRows(member.id)).toEqual([COMMUNITY]);
    expect((await record(member.id)).currentMembershipTier).toBe(COMMUNITY);

    const last = await bulk([member.id], `remove:${COMMUNITY}`);
    expect(last.applied!.status).toBe(200);
    expect((await record(member.id)).currentMembershipTier).toBe("awaiting_selection");
    expect(await storedRows(member.id)).toEqual([]);
    expect((await due(member.id)).amountDue).toBeNull();
  });

  it("bulk edit 'set' still replaces everything, and a status cannot be added or removed", async () => {
    const { member } = await newMember({ membershipCategories: [LEAGUE, COMMUNITY] });
    const set = await bulk([member.id], SOCIAL);
    expect(set.applied!.status).toBe(200);
    expect(await storedRows(member.id)).toEqual([SOCIAL]);
    expect((await due(member.id)).amountDue).toBe("300.00");
    expect((await bulk([member.id], "add:trials")).preview.status).toBe(400);
    expect((await bulk([member.id], "remove:awaiting_selection")).preview.status).toBe(400);
  });

  it("works out the plan without writing (fee rules)", () => {
    const catalogue = [
      { key: "awaiting_selection", defaultFee: null, protected: true, retired: false },
      { key: "a", defaultFee: "300.00", protected: false, retired: false },
      { key: "b", defaultFee: "300.00", protected: false, retired: false },
      { key: "free", defaultFee: null, protected: false, retired: false },
    ];
    const plan = (requested: string[], previous: string[], currentDue: number | null, currentTier = previous[0] ?? "awaiting_selection") =>
      planCategoryChange({ requested, previous, currentTier, currentDue, catalogue });
    // A tie on fee keeps the category held longest as the main one.
    expect(plan(["b", "a"], ["a"], 300).mainCategory).toBe("a");
    // A category without a fee never outranks one with a fee.
    expect(plan(["free", "a"], [], null)).toMatchObject({ mainCategory: "a", amountDue: 300 });
    // Only categories without a fee: no fee due.
    expect(plan(["free"], [], null)).toMatchObject({ mainCategory: "free", amountDue: null, standardFee: null });
    // Same list: nothing changes, not even a hand-set fee.
    expect(plan(["a"], ["a"], 123)).toMatchObject({ changed: false, amountDue: 123, customFeeKept: false });
  });
});
