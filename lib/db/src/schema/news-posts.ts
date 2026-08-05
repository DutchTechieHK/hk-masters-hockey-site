import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const newsPostsTable = pgTable("news_posts", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull(),
  excerpt: text("excerpt"),
  bodyHtml: text("body_html"),
  coverImage: text("cover_image"),
  category: text("category"),
  author: text("author"),
  status: text("status").notNull().default("draft"),
  publishedAt: timestamp("published_at"),
  reportDate: timestamp("report_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
