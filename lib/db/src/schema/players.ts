import { pgTable, serial, text, boolean, integer, numeric, timestamp } from "drizzle-orm/pg-core";
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
  dateOfBirth: text("date_of_birth"),
  nationality: text("nationality"),
  passportNumber: text("passport_number"),
  passportExpiry: text("passport_expiry"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  flightArrivalDateTime: text("flight_arrival_date_time"),
  flightDepartureDateTime: text("flight_departure_date_time"),
  arrivalCity: text("arrival_city"),
  roomSharingPreference: text("room_sharing_preference"),
  roomSharingWith: text("room_sharing_with"),
  shirtSize: text("shirt_size"),
  shortsSize: text("shorts_size"),
  jacketSize: text("jacket_size"),
  travelDates: text("travel_dates"),
  feePaid: boolean("fee_paid").default(false).notNull(),
  paymentAmountDue: numeric("payment_amount_due", { precision: 10, scale: 2 }),
  paymentAmountPaid: numeric("payment_amount_paid", { precision: 10, scale: 2 }),
  paymentDate: text("payment_date"),
  dietaryRequirements: text("dietary_requirements"),
  medicalNotes: text("medical_notes"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPlayerSchema = createInsertSchema(playersTable).omit({ id: true, createdAt: true });
export type InsertPlayer = z.infer<typeof insertPlayerSchema>;
export type Player = typeof playersTable.$inferSelect;
