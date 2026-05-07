import { z } from "zod";

export const DOCUMENT_CATEGORIES = ["mandatory-form", "regulation", "information"] as const;

export const CreateDocumentBody = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  category: z.enum(DOCUMENT_CATEGORIES),
  fileUrl: z.string().url(),
  fileName: z.string().min(1),
  fileSize: z.number().int().positive().optional(),
});

export const DeleteDocumentParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const DocumentItem = z.object({
  id: z.number().int(),
  title: z.string(),
  description: z.string().nullable().optional(),
  category: z.enum(DOCUMENT_CATEGORIES),
  fileUrl: z.string(),
  fileName: z.string(),
  fileSize: z.number().nullable().optional(),
  uploadedBy: z.string().nullable().optional(),
  uploadedAt: z.string().optional(),
});

export type CreateDocument = z.infer<typeof CreateDocumentBody>;
export type DeleteDocumentParam = z.infer<typeof DeleteDocumentParams>;
export type DocumentItemType = z.infer<typeof DocumentItem>;
