import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { teamsTable } from "./teams";

export const playersTable = pgTable("players", {
  id: serial("id").primaryKey(),
  teamId: integer("team_id").references(() => teamsTable.id).notNull(),
  name: text("name").notNull(),
  shirtNumber: integer("shirt_number"),
  email: text("email").notNull(),
  phone: text("phone"),
  position: text("position"),
  shirtSize: text("shirt_size"),
  shortsSize: text("shorts_size"),
  jacketSize: text("jacket_size"),
  travelDates: text("travel_dates"),
  feePaid: boolean("fee_paid").default(false).notNull(),
  passportExpiry: text("passport_expiry"),
  dietaryRequirements: text("dietary_requirements"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
