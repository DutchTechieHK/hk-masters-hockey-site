import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { and, eq, inArray, like, or, sql } from "drizzle-orm";
import { db } from "@workspace/db";
import { emailBlastRecipientsTable, emailBlastsTable, playersTable } from "@workspace/db/schema";
import {
  PreviewPortalInvitationsBody, PreviewPortalInvitationsResponse,
  SendPortalInvitationsBody, SendPortalInvitationsResponse,
} from "@workspace/api-zod";
import type { PortalInvitationPreview, PortalInvitationSelection } from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";
import { portalInvitationContent, sendPortalInviteEmail } from "../utils/email";

const router: IRouter = Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PENDING = "portal_invite_pending";
const UNCERTAIN = "portal_invite_uncertain";
type Executor = Pick<typeof db, "select">;
const hash = (value: unknown) => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
const selectionHash = (selection: PortalInvitationSelection) => hash({
  playerIds: [...new Set(selection.playerIds)].sort((a, b) => a - b), resend: selection.resend,
});

// Preview and claim share the same resolver. Email uniqueness must be checked
// across ALL active members, including people outside the selected audience.
export async function resolvePortalInvitations(executor: Executor, selection: PortalInvitationSelection): Promise<PortalInvitationPreview> {
  const ids = [...new Set(selection.playerIds)].sort((a, b) => a - b);
  const members = await executor.select({
    id: playersTable.id, name: playersTable.name, email: playersTable.email, memberStatus: playersTable.memberStatus,
  }).from(playersTable).where(or(eq(playersTable.memberStatus, "active"), inArray(playersTable.id, ids)));
  const memberById = new Map(members.map(member => [member.id, member]));
  const emailCounts = new Map<string, number>();
  for (const member of members) {
    if (member.memberStatus !== "active") continue;
    const email = member.email.trim().toLowerCase();
    emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }
  const history = await executor.select({
    id: emailBlastRecipientsTable.id, playerId: emailBlastRecipientsTable.playerId,
    sent: emailBlastRecipientsTable.sent, error: emailBlastRecipientsTable.errorMessage,
    audienceType: emailBlastsTable.audienceType,
  }).from(emailBlastRecipientsTable)
    .innerJoin(emailBlastsTable, eq(emailBlastRecipientsTable.blastId, emailBlastsTable.id))
    .where(and(
      inArray(emailBlastRecipientsTable.playerId, ids),
      or(
        inArray(emailBlastsTable.audienceType, ["trials_invite", "trials_invite_manual"]),
        like(emailBlastsTable.audienceType, "portal\\_invite:%"),
      ),
    )).orderBy(emailBlastRecipientsTable.id);
  const previouslyInvited = new Set(history.filter(row => row.sent).map(row => row.playerId));
  const unresolved = new Set(history.filter(row =>
    !row.sent && row.audienceType.startsWith("portal_invite:") &&
    (row.error === PENDING || row.error === UNCERTAIN),
  ).map(row => row.playerId));
  const recipients: PortalInvitationPreview["recipients"] = ids.map(playerId => {
    const member = memberById.get(playerId);
    const email = member?.email.trim().toLowerCase() ?? "";
    const base = { playerId, name: member?.name ?? "Member no longer available", email, previouslyInvited: previouslyInvited.has(playerId) };
    if (!member || member.memberStatus !== "active") return { ...base, status: "skipped", reason: "Not an active member" };
    if (!EMAIL_RE.test(email)) return { ...base, status: "skipped", reason: "Missing or invalid email address" };
    if (emailCounts.get(email) !== 1) return { ...base, status: "skipped", reason: "Email shared by multiple active members; sign-in would be ambiguous" };
    if (unresolved.has(playerId)) return { ...base, status: "blocked", reason: "Delivery pending or uncertain. Check Email History and provider records before any further invitation." };
    if (base.previouslyInvited && !selection.resend) return { ...base, status: "already_invited", reason: "Previously invited; excluded unless resend is explicitly selected" };
    return { ...base, status: "eligible", reason: base.previouslyInvited ? "Resend explicitly selected" : "Ready to invite" };
  });
  return {
    recipients,
    eligible: recipients.filter(row => row.status === "eligible").length,
    alreadyInvited: recipients.filter(row => row.previouslyInvited).length,
    skipped: recipients.filter(row => row.status === "skipped").length,
    blocked: recipients.filter(row => row.status === "blocked").length,
    total: recipients.length,
    // Relevant history and recipient data bind the confirmation to a fresh
    // audience. An overlapping concurrent claim invalidates the old preview.
    previewToken: hash({ selection: selectionHash(selection), recipients, history, content: portalInvitationContent() }),
    ...portalInvitationContent(),
  };
}

async function batchResult(blast: typeof emailBlastsTable.$inferSelect) {
  const rows = await db.select().from(emailBlastRecipientsTable).where(eq(emailBlastRecipientsTable.blastId, blast.id));
  const summary = blast.deliverySummary!;
  return SendPortalInvitationsResponse.parse({
    blastId: blast.id,
    sent: rows.filter(row => row.sent).length,
    failed: rows.filter(row => !row.sent).length,
    uncertain: rows.filter(row => !row.sent && row.errorMessage === UNCERTAIN).length,
    pending: rows.filter(row => !row.sent && row.errorMessage === PENDING).length,
    alreadyInvited: summary.alreadyInvited, skipped: summary.skipped, blocked: summary.blocked, total: summary.total,
  });
}

router.use(requireAdminAccess, (_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  res.vary("X-Session-Token");
  next();
});

router.post("/preview", async (req, res): Promise<void> => {
  const input = PreviewPortalInvitationsBody.safeParse(req.body);
  if (!input.success || !input.data.playerIds.every(Number.isSafeInteger)) {
    res.status(400).json({ error: "Select at least one member and specify whether to resend." });
    return;
  }
  res.json(PreviewPortalInvitationsResponse.parse(await resolvePortalInvitations(db, input.data)));
});

router.post("/send", async (req, res): Promise<void> => {
  const input = SendPortalInvitationsBody.safeParse(req.body);
  if (!input.success || !input.data.playerIds.every(Number.isSafeInteger)) {
    res.status(400).json({ error: "A selected audience, fresh preview, and valid request ID are required." });
    return;
  }
  const selection = input.data;
  const audienceType = `portal_invite:${selection.requestId}`;
  const claimed = await db.transaction(async tx => {
    // Cross-process serialisation only during claiming, never during provider
    // calls. Pending recipients are committed before any external side effect.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hk-masters-portal-invitations'))`);
    const [existing] = await tx.select().from(emailBlastsTable).where(eq(emailBlastsTable.audienceType, audienceType));
    if (existing) {
      if (existing.deliverySummary?.selectionHash !== selectionHash(selection) ||
          existing.deliverySummary?.previewToken !== selection.previewToken) {
        return { error: "This request ID was used with another selection. Preview again.", status: 409 } as const;
      }
      return { blast: existing, recipients: [], replay: true };
    }
    const preview = await resolvePortalInvitations(tx, selection);
    if (preview.previewToken !== selection.previewToken) {
      return { error: "Recipient details or invitation history changed. Preview the selection again before sending.", status: 409 } as const;
    }
    if (!preview.eligible) return { error: "No eligible recipients. Review the selection and preview again.", status: 409 } as const;
    const eligible = preview.recipients.filter(row => row.status === "eligible");
    const [blast] = await tx.insert(emailBlastsTable).values({
      subject: preview.subject, body: preview.body, audienceType,
      playerIds: JSON.stringify(eligible.map(row => row.playerId)),
      recipientCount: eligible.length, sentCount: 0, failedCount: eligible.length,
      sentByEmail: "play@hkmastershockey.com", operationalScope: "local_2026_27",
      deliverySummary: {
        selectionHash: selectionHash(selection), previewToken: preview.previewToken,
        alreadyInvited: preview.alreadyInvited, skipped: preview.skipped, blocked: preview.blocked, total: preview.total,
      },
    }).returning();
    const recipients = await tx.insert(emailBlastRecipientsTable).values(eligible.map(row => ({
      blastId: blast.id, playerId: row.playerId, playerName: row.name, playerEmail: row.email,
      sent: false, errorMessage: PENDING,
    }))).returning();
    return { blast, recipients, replay: false };
  });
  if ("error" in claimed) {
    res.status(claimed.status ?? 409).json({ error: claimed.error });
    return;
  }
  if (!claimed.replay) {
    for (let index = 0; index < claimed.recipients.length; index++) {
      const recipient = claimed.recipients[index];
      let sent = false;
      try {
        sent = await sendPortalInviteEmail({ playerName: recipient.playerName, playerEmail: recipient.playerEmail });
      } catch {
        // Transport errors do not establish non-delivery. Do not retry.
      }
      await db.transaction(async tx => {
        await tx.update(emailBlastRecipientsTable).set({
          sent, errorMessage: sent ? null : UNCERTAIN,
        }).where(eq(emailBlastRecipientsTable.id, recipient.id));
        // Atomic increments keep the history meaningful if a later send or
        // persistence operation fails. Unfinished entries remain pending.
        if (sent) await tx.update(emailBlastsTable).set({
          sentCount: sql`${emailBlastsTable.sentCount} + 1`,
          failedCount: sql`${emailBlastsTable.failedCount} - 1`,
        }).where(eq(emailBlastsTable.id, claimed.blast.id));
      });
      if (index < claimed.recipients.length - 1) await new Promise(resolve => setTimeout(resolve, 600));
    }
  }
  res.json(await batchResult(claimed.blast));
});

export default router;
