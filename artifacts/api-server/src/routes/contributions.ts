import { Router } from "express";
import { db } from "@workspace/db";
import { contributionsTable } from "@workspace/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import {
  CreateContributionBody,
  UpdateContributionBody,
  UpdateContributionParams,
  ListContributionsQueryParams,
  LookupContributionBody,
} from "@workspace/api-zod";
import { sendNewContributionEmail, sendContributionDecisionEmail, sendContributionConfirmationEmail, sendContributionDeletedEmail } from "../utils/email.js";
import { requireAdminAccess } from "../middleware/adminAuth.js";
import { generateUniqueSlug } from "../utils/slug.js";
import { backfillSlugs } from "../utils/backfillSlugs.js";

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
    slug: row.slug ?? undefined,
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
  const slug = await generateUniqueSlug(body.title, async (candidate) => {
    const [existing] = await db
      .select({ id: contributionsTable.id })
      .from(contributionsTable)
      .where(eq(contributionsTable.slug, candidate));
    return !!existing;
  });
  const [contribution] = await db
    .insert(contributionsTable)
    .values({
      ...body,
      slug,
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
  }).catch((err: unknown) => console.error("[email] Unexpected error (admin notify):", err));

  sendContributionConfirmationEmail({
    authorName: contribution.authorName,
    authorEmail: contribution.authorEmail,
    contentType: contribution.contentType,
    title: contribution.title,
    contributionId: contribution.id,
  }).catch((err: unknown) => console.error("[email] Unexpected error (confirmation):", err));

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

router.get("/approved/:slug", async (req, res) => {
  const param = req.params.slug;

  const [slugRow] = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.slug, param));

  if (slugRow) {
    if (slugRow.status !== "approved") {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    res.json(mapContributionPublic(slugRow));
    return;
  }

  if (/^\d+$/.test(param)) {
    const numericId = parseInt(param, 10);
    const [idRow] = await db
      .select()
      .from(contributionsTable)
      .where(eq(contributionsTable.id, numericId));
    if (!idRow || idRow.status !== "approved") {
      res.status(404).json({ error: "Article not found" });
      return;
    }
    if (idRow.slug) {
      res.redirect(301, `/api/contributions/approved/${idRow.slug}`);
      return;
    }
    res.json(mapContributionPublic(idRow));
    return;
  }

  res.status(404).json({ error: "Article not found" });
});

router.post("/lookup", async (req, res) => {
  let body;
  try {
    body = LookupContributionBody.parse(req.body);
  } catch (err) {
    if (err != null && typeof err === "object" && "issues" in err) {
      res.status(400).json({ error: "Invalid email address" });
      return;
    }
    throw err;
  }
  const normalizedEmail = body.email.toLowerCase().trim();
  const rows = await db
    .select()
    .from(contributionsTable)
    .where(sql`lower(${contributionsTable.authorEmail}) = ${normalizedEmail}`)
    .orderBy(desc(contributionsTable.createdAt));
  const results = rows.map((row) => ({
    id: row.id,
    title: row.title,
    contentType: row.contentType,
    status: row.status,
    adminNote: row.adminNote ?? undefined,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt?.toISOString() ?? undefined,
  }));
  res.json(results);
});

router.get("/", requireAdminAccess, async (req, res) => {
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

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateContributionParams.parse(req.params);
  const body = UpdateContributionBody.parse(req.body);

  const [existing] = await db
    .select()
    .from(contributionsTable)
    .where(eq(contributionsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  const updateValues: Partial<typeof contributionsTable.$inferInsert> = {
    status: body.status,
    adminNote: body.adminNote ?? null,
    reviewedAt: new Date(),
  };
  if (body.title !== undefined) updateValues.title = body.title;
  if (body.articleBody !== undefined) updateValues.articleBody = body.articleBody;
  if (body.photoUrls !== undefined) updateValues.photoUrls = body.photoUrls;

  if (body.title !== undefined && existing.status === "pending") {
    updateValues.slug = await generateUniqueSlug(body.title, async (candidate) => {
      const [existingSlug] = await db
        .select({ id: contributionsTable.id })
        .from(contributionsTable)
        .where(eq(contributionsTable.slug, candidate));
      return !!existingSlug && existingSlug.id !== id;
    });
  }

  const [contribution] = await db
    .update(contributionsTable)
    .set(updateValues)
    .where(eq(contributionsTable.id, id))
    .returning();
  if (!contribution) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  if (body.status === "approved" || body.status === "declined") {
    const editDetails: {
      titleChanged?: { from: string; to: string };
      photosRemovedCount?: number;
    } = {};

    if (body.title !== undefined && body.title !== existing.title) {
      editDetails.titleChanged = { from: existing.title, to: body.title };
    }

    if (body.photoUrls !== undefined) {
      const oldCount = (existing.photoUrls ?? []).length;
      const newCount = body.photoUrls.length;
      if (newCount < oldCount) {
        editDetails.photosRemovedCount = oldCount - newCount;
      }
    }

    sendContributionDecisionEmail({
      authorName: contribution.authorName,
      authorEmail: contribution.authorEmail,
      title: contribution.title,
      status: body.status,
      adminNote: contribution.adminNote ?? undefined,
      contributionId: contribution.id,
      slug: contribution.slug ?? undefined,
      editDetails: Object.keys(editDetails).length > 0 ? editDetails : undefined,
    }).catch((err: unknown) => console.error("[email] Unexpected error:", err));
  }

  res.json(mapContributionAdmin(contribution));
});

router.post("/backfill-slugs", requireAdminAccess, async (_req, res) => {
  const updated = await backfillSlugs();
  res.json({ updated });
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  if (!/^\d+$/.test(req.params.id)) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const id = parseInt(req.params.id, 10);
  const [deleted] = await db
    .delete(contributionsTable)
    .where(eq(contributionsTable.id, id))
    .returning();
  if (!deleted) {
    res.status(404).json({ error: "Contribution not found" });
    return;
  }

  sendContributionDeletedEmail({
    authorName: deleted.authorName,
    authorEmail: deleted.authorEmail,
    title: deleted.title,
    contentType: deleted.contentType,
    contributionId: deleted.id,
    status: deleted.status,
  }).catch((err: unknown) => console.error("[email] Unexpected error (deletion notify):", err));

  res.status(204).send();
});

export default router;
