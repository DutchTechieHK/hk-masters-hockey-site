import { Router } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { newsPostsTable } from "@workspace/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { requireSession } from "../middleware/adminSession";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

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
      .orderBy(desc(newsPostsTable.publishedAt));
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
  const { title, slug, excerpt, bodyHtml, coverImage, category, author, status } = req.body ?? {};
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

  const { title, slug, excerpt, bodyHtml, coverImage, category, author, status } = req.body ?? {};

  try {
    const [existing] = await db.select().from(newsPostsTable).where(eq(newsPostsTable.id, id));
    if (!existing) { res.status(404).json({ error: "Not found" }); return; }

    const wasPublished = existing.status === "published";
    const nowPublished = status === "published";
    const publishedAt = nowPublished
      ? (wasPublished ? existing.publishedAt : new Date())
      : null;

    const [row] = await db.update(newsPostsTable).set({
      title: title?.trim() ?? existing.title,
      slug: slug?.trim() || existing.slug,
      excerpt: excerpt !== undefined ? (excerpt?.trim() || null) : existing.excerpt,
      bodyHtml: bodyHtml !== undefined ? (bodyHtml || null) : existing.bodyHtml,
      coverImage: coverImage !== undefined ? (coverImage?.trim() || null) : existing.coverImage,
      category: category !== undefined ? (category?.trim() || null) : existing.category,
      author: author !== undefined ? (author?.trim() || null) : existing.author,
      status: status ?? existing.status,
      publishedAt,
      updatedAt: new Date(),
    }).where(eq(newsPostsTable.id, id)).returning();
    res.json(mapPost(row));
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
    await db.delete(newsPostsTable).where(eq(newsPostsTable.id, id));
    res.json({ ok: true });
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
