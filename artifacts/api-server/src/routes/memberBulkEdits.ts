import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import { and, asc, desc, eq, inArray, lt, sql } from "drizzle-orm";
import { db, memberBulkEditsTable, playersTable, playerParticipationsTable, playerPaymentsTable, seasonsTable, teamsTable, type MemberBulkEdit } from "@workspace/db";
import { PreviewMemberBulkEditBody, ApplyMemberBulkEditBody, PreviewMemberBulkEditResponse, ApplyMemberBulkEditResponse, ListMemberBulkEditHistoryResponse } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { getSessionLabel } from "../middleware/adminSession";
import { MEMBERSHIP_CATEGORIES, membershipCategoryAmountDue, buildSeasonFeeAccount } from "../utils/membershipFees";

const router = Router();
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("x-session-token");
  next();
});
router.use(requireAdminAccess);
const ids = z.array(z.number().int().positive()).min(1).max(500).refine(v => new Set(v).size === v.length);
const previewBody = PreviewMemberBulkEditBody.extend({ playerIds: ids }).strict();
const applyBody = ApplyMemberBulkEditBody.extend({
  playerIds: ids, requestId: z.string().uuid(), previewToken: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
type Selection = z.infer<typeof previewBody>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
class BulkEditError extends Error {
  constructor(readonly status: number, message: string) { super(message); }
}
function fail(message: string, status = 409): never { throw new BulkEditError(status, message); }
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function selection(b: Selection): Selection {
  const allowed: readonly string[] = b.field === "category" ? MEMBERSHIP_CATEGORIES : ["not_set", "men", "women"];
  if (!allowed.includes(b.value)) fail("Choose a supported value for this field.", 400);
  return { ...b, playerIds: [...b.playerIds].sort((a, c) => a - c) };
}
function result(batch: MemberBulkEdit) {
  return ApplyMemberBulkEditResponse.parse({
    batchId: batch.id, seasonId: batch.seasonId, seasonName: batch.seasonName,
    field: batch.field, value: batch.value, rows: batch.rows,
    changed: batch.changed, unchanged: batch.unchanged, total: batch.changed + batch.unchanged,
    actor: batch.actor, recordedAt: batch.recordedAt.toISOString(),
  });
}

// Preview never runs the broad membership backfill: reading a batch cannot
// change unselected members, custom fees, or historical participation.
async function preview(tx: Tx, b: Selection, lock: boolean) {
  const seasonQuery = tx.select().from(seasonsTable).where(and(
    eq(seasonsTable.kind, "membership"), eq(seasonsTable.isCurrent, true), eq(seasonsTable.status, "current"),
  )).orderBy(asc(seasonsTable.id));
  const seasons = await (lock ? seasonQuery.for("share") : seasonQuery);
  if (seasons.length !== 1) fail("A single current membership season is required. Reload Members before trying again.");
  const season = seasons[0];
  const playerQuery = tx.select().from(playersTable).where(inArray(playersTable.id, b.playerIds)).orderBy(asc(playersTable.id));
  // Parent FOR UPDATE also blocks new payment/participation FK inserts until
  // this transaction commits. Existing child records are locked separately.
  const players = await (lock ? playerQuery.for("update") : playerQuery);
  if (players.length !== b.playerIds.length) fail("A selected member no longer exists. Reload Members and preview again.");
  const participationQuery = tx.select().from(playerParticipationsTable).where(and(
    eq(playerParticipationsTable.seasonId, season.id), inArray(playerParticipationsTable.playerId, b.playerIds),
  )).orderBy(asc(playerParticipationsTable.playerId));
  const participations = await (lock ? participationQuery.for("update") : participationQuery);
  const paymentQuery = tx.select().from(playerPaymentsTable).where(and(
    eq(playerPaymentsTable.seasonId, season.id), inArray(playerPaymentsTable.playerId, b.playerIds),
  )).orderBy(asc(playerPaymentsTable.id));
  const payments = await (lock ? paymentQuery.for("update") : paymentQuery);
  const teamIds = [...new Set(participations.flatMap(p => p.teamId == null ? [] : [p.teamId]))].sort((a, c) => a - c);
  const teamQuery = tx.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)).orderBy(asc(teamsTable.id));
  const teams = teamIds.length ? await (lock ? teamQuery.for("share") : teamQuery) : [];
  const rows = players.map(player => {
    const p = participations.find(p => p.playerId === player.id);
    if (player.memberStatus === "archived" || p?.participationStatus === "archived")
      fail(`${player.name} is archived and cannot be included in current membership bulk edits.`);
    if (!p || p.membershipTier !== player.currentMembershipTier || p.membershipSection !== player.currentMembershipSection)
      fail(`${player.name}'s current membership record needs refreshing. Reload Members or save their individual profile, then preview again.`);
    const oldValue = (b.field === "category" ? player.currentMembershipTier : player.currentMembershipSection) ?? "not_set";
    const changed = oldValue !== b.value;
    const oldAmountDue = p.amountDue == null ? null : Number(p.amountDue);
    const newAmountDue = b.field === "category" && changed ? membershipCategoryAmountDue(b.value) : oldAmountDue;
    const memberPayments = payments.filter(payment => payment.playerId === player.id);
    const before = buildSeasonFeeAccount(season.id, oldAmountDue, memberPayments);
    const after = buildSeasonFeeAccount(season.id, newAmountDue, memberPayments);
    const team = teams.find(t => t.id === p.teamId);
    const removeSquad = b.field === "section" && changed && p.teamId != null && team?.membershipSection !== b.value;
    const customFee = b.field === "category" && changed && oldAmountDue !== membershipCategoryAmountDue(player.currentMembershipTier);
    const warnings: string[] = [];
    if (customFee) warnings.push("The existing nonstandard/custom amount due will be replaced by the selected category's fee.");
    if (removeSquad) warnings.push(`The incompatible current squad ${team?.name ?? `#${p.teamId}`} will be removed.`);
    return {
      playerId: player.id, name: player.name, oldValue, newValue: b.value, changed,
      oldAmountDue, newAmountDue, amountPaid: before.amountPaid, balanceBefore: before.balance, balanceAfter: after.balance,
      customFee, teamIdBefore: p.teamId, teamNameBefore: team?.name ?? null,
      teamIdAfter: removeSquad ? null : p.teamId, teamNameAfter: removeSquad ? null : team?.name ?? null, warnings,
    };
  });
  const changed = rows.filter(r => r.changed).length;
  // Exclude unrelated private profile data and season.updatedAt (which the
  // legacy foundation touches on reads). Include revisions and payment rows,
  // not just their total, so a replacement payment invalidates an old preview.
  const previewToken = hash({
    selection: b, season: { id: season.id, name: season.name, slug: season.slug, kind: season.kind, status: season.status, isCurrent: season.isCurrent },
    members: players.map(p => ({ id: p.id, name: p.name, tier: p.currentMembershipTier, section: p.currentMembershipSection, status: p.memberStatus, tierUpdatedAt: p.membershipTierUpdatedAt })),
    participations: participations.map(p => ({ id: p.id, playerId: p.playerId, tier: p.membershipTier, section: p.membershipSection, status: p.participationStatus, teamId: p.teamId, amountDue: p.amountDue, updatedAt: p.updatedAt })),
    payments: payments.map(p => ({ id: p.id, playerId: p.playerId, amount: p.amount, paymentDate: p.paymentDate, createdAt: p.createdAt })),
    teams: teams.map(t => ({ id: t.id, name: t.name, section: t.membershipSection })),
  });
  return PreviewMemberBulkEditResponse.parse({
    seasonId: season.id, seasonName: season.name, field: b.field, value: b.value,
    rows, changed, unchanged: rows.length - changed, total: rows.length, previewToken,
    warnings: b.field === "category" ? [
      "Changing category replaces only the current-season amount due with the selected category's fee; Trials and Awaiting Selection have no set fee.",
      "Recorded payments, payment dates, historical fees and squad selections stay unchanged. No payments, refunds or emails are created.",
    ] : [
      "Changing section leaves categories, fees, recorded payments and historical records unchanged.",
      "An incompatible current-season squad assignment will be removed as shown below.",
    ],
  });
}

router.post("/preview", async (req, res) => {
  const parsed = previewBody.safeParse(req.body);
  if (!parsed.success) fail("Select 1–500 distinct member IDs, one supported field and its target value.", 400);
  const b = selection(parsed.data!);
  const response = await db.transaction(tx => preview(tx, b, false), { isolationLevel: "repeatable read", accessMode: "read only" });
  res.json(response);
});
router.post("/apply", async (req, res) => {
  const parsed = applyBody.safeParse(req.body);
  if (!parsed.success) fail("A valid selection, reviewed preview and request ID are required.", 400);
  const input = parsed.data!;
  const b = selection({ playerIds: input.playerIds, field: input.field, value: input.value });
  const inputHash = hash({ selection: b, previewToken: input.previewToken });
  const token = req.headers["x-session-token"];
  const actor = typeof token === "string" ? await getSessionLabel(token) ?? "Full admin" : "Admin API key";
  const response = await db.transaction(async tx => {
    // Serialize duplicate submissions and the legacy read-path provisioning.
    // Lock order is stable: foundation, request, season, sorted members/children.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hk-masters-membership-foundation'))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"member-bulk-edit:" + input.requestId}))`);
    const [existing] = await tx.select().from(memberBulkEditsTable).where(eq(memberBulkEditsTable.requestId, input.requestId));
    if (existing) {
      if (existing.inputHash !== inputHash) fail("This request ID was already used for a different change. Preview again.");
      return result(existing);
    }
    const current = await preview(tx, b, true);
    if (current.previewToken !== input.previewToken) fail("Membership, fees, payments or squads have changed since preview. Preview and review the entire batch again.");
    if (!current.changed) fail("No selected members would change. Choose a different value.");
    const now = new Date();
    const changedIds = current.rows.filter(r => r.changed).map(r => r.playerId);
    const removeSquadIds = current.rows.filter(r => r.changed && r.teamIdBefore !== r.teamIdAfter).map(r => r.playerId);
    // Set-based writes keep even a 500-member operation to two updates, while
    // unchanged rows (including any custom dues) remain true no-ops.
    await tx.update(playersTable).set(b.field === "category"
      ? { currentMembershipTier: b.value, membershipTierUpdatedAt: now }
      : { currentMembershipSection: b.value })
      .where(inArray(playersTable.id, changedIds));
    await tx.update(playerParticipationsTable).set(b.field === "category"
      ? { membershipTier: b.value, amountDue: membershipCategoryAmountDue(b.value)?.toFixed(2) ?? null, updatedAt: now }
      : {
        membershipSection: b.value, updatedAt: now,
        teamId: sql`CASE WHEN ${inArray(playerParticipationsTable.playerId, removeSquadIds)} THEN NULL ELSE ${playerParticipationsTable.teamId} END`,
      }).where(and(inArray(playerParticipationsTable.playerId, changedIds), eq(playerParticipationsTable.seasonId, current.seasonId)));
    const [batch] = await tx.insert(memberBulkEditsTable).values({
      requestId: input.requestId, inputHash, seasonId: current.seasonId, seasonName: current.seasonName,
      field: b.field, value: b.value, actor, changed: current.changed, unchanged: current.unchanged, rows: current.rows,
    }).returning();
    return result(batch);
  });
  res.json(response);
});
router.get("/history", async (req, res) => {
  const parsed = z.object({ beforeId: z.coerce.number().int().positive().optional() }).strict().safeParse(req.query);
  if (!parsed.success) fail("Invalid history cursor.", 400);
  const batches = await db.select().from(memberBulkEditsTable)
    .where(parsed.data!.beforeId == null ? undefined : lt(memberBulkEditsTable.id, parsed.data!.beforeId))
    .orderBy(desc(memberBulkEditsTable.id)).limit(31);
  const page = batches.slice(0, 30);
  res.json(ListMemberBulkEditHistoryResponse.parse({
    items: page.map(result), nextBeforeId: batches.length > 30 ? page[page.length - 1].id : null,
  }));
});
router.use((error: unknown, _req: import("express").Request, res: import("express").Response, next: import("express").NextFunction) => {
  if (error instanceof BulkEditError) res.status(error.status).json({ error: error.message });
  else next(error);
});
export default router;
