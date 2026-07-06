import { Router } from "express";
import { db } from "@workspace/db";
import { whatsappTemplatesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import {
  CreateWhatsappTemplateBody,
  DeleteWhatsappTemplateParams,
  UpdateWhatsappTemplateBody,
  UpdateWhatsappTemplateParams,
} from "@workspace/api-zod";

const router = Router();

router.get("/", requireAdminAccess, async (_req, res) => {
  const rows = await db
    .select()
    .from(whatsappTemplatesTable)
    .orderBy(asc(whatsappTemplatesTable.name));

  res.json(rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateWhatsappTemplateBody.parse(req.body);
  const [created] = await db
    .insert(whatsappTemplatesTable)
    .values({
      name: body.name.trim(),
      title: body.title.trim(),
      body: body.body,
    })
    .returning();

  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateWhatsappTemplateParams.parse(req.params);
  const body = UpdateWhatsappTemplateBody.parse(req.body);
  const [updated] = await db
    .update(whatsappTemplatesTable)
    .set({
      name: body.name.trim(),
      title: body.title.trim(),
      body: body.body,
      updatedAt: new Date(),
    })
    .where(eq(whatsappTemplatesTable.id, id))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.json({
    ...updated,
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  });
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteWhatsappTemplateParams.parse(req.params);
  const result = await db
    .delete(whatsappTemplatesTable)
    .where(eq(whatsappTemplatesTable.id, id))
    .returning({ id: whatsappTemplatesTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.status(204).send();
});

export default router;
