import { Router, type Response, type Request, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { auctionSettingsTable, auctionItemsTable, auctionBidsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

const sseClients = new Set<Response>();

function broadcastBid(itemId: number, bid: { bidderName: string; amount: string }, reserveMet: boolean | null) {
  const data = JSON.stringify({ itemId, bid: { bidderName: bid.bidderName, amount: bid.amount }, reserveMet });
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

type TopBidRow = { item_id: number; bidder_name: string; amount: string };

async function getItemsWithTopBids(activeOnly = false) {
  const itemsQuery = db.select().from(auctionItemsTable).orderBy(auctionItemsTable.id);
  const items = activeOnly
    ? await db.select().from(auctionItemsTable).where(eq(auctionItemsTable.isActive, true)).orderBy(auctionItemsTable.id)
    : await itemsQuery;

  // DISTINCT ON ensures we get the bidder_name for the actual highest bid row
  const topBidRows = await db.execute<TopBidRow>(sql`
    SELECT DISTINCT ON (item_id) item_id, bidder_name, amount::text
    FROM auction_bids
    ORDER BY item_id, amount DESC, placed_at DESC
  `);

  const topBidMap = new Map(topBidRows.rows.map(b => [b.item_id, b]));

  return items.map(item => {
    const topBidRow = topBidMap.get(item.id);
    const topBid = topBidRow
      ? { amount: topBidRow.amount, bidderName: topBidRow.bidder_name }
      : null;
    const reservePrice = item.reservePrice ? parseFloat(item.reservePrice) : null;
    const topBidAmount = topBid ? parseFloat(topBid.amount) : null;
    const reserveMet = reservePrice === null ? null : (topBidAmount !== null && topBidAmount >= reservePrice);
    return {
      id: item.id,
      title: item.title,
      description: item.description,
      imageUrl: item.imageUrl,
      startingPrice: item.startingPrice,
      minIncrement: item.minIncrement,
      reservePrice: item.reservePrice ?? null,
      opensAt: item.opensAt?.toISOString() ?? null,
      closesAt: item.closesAt?.toISOString() ?? null,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      topBid,
      reserveMet,
    };
  });
}

export const auctionAdminRouter = Router();

auctionAdminRouter.post("/image-upload", requireAdminAccess, (req: Request, res: Response, next: NextFunction) => {
  upload.single("file")(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(413).json({ error: "Image too large — max 10 MB" }); return;
      }
      res.status(400).json({ error: err.message }); return;
    }
    if (err) { next(err); return; }
    next();
  });
}, async (req, res) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }); return;
  }
  const storage = new ObjectStorageService();
  const objectPath = await storage.uploadObjectEntity(req.file.buffer, req.file.mimetype);
  const imageUrl = `/api/auction/image${objectPath}`;
  res.json({ objectPath, imageUrl });
});

auctionAdminRouter.use("/image/objects", async (req, res, next) => {
  const objectPath = `/objects${req.path}`;
  const storage = new ObjectStorageService();
  try {
    const signedUrl = await storage.getObjectEntityDownloadURL(objectPath);
    const gcsRes = await fetch(signedUrl);
    if (!gcsRes.ok) { res.status(502).json({ error: "Failed to fetch image from storage" }); return; }
    const buffer = Buffer.from(await gcsRes.arrayBuffer());
    const contentType = gcsRes.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch (e) {
    if (e instanceof ObjectNotFoundError) { res.status(404).json({ error: "Not found" }); return; }
    next(e);
  }
});

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
  const { title, description, imageUrl, startingPrice, minIncrement, reservePrice, opensAt, closesAt, isActive } = req.body ?? {};
  if (!title || typeof title !== "string" || title.trim().length === 0) {
    res.status(400).json({ error: "title is required" }); return;
  }
  const parsedReserve = reservePrice !== undefined && reservePrice !== "" && reservePrice !== null ? parseFloat(reservePrice) : null;
  const [item] = await db.insert(auctionItemsTable).values({
    title: title.trim(),
    description: description?.trim() || null,
    imageUrl: imageUrl?.trim() || null,
    startingPrice: String(parseFloat(startingPrice) || 0),
    minIncrement: String(parseFloat(minIncrement) || 100),
    reservePrice: parsedReserve !== null && !isNaN(parsedReserve) ? String(parsedReserve) : null,
    opensAt: opensAt ? new Date(opensAt) : null,
    closesAt: closesAt ? new Date(closesAt) : null,
    isActive: isActive !== false,
  }).returning();
  res.status(201).json({ ...item, opensAt: item.opensAt?.toISOString() ?? null, closesAt: item.closesAt?.toISOString() ?? null, createdAt: item.createdAt.toISOString() });
});

auctionAdminRouter.patch("/items/:id", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const { title, description, imageUrl, startingPrice, minIncrement, reservePrice, opensAt, closesAt, isActive } = req.body ?? {};
  const updates: Record<string, unknown> = {};
  if (title !== undefined) updates.title = title.trim();
  if (description !== undefined) updates.description = description?.trim() || null;
  if (imageUrl !== undefined) updates.imageUrl = imageUrl?.trim() || null;
  if (startingPrice !== undefined) updates.startingPrice = String(parseFloat(startingPrice) || 0);
  if (minIncrement !== undefined) updates.minIncrement = String(parseFloat(minIncrement) || 100);
  if (reservePrice !== undefined) {
    const parsedReserve = reservePrice !== "" && reservePrice !== null ? parseFloat(reservePrice) : null;
    updates.reservePrice = parsedReserve !== null && !isNaN(parsedReserve) ? String(parsedReserve) : null;
  }
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
    .orderBy(desc(auctionBidsTable.placedAt));
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
  const items = await getItemsWithTopBids(true);
  const publicItems = items.map(({ reservePrice: _rp, ...rest }) => rest);
  res.json({ isLive: true, items: publicItems });
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

  let bid: typeof auctionBidsTable.$inferSelect;
  try {
    bid = await db.transaction(async (tx) => {
      // Lock the item row to prevent concurrent bid races
      await tx.execute(sql`SELECT id FROM auction_items WHERE id = ${id} FOR UPDATE`);

      const [maxRow] = await tx
        .select({ maxAmount: sql<string>`MAX(${auctionBidsTable.amount}::numeric)::text` })
        .from(auctionBidsTable)
        .where(eq(auctionBidsTable.itemId, id));

      const minBid = maxRow?.maxAmount
        ? parseFloat(maxRow.maxAmount) + parseFloat(item[0].minIncrement)
        : parseFloat(item[0].startingPrice);

      if (parsedAmount < minBid) {
        throw Object.assign(new Error(`Minimum bid is HK$${Math.round(minBid)}`), { statusCode: 400 });
      }

      const [inserted] = await tx.insert(auctionBidsTable).values({
        itemId: id,
        bidderName: bidderName.trim(),
        bidderEmail: bidderEmail.trim(),
        amount: String(parsedAmount),
      }).returning();
      return inserted;
    });
  } catch (err: unknown) {
    const e = err as { statusCode?: number; message?: string };
    res.status(e.statusCode ?? 500).json({ error: e.message ?? "Failed to place bid" });
    return;
  }

  const topBid = { bidderName: bid.bidderName, amount: bid.amount };
  const reservePrice = item[0].reservePrice ? parseFloat(item[0].reservePrice) : null;
  const reserveMet = reservePrice === null ? null : parseFloat(bid.amount) >= reservePrice;
  broadcastBid(id, topBid, reserveMet);

  res.status(201).json({ id: bid.id, itemId: bid.itemId, amount: bid.amount, placedAt: bid.placedAt.toISOString() });
});
