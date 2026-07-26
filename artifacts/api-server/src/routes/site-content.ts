import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { siteContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import sharp from "sharp";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Default values matching what was previously in the static JSON files
const STATIC_DEFAULTS = {
  heroImage: "/images/hero-squad.jpg",
  mo40Photo: "/images/mo40-squad.jpg",
  mo50Photo: "/images/mo50-squad.jpg",
  // Self-hosted in object storage (migrated from Cloudinary, recompressed to
  // max 2000px / q80 like regular uploads).
  galleryImages: [
    { url: "/api/site-content/image/objects/uploads/bc8ae3bc-6adf-42ab-9832-b369623b2dd9" },
    { url: "/api/site-content/image/objects/uploads/a33269a0-9c67-4452-926b-ca9256e24cfc" },
    { url: "/api/site-content/image/objects/uploads/1c87afd8-10b5-4895-ad75-b2a1a29131a1" },
    { url: "/api/site-content/image/objects/uploads/0e6e6c31-1ba0-4d0d-8fcf-60d27e07e70e" },
    { url: "/api/site-content/image/objects/uploads/a73f02d5-78c7-4b5e-b166-d9e5f36f7504" },
    { url: "/api/site-content/image/objects/uploads/457f5e09-9bd4-4005-9a14-c069a922447b" },
    { url: "/api/site-content/image/objects/uploads/ea849591-8217-4d21-8ffa-73beec1f5830" },
    { url: "/api/site-content/image/objects/uploads/6aa0fe25-17e9-4c5a-bf7a-16563c6bea50" },
    { url: "/api/site-content/image/objects/uploads/ea4a5259-5bff-4dea-a414-5a10f8763713" },
    { url: "/api/site-content/image/objects/uploads/5f2dadc6-733b-4740-ab16-839a90ec6cb2" },
    { url: "/api/site-content/image/objects/uploads/988594b5-06b6-40d4-93c1-09111fdf6f9e" },
  ],
};

function formatRow(row: typeof siteContentTable.$inferSelect) {
  // Parse gallery — return exactly what's stored (may be []).
  // Null/parse-error falls back to static defaults (first-boot case only).
  let galleryImages: { url: string; caption?: string }[] | null = null;
  try {
    const parsed = JSON.parse(row.galleryImages);
    if (Array.isArray(parsed)) galleryImages = parsed;
  } catch {
    // keep null → will use defaults below
  }

  return {
    heroImage: row.heroImage || STATIC_DEFAULTS.heroImage,
    mo40Photo: row.mo40Photo || STATIC_DEFAULTS.mo40Photo,
    mo50Photo: row.mo50Photo || STATIC_DEFAULTS.mo50Photo,
    // Use static defaults only when gallery has never been set (null/parse error),
    // not when admin explicitly cleared it to [].
    galleryImages: galleryImages ?? STATIC_DEFAULTS.galleryImages,
    updatedAt: row.updatedAt?.toISOString(),
  };
}

async function getOrCreateRow() {
  const rows = await db.select().from(siteContentTable).limit(1);
  if (rows.length > 0) return rows[0];
  // Seed the first row with the static gallery so the public site has
  // real content before an admin touches anything.
  const [row] = await db.insert(siteContentTable).values({
    galleryImages: JSON.stringify(STATIC_DEFAULTS.galleryImages),
  }).returning();
  return row;
}

// GET /api/site-content — public, returns current photo config
router.get("/", async (_req, res) => {
  const row = await getOrCreateRow();
  res.json(formatRow(row));
});

// PUT /api/site-content — admin only, updates photo config
router.put("/", requireAdminAccess, async (req, res) => {
  const body = req.body as {
    heroImage?: string;
    mo40Photo?: string;
    mo50Photo?: string;
    galleryImages?: { url: string; caption?: string }[];
  };

  // Sanitize gallery entries: keep only url + optional caption strings
  const sanitizedGallery = Array.isArray(body.galleryImages)
    ? body.galleryImages
        .filter((img) => img && typeof img.url === "string" && img.url)
        .map((img) => {
          const caption = typeof img.caption === "string" ? img.caption.trim() : "";
          return caption ? { url: img.url, caption } : { url: img.url };
        })
    : null;

  const row = await getOrCreateRow();
  const [updated] = await db
    .update(siteContentTable)
    .set({
      heroImage: typeof body.heroImage === "string" ? body.heroImage : row.heroImage,
      mo40Photo: typeof body.mo40Photo === "string" ? body.mo40Photo : row.mo40Photo,
      mo50Photo: typeof body.mo50Photo === "string" ? body.mo50Photo : row.mo50Photo,
      galleryImages: sanitizedGallery
        ? JSON.stringify(sanitizedGallery)
        : row.galleryImages,
    })
    .where(eq(siteContentTable.id, row.id))
    .returning();

  res.json(formatRow(updated));
});

// POST /api/site-content/upload-image — admin only, uploads an image
router.post(
  "/upload-image",
  requireAdminAccess,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "Image too large — max 20 MB" });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) { next(err); return; }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Only image files are allowed (JPEG, PNG, WebP, GIF)" });
      return;
    }
    // Resize/compress server-side so pages load fast. Animated GIFs are kept
    // as-is (resizing would drop animation); everything else is capped at
    // 2000px wide and re-encoded as JPEG (or WebP if the source had alpha).
    let buffer = req.file.buffer;
    let contentType = req.file.mimetype;
    if (contentType !== "image/gif") {
      try {
        const meta = await sharp(buffer).metadata();
        const pipeline = sharp(buffer)
          .rotate() // apply EXIF orientation before stripping metadata
          .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
        if (meta.hasAlpha) {
          buffer = await pipeline.webp({ quality: 80 }).toBuffer();
          contentType = "image/webp";
        } else {
          buffer = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
          contentType = "image/jpeg";
        }
      } catch (err) {
        console.error("Image processing failed:", err);
        res.status(400).json({ error: "Could not process image — is the file a valid image?" });
        return;
      }
    }
    const storage = new ObjectStorageService();
    const objectPath = await storage.uploadObjectEntity(buffer, contentType);
    const imageUrl = `/api/site-content/image${objectPath}`;
    res.json({ imageUrl });
  }
);

// Serve uploaded site-content images
router.use("/image/objects", async (req: Request, res: Response) => {
  const objectPath = `/objects${req.path}`;
  const storage = new ObjectStorageService();
  try {
    const signedUrl = await storage.getObjectEntityDownloadURL(objectPath);
    const gcsRes = await fetch(signedUrl);
    if (!gcsRes.ok) { res.status(502).json({ error: "Failed to fetch image" }); return; }
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
