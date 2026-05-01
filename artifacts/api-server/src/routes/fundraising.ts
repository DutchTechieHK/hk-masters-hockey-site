import { Router } from "express";
import { db } from "@workspace/db";
import { fundraisingTable, teamsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  CreateFundraisingBody,
  UpdateFundraisingBody,
  UpdateFundraisingParams,
  DeleteFundraisingParams,
} from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { sendPledgeReceivedEmail, sendNewPledgeEmail } from "../utils/email";

const router = Router();

router.get("/summary", async (_req, res) => {
  const [row] = await db
    .select({
      totalPledged: sql<string>`COALESCE(SUM(${fundraisingTable.amountPledged}), 0)`,
      totalReceived: sql<string>`COALESCE(SUM(${fundraisingTable.amountReceived}), 0)`,
      count: sql<number>`COUNT(*)`,
    })
    .from(fundraisingTable);
  res.json({
    totalPledged: parseFloat(row.totalPledged),
    totalReceived: parseFloat(row.totalReceived),
    count: Number(row.count),
  });
});

router.get("/", requireAdminAccess, async (_req, res) => {
  const entries = await db
    .select({ f: fundraisingTable, teamName: teamsTable.name })
    .from(fundraisingTable)
    .leftJoin(teamsTable, eq(fundraisingTable.teamId, teamsTable.id))
    .orderBy(fundraisingTable.id);
  res.json(entries.map(({ f, teamName }) => ({
    id: f.id,
    donorName: f.donorName,
    donorEmail: f.donorEmail ?? undefined,
    amountPledged: parseFloat(f.amountPledged ?? "0"),
    amountReceived: parseFloat(f.amountReceived ?? "0"),
    date: f.date,
    teamId: f.teamId,
    teamName: teamName ?? undefined,
    status: f.status,
    notes: f.notes,
    paidAt: f.paidAt?.toISOString(),
    createdAt: f.createdAt?.toISOString(),
  })));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateFundraisingBody.parse(req.body);
  const [entry] = await db.insert(fundraisingTable).values({
    donorName: body.donorName,
    donorEmail: body.donorEmail,
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
  if (entry.status === "received" && entry.donorEmail) {
    sendPledgeReceivedEmail({
      donorName: entry.donorName,
      donorEmail: entry.donorEmail,
      amount: parseFloat(entry.amountReceived ?? "0") > 0
        ? parseFloat(entry.amountReceived ?? "0")
        : parseFloat(entry.amountPledged ?? "0"),
      pledgeId: entry.id,
    }).catch((err) => console.error("[email] Failed to send pledge received email:", err));
  }
  if (entry.status === "received") {
    sendNewPledgeEmail({
      donorName: entry.donorName,
      donorEmail: entry.donorEmail ?? undefined,
      amount: parseFloat(entry.amountReceived ?? "0") > 0
        ? parseFloat(entry.amountReceived ?? "0")
        : parseFloat(entry.amountPledged ?? "0"),
      note: entry.notes ?? undefined,
      pledgeId: entry.id,
      status: "received",
    }).catch((err) => console.error("[email] Failed to send admin new pledge email:", err));
  } else {
    sendNewPledgeEmail({
      donorName: entry.donorName,
      donorEmail: entry.donorEmail ?? undefined,
      amount: parseFloat(entry.amountPledged ?? "0"),
      note: entry.notes ?? undefined,
      pledgeId: entry.id,
      status: entry.status ?? "pending",
    }).catch((err) => console.error("[email] Failed to send admin new pledge email:", err));
  }

  res.status(201).json({
    id: entry.id,
    donorName: entry.donorName,
    donorEmail: entry.donorEmail ?? undefined,
    amountPledged: parseFloat(entry.amountPledged ?? "0"),
    amountReceived: parseFloat(entry.amountReceived ?? "0"),
    date: entry.date,
    teamId: entry.teamId,
    teamName,
    status: entry.status,
    notes: entry.notes,
    paidAt: entry.paidAt?.toISOString(),
    createdAt: entry.createdAt?.toISOString(),
  });
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateFundraisingParams.parse(req.params);
  const body = UpdateFundraisingBody.parse(req.body);

  const [existing] = await db.select().from(fundraisingTable).where(eq(fundraisingTable.id, id));
  const previousStatus = existing?.status;

  const paidAt = body.paidAt !== undefined ? (body.paidAt ? new Date(body.paidAt) : null) : undefined;
  const [entry] = await db.update(fundraisingTable).set({
    donorName: body.donorName,
    donorEmail: body.donorEmail,
    amountPledged: body.amountPledged !== undefined ? String(body.amountPledged) : undefined,
    amountReceived: body.amountReceived !== undefined ? String(body.amountReceived) : undefined,
    date: body.date,
    teamId: body.teamId,
    status: body.status,
    notes: body.notes,
    paidAt,
  }).where(eq(fundraisingTable.id, id)).returning();

  let teamName: string | undefined;
  if (entry.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, entry.teamId));
    teamName = team?.name;
  }

  if (body.status === "received" && previousStatus !== "received" && entry.donorEmail) {
    sendPledgeReceivedEmail({
      donorName: entry.donorName,
      donorEmail: entry.donorEmail,
      amount: parseFloat(entry.amountReceived ?? "0") > 0
        ? parseFloat(entry.amountReceived ?? "0")
        : parseFloat(entry.amountPledged ?? "0"),
      pledgeId: entry.id,
    }).catch((err) => console.error("[email] Failed to send pledge received email:", err));
  }

  res.json({
    id: entry.id,
    donorName: entry.donorName,
    donorEmail: entry.donorEmail ?? undefined,
    amountPledged: parseFloat(entry.amountPledged ?? "0"),
    amountReceived: parseFloat(entry.amountReceived ?? "0"),
    date: entry.date,
    teamId: entry.teamId,
    teamName,
    status: entry.status,
    notes: entry.notes,
    paidAt: entry.paidAt?.toISOString(),
    createdAt: entry.createdAt?.toISOString(),
  });
});

router.post("/:id/resend-receipt", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [entry] = await db.select().from(fundraisingTable).where(eq(fundraisingTable.id, id));
  if (!entry) {
    res.status(404).json({ error: "Record not found" });
    return;
  }
  if (entry.status !== "received") {
    res.status(400).json({ error: "Receipt can only be resent for records with status 'received'" });
    return;
  }
  if (!entry.donorEmail) {
    res.status(400).json({ error: "No donor email on record" });
    return;
  }
  await sendPledgeReceivedEmail({
    donorName: entry.donorName,
    donorEmail: entry.donorEmail,
    amount: parseFloat(entry.amountReceived ?? "0") > 0
      ? parseFloat(entry.amountReceived ?? "0")
      : parseFloat(entry.amountPledged ?? "0"),
    pledgeId: entry.id,
  });
  res.json({ ok: true });
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteFundraisingParams.parse(req.params);
  await db.delete(fundraisingTable).where(eq(fundraisingTable.id, id));
  res.status(204).send();
});

export default router;
