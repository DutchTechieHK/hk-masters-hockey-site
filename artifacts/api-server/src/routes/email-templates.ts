import { Router } from "express";
import { db } from "@workspace/db";
import { emailTemplatesTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { CreateEmailTemplateBody, DeleteEmailTemplateParams } from "@workspace/api-zod";

const router = Router();

router.get("/", requireAdminAccess, async (_req, res) => {
  const rows = await db
    .select()
    .from(emailTemplatesTable)
    .orderBy(asc(emailTemplatesTable.name));

  res.json(rows.map((r) => ({
    ...r,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  })));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateEmailTemplateBody.parse(req.body);
  const [created] = await db
    .insert(emailTemplatesTable)
    .values({
      name: body.name.trim(),
      subject: body.subject.trim(),
      body: body.body,
    })
    .returning();

  res.status(201).json({
    ...created,
    createdAt: created.createdAt.toISOString(),
    updatedAt: created.updatedAt.toISOString(),
  });
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteEmailTemplateParams.parse(req.params);
  const result = await db
    .delete(emailTemplatesTable)
    .where(eq(emailTemplatesTable.id, id))
    .returning({ id: emailTemplatesTable.id });

  if (result.length === 0) {
    res.status(404).json({ error: "Template not found" });
    return;
  }
  res.status(204).send();
});

export default router;
