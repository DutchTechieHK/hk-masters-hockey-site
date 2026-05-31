import { pgTable, serial, text, integer, boolean, numeric, timestamp } from "drizzle-orm/pg-core";

export const legoJarPrizesTable = pgTable("lego_jar_prizes", {
  id: serial("id").primaryKey(),
  rank: integer("rank").notNull().unique(),
  badge: text("badge").notNull(),
  badgeColor: text("badge_color").notNull(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  imageAlt: text("image_alt"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const legoJarConfigTable = pgTable("lego_jar_config", {
  id: serial("id").primaryKey(),
  pricePerGuess: numeric("price_per_guess", { precision: 10, scale: 2 }).notNull().default("50"),
  actualCount: integer("actual_count"),
  status: text("status").notNull().default("active"),
  imageUrl: text("image_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const legoJarRoundsTable = pgTable("lego_jar_rounds", {
  id: serial("id").primaryKey(),
  holderName: text("holder_name").notNull(),
  squadMemberId: integer("squad_member_id"),
  location: text("location"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  endedAt: timestamp("ended_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const legoJarGuessesTable = pgTable("lego_jar_guesses", {
  id: serial("id").primaryKey(),
  roundId: integer("round_id").references(() => legoJarRoundsTable.id),
  guesserName: text("guesser_name").notNull(),
  guesserEmail: text("guesser_email"),
  guessNumber: integer("guess_number").notNull(),
  paymentMethod: text("payment_method"),
  paid: boolean("paid").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
