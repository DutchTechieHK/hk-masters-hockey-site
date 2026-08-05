import { z } from "zod";

export const CreateContributionBody = z.object({
  title: z.string().min(1),
  authorName: z.string().min(1),
  authorEmail: z.string().email(),
  contentType: z.enum(["article", "photo", "both"]),
  articleBody: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional(),
});

export const UpdateContributionBody = z.object({
  status: z.enum(["approved", "declined"]),
  adminNote: z.string().optional(),
  title: z.string().min(1).optional(),
  articleBody: z.string().optional(),
  photoUrls: z.array(z.string().url()).optional(),
  reportDate: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Invalid date")
    .nullable()
    .optional(),
});

export const UpdateContributionParams = z.object({
  id: z.coerce.number().int().positive(),
});

export const ListContributionsQueryParams = z.object({
  status: z.enum(["pending", "approved", "declined"]).optional(),
});

export const LookupContributionBody = z.object({
  email: z.string().email(),
});

export type CreateContribution = z.infer<typeof CreateContributionBody>;
export type UpdateContribution = z.infer<typeof UpdateContributionBody>;
export type LookupContribution = z.infer<typeof LookupContributionBody>;
