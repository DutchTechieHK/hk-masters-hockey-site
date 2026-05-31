import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { sponsorsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CreateSponsorBody, UpdateSponsorParams, DeleteSponsorParams } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { backfillSponsorLogos } from "../utils/backfillSponsorLogos";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"];

router.get("/", async (_req, res) => {
  const sponsors = await db
    .select()
    .from(sponsorsTable)
    .orderBy(sponsorsTable.id);
  res.json(sponsors.map((s) => ({
    id: s.id,
    name: s.name,
    logoUrl: s.logoUrl ?? undefined,
    websiteUrl: s.websiteUrl ?? undefined,
    tier: s.tier,
    active: s.active,
    contributionAmount: s.contributionAmount != null ? Number(s.contributionAmount) : null,
    createdAt: s.createdAt?.toISOString(),
  })));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateSponsorBody.parse(req.body);
  const [sponsor] = await db.insert(sponsorsTable).values({
    name: body.name,
    logoUrl: body.logoUrl || null,
    websiteUrl: body.websiteUrl || null,
    tier: body.tier,
    active: body.active,
    contributionAmount: body.contributionAmount != null ? String(body.contributionAmount) : null,
  }).returning();
  res.status(201).json({
    id: sponsor.id,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl ?? undefined,
    websiteUrl: sponsor.websiteUrl ?? undefined,
    tier: sponsor.tier,
    active: sponsor.active,
    contributionAmount: sponsor.contributionAmount != null ? Number(sponsor.contributionAmount) : null,
    createdAt: sponsor.createdAt?.toISOString(),
  });
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateSponsorParams.parse(req.params);
  const body = CreateSponsorBody.parse(req.body);
  const [sponsor] = await db.update(sponsorsTable).set({
    name: body.name,
    logoUrl: body.logoUrl || null,
    websiteUrl: body.websiteUrl || null,
    tier: body.tier,
    active: body.active,
    contributionAmount: body.contributionAmount != null ? String(body.contributionAmount) : null,
  }).where(eq(sponsorsTable.id, id)).returning();
  if (!sponsor) {
    res.status(404).json({ error: "Sponsor not found" });
    return;
  }
  res.json({
    id: sponsor.id,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl ?? undefined,
    websiteUrl: sponsor.websiteUrl ?? undefined,
    tier: sponsor.tier,
    active: sponsor.active,
    contributionAmount: sponsor.contributionAmount != null ? Number(sponsor.contributionAmount) : null,
    createdAt: sponsor.createdAt?.toISOString(),
  });
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteSponsorParams.parse(req.params);
  await db.delete(sponsorsTable).where(eq(sponsorsTable.id, id));
  res.status(204).send();
});

router.post("/backfill-logos", requireAdminAccess, async (_req, res) => {
  const updated = await backfillSponsorLogos();
  res.json({ updated });
});

router.post("/image-upload", requireAdminAccess, (req: Request, res: Response, next: NextFunction) => {
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
}, async (req: Request, res: Response) => {
  if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
  if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
    res.status(400).json({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }); return;
  }
  const storage = new ObjectStorageService();
  const objectPath = await storage.uploadObjectEntity(req.file.buffer, req.file.mimetype);
  const imageUrl = `/api/sponsors/image${objectPath}`;
  res.json({ objectPath, imageUrl });
});

router.use("/image/objects", async (req: Request, res: Response) => {
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
  } catch {
    res.status(404).json({ error: "Image not found" });
  }
});

export default router;
