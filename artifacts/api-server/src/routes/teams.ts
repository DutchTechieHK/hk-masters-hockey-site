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

router.get("/", async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.json(teams.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    managerName: t.managerName,
    managerEmail: t.managerEmail,
    managerPhone: t.managerPhone,
    notes: t.notes,
    createdAt: t.createdAt?.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const body = CreateTeamBody.parse(req.body);
  const [team] = await db.insert(teamsTable).values(body).returning();
  res.status(201).json({
    id: team.id,
    name: team.name,
    category: team.category,
    managerName: team.managerName,
    managerEmail: team.managerEmail,
    managerPhone: team.managerPhone,
    notes: team.notes,
    createdAt: team.createdAt?.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateTeamParams.parse(req.params);
  const body = UpdateTeamBody.parse(req.body);
  const [team] = await db.update(teamsTable).set(body).where(eq(teamsTable.id, id)).returning();
  res.json({
    id: team.id,
    name: team.name,
    category: team.category,
    managerName: team.managerName,
    managerEmail: team.managerEmail,
    managerPhone: team.managerPhone,
    notes: team.notes,
    createdAt: team.createdAt?.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteTeamParams.parse(req.params);
  await db.delete(teamsTable).where(eq(teamsTable.id, id));
  res.status(204).send();
});

export default router;
