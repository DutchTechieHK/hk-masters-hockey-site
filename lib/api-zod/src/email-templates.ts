import { z } from "zod";

export const EmailTemplateItem = z.object({
  id: z.number(),
  name: z.string(),
  subject: z.string(),
  body: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const ListEmailTemplatesResponse = z.array(EmailTemplateItem);

export const CreateEmailTemplateBody = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  subject: z.string().min(1, "Subject is required").max(300),
  body: z.string().min(1, "Body is required").max(10000),
});

export const DeleteEmailTemplateParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const UpdateEmailTemplateParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const UpdateEmailTemplateBody = z.object({
  name: z.string().min(1, "Template name is required").max(200),
  subject: z.string().min(1, "Subject is required").max(300),
  body: z.string().min(1, "Body is required").max(10000),
});
