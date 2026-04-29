import { Router } from "express";
import { db } from "@workspace/db";
import { sponsorsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import { CreateSponsorBody, UpdateSponsorParams, DeleteSponsorParams } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

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
  }).returning();
  res.status(201).json({
    id: sponsor.id,
    name: sponsor.name,
    logoUrl: sponsor.logoUrl ?? undefined,
    websiteUrl: sponsor.websiteUrl ?? undefined,
    tier: sponsor.tier,
    active: sponsor.active,
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
    createdAt: sponsor.createdAt?.toISOString(),
  });
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteSponsorParams.parse(req.params);
  await db.delete(sponsorsTable).where(eq(sponsorsTable.id, id));
  res.status(204).send();
});

export default router;
