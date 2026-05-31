import { pgTable, serial, text, numeric, timestamp } from "drizzle-orm/pg-core";

export const funRunParticipantsTable = pgTable("fun_run_participants", {
  id: serial("id").primaryKey(),
  participantName: text("participant_name").notNull(),
  participantEmail: text("participant_email"),
  pledgePerKm: numeric("pledge_per_km", { precision: 10, scale: 2 }).notNull().default("0"),
  distanceKm: numeric("distance_km", { precision: 8, scale: 2 }),
  status: text("status").notNull().default("registered"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
