import { z } from "zod";

export const SendBulkEmailBody = z.object({
  audienceType: z.enum(["all", "teams", "individuals"]),
  teamIds: z.array(z.number().int().positive()).optional(),
  playerIds: z.array(z.number().int().positive()).optional(),
  subject: z.string().min(1, "Subject is required").max(300),
  body: z.string().min(1, "Message body is required").max(10000),
});

export type SendBulkEmail = z.infer<typeof SendBulkEmailBody>;

export const SendBulkEmailResponse = z.object({
  sent: z.number(),
  failed: z.number(),
  skipped: z.number(),
  total: z.number(),
  blastId: z.number(),
});

export const EmailBlastItem = z.object({
  id: z.number(),
  subject: z.string(),
  body: z.string(),
  audienceType: z.string(),
  teamIds: z.string().nullable(),
  playerIds: z.string().nullable(),
  recipientCount: z.number(),
  sentCount: z.number(),
  failedCount: z.number(),
  sentByEmail: z.string().nullable(),
  sentAt: z.string(),
});

export const ListEmailBlastsResponse = z.array(EmailBlastItem);
