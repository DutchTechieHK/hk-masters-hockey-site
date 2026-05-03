import { pgTable, serial, text, timestamp, integer, index } from "drizzle-orm/pg-core";
import { playersTable } from "./players";

export const playerLoginCodesTable = pgTable("player_login_codes", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  consumedAt: timestamp("consumed_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  emailIdx: index("player_login_codes_email_idx").on(t.email),
}));

export const playerSessionsTable = pgTable("player_sessions", {
  token: text("token").primaryKey(),
  playerId: integer("player_id").references(() => playersTable.id, { onDelete: "cascade" }).notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PlayerSession = typeof playerSessionsTable.$inferSelect;
