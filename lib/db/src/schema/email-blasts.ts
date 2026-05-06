import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const emailBlastsTable = pgTable("email_blasts", {
  id: serial("id").primaryKey(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  audienceType: text("audience_type").notNull(),
  teamIds: text("team_ids"),
  playerIds: text("player_ids"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  sentByEmail: text("sent_by_email"),
  sentAt: timestamp("sent_at").defaultNow().notNull(),
}, (t) => ({
  sentAtIdx: index("email_blasts_sent_at_idx").on(t.sentAt),
}));

export type EmailBlast = typeof emailBlastsTable.$inferSelect;
