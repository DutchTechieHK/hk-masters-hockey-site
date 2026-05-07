import { Router } from "express";
import { db } from "@workspace/db";
import { documentsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { requireSession } from "../middleware/adminSession";

const router = Router();

const VALID_CATEGORIES = ["mandatory-form", "regulation", "information"] as const;
type DocCategory = typeof VALID_CATEGORIES[number];

const ALLOWED_EXTENSIONS = [".pdf"];

function parseCreateBody(body: unknown): {
  title: string;
  description: string | null;
  category: DocCategory;
  fileUrl: string;
  fileName: string;
  fileSize: number | null;
  uploadedByEmail: null;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "title required" };
  const category = b.category as string;
  if (!VALID_CATEGORIES.includes(category as DocCategory)) return { error: "Invalid category" };
  const fileUrl = typeof b.fileUrl === "string" ? b.fileUrl.trim() : "";
  if (!fileUrl) return { error: "fileUrl required" };
  const fileName = typeof b.fileName === "string" ? b.fileName.trim() : "";
  if (!fileName) return { error: "fileName required" };
  const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
  if (!ALLOWED_EXTENSIONS.includes(ext)) return { error: `Only PDF files are allowed (got ${ext || "unknown"})` };
  const description = typeof b.description === "string" && b.description.trim() ? b.description.trim() : null;
  const fileSize = typeof b.fileSize === "number" && b.fileSize > 0 ? b.fileSize : null;
  return { title, description, category: category as DocCategory, fileUrl, fileName, fileSize, uploadedByEmail: null };
}

function mapDocument(doc: typeof documentsTable.$inferSelect) {
  return {
    id: doc.id,
    title: doc.title,
    description: doc.description,
    category: doc.category,
    fileUrl: doc.fileUrl,
    fileName: doc.fileName,
    fileSize: doc.fileSize,
    uploadedByEmail: doc.uploadedByEmail,
    uploadedAt: doc.uploadedAt?.toISOString(),
  };
}

router.get("/", requireAdminAccess, async (_req, res) => {
  const docs = await db
    .select()
    .from(documentsTable)
    .orderBy(documentsTable.category, documentsTable.uploadedAt);
  res.json(docs.map(mapDocument));
});

router.post("/", requireSession, async (req, res) => {
  const parsed = parseCreateBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const [doc] = await db
    .insert(documentsTable)
    .values(parsed)
    .returning();
  res.status(201).json(mapDocument(doc));
});

router.delete("/:id", requireSession, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const result = await db
    .delete(documentsTable)
    .where(eq(documentsTable.id, id))
    .returning({ id: documentsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

export default router;
