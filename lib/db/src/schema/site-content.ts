import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const siteContentTable = pgTable("site_content", {
  id: serial("id").primaryKey(),
  heroImage: text("hero_image"),
  mo40Photo: text("mo40_photo"),
  mo50Photo: text("mo50_photo"),
  galleryImages: text("gallery_images").notNull().default("[]"),
  // JSON array of { name, photos: string[] } — null means "never set" (use static defaults)
  mediaAlbums: text("media_albums"),
  // JSON array of { youtube_id, title, description? } — null means "never set" (use static defaults)
  mediaVideos: text("media_videos"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type SiteContent = typeof siteContentTable.$inferSelect;
