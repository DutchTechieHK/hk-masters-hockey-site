import { pgTable, serial, text, integer, timestamp, primaryKey, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { playersTable } from "./players";
import { eventsTable } from "./events";

export const memberGroupsTable = pgTable("member_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberGroupMembersTable = pgTable("member_group_members", {
  groupId: integer("group_id").notNull().references(() => memberGroupsTable.id, { onDelete: "cascade" }),
  playerId: integer("player_id").notNull().references(() => playersTable.id, { onDelete: "cascade" }),
}, (t) => [
  primaryKey({ columns: [t.groupId, t.playerId] }),
  index("member_group_members_player_idx").on(t.playerId),
]);

export const eventGroupsTable = pgTable("event_groups", {
  eventId: integer("event_id").notNull().references(() => eventsTable.id, { onDelete: "cascade" }),
  groupId: integer("group_id").notNull().references(() => memberGroupsTable.id, { onDelete: "restrict" }),
}, (t) => [
  primaryKey({ columns: [t.eventId, t.groupId] }),
  index("event_groups_group_idx").on(t.groupId),
]);

export const insertMemberGroupSchema = createInsertSchema(memberGroupsTable).omit({ id: true, createdAt: true, version: true });
export type MemberGroup = typeof memberGroupsTable.$inferSelect;
export type InsertMemberGroup = typeof memberGroupsTable.$inferInsert;
