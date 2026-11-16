import { Router, type Request, type Response, type NextFunction } from "express";
import { randomUUID } from "node:crypto";
import { db, membershipCategoriesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { z } from "zod";
import { CreateMembershipCategoryBody, UpdateMembershipCategoryBody, ListMembershipCategoriesResponse, UpdateMembershipCategoryResponse } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { categoryInput, categoryRows, categoryJson, CategoryError, lockCategories, seedMissingCategories } from "../utils/membershipCategories";

const router = Router();
router.use(requireAdminAccess);
router.use((_req, res, next) => { res.set("Cache-Control", "private, no-store"); next(); });
router.get("/", async (_req, res) => {
  const rows = await db.transaction(async tx => {
    await lockCategories(tx);
    await seedMissingCategories(tx);
    return categoryRows(tx);
  });
  res.json(ListMembershipCategoriesResponse.parse(rows.map(categoryJson)));
});
router.post("/", async (req, res) => {
  const input = categoryInput.strict().parse(req.body);
  CreateMembershipCategoryBody.parse(input);
  const row = await db.transaction(async tx => {
    await lockCategories(tx);
    await seedMissingCategories(tx);
    const [created] = await tx.insert(membershipCategoriesTable).values({
      key: `category_${randomUUID().replaceAll("-", "")}`, name: input.name,
      defaultFee: input.defaultFee?.toFixed(2) ?? null,
    }).returning();
    return created;
  });
  res.status(201).json(UpdateMembershipCategoryResponse.parse(categoryJson(row)));
});
router.patch("/:key", async (req, res) => {
  const input = categoryInput.extend({ retired: z.boolean(), version: z.number().int().positive() }).strict().parse(req.body);
  UpdateMembershipCategoryBody.parse(input);
  const row = await db.transaction(async tx => {
    await lockCategories(tx);
    await seedMissingCategories(tx);
    const [existing] = await tx.select().from(membershipCategoriesTable).where(eq(membershipCategoriesTable.key, String(req.params.key)));
    if (!existing) throw new CategoryError(404, "Category not found.");
    if (existing.protected && input.retired) throw new CategoryError(400, "Awaiting Selection and Trials must remain available for automatic onboarding.");
    const [saved] = await tx.update(membershipCategoriesTable).set({
      name: input.name, defaultFee: input.defaultFee?.toFixed(2) ?? null,
      retired: input.retired, version: sql`${membershipCategoriesTable.version} + 1`,
    }).where(and(eq(membershipCategoriesTable.key, existing.key), eq(membershipCategoriesTable.version, input.version))).returning();
    if (!saved) throw new CategoryError(409, "Another administrator changed this category. Reload before saving.");
    return saved;
  });
  res.json(UpdateMembershipCategoryResponse.parse(categoryJson(row)));
});
router.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
  if (error instanceof CategoryError) { res.status(error.status).json({ error: error.message }); return; }
  if (error instanceof z.ZodError) { res.status(400).json({ error: error.issues.map(i => i.message).join(" ") }); return; }
  const databaseError = error as { code?: string; cause?: { code?: string } } | null;
  if (databaseError?.code === "23505" || databaseError?.cause?.code === "23505") {
    res.status(400).json({ error: "A category with that name already exists (including retired categories)." }); return;
  }
  next(error);
});
export default router;
