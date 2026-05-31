import { Router } from "express";
import { db } from "@workspace/db";
import { funRunParticipantsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdminAccess);

function serialize(p: typeof funRunParticipantsTable.$inferSelect) {
  const pledgePerKm = Number(p.pledgePerKm ?? 0);
  const distanceKm = p.distanceKm != null ? Number(p.distanceKm) : null;
  const totalRaised = distanceKm != null ? pledgePerKm * distanceKm : null;
  return {
    id: p.id,
    participantName: p.participantName,
    participantEmail: p.participantEmail ?? null,
    pledgePerKm,
    distanceKm,
    totalRaised,
    status: p.status,
    notes: p.notes ?? null,
    createdAt: p.createdAt.toISOString(),
  };
}

// GET /api/fun-run — list all participants
router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(funRunParticipantsTable)
    .orderBy(funRunParticipantsTable.id);
  res.json(rows.map(serialize));
});

// GET /api/fun-run/summary — totals
router.get("/summary", async (_req, res) => {
  const [row] = await db
    .select({
      count: sql<number>`COUNT(*)`,
      completedCount: sql<number>`COUNT(*) FILTER (WHERE status = 'completed')`,
      totalRaised: sql<string>`COALESCE(SUM(CASE WHEN distance_km IS NOT NULL THEN pledge_per_km * distance_km ELSE 0 END), 0)`,
      totalPledged: sql<string>`COALESCE(SUM(pledge_per_km), 0)`,
    })
    .from(funRunParticipantsTable);

  res.json({
    count: Number(row.count),
    completedCount: Number(row.completedCount),
    totalRaised: Number(row.totalRaised),
    totalPledged: Number(row.totalPledged),
  });
});

// POST /api/fun-run — create participant
router.post("/", async (req, res) => {
  const { participantName, participantEmail, pledgePerKm, distanceKm, notes } = req.body ?? {};

  if (typeof participantName !== "string" || !participantName.trim()) {
    res.status(400).json({ error: "participantName is required" });
    return;
  }

  const pledgeNum = parseFloat(pledgePerKm ?? 0);
  if (isNaN(pledgeNum) || pledgeNum < 0) {
    res.status(400).json({ error: "pledgePerKm must be a non-negative number" });
    return;
  }

  const distanceNum = distanceKm != null && distanceKm !== "" ? parseFloat(distanceKm) : null;
  if (distanceNum !== null && (isNaN(distanceNum) || distanceNum < 0)) {
    res.status(400).json({ error: "distanceKm must be a non-negative number" });
    return;
  }

  const status = distanceNum != null ? "completed" : "registered";

  const [row] = await db
    .insert(funRunParticipantsTable)
    .values({
      participantName: participantName.trim(),
      participantEmail: participantEmail?.trim() || null,
      pledgePerKm: String(pledgeNum),
      distanceKm: distanceNum != null ? String(distanceNum) : null,
      status,
      notes: notes?.trim() || null,
    })
    .returning();

  res.status(201).json(serialize(row));
});

// PUT /api/fun-run/:id — update participant
router.put("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { participantName, participantEmail, pledgePerKm, distanceKm, notes, status } = req.body ?? {};

  const updateData: Record<string, unknown> = {};

  if (participantName !== undefined) {
    if (typeof participantName !== "string" || !participantName.trim()) {
      res.status(400).json({ error: "participantName must be a non-empty string" });
      return;
    }
    updateData.participantName = participantName.trim();
  }

  if (participantEmail !== undefined) {
    updateData.participantEmail = participantEmail?.trim() || null;
  }

  if (pledgePerKm !== undefined) {
    const pledgeNum = parseFloat(pledgePerKm);
    if (isNaN(pledgeNum) || pledgeNum < 0) {
      res.status(400).json({ error: "pledgePerKm must be a non-negative number" });
      return;
    }
    updateData.pledgePerKm = String(pledgeNum);
  }

  if (distanceKm !== undefined) {
    const distanceNum = distanceKm != null && distanceKm !== "" ? parseFloat(distanceKm) : null;
    if (distanceNum !== null && (isNaN(distanceNum) || distanceNum < 0)) {
      res.status(400).json({ error: "distanceKm must be a non-negative number" });
      return;
    }
    updateData.distanceKm = distanceNum != null ? String(distanceNum) : null;
    if (status === undefined) {
      updateData.status = distanceNum != null ? "completed" : "registered";
    }
  }

  if (status !== undefined) {
    if (!["registered", "completed"].includes(status)) {
      res.status(400).json({ error: "status must be 'registered' or 'completed'" });
      return;
    }
    updateData.status = status;
  }

  if (notes !== undefined) {
    updateData.notes = notes?.trim() || null;
  }

  const [row] = await db
    .update(funRunParticipantsTable)
    .set(updateData as any)
    .where(eq(funRunParticipantsTable.id, id))
    .returning();

  if (!row) {
    res.status(404).json({ error: "Participant not found" });
    return;
  }

  res.json(serialize(row));
});

// DELETE /api/fun-run/:id — delete participant
router.delete("/:id", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  await db.delete(funRunParticipantsTable).where(eq(funRunParticipantsTable.id, id));
  res.status(204).send();
});

export default router;
