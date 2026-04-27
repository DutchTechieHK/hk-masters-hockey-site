import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contributionsTable = pgTable("contributions", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  authorName: text("author_name").notNull(),
  authorEmail: text("author_email").notNull(),
  contentType: text("content_type").notNull(),
  articleBody: text("article_body"),
  photoUrls: text("photo_urls").array(),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});

export const insertContributionSchema = createInsertSchema(contributionsTable).omit({
  id: true,
  status: true,
  adminNote: true,
  createdAt: true,
  reviewedAt: true,
});

export type InsertContribution = z.infer<typeof insertContributionSchema>;
export type Contribution = typeof contributionsTable.$inferSelect;
