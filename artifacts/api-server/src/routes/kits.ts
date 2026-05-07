import { Router } from "express";
import { db } from "@workspace/db";
import { kitOrdersTable, kitDistributionsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import {
  CreateKitBody,
  UpdateKitBody,
  UpdateKitParams,
  DeleteKitParams,
} from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

router.use(requireAdminAccess);

function serializeOrder(row: typeof kitOrdersTable.$inferSelect) {
  const qty = row.quantity ?? 1;
  const unit = parseFloat(row.unitCostHKD ?? "0");
  const deposit = row.depositAmountHKD ? parseFloat(row.depositAmountHKD) : undefined;
  return {
    id: row.id,
    itemName: row.itemName,
    itemType: row.itemType,
    supplier: row.supplier ?? undefined,
    quantity: qty,
    unitCostHKD: unit,
    totalCostHKD: qty * unit,
    depositAmountHKD: deposit,
    depositPaidDate: row.depositPaidDate ?? undefined,
    balanceDueDate: row.balanceDueDate ?? undefined,
    balancePaidDate: row.balancePaidDate ?? undefined,
    orderPlacedDate: row.orderPlacedDate ?? undefined,
    artworkApprovedDate: row.artworkApprovedDate ?? undefined,
    expectedDeliveryDate: row.expectedDeliveryDate ?? undefined,
    actualDeliveryDate: row.actualDeliveryDate ?? undefined,
    orderStatus: row.orderStatus,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt?.toISOString(),
  };
}

router.get("/", async (_req, res) => {
  const rows = await db
    .select()
    .from(kitOrdersTable)
    .orderBy(kitOrdersTable.id);
  res.json(rows.map(serializeOrder));
});

router.post("/", async (req, res) => {
  const body = CreateKitBody.parse(req.body);
  const [row] = await db.insert(kitOrdersTable).values({
    itemName: body.itemName,
    itemType: body.itemType,
    supplier: body.supplier,
    quantity: body.quantity,
    unitCostHKD: String(body.unitCostHKD),
    depositAmountHKD: body.depositAmountHKD !== undefined ? String(body.depositAmountHKD) : null,
    depositPaidDate: body.depositPaidDate,
    balanceDueDate: body.balanceDueDate,
    balancePaidDate: body.balancePaidDate,
    orderPlacedDate: body.orderPlacedDate,
    artworkApprovedDate: body.artworkApprovedDate,
    expectedDeliveryDate: body.expectedDeliveryDate,
    actualDeliveryDate: body.actualDeliveryDate,
    orderStatus: body.orderStatus,
    notes: body.notes,
  }).returning();
  res.status(201).json(serializeOrder(row));
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateKitParams.parse(req.params);
  const body = UpdateKitBody.parse(req.body);
  const [row] = await db.update(kitOrdersTable).set({
    itemName: body.itemName,
    itemType: body.itemType,
    supplier: body.supplier,
    quantity: body.quantity,
    unitCostHKD: String(body.unitCostHKD),
    depositAmountHKD: body.depositAmountHKD !== undefined ? String(body.depositAmountHKD) : null,
    depositPaidDate: body.depositPaidDate ?? null,
    balanceDueDate: body.balanceDueDate ?? null,
    balancePaidDate: body.balancePaidDate ?? null,
    orderPlacedDate: body.orderPlacedDate ?? null,
    artworkApprovedDate: body.artworkApprovedDate ?? null,
    expectedDeliveryDate: body.expectedDeliveryDate ?? null,
    actualDeliveryDate: body.actualDeliveryDate ?? null,
    orderStatus: body.orderStatus,
    notes: body.notes,
  }).where(eq(kitOrdersTable.id, id)).returning();
  res.json(serializeOrder(row));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteKitParams.parse(req.params);
  await db.delete(kitOrdersTable).where(eq(kitOrdersTable.id, id));
  res.status(204).send();
});

// ── Kit Distributions ──

router.get("/distributions", async (_req, res) => {
  const rows = await db.select().from(kitDistributionsTable);
  res.json(rows.map(r => ({
    id: r.id,
    playerId: r.playerId,
    itemType: r.itemType,
    collectedAt: r.collectedAt ?? null,
    notes: r.notes ?? null,
  })));
});

router.put("/distributions/:playerId/:itemType", async (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const itemType = req.params.itemType;
  const collectedAt = (req.body as { collectedAt?: string }).collectedAt
    || new Date().toISOString().split("T")[0];
  const notes = (req.body as { notes?: string }).notes;

  await db.delete(kitDistributionsTable).where(
    and(
      eq(kitDistributionsTable.playerId, playerId),
      eq(kitDistributionsTable.itemType, itemType),
    ),
  );
  const [row] = await db.insert(kitDistributionsTable).values({
    playerId,
    itemType,
    collectedAt,
    notes,
  }).returning();
  res.json({
    id: row.id,
    playerId: row.playerId,
    itemType: row.itemType,
    collectedAt: row.collectedAt ?? null,
    notes: row.notes ?? null,
  });
});

router.delete("/distributions/:playerId/:itemType", async (req, res) => {
  const playerId = parseInt(req.params.playerId);
  const itemType = req.params.itemType;
  await db.delete(kitDistributionsTable).where(
    and(
      eq(kitDistributionsTable.playerId, playerId),
      eq(kitDistributionsTable.itemType, itemType),
    ),
  );
  res.status(204).send();
});

export default router;
