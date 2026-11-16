import type { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";
import { db, eventsTable, eventRsvpsTable, eventRsvpAdminChangesTable } from "@workspace/db";
import { CorrectEventRsvpBody } from "@workspace/api-zod";
import { getSessionLabel } from "../middleware/adminSession";
import type { EventAudience } from "../utils/eventGroups";

// Inject the existing audience resolver so group and squad rules stay identical
// to the event roster, without introducing a circular route dependency.
export function createEventRsvpCorrection(
  invitees: (event: EventAudience) => Promise<Array<{ id: number }>>,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const id = Number(req.params.id);
    const playerId = Number(req.params.playerId);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(playerId) || playerId <= 0) {
      res.status(400).json({ error: "Invalid event or player id" }); return;
    }
    const parsed = CorrectEventRsvpBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Invalid reply. Include status and the expected reply version." }); return;
    }
    const { status, expected } = parsed.data;
    if (expected && (!Number.isSafeInteger(expected.id) || expected.id <= 0 ||
      !Number.isSafeInteger(expected.revision) || expected.revision <= 0)) {
      res.status(400).json({ error: "Invalid expected reply version" }); return;
    }
    const note = status === "yes" || status === null ? null : parsed.data.note?.trim() || null;
    if (status !== "yes" && status !== null && !note) {
      res.status(400).json({ error: "A reason is required for Maybe or Not going" }); return;
    }
    if (status === null && expected === null) {
      res.status(400).json({ error: "Nothing to clear" }); return;
    }
    const token = req.headers["x-session-token"];
    const actor = typeof token === "string" ? await getSessionLabel(token) ?? "Admin API key" : "Admin API key";
    const result = await db.transaction(async (tx) => {
      // Audience edits/deletions serialize here. Player replies remain protected
      // by the revision-checked UPDATE/DELETE, including a concurrently arriving reply.
      const [event] = await tx.select().from(eventsTable).where(eq(eventsTable.id, id)).for("update");
      if (!event) return { code: 404, error: "Event not found" } as const;
      if (event.operationalScope !== "local_2026_27") {
        return { code: 409, error: "Archived or unclassified event attendance is read-only" } as const;
      }
      if (!(await invitees(event)).some((player) => player.id === playerId)) {
        return { code: 403, error: "Player is not in this event's current invited audience" } as const;
      }
      const where = and(eq(eventRsvpsTable.eventId, id), eq(eventRsvpsTable.playerId, playerId));
      const [current] = await tx.select().from(eventRsvpsTable).where(where);
      if ((expected === null && current) || (expected !== null &&
        (!current || current.id !== expected.id || current.revision !== expected.revision))) {
        return { code: 409, error: "This reply changed. Refresh the roster and reopen the reply before editing." } as const;
      }
      const now = new Date();
      let changed: Array<{ id: number }>;
      if (status === null) {
        changed = await tx.delete(eventRsvpsTable)
          .where(and(eq(eventRsvpsTable.id, current!.id), eq(eventRsvpsTable.revision, current!.revision)))
          .returning({ id: eventRsvpsTable.id });
      } else if (current) {
        changed = await tx.update(eventRsvpsTable)
          .set({ status, note, respondedAt: now, revision: sql`${eventRsvpsTable.revision} + 1` })
          .where(and(eq(eventRsvpsTable.id, current.id), eq(eventRsvpsTable.revision, current.revision)))
          .returning({ id: eventRsvpsTable.id });
      } else {
        changed = await tx.insert(eventRsvpsTable).values({ eventId: id, playerId, status, note, respondedAt: now })
          .onConflictDoNothing().returning({ id: eventRsvpsTable.id });
      }
      if (!changed.length) return { code: 409, error: "This reply changed. Refresh the roster and reopen the reply." } as const;
      await tx.insert(eventRsvpAdminChangesTable).values({
        eventId: id, playerId, actor, previousStatus: current?.status ?? null,
        previousNote: current?.note ?? null, newStatus: status, newNote: note, changedAt: now,
      });
      return { code: 200, status, note } as const;
    });
    if ("error" in result) { res.status(result.code).json({ error: result.error }); return; }
    res.json({ status: result.status, note: result.note });
  };
}
