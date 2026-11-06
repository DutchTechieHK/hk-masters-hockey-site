import type { Request, Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, pool, eventsTable, eventRsvpsTable, emailBlastsTable, emailBlastRecipientsTable } from "@workspace/db";
import { assertStaffResource, lookupStaffIdentity, StaffAccessError } from "../middleware/staffAccess";
import { listEventInvitees } from "../routes/events";
import { formatEventDateTime } from "./eventTime";
import { sendRsvpReminderEmail } from "./email";

// Staff reminder sends get their own exact-event ledger. A pending/ambiguous
// provider outcome is never automatically retried.
export async function remindStaffEvent(req: Request, res: Response) {
  const id = Number(req.params.id);
  const lock = await pool.connect();
  let acquired = false;
  try {
    acquired = (await lock.query("SELECT pg_try_advisory_lock(639, $1) AS acquired", [id])).rows[0]?.acquired === true;
    if (!acquired) throw new StaffAccessError(409, "Reminders for this event are already being sent.");
    const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
    if (!event) throw new StaffAccessError(404, "Event not found.");
    assertStaffResource(req, event);
    if (event.startsAt <= new Date()) throw new StaffAccessError(409, "Reminders are only available for future team events.");
    const invited = await listEventInvitees(event, true);
    const replied = new Set((await db.select({ playerId: eventRsvpsTable.playerId }).from(eventRsvpsTable).where(eq(eventRsvpsTable.eventId, id))).map((r) => r.playerId));
    const audienceType = `staff-event-rsvp-reminder:${id}`;
    const previous = await db.select({ playerId: emailBlastRecipientsTable.playerId, sent: emailBlastRecipientsTable.sent, errorMessage: emailBlastRecipientsTable.errorMessage })
      .from(emailBlastRecipientsTable).innerJoin(emailBlastsTable, eq(emailBlastsTable.id, emailBlastRecipientsTable.blastId))
      .where(eq(emailBlastsTable.audienceType, audienceType));
    const sentBefore = new Set(previous.filter((r) => r.sent).map((r) => r.playerId));
    const uncertain = new Set(previous.filter((r) => !r.sent && ["delivery_pending", "delivery_uncertain"].includes(r.errorMessage ?? "")).map((r) => r.playerId));
    const nonresponders = invited.filter((p) => !replied.has(p.id));
    const recipients = nonresponders.filter((p) => p.email && !sentBefore.has(p.id) && !uncertain.has(p.id));
    const summary = {
      total: nonresponders.length, sent: 0, failed: 0, skippedChanged: 0, historyRecorded: true,
      skippedNoEmail: nonresponders.filter((p) => !p.email).length,
      skippedAlreadySent: nonresponders.filter((p) => sentBefore.has(p.id)).length,
      skippedUncertain: nonresponders.filter((p) => !sentBefore.has(p.id) && uncertain.has(p.id)).length,
    };
    if (!recipients.length) { res.json(summary); return; }
    const { eventDate, eventTime } = formatEventDateTime(event.startsAt);
    const [blast] = await db.insert(emailBlastsTable).values({
      subject: `Quick reply needed: ${event.title}`, body: `Team event reminder\nEvent #${id}: ${event.title}\n${eventDate} ${eventTime} HKT`,
      audienceType, operationalScope: "local_2026_27", teamIds: JSON.stringify([event.teamId]),
      playerIds: JSON.stringify(recipients.map((p) => p.id)), recipientCount: recipients.length,
      sentByEmail: req.staffActor!,
    }).returning({ id: emailBlastsTable.id });
    for (const person of recipients) {
      const identity = await lookupStaffIdentity(String(req.headers["x-session-token"]));
      const [current] = await db.select().from(eventsTable).where(eq(eventsTable.id, id));
      const [reply] = await db.select({ id: eventRsvpsTable.id }).from(eventRsvpsTable)
        .where(and(eq(eventRsvpsTable.eventId, id), eq(eventRsvpsTable.playerId, person.id)));
      const eligible = current && (await listEventInvitees(current, true)).some((p) => p.id === person.id);
      if (!identity?.grants.some((g) => g.teamId === req.staffTeamId && g.manageAttendance) || !current ||
        current.teamId !== event.teamId || current.operationalScope !== "local_2026_27" ||
        current.audienceMode !== "squad" || current.isPublic || current.startsAt <= new Date() || reply || !eligible) {
        summary.skippedChanged++; continue;
      }
      const [pending] = await db.insert(emailBlastRecipientsTable).values({
        blastId: blast.id, playerId: person.id, playerName: person.name, playerEmail: person.email!,
        sent: false, errorMessage: "delivery_pending",
      }).returning({ id: emailBlastRecipientsTable.id });
      // The mail helper returns false for provider exceptions too, which can be
      // ambiguous; conservatively block resends until a full admin reconciles.
      let ok = false;
      try {
        ok = await sendRsvpReminderEmail({
          playerName: person.name, playerEmail: person.email!, eventTitle: current.title,
          ...formatEventDateTime(current.startsAt),
          scheduleUrl: `${process.env.PUBLIC_URL || "https://www.hkmastershockey.com"}/schedule`,
        });
      } catch { /* pending is retained if the process/provider fails */ }
      if (ok) summary.sent++; else summary.failed++;
      try {
        await db.update(emailBlastRecipientsTable).set({ sent: ok, errorMessage: ok ? null : "delivery_uncertain" }).where(eq(emailBlastRecipientsTable.id, pending.id));
        await db.update(emailBlastsTable).set({ sentCount: summary.sent, failedCount: summary.failed }).where(eq(emailBlastsTable.id, blast.id));
      } catch {
        // Stop sending if outcomes cannot be persisted. The pending record is
        // enough to prevent a duplicate retry for this recipient.
        summary.historyRecorded = false; break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    res.json(summary);
  } finally {
    try { if (acquired) await lock.query("SELECT pg_advisory_unlock(639, $1)", [id]); }
    finally { lock.release(); }
  }
}
