import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  CreateTeamBody,
  UpdateTeamBody,
  UpdateTeamParams,
  DeleteTeamParams,
} from "@workspace/api-zod";
import { hasAdminAccess, requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

function mapTeam(t: typeof teamsTable.$inferSelect) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    managerName: t.managerName,
    managerEmail: t.managerEmail,
    managerPhone: t.managerPhone,
    assistantManagerName: t.assistantManagerName,
    assistantManagerContact: t.assistantManagerContact,
    whatsappGroupLink: t.whatsappGroupLink,
    targetPlayerCount: t.targetPlayerCount,
    kitNotes: t.kitNotes,
    notes: t.notes,
    coachName: t.coachName,
    captainName: t.captainName,
    description: t.description,
    createdAt: t.createdAt?.toISOString(),
  };
}

function mapTeamPublic(t: typeof teamsTable.$inferSelect, playerCount: number) {
  return {
    id: t.id,
    name: t.name,
    category: t.category,
    managerName: t.managerName || null,
    coachName: t.coachName || null,
    captainName: t.captainName || null,
    description: t.description || null,
    playerCount,
  };
}

router.get("/", async (req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  const isAdmin = await hasAdminAccess(req);
  if (isAdmin) {
    return res.json(teams.map(mapTeam));
  }
  // For public: include live player counts
  const counts = await db
    .select({ teamId: playersTable.teamId, count: sql<number>`count(*)::int` })
    .from(playersTable)
    .groupBy(playersTable.teamId);
  const countMap = new Map(counts.map((r) => [r.teamId, r.count]));
  return res.json(teams.map((t) => mapTeamPublic(t, countMap.get(t.id) ?? 0)));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  const [team] = await db.insert(teamsTable).values(body as any).returning();
  res.status(201).json(mapTeam(team));
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateTeamParams.parse(req.params);
  const body = UpdateTeamBody.parse(req.body);
  const [team] = await db.update(teamsTable).set(body as any).where(eq(teamsTable.id, id)).returning();
  res.json(mapTeam(team));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteTeamParams.parse(req.params);
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

export default router;
