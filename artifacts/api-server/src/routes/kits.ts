import { Router } from "express";
import { db } from "@workspace/db";
import { kitsTable, playersTable, teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreateKitBody,
  UpdateKitBody,
  UpdateKitParams,
  DeleteKitParams,
  ListKitsQueryParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", async (req, res) => {
  const query = ListKitsQueryParams.parse(req.query);
  let kits;
  if (query.playerId) {
    kits = await db
      .select({ kit: kitsTable, playerName: playersTable.name, teamId: playersTable.teamId, teamName: teamsTable.name })
      .from(kitsTable)
      .leftJoin(playersTable, eq(kitsTable.playerId, playersTable.id))
      .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
      .where(eq(kitsTable.playerId, query.playerId))
      .orderBy(kitsTable.id);
  } else {
    kits = await db
      .select({ kit: kitsTable, playerName: playersTable.name, teamId: playersTable.teamId, teamName: teamsTable.name })
      .from(kitsTable)
      .leftJoin(playersTable, eq(kitsTable.playerId, playersTable.id))
      .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
      .orderBy(kitsTable.id);
  }
  res.json(kits.map(({ kit, playerName, teamId, teamName }) => {
    const qty = kit.quantity ?? 1;
    const unit = parseFloat(kit.unitCost ?? "0");
    return {
      id: kit.id,
      playerId: kit.playerId,
      playerName: playerName ?? undefined,
      teamId: teamId ?? undefined,
      teamName: teamName ?? undefined,
      itemType: kit.itemType,
      itemName: kit.itemName,
      size: kit.size,
      quantity: qty,
      unitCost: unit,
      totalCost: qty * unit,
      supplier: kit.supplier,
      orderStatus: kit.orderStatus,
      notes: kit.notes,
      createdAt: kit.createdAt?.toISOString(),
    };
  }));
});

router.post("/", async (req, res) => {
  const body = CreateKitBody.parse(req.body);
  const [kit] = await db.insert(kitsTable).values({
    playerId: body.playerId,
    itemType: body.itemType,
    itemName: body.itemName,
    size: body.size,
    quantity: body.quantity,
    unitCost: String(body.unitCost),
    supplier: body.supplier,
    orderStatus: body.orderStatus,
    notes: body.notes,
  }).returning();
  const [player] = await db.select({ name: playersTable.name, teamId: playersTable.teamId }).from(playersTable).where(eq(playersTable.id, kit.playerId));
  let teamName: string | undefined;
  if (player?.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
    teamName = team?.name;
  }
  const qty = kit.quantity ?? 1;
  const unit = parseFloat(kit.unitCost ?? "0");
  res.status(201).json({
    id: kit.id,
    playerId: kit.playerId,
    playerName: player?.name,
    teamId: player?.teamId,
    teamName,
    itemType: kit.itemType,
    itemName: kit.itemName,
    size: kit.size,
    quantity: qty,
    unitCost: unit,
    totalCost: qty * unit,
    supplier: kit.supplier,
    orderStatus: kit.orderStatus,
    notes: kit.notes,
    createdAt: kit.createdAt?.toISOString(),
  });
});

router.put("/:id", async (req, res) => {
  const { id } = UpdateKitParams.parse(req.params);
  const body = UpdateKitBody.parse(req.body);
  const [kit] = await db.update(kitsTable).set({
    playerId: body.playerId,
    itemType: body.itemType,
    itemName: body.itemName,
    size: body.size,
    quantity: body.quantity,
    unitCost: body.unitCost !== undefined ? String(body.unitCost) : undefined,
    supplier: body.supplier,
    orderStatus: body.orderStatus,
    notes: body.notes,
  }).where(eq(kitsTable.id, id)).returning();
  const [player] = await db.select({ name: playersTable.name, teamId: playersTable.teamId }).from(playersTable).where(eq(playersTable.id, kit.playerId));
  let teamName: string | undefined;
  if (player?.teamId) {
    const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
    teamName = team?.name;
  }
  const qty = kit.quantity ?? 1;
  const unit = parseFloat(kit.unitCost ?? "0");
  res.json({
    id: kit.id,
    playerId: kit.playerId,
    playerName: player?.name,
    teamId: player?.teamId,
    teamName,
    itemType: kit.itemType,
    itemName: kit.itemName,
    size: kit.size,
    quantity: qty,
    unitCost: unit,
    totalCost: qty * unit,
    supplier: kit.supplier,
    orderStatus: kit.orderStatus,
    notes: kit.notes,
    createdAt: kit.createdAt?.toISOString(),
  });
});

router.delete("/:id", async (req, res) => {
  const { id } = DeleteKitParams.parse(req.params);
  await db.delete(kitsTable).where(eq(kitsTable.id, id));
  res.status(204).send();
});

export default router;
