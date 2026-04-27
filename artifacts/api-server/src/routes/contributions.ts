import { Router } from "express";
import { db } from "@workspace/db";
import { contributionsTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import {
  CreateContributionBody,
  UpdateContributionBody,
  UpdateContributionParams,
  ListContributionsQueryParams,
} from "@workspace/api-zod";
import { sendNewContributionEmail } from "../utils/email.js";
import { requireAdminKey } from "../middleware/adminAuth.js";

const router = Router();

function mapContributionAdmin(row: typeof contributionsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    authorName: row.authorName,
    authorEmail: row.authorEmail,
    contentType: row.contentType,
    articleBody: row.articleBody ?? undefined,
    photoUrls: row.photoUrls ?? [],
    status: row.status,
    adminNote: row.adminNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? undefined,
  };
}

function mapContributionPublic(row: typeof contributionsTable.$inferSelect) {
  return {
    id: row.id,
    title: row.title,
    authorName: row.authorName,
    contentType: row.contentType,
    articleBody: row.articleBody ?? undefined,
    photoUrls: row.photoUrls ?? [],
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? undefined,
  };
}

router.post("/", async (req, res) => {
  const body = CreateContributionBody.parse(req.body);
  const [contribution] = await db
    .insert(contributionsTable)
    .values({
      ...body,
      photoUrls: body.photoUrls ?? null,
      status: "pending",
    })
    .returning();

  sendNewContributionEmail({
    authorName: contribution.authorName,
    authorEmail: contribution.authorEmail,
    contentType: contribution.contentType,
    title: contribution.title,
    contributionId: contribution.id,
  }).catch((err: unknown) => console.error("[email] Unexpected error:", err));

  res.status(201).json(mapContributionPublic(contribution));
});

router.get("/approved", async (_req, res) => {
  const rows = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.status, "approved"))
    .orderBy(desc(contributionsTable.reviewedAt));
  res.json(rows.map(mapContributionPublic));
});

router.get("/", requireAdminKey, async (req, res) => {
  const query = ListContributionsQueryParams.parse(req.query);
  let rows;
  if (query.status) {
    rows = await db
      .select()
      .from(contributionsTable)
      .where(eq(contributionsTable.status, query.status))
      .orderBy(desc(contributionsTable.createdAt));
  } else {
    rows = await db
      .select()
      .from(contributionsTable)
      .orderBy(desc(contributionsTable.createdAt));
  }
  res.json(rows.map(mapContributionAdmin));
});

router.put("/:id", requireAdminKey, async (req, res) => {
  const { id } = UpdateContributionParams.parse(req.params);
  const body = UpdateContributionBody.parse(req.body);
  const [contribution] = await db
    .update(contributionsTable)
    .set({
      status: body.status,
      adminNote: body.adminNote ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(contributionsTable.id, id))
    .returning();
  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }
  res.json(mapContributionAdmin(contribution));
});

export default router;
