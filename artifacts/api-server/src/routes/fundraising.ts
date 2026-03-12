import { Router } from "express";
import { db } from "@workspace/db";
import { fundraisingTable, teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateFundraisingBody,
  UpdateFundraisingBody,
  UpdateFundraisingParams,
  DeleteFundraisingParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (_req, res) => {
  const entries = await db
    .select({ f: fundraisingTable, teamName: teamsTable.name })
    .from(fundraisingTable)
    .leftJoin(teamsTable, eq(fundraisingTable.teamId, teamsTable.id))
    .orderBy(fundraisingTable.id);
  res.json(entries.map(({ f, teamName }) => ({
    id: f.id,
    donorName: f.donorName,
    amountPledged: parseFloat(f.amountPledged ?? "0"),
    amountReceived: parseFloat(f.amountReceived ?? "0"),
    date: f.date,
    teamId: f.teamId,
    teamName: teamName ?? undefined,
    status: f.status,
    notes: f.notes,
    createdAt: f.createdAt?.toISOString(),
  })));
});

router.post("/", async (req, res) => {
  const body = CreateFundraisingBody.parse(req.body);
  const [entry] = await db.insert(fundraisingTable).values({
    donorName: body.donorName,
    amountPledged: String(body.amountPledged),
    amountReceived: String(body.amountReceived),
    date: body.date,
    teamId: body.teamId,
    status: body.status,
    notes: body.notes,
  }).returning();
  let teamName: string | undefined;
  if (entry.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, entry.teamId));
    teamName = team?.name;
  }
  res.status(201).json({
    id: entry.id,
    donorName: entry.donorName,
    amountPledged: parseFloat(entry.amountPledged ?? "0"),
    amountReceived: parseFloat(entry.amountReceived ?? "0"),
    date: entry.date,
    teamId: entry.teamId,
    teamName,
    status: entry.status,
    notes: entry.notes,
    createdAt: entry.createdAt?.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateFundraisingParams.parse(req.params);
  const body = UpdateFundraisingBody.parse(req.body);
  const [entry] = await db.update(fundraisingTable).set({
    donorName: body.donorName,
    amountPledged: body.amountPledged !== undefined ? String(body.amountPledged) : undefined,
    amountReceived: body.amountReceived !== undefined ? String(body.amountReceived) : undefined,
    date: body.date,
    teamId: body.teamId,
    status: body.status,
    notes: body.notes,
  }).where(eq(fundraisingTable.id, id)).returning();
  let teamName: string | undefined;
  if (entry.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, entry.teamId));
    teamName = team?.name;
  }
  res.json({
    id: entry.id,
    donorName: entry.donorName,
    amountPledged: parseFloat(entry.amountPledged ?? "0"),
    amountReceived: parseFloat(entry.amountReceived ?? "0"),
    date: entry.date,
    teamId: entry.teamId,
    teamName,
    status: entry.status,
    notes: entry.notes,
    createdAt: entry.createdAt?.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteFundraisingParams.parse(req.params);
  await db.delete(fundraisingTable).where(eq(fundraisingTable.id, id));
  res.status(204).send();
});

export default router;
