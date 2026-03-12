import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateTeamBody,
  UpdateTeamBody,
  UpdateTeamParams,
  DeleteTeamParams,
} from "@workspace/api-zod";

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
    createdAt: t.createdAt?.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.json(teams.map(mapTeam));
});

router.post("/", async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  const [team] = await db.insert(teamsTable).values(body as any).returning();
  res.status(201).json(mapTeam(team));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateTeamParams.parse(req.params);
  const body = UpdateTeamBody.parse(req.body);
  const [team] = await db.update(teamsTable).set(body as any).where(eq(teamsTable.id, id)).returning();
  res.json(mapTeam(team));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteTeamParams.parse(req.params);
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

export default router;
