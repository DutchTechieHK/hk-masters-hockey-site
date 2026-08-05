import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { newsPostsTable } from "@workspace/db/schema";
import { eq, desc, and, sql } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { requireSession } from "../middleware/adminSession";
import { ObjectStorageService, ObjectNotFoundError, extractUploadObjectId } from "../lib/objectStorage";
import { cleanupOrphanedUpload } from "../lib/uploadCleanup";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const objectStorage = new ObjectStorageService();

const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80);
}

function mapPost(row: typeof newsPostsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    bodyHtml: row.bodyHtml,
    coverImage: row.coverImage,
    category: row.category,
    author: row.author,
    status: row.status,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    reportDate: row.reportDate?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/* ── Public: list published posts ─────────────────────── */
router.get("/", async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(newsPostsTable)
      .where(eq(newsPostsTable.status, "published"))
      .orderBy(desc(sql`COALESCE(${newsPostsTable.reportDate}, ${newsPostsTable.publishedAt})`));
    res.set("Cache-Control", "public, max-age=30");
    res.json({ configured: true, posts: rows.map(mapPost) });
  } catch (err) {
    console.error("[news] list failed:", err);
    res.status(503).json({ configured: true, posts: [], error: "Temporarily unavailable" });
  }
});

/* ── Admin: list all posts (including drafts) ─────────── */
router.get("/admin/all", requireSession, requireAdminAccess, async (_req, res) => {
  try {
    const rows = await db
      .select()
      .from(newsPostsTable)
      .orderBy(desc(newsPostsTable.updatedAt));
    res.json({ posts: rows.map(mapPost) });
  } catch (err) {
    console.error("[news] admin list failed:", err);
    res.status(503).json({ error: "Failed to load posts" });
  }
});

/* ── Admin: create post ───────────────────────────────── */
router.post("/", requireSession, requireAdminAccess, async (req, res) => {
  const { title, slug, excerpt, bodyHtml, coverImage, category, author, status, reportDate } = req.body ?? {};
  if (reportDate != null && (typeof reportDate !== "string" || Number.isNaN(Date.parse(reportDate)))) {
    res.status(400).json({ error: "Invalid reportDate" });
    return;
  }
  if (!title?.trim()) {
    res.status(400).json({ error: "title required" });
    return;
  }
  const finalSlug = slug?.trim() || slugify(title.trim());
  if (!finalSlug) {
    res.status(400).json({ error: "slug required" });
    return;
  }
  try {
    const publishedAt = status === "published" ? new Date() : null;
    const [row] = await db.insert(newsPostsTable).values({
      title: title.trim(),
      slug: finalSlug,
      excerpt: excerpt?.trim() || null,
      bodyHtml: bodyHtml || null,
      coverImage: coverImage?.trim() || null,
      category: category?.trim() || null,
      author: author?.trim() || null,
      status: status === "published" ? "published" : "draft",
      publishedAt,
      reportDate: reportDate ? new Date(reportDate) : null,
    }).returning();
    res.status(201).json(mapPost(row));
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A post with this slug already exists" });
      return;
    }
    console.error("[news] create failed:", err);
    res.status(500).json({ error: "Failed to create post" });
  }
});

/* ── Admin: update post ───────────────────────────────── */
router.patch("/:id", requireSession, requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }

  const { title, slug, excerpt, bodyHtml, coverImage, category, author, status, reportDate } = req.body ?? {};
  if (reportDate !== undefined && reportDate !== null && (typeof reportDate !== "string" || Number.isNaN(Date.parse(reportDate)))) {
    res.status(400).json({ error: "Invalid reportDate" });
    return;
  }

  try {
    const [existing] = await db.select().from(newsPostsTable).where(eq(newsPostsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    // Only an explicit status change touches publishedAt; omitting status keeps it as-is.
    const wasPublished = existing.status === "published";
    let publishedAt = existing.publishedAt;
    if (status !== undefined) {
      const nowPublished = status === "published";
      if (nowPublished && !wasPublished) publishedAt = new Date();
      else if (!nowPublished) publishedAt = null;
    }

    const newCoverImage = coverImage !== undefined ? (coverImage?.trim() || null) : existing.coverImage;
    const [row] = await db.update(newsPostsTable).set({
      title: title?.trim() ?? existing.title,
      slug: slug?.trim() || existing.slug,
      excerpt: excerpt !== undefined ? (excerpt?.trim() || null) : existing.excerpt,
      bodyHtml: bodyHtml !== undefined ? (bodyHtml || null) : existing.bodyHtml,
      coverImage: newCoverImage,
      category: category !== undefined ? (category?.trim() || null) : existing.category,
      author: author !== undefined ? (author?.trim() || null) : existing.author,
      status: status ?? existing.status,
      publishedAt,
      reportDate:
        reportDate === undefined ? existing.reportDate : reportDate === null ? null : new Date(reportDate),
      updatedAt: new Date(),
    }).where(eq(newsPostsTable.id, id)).returning();
    res.json(mapPost(row));

    // Fire-and-forget: clean up old cover image if replaced/cleared (cross-entity ref check inside).
    if (coverImage !== undefined) {
      const oldId = extractUploadObjectId(existing.coverImage);
      const newId = extractUploadObjectId(newCoverImage);
      if (oldId && oldId !== newId) cleanupOrphanedUpload(oldId).catch(() => {});
    }
  } catch (err: any) {
    if (err?.code === "23505") {
      res.status(409).json({ error: "A post with this slug already exists" });
      return;
    }
    console.error("[news] update failed:", err);
    res.status(500).json({ error: "Failed to update post" });
  }
});

/* ── Admin: delete post ───────────────────────────────── */
router.delete("/:id", requireSession, requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  try {
    // Read existing cover image before deleting so we can clean up storage.
    const [existing] = await db.select({ coverImage: newsPostsTable.coverImage }).from(newsPostsTable).where(eq(newsPostsTable.id, id)).limit(1);
    await db.delete(newsPostsTable).where(eq(newsPostsTable.id, id));
    res.json({ ok: true });
    // Fire-and-forget: clean up the orphaned cover image (cross-entity ref check inside).
    const oldId = extractUploadObjectId(existing?.coverImage);
    if (oldId) cleanupOrphanedUpload(oldId).catch(() => {});
  } catch (err) {
    console.error("[news] delete failed:", err);
    res.status(500).json({ error: "Failed to delete post" });
  }
});

/* ── Admin: upload image ──────────────────────────────── */
router.post("/upload-image", requireSession, requireAdminAccess, upload.single("image"), async (req, res) => {
  const file = req.file;
  if (!file) { res.status(400).json({ error: "No file uploaded" }); return; }
  if (!ALLOWED_IMAGE_TYPES.has(file.mimetype)) {
    res.status(400).json({ error: "Only JPEG, PNG, GIF, and WebP images are allowed" });
    return;
  }
  try {
    const objectPath = await objectStorage.uploadObjectEntity(file.buffer, file.mimetype);
    const objectId = objectPath.replace("/objects/uploads/", "");
    res.json({ url: `/api/news/serve-image/${objectId}` });
  } catch (err) {
    console.error("[news] image upload failed:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

/* ── Public: serve uploaded image ─────────────────────── */
router.get("/serve-image/:objectId", async (req, res) => {
  const { objectId } = req.params;
  if (!objectId || !/^[\w-]+$/.test(objectId)) {
    res.status(400).json({ error: "Invalid objectId" });
    return;
  }
  try {
    const signedUrl = await objectStorage.getObjectEntityDownloadURL(`/objects/uploads/${objectId}`);
    res.redirect(302, signedUrl);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found" });
      return;
    }
    console.error("[news] serve-image failed:", err);
    res.status(502).json({ error: "Could not retrieve image" });
  }
});

/* ── Public: get single post by slug ──────────────────── */
router.get("/:slug", async (req, res) => {
  try {
    const [row] = await db
      .select()
      .from(newsPostsTable)
      .where(and(eq(newsPostsTable.slug, req.params.slug), eq(newsPostsTable.status, "published")));
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.set("Cache-Control", "public, max-age=30");
    res.json(mapPost(row));
  } catch (err) {
    console.error(`[news] post fetch failed for "${req.params.slug}":`, err);
    res.status(503).json({ error: "Temporarily unavailable" });
  }
});

export default router;
