import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { siteContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

// Default values matching what was previously in the static JSON files
const STATIC_DEFAULTS = {
  heroImage: "/images/hero-squad.jpg",
  mo40Photo: "/images/mo40-squad.jpg",
  mo50Photo: "/images/mo50-squad.jpg",
  galleryImages: [
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853920/HK_M50_d4-0212_ynxitw.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853981/WhatsApp_Image_2026-03-24_at_21.24.25_1_x7zsqm.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853981/WhatsApp_Image_2026-03-24_at_21.24.26_viwxfc.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853981/WhatsApp_Image_2026-03-24_at_21.24.24_phzwyj.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-1425_1_gexlx7.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774854986/58BC6C97-2F7F-4CD1-8F97-C014A864ECC3_moxvd3.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0855_lj4mgz.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853985/WhatsApp_Image_2026-03-24_at_21.24.36_larlup.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0536_veln0s.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853919/A32I6153_pwqfwv.jpg" },
    { url: "https://res.cloudinary.com/djyvdrhal/image/upload/v1777016038/Wajid_mbg2po.jpg" },
  ],
};

function formatRow(row: typeof siteContentTable.$inferSelect) {
  // Parse gallery — return exactly what's stored (may be []).
  // Null/parse-error falls back to static defaults (first-boot case only).
  let galleryImages: { url: string }[] | null = null;
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
    galleryImages?: { url: string }[];
  };

  const row = await getOrCreateRow();
  const [updated] = await db
    .update(siteContentTable)
    .set({
      heroImage: typeof body.heroImage === "string" ? body.heroImage : row.heroImage,
      mo40Photo: typeof body.mo40Photo === "string" ? body.mo40Photo : row.mo40Photo,
      mo50Photo: typeof body.mo50Photo === "string" ? body.mo50Photo : row.mo50Photo,
      galleryImages: Array.isArray(body.galleryImages)
        ? JSON.stringify(body.galleryImages)
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
    const storage = new ObjectStorageService();
    const objectPath = await storage.uploadObjectEntity(req.file.buffer, req.file.mimetype);
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
