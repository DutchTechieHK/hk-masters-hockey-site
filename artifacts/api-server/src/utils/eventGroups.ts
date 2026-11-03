import { db, memberGroupMembersTable, eventGroupsTable, memberGroupsTable } from "@workspace/db";
import { asc, inArray } from "drizzle-orm";

export type EventAudience = { id: number; teamId: number | null; audienceMode?: string };
export type AudienceMember = { id: number; teamId: number | null };

export async function loadEventGroups(events: EventAudience[]) {
  const groupEvents = events.filter((event) => event.audienceMode === "groups");
  const links = groupEvents.length
    ? await db.select().from(eventGroupsTable).where(inArray(eventGroupsTable.eventId, groupEvents.map((event) => event.id)))
    : [];
  const ids = [...new Set(links.map((link) => link.groupId))];
  const members = ids.length
    ? await db.select().from(memberGroupMembersTable).where(inArray(memberGroupMembersTable.groupId, ids))
    : [];
  const groupIdsByEvent = new Map<number, number[]>();
  const playerIdsByEvent = new Map<number, Set<number>>();
  for (const event of groupEvents) {
    const groupIds = links.filter((link) => link.eventId === event.id).map((link) => link.groupId);
    groupIdsByEvent.set(event.id, groupIds);
    playerIdsByEvent.set(event.id, new Set(members.filter((member) => groupIds.includes(member.groupId)).map((member) => member.playerId)));
  }
  return {
    groupIdsByEvent,
    includes(event: EventAudience, player: AudienceMember) {
      // A missing/empty group association fails closed, never to "all squads".
      return event.audienceMode === "groups"
        ? playerIdsByEvent.get(event.id)?.has(player.id) === true
        : event.teamId == null || event.teamId === player.teamId;
    },
  };
}

export type EventWriteTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function lockEventGroups(tx: EventWriteTransaction, groupIds: number[]) {
  const groups = groupIds.length
    ? await tx.select({ id: memberGroupsTable.id }).from(memberGroupsTable)
        .where(inArray(memberGroupsTable.id, groupIds)).orderBy(asc(memberGroupsTable.id)).for("share")
    : [];
  if (groups.length !== groupIds.length) throw new InvalidEventGroups();
}

export class InvalidEventGroups extends Error {
  constructor() { super("One or more selected groups no longer exist. Reload and select groups again."); }
}
