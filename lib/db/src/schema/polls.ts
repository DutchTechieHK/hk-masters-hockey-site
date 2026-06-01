import { pgTable, serial, text, integer, timestamp, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const pollsTable = pgTable("polls", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  audience: text("audience").notNull().default("all"),
  allowMultiple: boolean("allow_multiple").notNull().default(false),
  deadline: timestamp("deadline"),
  closedAt: timestamp("closed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pollOptionsTable = pgTable("poll_options", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").references(() => pollsTable.id, { onDelete: "cascade" }).notNull(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const pollVotesTable = pgTable("poll_votes", {
  id: serial("id").primaryKey(),
  pollId: integer("poll_id").references(() => pollsTable.id, { onDelete: "cascade" }).notNull(),
  optionId: integer("option_id").references(() => pollOptionsTable.id, { onDelete: "cascade" }).notNull(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqueOptionPlayer: uniqueIndex("poll_votes_option_player_unique").on(t.optionId, t.playerId),
}));
