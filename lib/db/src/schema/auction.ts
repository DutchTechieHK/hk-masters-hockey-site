import { pgTable, serial, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";

export const auctionSettingsTable = pgTable("auction_settings", {
  id: serial("id").primaryKey(),
  isLive: boolean("is_live").notNull().default(false),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const auctionItemsTable = pgTable("auction_items", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  startingPrice: numeric("starting_price", { precision: 10, scale: 2 }).notNull(),
  minIncrement: numeric("min_increment", { precision: 10, scale: 2 }).notNull().default("100"),
  opensAt: timestamp("opens_at"),
  closesAt: timestamp("closes_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const auctionBidsTable = pgTable("auction_bids", {
  id: serial("id").primaryKey(),
  itemId: integer("item_id").references(() => auctionItemsTable.id).notNull(),
  bidderName: text("bidder_name").notNull(),
  bidderEmail: text("bidder_email").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  placedAt: timestamp("placed_at").defaultNow().notNull(),
});

export type AuctionSettings = typeof auctionSettingsTable.$inferSelect;
export type AuctionItem = typeof auctionItemsTable.$inferSelect;
export type AuctionBid = typeof auctionBidsTable.$inferSelect;
