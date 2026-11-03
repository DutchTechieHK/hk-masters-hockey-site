import { Router, type IRouter } from "express";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, memberGroupsTable, memberGroupMembersTable, eventGroupsTable, playersTable, teamsTable } from "@workspace/db";
import { CreateMemberGroupBody, UpdateMemberGroupBody } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";

const router: IRouter = Router();
router.use(requireAdminAccess);
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

async function listGroups() {
  // A transaction keeps version and member IDs from different saves out of one response.
  return db.transaction(async (tx) => {
    const groups = await tx.select().from(memberGroupsTable).orderBy(asc(memberGroupsTable.name)).for("share");
    const memberships = await tx.select().from(memberGroupMembersTable);
    const links = await tx.select().from(eventGroupsTable);
    return groups.map((group) => ({
      id: group.id, name: group.name, description: group.description, version: group.version,
      memberIds: memberships.filter((m) => m.groupId === group.id).map((m) => m.playerId),
      eventCount: links.filter((link) => link.groupId === group.id).length,
    }));
  });
}

router.get("/", async (_req, res) => { res.json(await listGroups()); });

router.get("/members", async (_req, res) => {
  const members = await db.select({
    id: playersTable.id, name: playersTable.name, memberStatus: playersTable.memberStatus,
    membershipSection: playersTable.currentMembershipSection, teamName: teamsTable.name,
  }).from(playersTable).leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id)).orderBy(asc(playersTable.name));
  res.json(members);
});

router.post("/", async (req, res) => {
  const parsed = CreateMemberGroupBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "A name and valid member IDs are required" }); return; }
  const name = parsed.data.name.trim();
  const memberIds = [...new Set(parsed.data.memberIds)];
  if (!name || memberIds.some((id) => !Number.isSafeInteger(id))) {
    res.status(400).json({ error: "A name and integer member IDs are required" }); return;
  }
  const result = await db.transaction(async (tx) => {
    const found = memberIds.length ? await tx.select({ id: playersTable.id }).from(playersTable).where(inArray(playersTable.id, memberIds)).for("key share") : [];
    if (found.length !== memberIds.length) return null;
    const [group] = await tx.insert(memberGroupsTable).values({ name, description: parsed.data.description?.trim() || null }).returning();
    if (memberIds.length) await tx.insert(memberGroupMembersTable).values(memberIds.map((playerId) => ({ groupId: group.id, playerId })));
    return { id: group.id, name, description: group.description, version: group.version, memberIds, eventCount: 0 };
  });
  if (!result) { res.status(400).json({ error: "One or more selected members no longer exist" }); return; }
  res.status(201).json(result);
});

router.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const parsed = UpdateMemberGroupBody.safeParse(req.body);
  if (!Number.isSafeInteger(id) || id <= 0 || !parsed.success) { res.status(400).json({ error: "Invalid group, members or version" }); return; }
  const name = parsed.data.name.trim();
  const memberIds = [...new Set(parsed.data.memberIds)];
  if (!name || !Number.isSafeInteger(parsed.data.version) || memberIds.some((n) => !Number.isSafeInteger(n))) {
    res.status(400).json({ error: "A name, integer version and integer member IDs are required" }); return;
  }
  const result = await db.transaction(async (tx) => {
    const found = memberIds.length ? await tx.select({ id: playersTable.id }).from(playersTable).where(inArray(playersTable.id, memberIds)).for("key share") : [];
    if (found.length !== memberIds.length) return { error: "One or more selected members no longer exist", status: 400 } as const;
    const [group] = await tx.update(memberGroupsTable).set({
      name, description: parsed.data.description?.trim() || null, version: sql`${memberGroupsTable.version} + 1`,
    }).where(and(eq(memberGroupsTable.id, id), eq(memberGroupsTable.version, parsed.data.version))).returning();
    if (!group) return { error: "This group changed or was deleted. Reload before saving.", status: 409 } as const;
    await tx.delete(memberGroupMembersTable).where(eq(memberGroupMembersTable.groupId, id));
    if (memberIds.length) await tx.insert(memberGroupMembersTable).values(memberIds.map((playerId) => ({ groupId: id, playerId })));
    const links = await tx.select().from(eventGroupsTable).where(eq(eventGroupsTable.groupId, id));
    return { group: { id, name, description: group.description, version: group.version, memberIds, eventCount: links.length } };
  });
  if (result.error !== undefined) { res.status(result.status!).json({ error: result.error }); return; }
  res.json(result.group);
});

router.delete("/:id", async (req, res) => {
  const id = Number(req.params.id);
  const version = Number(req.query.version);
  if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(version) || version <= 0) {
    res.status(400).json({ error: "Valid group ID and version required" }); return;
  }
  const result = await db.transaction(async (tx) => {
    // Event writes lock referenced groups before inserting links. Deletion cannot
    // race an assignment and turn a restricted event into an all-members event.
    const [group] = await tx.select().from(memberGroupsTable).where(eq(memberGroupsTable.id, id)).for("update");
    if (!group || group.version !== version) return "This group changed or was deleted. Reload before deleting.";
    const linked = await tx.select().from(eventGroupsTable).where(eq(eventGroupsTable.groupId, id)).limit(1);
    if (linked.length) return "This group is used by events. Change those event audiences before deleting it.";
    await tx.delete(memberGroupsTable).where(eq(memberGroupsTable.id, id));
    return null;
  });
  if (result) { res.status(409).json({ error: result }); return; }
  res.status(204).send();
});

export default router;
