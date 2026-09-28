import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import {
  db, pool, matchesTable, matchChangeNoticesTable, playerParticipationsTable,
  playersTable, seasonsTable, emailBlastsTable, emailBlastRecipientsTable,
} from "@workspace/db";
import { sendMatchChangeEmail } from "../utils/email";
import { getSessionLabel } from "../middleware/adminSession";

function format(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Hong_Kong", weekday: "short", day: "numeric", month: "long",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(date) + " HKT";
}

async function latest(id: number) {
  const [notice] = await db.select().from(matchChangeNoticesTable)
    .where(eq(matchChangeNoticesTable.matchId, id))
    .orderBy(desc(matchChangeNoticesTable.id)).limit(1);
  return notice;
}

async function eligible(teamId: number) {
  const rows = await db.select({
    id: playersTable.id, name: playersTable.name, email: playersTable.email,
  }).from(playerParticipationsTable)
    .innerJoin(seasonsTable, eq(seasonsTable.id, playerParticipationsTable.seasonId))
    .innerJoin(playersTable, eq(playersTable.id, playerParticipationsTable.playerId))
    .where(and(eq(seasonsTable.slug, "membership-2026-27"),
      eq(playerParticipationsTable.participationStatus, "active"),
      eq(playerParticipationsTable.teamId, teamId), eq(playersTable.memberStatus, "active")));
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

function content(notice: NonNullable<Awaited<ReturnType<typeof latest>>>) {
  const fixture = `HK Masters vs ${notice.opponent}`;
  const subject = `${notice.kind === "cancelled" ? "Match cancelled" : "Match rescheduled"}: ${fixture}`;
  const message = notice.kind === "cancelled"
    ? `${fixture} has been cancelled.\nOriginal kick-off: ${format(notice.previousKickoffAt)}${notice.venue ? `\nVenue: ${notice.venue}` : ""}\nPlease do not travel to this match.`
    : `${fixture} has been rescheduled.\nPrevious kick-off: ${format(notice.previousKickoffAt)}\nNew kick-off: ${format(notice.kickoffAt)}${notice.venue ? `\nVenue: ${notice.venue}` : ""}\nPlease check the schedule for the latest details.`;
  return { subject, message };
}

async function state(id: number) {
  const notice = await latest(id);
  if (!notice) return null;
  const [match] = await db.select().from(matchesTable).where(eq(matchesTable.id, id));
  const current = !!match && match.operationalScope === "local_2026_27" &&
    match.status === (notice.kind === "cancelled" ? "cancelled" : "scheduled") &&
    match.kickoffAt.getTime() === notice.kickoffAt.getTime() &&
    match.teamId === notice.teamId && match.opponent === notice.opponent &&
    match.venue === notice.venue;
  const audienceType = `match-change:${notice.id}`;
  const players = current ? await eligible(notice.teamId) : [];
  const previous = await db.select({
    playerId: emailBlastRecipientsTable.playerId, sent: emailBlastRecipientsTable.sent,
    errorMessage: emailBlastRecipientsTable.errorMessage,
    playerName: emailBlastRecipientsTable.playerName,
  }).from(emailBlastRecipientsTable)
    .innerJoin(emailBlastsTable, eq(emailBlastsTable.id, emailBlastRecipientsTable.blastId))
    .where(eq(emailBlastsTable.audienceType, audienceType));
  const sent = new Set(previous.filter((r) => r.sent).map((r) => r.playerId));
  const uncertain = new Set(previous.filter((r) =>
    !r.sent && (r.errorMessage === "delivery_pending" || r.errorMessage === "delivery_uncertain"),
  ).map((r) => r.playerId));
  const remaining = players.filter((p) => p.email && !sent.has(p.id) && !uncertain.has(p.id));
  return { notice, current, audienceType, players, remaining, previous, sent, uncertain, ...content(notice) };
}

function preview(value: NonNullable<Awaited<ReturnType<typeof state>>>) {
  const { notice, current, players, remaining, previous, sent, uncertain, subject, message } = value;
  return {
    revisionId: notice.id, kind: notice.kind, current,
    subject, message, changedAt: notice.createdAt.toISOString(),
    total: players.length, ready: remaining.length,
    noEmail: players.filter((p) => !p.email).length,
    sent: players.filter((p) => sent.has(p.id)).length,
    uncertain: players.filter((p) => uncertain.has(p.id) && !sent.has(p.id)).length,
    deliveries: previous.map((r) => ({
      playerName: r.playerName,
      status: r.sent ? "sent" : r.errorMessage === "confirmed_not_delivered" ? "confirmed_failed" : "uncertain",
    })),
  };
}

function parseId(req: Request) {
  const id = Number(req.params.id);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function previewMatchChange(req: Request, res: Response): Promise<void> {
  const id = parseId(req);
  if (id == null) { res.status(400).json({ error: "Invalid match id" }); return; }
  const value = await state(id);
  if (!value) { res.status(404).json({ error: "No fixture change recorded for this match" }); return; }
  res.json(preview(value));
}

export async function sendMatchChange(req: Request, res: Response): Promise<void> {
  const id = parseId(req);
  if (id == null || !Number.isSafeInteger(req.body?.revisionId)) {
    res.status(400).json({ error: "Match id and revisionId are required" }); return;
  }
  const client = await pool.connect();
  let locked = false;
  try {
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(613, $1) AS acquired", [id]);
    locked = lock.rows[0]?.acquired === true;
    if (!locked) { res.status(409).json({ error: "A change notice is already being sent" }); return; }
    const value = await state(id);
    if (!value || !value.current || value.notice.id !== req.body.revisionId) {
      res.status(409).json({ error: "The fixture has changed. Refresh the preview before sending." }); return;
    }
    const sender = typeof req.headers["x-session-token"] === "string"
      ? await getSessionLabel(req.headers["x-session-token"]) : null;
    let sent = 0, uncertain = 0, skippedChanged = 0, historyRecorded = true;
    if (value.remaining.length) {
      const [blast] = await db.insert(emailBlastsTable).values({
        subject: value.subject, body: value.message, audienceType: value.audienceType,
        teamIds: JSON.stringify([value.notice.teamId]),
        playerIds: JSON.stringify(value.remaining.map((p) => p.id)),
        recipientCount: value.remaining.length, failedCount: value.remaining.length,
        sentByEmail: sender ?? "HK Masters Hockey", operationalScope: "local_2026_27",
      }).returning({ id: emailBlastsTable.id });
      for (let i = 0; i < value.remaining.length; i++) {
        const player = value.remaining[i];
        const fresh = await state(id);
        if (!fresh?.current || fresh.notice.id !== value.notice.id) {
          skippedChanged += value.remaining.length - i;
          break;
        }
        if (!fresh.remaining.some((p) => p.id === player.id && p.email === player.email)) {
          skippedChanged++;
          continue;
        }
        let recipientId: number;
        try {
          const [claim] = await db.insert(emailBlastRecipientsTable).values({
            blastId: blast.id, playerId: player.id, playerName: player.name,
            playerEmail: player.email!, sent: false, errorMessage: "delivery_pending",
          }).returning({ id: emailBlastRecipientsTable.id });
          recipientId = claim.id;
        } catch {
          historyRecorded = false;
          break;
        }
        let ok = false;
        try {
          ok = await sendMatchChangeEmail({
            playerName: player.name, playerEmail: player.email!,
            subject: value.subject, message: value.message,
            matchUrl: `${process.env.PUBLIC_URL || "https://www.hkmastershockey.com"}/schedule#match-${id}`,
          });
        } catch {
          // An exception can happen after provider acceptance; the claim remains uncertain.
        }
        if (ok) sent++; else uncertain++;
        try {
          await db.transaction(async (tx) => {
            await tx.update(emailBlastRecipientsTable).set({
              sent: ok, errorMessage: ok ? null : "delivery_uncertain",
            }).where(eq(emailBlastRecipientsTable.id, recipientId));
            await tx.update(emailBlastsTable).set({
              sentCount: sent, failedCount: value.remaining.length - sent - skippedChanged,
            }).where(eq(emailBlastsTable.id, blast.id));
          });
        } catch {
          historyRecorded = false;
          break;
        }
        if (i < value.remaining.length - 1) await new Promise((resolve) => setTimeout(resolve, 500));
      }
      if (historyRecorded) {
        try {
          await db.update(emailBlastsTable).set({
            recipientCount: sent + uncertain, sentCount: sent, failedCount: uncertain,
          }).where(eq(emailBlastsTable.id, blast.id));
        } catch { historyRecorded = false; }
      }
    }
    res.json({ sent, uncertain, skippedChanged, historyRecorded, preview: preview((await state(id)) ?? value) });
  } finally {
    try { if (locked) await client.query("SELECT pg_advisory_unlock(613, $1)", [id]); }
    finally { client.release(); }
  }
}