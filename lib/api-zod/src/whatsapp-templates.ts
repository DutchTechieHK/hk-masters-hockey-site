import { z } from "zod";

export const WhatsappTemplateItem = z.object({
  id: z.number(),
  name: z.string(),
  title: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListWhatsappTemplatesResponse = z.array(WhatsappTemplateItem);

export const CreateWhatsappTemplateBody = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required").max(10000),
});

export const DeleteWhatsappTemplateParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const UpdateWhatsappTemplateParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const UpdateWhatsappTemplateBody = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  title: z.string().min(1, "Title is required").max(200),
  body: z.string().min(1, "Body is required").max(10000),
});
