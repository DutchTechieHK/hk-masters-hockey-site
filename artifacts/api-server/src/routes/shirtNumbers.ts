import { Router } from "express";
import { db, playersTable, teamsTable, seasonsTable, shirtContextsTable, shirtAssignmentsTable, shirtAuditTable, worldCupPlayerSnapshotsTable } from "@workspace/db";
import { and, eq, desc, ne, sql } from "drizzle-orm";
import { CreateShirtContextBody, ChangePlayerShirtNumberBody } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { getSessionLabel } from "../middleware/adminSession";
import { StaffAccessError } from "../middleware/staffAccess";
import { shirtAssignments } from "../utils/shirtNumbers";

const router = Router();
router.use(requireAdminAccess);
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); res.vary("x-session-token"); next(); });
const fail = (code: number, message: string): never => { throw new StaffAccessError(code, message); };
const positive = (v: unknown) => typeof v === "number" && Number.isSafeInteger(v) && v > 0;
function date(v: unknown): string | null {
  if (v == null || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(new Date(v + "T00:00:00Z").getTime()) || new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v)
    fail(400, "Use a valid YYYY-MM-DD date or leave it unknown.");
  return v as string;
}
async function history(playerId: number, warnings: string[] = []) {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) fail(404, "Member not found.");
  const [assignments, audit, snapshots] = await Promise.all([
    shirtAssignments([playerId]),
    db.select().from(shirtAuditTable).where(eq(shirtAuditTable.playerId, playerId)).orderBy(desc(shirtAuditTable.id)),
    db.select().from(worldCupPlayerSnapshotsTable).where(eq(worldCupPlayerSnapshotsTable.playerId, playerId)),
  ]);
  const current = assignments.filter((a) => a.status === "current");
  if (current.length) {
    const others = await db.select({ assignment: shirtAssignmentsTable, name: playersTable.name })
      .from(shirtAssignmentsTable).innerJoin(playersTable, eq(playersTable.id, shirtAssignmentsTable.playerId))
      .where(and(ne(shirtAssignmentsTable.playerId, playerId), eq(shirtAssignmentsTable.status, "current")));
    for (const a of current) {
      const names = others.filter(({ assignment: o }) => o.contextId === a.contextId && o.teamId === a.teamId && o.number === a.number).map((o) => o.name);
      if (names.length) warnings.push(`#${a.number} in ${a.contextName} / ${a.teamName} is also current for ${names.join(", ")}.`);
    }
  }
  return {
    revision: player.shirtNumberRevision, legacyNumber: player.shirtNumberLegacyResolved ? null : player.shirtNumber,
    assignments, audit: audit.map(({ before: _b, after: _a, ...a }) => ({ ...a, recordedAt: a.recordedAt.toISOString() })),
    archiveEvidence: snapshots.flatMap((s) => {
      const snap = s.snapshot as Record<string, unknown>;
      const number = snap.shirt_number ?? snap.shirtNumber;
      return typeof number === "number" ? [`Rotterdam Masters World Cup 2026: #${number}. Immutable campaign snapshot; effective dates unknown. Recorded ${s.capturedAt.toISOString()}.`] : [];
    }), warnings: [...new Set(warnings)],
  };
}

router.get("/contexts", async (_req, res) => {
  const [contexts, seasons, teams] = await Promise.all([
    db.select().from(shirtContextsTable).orderBy(shirtContextsTable.name),
    db.select({ id: seasonsTable.id, name: seasonsTable.name, kind: seasonsTable.kind }).from(seasonsTable),
    db.select({ id: teamsTable.id, name: teamsTable.name }).from(teamsTable).where(eq(teamsTable.isInternal, false)).orderBy(teamsTable.name),
  ]);
  res.json({ contexts, seasons, teams });
});
router.post("/contexts", async (req, res) => {
  const parsed = CreateShirtContextBody.safeParse(req.body);
  if (!parsed.success) fail(400, "A competition name and kind are required.");
  const b = parsed.data!;
  const name = b.name.trim();
  if (!name || (b.seasonId != null && !positive(b.seasonId))) fail(400, "Invalid competition or season.");
  const [season] = b.seasonId ? await db.select().from(seasonsTable).where(eq(seasonsTable.id, b.seasonId)) : [];
  if (b.seasonId && !season) fail(400, "Season not found.");
  if (season && ((season.kind === "membership") !== (b.kind === "league"))) fail(400, "Membership seasons use league contexts; event seasons use tournament contexts.");
  const [row] = await db.insert(shirtContextsTable).values({
    name, kind: b.kind, seasonId: season?.id ?? null, seasonName: season?.name ?? null,
  }).onConflictDoNothing().returning();
  if (!row) fail(409, "This competition or season context already exists. Reload the choices.");
  res.status(201).json(row);
});
router.get("/players/:playerId", async (req, res) => {
  const id = Number(req.params.playerId);
  if (!positive(id)) fail(400, "Invalid member.");
  res.json(await history(id));
});
router.post("/players/:playerId", async (req, res) => {
  const playerId = Number(req.params.playerId);
  const parsed = ChangePlayerShirtNumberBody.safeParse(req.body);
  if (!positive(playerId) || !parsed.success) fail(400, "Invalid number change.");
  const b = parsed.data!;
  if (!Number.isSafeInteger(b.revision) || b.revision < 0 || (b.number !== undefined && (!positive(b.number) || b.number > 99))) fail(400, "Invalid revision or number.");
  for (const id of [b.contextId, b.teamId, b.assignmentId]) if (id !== undefined && !positive(id)) fail(400, "Invalid identifier.");
  const reason = b.reason?.trim() || null;
  if (["correct", "void", "dismiss_legacy"].includes(b.action) && !reason) fail(400, "A correction reason is required.");
  const actor = typeof req.headers["x-session-token"] === "string"
    ? await getSessionLabel(req.headers["x-session-token"]) ?? "Full admin" : "Admin API key";
  const warnings = await db.transaction(async (tx) => {
    await tx.execute(sql`SELECT id FROM players WHERE id = ${playerId} FOR UPDATE`);
    const [p] = await tx.select().from(playersTable).where(eq(playersTable.id, playerId));
    if (!p) fail(404, "Member not found.");
    if (p.shirtNumberRevision !== b.revision) fail(409, "Shirt history changed. Reload and review before saving.");
    let before: unknown = null;
    let after: unknown = null;
    let changed: typeof shirtAssignmentsTable.$inferSelect | undefined;
    if (b.action === "dismiss_legacy") {
      if (p.shirtNumberLegacyResolved || p.shirtNumber == null) fail(409, "No unresolved legacy number remains.");
      before = { legacyNumber: p.shirtNumber };
      await tx.update(playersTable).set({ shirtNumberLegacyResolved: true }).where(eq(playersTable.id, playerId));
      after = { legacyNumber: p.shirtNumber, resolved: true };
    } else if (b.action === "assign" || b.action === "history") {
      if (!positive(b.contextId) || !positive(b.teamId) || b.number === undefined) fail(400, "Select a competition, team and number.");
      const [context] = await tx.select().from(shirtContextsTable).where(eq(shirtContextsTable.id, b.contextId!));
      const [team] = await tx.select().from(teamsTable).where(eq(teamsTable.id, b.teamId!));
      if (!context || !team || team.isInternal) fail(400, "Competition or team is unavailable.");
      const startsOn = date(b.startsOn), endsOn = date(b.endsOn);
      if (startsOn && endsOn && endsOn < startsOn) fail(400, "End date cannot precede start date.");
      if (b.action === "assign" && endsOn) fail(400, "A current assignment cannot have an end date.");
      if (b.action === "assign") {
        const [current] = await tx.select().from(shirtAssignmentsTable).where(and(eq(shirtAssignmentsTable.playerId, playerId),
          eq(shirtAssignmentsTable.contextId, context.id), eq(shirtAssignmentsTable.teamId, team.id), eq(shirtAssignmentsTable.status, "current")));
        if (current) fail(409, "A current number already exists for this competition and team. Use Change.");
      }
      [changed] = await tx.insert(shirtAssignmentsTable).values({
        playerId, contextId: context.id, teamId: team.id, teamName: team.name, number: b.number!,
        status: b.action === "assign" ? "current" : "historical", startsOn, endsOn, notes: b.notes?.trim() || null,
      }).returning();
      after = changed;
    } else {
      if (!positive(b.assignmentId)) fail(400, "Select an assignment.");
      const [a] = await tx.select().from(shirtAssignmentsTable).where(and(eq(shirtAssignmentsTable.id, b.assignmentId!), eq(shirtAssignmentsTable.playerId, playerId)));
      if (!a || a.status === "void") fail(409, "Assignment is unavailable.");
      before = a;
      if (b.contextId !== undefined && b.contextId !== a.contextId || b.teamId !== undefined && b.teamId !== a.teamId)
        fail(400, "A correction cannot move an assignment. Void it and add the correct context.");
      if (b.action === "change") {
        if (a.status !== "current" || b.number === undefined) fail(400, "Select a current assignment and a new number.");
        if (b.number === a.number) fail(400, "Choose a different number, or use Correct for metadata.");
        if (b.endsOn != null && b.endsOn !== "") fail(400, "A new current assignment cannot have an end date.");
        const startsOn = date(b.startsOn);
        if (startsOn && a.startsOn && startsOn < a.startsOn) fail(400, "New assignment cannot begin before the previous assignment.");
        await tx.update(shirtAssignmentsTable).set({ status: "historical", endsOn: startsOn }).where(eq(shirtAssignmentsTable.id, a.id));
        [changed] = await tx.insert(shirtAssignmentsTable).values({
          playerId, contextId: a.contextId, teamId: a.teamId, teamName: a.teamName, number: b.number!,
          status: "current", startsOn, notes: b.notes?.trim() || null,
        }).returning();
        after = { closed: { ...a, status: "historical", endsOn: startsOn }, created: changed };
      } else {
        const startsOn = b.startsOn === undefined ? a.startsOn : date(b.startsOn);
        const endsOn = b.endsOn === undefined ? a.endsOn : date(b.endsOn);
        if (startsOn && endsOn && endsOn < startsOn) fail(400, "End date cannot precede start date.");
        if (b.action === "end" && a.status !== "current") fail(400, "Only a current assignment can be ended.");
        if (b.action === "correct" && a.status === "current" && endsOn) fail(400, "Use End to close a current assignment.");
        [changed] = await tx.update(shirtAssignmentsTable).set(b.action === "void" ? { status: "void" } :
          b.action === "end" ? { status: "historical", endsOn, notes: b.notes === undefined ? a.notes : b.notes?.trim() || null } :
          { number: b.number ?? a.number, startsOn, endsOn, notes: b.notes === undefined ? a.notes : b.notes?.trim() || null })
          .where(eq(shirtAssignmentsTable.id, a.id)).returning();
        after = changed;
      }
    }
    if (b.attributeLegacy) {
      if (!["assign", "history"].includes(b.action) || p.shirtNumberLegacyResolved || p.shirtNumber == null || changed?.number !== p.shirtNumber)
        fail(400, "Legacy attribution must use the unresolved original number.");
      await tx.update(playersTable).set({ shirtNumberLegacyResolved: true }).where(eq(playersTable.id, playerId));
    }
    await tx.update(playersTable).set({ shirtNumberRevision: p.shirtNumberRevision + 1 }).where(eq(playersTable.id, playerId));
    await tx.insert(shirtAuditTable).values({ playerId, actor, action: b.action, reason, before, after,
      detail: `${b.action}${changed ? ` #${changed.number}, assignment ${changed.id}, competition ${changed.contextId}, ${changed.teamName}` : " legacy number"}${b.attributeLegacy ? "; legacy context confirmed" : ""}` });
    if (!changed || changed.status !== "current") return [];
    const duplicates = await tx.select({ name: playersTable.name }).from(shirtAssignmentsTable)
      .innerJoin(playersTable, eq(playersTable.id, shirtAssignmentsTable.playerId))
      .where(and(eq(shirtAssignmentsTable.contextId, changed.contextId), eq(shirtAssignmentsTable.teamId, changed.teamId),
        eq(shirtAssignmentsTable.number, changed.number), eq(shirtAssignmentsTable.status, "current"), ne(shirtAssignmentsTable.playerId, playerId)));
    return duplicates.length ? [`#${changed.number} is also current for ${duplicates.map((d) => d.name).join(", ")} in this competition/team.`] : [];
  });
  res.json(await history(playerId, warnings));
});
export default router;
