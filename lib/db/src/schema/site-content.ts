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
  // JSON object keyed by page (home, about, teams, rotterdam, contact, events, media)
  // holding editable page text — null means "never set" (use static defaults)
  pageTexts: text("page_texts"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
  // Per-section timestamps used for optimistic-concurrency checks so two admins
  // don't silently overwrite each other's edits.
  galleryUpdatedAt: timestamp("gallery_updated_at", { withTimezone: true }),
  mediaAlbumsUpdatedAt: timestamp("media_albums_updated_at", { withTimezone: true }),
  pageTextsUpdatedAt: timestamp("page_texts_updated_at", { withTimezone: true }),
});

export type SiteContent = typeof siteContentTable.$inferSelect;
