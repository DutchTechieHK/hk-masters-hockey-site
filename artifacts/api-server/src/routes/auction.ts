import { Router, type Response } from "express";
import { db } from "@workspace/db";
import { auctionSettingsTable, auctionItemsTable, auctionBidsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

const sseClients = new Set<Response>();

function broadcastBid(itemId: number, bid: { bidderName: string; amount: string }) {
  const data = JSON.stringify({ itemId, bid: { bidderName: bid.bidderName, amount: bid.amount } });
  for (const res of sseClients) {
    try { res.write(`event: bid\ndata: ${data}\n\n`); } catch { sseClients.delete(res); }
  }
}

async function getSettings() {
  const rows = await db.select().from(auctionSettingsTable).limit(1);
  if (rows.length === 0) {
    const [row] = await db.insert(auctionSettingsTable).values({ isLive: false }).returning();
    return row;
  }
  return rows[0];
}

async function getItemsWithTopBids() {
  const items = await db.select().from(auctionItemsTable).orderBy(auctionItemsTable.id);
  const topBids = await db
    .select({
      itemId: auctionBidsTable.itemId,
      bidderName: auctionBidsTable.bidderName,
      amount: sql<string>`MAX(${auctionBidsTable.amount}::numeric)::text`,
    })
    .from(auctionBidsTable)
    .groupBy(auctionBidsTable.itemId);

  const topBidMap = new Map(topBids.map(b => [b.itemId, b]));

  return items.map(item => {
    const topBidRow = topBidMap.get(item.id);
    let topBid = null;
    if (topBidRow) {
      topBid = { amount: topBidRow.amount, bidderName: topBidRow.bidderName };
    }
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      startingPrice: item.startingPrice,
      minIncrement: item.minIncrement,
      opensAt: item.opensAt?.toISOString() ?? null,
      closesAt: item.closesAt?.toISOString() ?? null,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      topBid,
    };
  });
}

export const auctionAdminRouter = Router();

auctionAdminRouter.get("/settings", requireAdminAccess, async (_req, res) => {
  const settings = await getSettings();
  res.json({ isLive: settings.isLive });
});

auctionAdminRouter.patch("/settings", requireAdminAccess, async (req, res) => {
  const { isLive } = req.body ?? {};
  if (typeof isLive !== "boolean") { res.status(400).json({ error: "isLive must be a boolean" }); return; }
  const settings = await getSettings();
  const [updated] = await db
    .update(auctionSettingsTable)
    .set({ isLive, updatedAt: new Date() })
    .where(eq(auctionSettingsTable.id, settings.id))
    .returning();
  res.json({ isLive: updated.isLive });
});

auctionAdminRouter.get("/items", requireAdminAccess, async (_req, res) => {
  const items = await getItemsWithTopBids();
  res.json(items);
});

auctionAdminRouter.post("/items", requireAdminAccess, async (req, res) => {
  const { title, description, imageUrl, startingPrice, minIncrement, opensAt, closesAt, isActive } = req.body ?? {};
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required" }); return;
  }
  const [item] = await db.insert(auctionItemsTable).values({
    title: title.trim(),
    description: description?.trim() || null,
    imageUrl: imageUrl?.trim() || null,
    startingPrice: String(parseFloat(startingPrice) || 0),
    minIncrement: String(parseFloat(minIncrement) || 100),
    opensAt: opensAt ? new Date(opensAt) : null,
    closesAt: closesAt ? new Date(closesAt) : null,
    isActive: isActive !== false,
  }).returning();
  res.status(201).json({ ...item, opensAt: item.opensAt?.toISOString() ?? null, closesAt: item.closesAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() });
});

auctionAdminRouter.patch("/items/:id", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, description, imageUrl, startingPrice, minIncrement, opensAt, closesAt, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl?.trim() || null;
  if (startingPrice !== undefined) updates.startingPrice = String(parseFloat(startingPrice) || 0);
  if (minIncrement !== undefined) updates.minIncrement = String(parseFloat(minIncrement) || 100);
  if (opensAt !== undefined) updates.opensAt = opensAt ? new Date(opensAt) : null;
  if (closesAt !== undefined) updates.closesAt = closesAt ? new Date(closesAt) : null;
  if (isActive !== undefined) updates.isActive = Boolean(isActive);
  const [item] = await db.update(auctionItemsTable).set(updates).where(eq(auctionItemsTable.id, id)).returning();
  if (!item) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...item, opensAt: item.opensAt?.toISOString() ?? null, closesAt: item.closesAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() });
});

auctionAdminRouter.delete("/items/:id", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  await db.delete(auctionBidsTable).where(eq(auctionBidsTable.itemId, id));
  await db.delete(auctionItemsTable).where(eq(auctionItemsTable.id, id));
  res.status(204).send();
});

auctionAdminRouter.get("/items/:id/bids", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const bids = await db
    .select()
    .from(auctionBidsTable)
    .where(eq(auctionBidsTable.itemId, id))
    .orderBy(desc(auctionBidsTable.amount));
  res.json(bids.map(b => ({
    id: b.id,
    bidderName: b.bidderName,
    bidderEmail: b.bidderEmail,
    amount: b.amount,
    placedAt: b.placedAt.toISOString(),
  })));
});

export const auctionPublicRouter = Router();

auctionPublicRouter.get("/", async (_req, res) => {
  const settings = await getSettings();
  if (!settings.isLive) {
    res.json({ isLive: false, items: [] });
    return;
  }
  const items = await getItemsWithTopBids();
  res.json({ isLive: true, items });
});

auctionPublicRouter.get("/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
  res.write(": connected\n\n");
  sseClients.add(res);
  const keepAlive = setInterval(() => {
    try { res.write(": ping\n\n"); } catch { /* closed */ }
  }, 25000);
  req.on("close", () => {
    clearInterval(keepAlive);
    sseClients.delete(res);
  });
});

auctionPublicRouter.post("/:id/bid", async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid item id" }); return; }

  const settings = await getSettings();
  if (!settings.isLive) { res.status(403).json({ error: "Auction is not currently live" }); return; }

  const item = await db.select().from(auctionItemsTable).where(eq(auctionItemsTable.id, id)).limit(1);
  if (!item[0]) { res.status(404).json({ error: "Item not found" }); return; }
  if (!item[0].isActive) { res.status(400).json({ error: "This item is not available for bidding" }); return; }

  const now = new Date();
  if (item[0].opensAt && item[0].opensAt > now) { res.status(400).json({ error: "This item is not yet open for bidding" }); return; }
  if (item[0].closesAt && item[0].closesAt <= now) { res.status(400).json({ error: "Bidding has closed for this item" }); return; }

  const { bidderName, bidderEmail, amount } = req.body ?? {};
  if (typeof bidderName !== "string" || bidderName.trim().length === 0) { res.status(400).json({ error: "Name is required" }); return; }
  if (typeof bidderEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(bidderEmail)) { res.status(400).json({ error: "Valid email is required" }); return; }
  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) { res.status(400).json({ error: "Valid amount is required" }); return; }

  const [topBidRow] = await db
    .select({ maxAmount: sql<string>`MAX(${auctionBidsTable.amount}::numeric)::text` })
    .from(auctionBidsTable)
    .where(eq(auctionBidsTable.itemId, id));

  const currentTop = topBidRow?.maxAmount ? parseFloat(topBidRow.maxAmount) : parseFloat(item[0].startingPrice) - 1;
  const minBid = topBidRow?.maxAmount
    ? parseFloat(topBidRow.maxAmount) + parseFloat(item[0].minIncrement)
    : parseFloat(item[0].startingPrice);

  if (parsedAmount < minBid) {
    res.status(400).json({ error: `Minimum bid is HK$${Math.round(minBid)}` }); return;
  }

  const [bid] = await db.insert(auctionBidsTable).values({
    itemId: id,
    bidderName: bidderName.trim(),
    bidderEmail: bidderEmail.trim(),
    amount: String(parsedAmount),
  }).returning();

  const topBid = { bidderName: bid.bidderName, amount: bid.amount };
  broadcastBid(id, topBid);

  res.status(201).json({ id: bid.id, itemId: bid.itemId, amount: bid.amount, placedAt: bid.placedAt.toISOString() });
});
