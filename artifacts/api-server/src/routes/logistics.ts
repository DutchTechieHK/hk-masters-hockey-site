import { Router } from "express";
import { db } from "@workspace/db";
import { logisticsTable, teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateLogisticsTaskBody,
  UpdateLogisticsTaskBody,
  UpdateLogisticsTaskParams,
  DeleteLogisticsTaskParams,
  ListLogisticsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListLogisticsQueryParams.parse(req.query);
  let tasks;
  if (query.teamId) {
    tasks = await db
      .select({ task: logisticsTable, teamName: teamsTable.name })
      .from(logisticsTable)
      .leftJoin(teamsTable, eq(logisticsTable.teamId, teamsTable.id))
      .where(eq(logisticsTable.teamId, query.teamId))
      .orderBy(logisticsTable.id);
  } else {
    tasks = await db
      .select({ task: logisticsTable, teamName: teamsTable.name })
      .from(logisticsTable)
      .leftJoin(teamsTable, eq(logisticsTable.teamId, teamsTable.id))
      .orderBy(logisticsTable.id);
  }
  res.json(tasks.map(({ task, teamName }) => ({
    id: task.id,
    teamId: task.teamId,
    teamName: teamName ?? undefined,
    title: task.title,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    assignedTo: task.assignedTo,
    notes: task.notes,
    createdAt: task.createdAt?.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const body = CreateLogisticsTaskBody.parse(req.body);
  const insertData = {
    ...body,
    teamId: body.teamId ?? null,
  };
  const [task] = await db.insert(logisticsTable).values(insertData).returning();
  let teamName: string | undefined;
  if (task.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, task.teamId));
    teamName = team?.name;
  }
  res.status(201).json({
    id: task.id,
    teamId: task.teamId,
    teamName,
    title: task.title,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    assignedTo: task.assignedTo,
    notes: task.notes,
    createdAt: task.createdAt?.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateLogisticsTaskParams.parse(req.params);
  const body = UpdateLogisticsTaskBody.parse(req.body);
  const [task] = await db.update(logisticsTable).set(body).where(eq(logisticsTable.id, id)).returning();
  let teamName: string | undefined;
  if (task.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, task.teamId));
    teamName = team?.name;
  }
  res.json({
    id: task.id,
    teamId: task.teamId,
    teamName,
    title: task.title,
    category: task.category,
    status: task.status,
    dueDate: task.dueDate,
    assignedTo: task.assignedTo,
    notes: task.notes,
    createdAt: task.createdAt?.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteLogisticsTaskParams.parse(req.params);
  await db.delete(logisticsTable).where(eq(logisticsTable.id, id));
  res.status(204).send();
});

export default router;
