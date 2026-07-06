import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const whatsappTemplatesTable = pgTable("whatsapp_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type WhatsappTemplate = typeof whatsappTemplatesTable.$inferSelect;
