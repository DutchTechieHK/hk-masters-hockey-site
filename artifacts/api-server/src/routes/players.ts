import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { db } from "@workspace/db";
import { playersTable, teamsTable, playerPaymentsTable, emailBlastsTable, emailBlastRecipientsTable, playerSessionsTable } from "@workspace/db/schema";
import { eq, isNull, isNotNull, or, and, inArray, desc, sql } from "drizzle-orm";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  UpdatePlayerParams,
  DeletePlayerParams,
  ListPlayersQueryParams,
  SendTravelRemindersBody,
  SendFeeRemindersBody,
  SendInsuranceRemindersBody,
  SendOnboardingInvitesBody,
  UpdateSelfPlayerBody,
  CreatePlayerPaymentBody,
  CreatePlayerPaymentParams,
  ListPlayerPaymentsParams,
  DeletePlayerPaymentParams,
  SendBulkEmailBody,
} from "@workspace/api-zod";
import { sendTravelReminderEmail, sendFeeReminderEmail, sendInsuranceReminderEmail, sendOnboardingInviteEmail, sendPassportUploadNotificationEmail, sendProfileUpdateNotificationEmail, sendBulkAnnouncementEmail } from "../utils/email";
import { requireSession } from "../middleware/adminSession";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

const emailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

export function mapPlayer(player: typeof playersTable.$inferSelect, teamName?: string | null, lastSessionAt?: string | null) {
  const t1 = player.lastPortalAccessAt?.toISOString() ?? null;
  const t2 = lastSessionAt ?? null;
  const lastLoginAt = t1 && t2 ? (t1 > t2 ? t1 : t2) : (t1 ?? t2);
  return {
    id: player.id,
    teamId: player.teamId,
    teamName: teamName ?? undefined,
    name: player.name,
    shirtNumber: player.shirtNumber ?? undefined,
    email: player.email,
    phone: player.phone,
    position: player.position,
    dateOfBirth: player.dateOfBirth,
    nationality: player.nationality,
    hkidNumber: player.hkidNumber,
    passportNumber: player.passportNumber,
    passportExpiry: player.passportExpiry,
    passportCopyUrl: player.passportCopyUrl,
    passportCopyReviewed: player.passportCopyReviewed,
    passportCopyUploadedAt: player.passportCopyUploadedAt?.toISOString() ?? null,
    passportCopyUploadedIsUpdate: player.passportCopyUploadedIsUpdate,
    emergencyContactName: player.emergencyContactName,
    emergencyContactPhone: player.emergencyContactPhone,
    flightArrivalDateTime: player.flightArrivalDateTime,
    flightDepartureDateTime: player.flightDepartureDateTime,
    arrivalCity: player.arrivalCity,
    outboundFlightNumber: player.outboundFlightNumber,
    outboundDepartureDateTime: player.outboundDepartureDateTime,
    returnFlightNumber: player.returnFlightNumber,
    returnArrivalDateTime: player.returnArrivalDateTime,
    roomSharingPreference: player.roomSharingPreference,
    roomSharingWith: player.roomSharingWith,
    accommodationName: player.accommodationName,
    accommodationAddress: player.accommodationAddress,
    accommodationPhone: player.accommodationPhone,
    accommodationEmail: player.accommodationEmail,
    insuranceProvider: player.insuranceProvider,
    insurancePolicyNumber: player.insurancePolicyNumber,
    insuranceEmergencyPhone: player.insuranceEmergencyPhone,
    insurancePolicyHolder: player.insurancePolicyHolder,
    insuranceExpiry: player.insuranceExpiry,
    insuranceEmail: player.insuranceEmail,
    shirtSize: player.shirtSize,
    shortsSize: player.shortsSize,
    jacketSize: player.jacketSize,
    poloSize: player.poloSize,
    trackTopSize: player.trackTopSize,
    goalieSmockSize: player.goalieSmockSize,
    travelDates: player.travelDates,
    feePaid: player.feePaid,
    paymentAmountDue: player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : undefined,
    paymentAmountPaid: player.paymentAmountPaid ? parseFloat(player.paymentAmountPaid) : undefined,
    paymentDate: player.paymentDate,
    dietaryRequirements: player.dietaryRequirements,
    medicalNotes: player.medicalNotes,
    notes: player.notes,
    instagramHandle: player.instagramHandle,
    facebookHandle: player.facebookHandle,
    travelReminderSentAt: player.travelReminderSentAt?.toISOString() ?? null,
    feeReminderSentAt: player.feeReminderSentAt?.toISOString() ?? null,
    insuranceReminderSentAt: player.insuranceReminderSentAt?.toISOString() ?? null,
    onboardingInviteSentAt: player.onboardingInviteSentAt?.toISOString() ?? null,
    lastLoginAt: lastLoginAt ?? null,
    createdAt: player.createdAt?.toISOString(),
  };
}

router.get("/", requireAdminAccess, async (req, res) => {
  const query = ListPlayersQueryParams.parse(req.query);

  const lastLoginSq = db
    .select({
      playerId: playerSessionsTable.playerId,
      lastLoginAt: sql<string>`max(${playerSessionsTable.createdAt})`.as("last_login_at"),
    })
    .from(playerSessionsTable)
    .groupBy(playerSessionsTable.playerId)
    .as("last_logins");

  let players;
  if (query.teamId) {
    players = await db
      .select({ player: playersTable, teamName: teamsTable.name, lastLoginAt: lastLoginSq.lastLoginAt })
      .from(playersTable)
      .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
      .leftJoin(lastLoginSq, eq(playersTable.id, lastLoginSq.playerId))
      .where(eq(playersTable.teamId, query.teamId))
      .orderBy(playersTable.id);
  } else {
    players = await db
      .select({ player: playersTable, teamName: teamsTable.name, lastLoginAt: lastLoginSq.lastLoginAt })
      .from(playersTable)
      .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
      .leftJoin(lastLoginSq, eq(playersTable.id, lastLoginSq.playerId))
      .orderBy(playersTable.id);
  }
  res.json(players.map(({ player, teamName, lastLoginAt }) => mapPlayer(player, teamName, lastLoginAt)));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreatePlayerBody.parse(req.body);
  const [player] = await db
    .insert(playersTable)
    .values({ ...(body as any), accessToken: crypto.randomUUID() })
    .returning();
  // If an initial paid amount was supplied via the legacy fields,
  // mirror it into the ledger so the new payments table remains the
  // source of truth and the next recompute cannot lose the value.
  const initialPaid = body.paymentAmountPaid;
  if (typeof initialPaid === "number" && Number.isFinite(initialPaid) && initialPaid > 0) {
    await db.insert(playerPaymentsTable).values({
      playerId: player.id,
      amount: initialPaid.toFixed(2),
      paymentDate: body.paymentDate ?? "",
      method: "",
      notes: "Initial payment recorded at player creation",
    });
    await recomputePlayerAggregates(player.id);
  }
  const [refreshed] = await db.select().from(playersTable).where(eq(playersTable.id, player.id));
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, refreshed.teamId));
  res.status(201).json(mapPlayer(refreshed, team?.name));
});

const SELF_EDITABLE_FIELDS = [
  "name",
  "phone",
  "dateOfBirth",
  "nationality",
  "hkidNumber",
  "passportNumber",
  "passportExpiry",
  "passportCopyUrl",
  "emergencyContactName",
  "emergencyContactPhone",
  "flightArrivalDateTime",
  "flightDepartureDateTime",
  "arrivalCity",
  "outboundFlightNumber",
  "outboundDepartureDateTime",
  "returnFlightNumber",
  "returnArrivalDateTime",
  "roomSharingPreference",
  "roomSharingWith",
  "accommodationName",
  "accommodationAddress",
  "accommodationPhone",
  "accommodationEmail",
  "insuranceProvider",
  "insurancePolicyNumber",
  "insuranceEmergencyPhone",
  "insurancePolicyHolder",
  "insuranceExpiry",
  "insuranceEmail",
  "shirtSize",
  "shortsSize",
  "jacketSize",
  "poloSize",
  "trackTopSize",
  "goalieSmockSize",
  "dietaryRequirements",
  "medicalNotes",
  "instagramHandle",
  "facebookHandle",
] as const;

function mapSelfPlayer(player: typeof playersTable.$inferSelect, teamName?: string | null) {
  const amountDue = player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : null;
  const amountPaid = player.paymentAmountPaid ? parseFloat(player.paymentAmountPaid) : null;
  const balance = amountDue == null ? null : Math.max(0, amountDue - (amountPaid ?? 0));
  return {
    id: player.id,
    teamId: player.teamId,
    teamName: teamName ?? undefined,
    name: player.name,
    shirtNumber: player.shirtNumber ?? undefined,
    email: player.email,
    phone: player.phone ?? undefined,
    dateOfBirth: player.dateOfBirth ?? undefined,
    nationality: player.nationality ?? undefined,
    hkidNumber: player.hkidNumber ?? undefined,
    passportNumber: player.passportNumber ?? undefined,
    passportExpiry: player.passportExpiry ?? undefined,
    passportCopyUrl: player.passportCopyUrl ?? undefined,
    emergencyContactName: player.emergencyContactName ?? undefined,
    emergencyContactPhone: player.emergencyContactPhone ?? undefined,
    flightArrivalDateTime: player.flightArrivalDateTime ?? undefined,
    flightDepartureDateTime: player.flightDepartureDateTime ?? undefined,
    arrivalCity: player.arrivalCity ?? undefined,
    outboundFlightNumber: player.outboundFlightNumber ?? undefined,
    outboundDepartureDateTime: player.outboundDepartureDateTime ?? undefined,
    returnFlightNumber: player.returnFlightNumber ?? undefined,
    returnArrivalDateTime: player.returnArrivalDateTime ?? undefined,
    roomSharingPreference: player.roomSharingPreference ?? undefined,
    accommodationName: player.accommodationName ?? undefined,
    accommodationAddress: player.accommodationAddress ?? undefined,
    accommodationPhone: player.accommodationPhone ?? undefined,
    accommodationEmail: player.accommodationEmail ?? undefined,
    insuranceProvider: player.insuranceProvider ?? undefined,
    insurancePolicyNumber: player.insurancePolicyNumber ?? undefined,
    insuranceEmergencyPhone: player.insuranceEmergencyPhone ?? undefined,
    insurancePolicyHolder: player.insurancePolicyHolder ?? undefined,
    insuranceExpiry: player.insuranceExpiry ?? undefined,
    insuranceEmail: player.insuranceEmail ?? undefined,
    shirtSize: player.shirtSize ?? undefined,
    shortsSize: player.shortsSize ?? undefined,
    jacketSize: player.jacketSize ?? undefined,
    poloSize: player.poloSize ?? undefined,
    trackTopSize: player.trackTopSize ?? undefined,
    goalieSmockSize: player.goalieSmockSize ?? undefined,
    dietaryRequirements: player.dietaryRequirements ?? undefined,
    medicalNotes: player.medicalNotes ?? undefined,
    instagramHandle: player.instagramHandle ?? undefined,
    facebookHandle: player.facebookHandle ?? undefined,
    feePaid: player.feePaid,
    paymentAmountDue: amountDue,
    paymentAmountPaid: amountPaid,
    paymentBalance: balance,
    paymentDate: player.paymentDate ?? null,
  };
}

router.get("/self/:token", async (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 8) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.accessToken, token));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  // Record when the player last accessed the portal via their invite link
  await db
    .update(playersTable)
    .set({ lastPortalAccessAt: new Date() })
    .where(eq(playersTable.id, row.player.id));
  res.json(mapSelfPlayer(row.player, row.teamName));
});

router.patch("/self/:token", async (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 8) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [existing] = await db.select().from(playersTable).where(eq(playersTable.accessToken, token));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const parseResult = UpdateSelfPlayerBody.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.flatten() });
    return;
  }
  const body = parseResult.data as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const field of SELF_EDITABLE_FIELDS) {
    if (field in body) {
      const value = body[field];
      updates[field] = value === "" ? null : value;
    }
  }
  const newPassportCopyUrl = updates.passportCopyUrl as string | null | undefined;
  const passportCopyChanged =
    "passportCopyUrl" in updates &&
    newPassportCopyUrl !== existing.passportCopyUrl &&
    typeof newPassportCopyUrl === "string" &&
    newPassportCopyUrl.length > 0;

  // If the player is uploading a new (or replacement) passport copy, clear the
  // admin's reviewed flag automatically — the admin must review the new file.
  if (passportCopyChanged) {
    const isUpdate = existing.passportCopyUrl !== null && existing.passportCopyUrl !== "";
    updates.passportCopyReviewed = false;
    updates.passportCopyUploadedAt = new Date();
    updates.passportCopyUploadedIsUpdate = isUpdate;
  }

  const allUpdates = { ...updates, lastPortalAccessAt: new Date() };
  const [updated] = await db.update(playersTable).set(allUpdates).where(eq(playersTable.id, existing.id)).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, updated.teamId));
  res.json(mapSelfPlayer(updated, team?.name));

  const updatedFields = Object.keys(updates);

  if (passportCopyChanged) {
    sendPassportUploadNotificationEmail({
      playerName: updated.name,
      playerEmail: updated.email,
      teamName: team?.name ?? "Unknown Team",
      passportCopyUrl: newPassportCopyUrl as string,
      isUpdate: existing.passportCopyUrl !== null && existing.passportCopyUrl !== "",
    }).catch((err) => {
      console.error("[passport-notify] Failed to send notification email:", err);
    });
  }

  const changedFields = updatedFields
    .filter(f => f !== "passportCopyUrl")
    .map(f => ({
      key: f,
      oldValue: (existing as Record<string, unknown>)[f] ?? null,
      newValue: updates[f] ?? null,
    }))
    .filter(({ oldValue, newValue }) => {
      const oldStr = (oldValue === null || oldValue === undefined || oldValue === "") ? "" : String(oldValue);
      const newStr = (newValue === null || newValue === undefined || newValue === "") ? "" : String(newValue);
      return oldStr !== newStr;
    });

  if (changedFields.length > 0) {
    sendProfileUpdateNotificationEmail({
      playerName: updated.name,
      playerEmail: updated.email,
      teamName: team?.name ?? "Unknown Team",
      changedFields,
    }).catch((err) => {
      console.error("[profile-update-notify] Failed to send notification email:", err);
    });
  }
});

function mapPayment(p: typeof playerPaymentsTable.$inferSelect) {
  return {
    id: p.id,
    playerId: p.playerId,
    amount: parseFloat(p.amount),
    paymentDate: p.paymentDate,
    method: p.method,
    notes: p.notes,
    createdAt: p.createdAt?.toISOString(),
  };
}

async function recomputePlayerAggregates(playerId: number, opts: { feePaidOverride?: boolean } = {}) {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return;
  const payments = await db
    .select()
    .from(playerPaymentsTable)
    .where(eq(playerPaymentsTable.playerId, playerId))
    .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const latestDate = payments.length > 0 ? payments[0].paymentDate : null;
  const due = player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : null;
  let feePaid = due != null ? totalPaid + 1e-6 >= due && totalPaid > 0 : totalPaid > 0;
  // Zero-fee participants (coaches, physios, staff) have no amount due and make
  // no payments, so the payment ledger can never mark them paid. For them the
  // admin's manual "Tournament Fee Fully Paid" checkbox is the source of truth.
  if (!feePaid && totalPaid === 0 && (due == null || due <= 0) && opts.feePaidOverride === true) {
    feePaid = true;
  }
  await db
    .update(playersTable)
    .set({
      paymentAmountPaid: totalPaid > 0 ? totalPaid.toFixed(2) : null,
      paymentDate: latestDate,
      feePaid,
    })
    .where(eq(playersTable.id, playerId));
}

router.get("/:id/payments", requireAdminAccess, async (req, res) => {
  const { id } = ListPlayerPaymentsParams.parse(req.params);
  const [player] = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const payments = await db
    .select()
    .from(playerPaymentsTable)
    .where(eq(playerPaymentsTable.playerId, id))
    .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  res.json(payments.map(mapPayment));
});

router.post("/:id/payments", requireAdminAccess, async (req, res) => {
  const { id } = CreatePlayerPaymentParams.parse(req.params);
  const body = CreatePlayerPaymentBody.parse(req.body);
  const [player] = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [created] = await db
    .insert(playerPaymentsTable)
    .values({
      playerId: id,
      amount: body.amount.toFixed(2),
      paymentDate: body.paymentDate,
      method: body.method ?? "",
      notes: body.notes ?? "",
    })
    .returning();
  await recomputePlayerAggregates(id);
  res.status(201).json(mapPayment(created));
});

router.delete("/:playerId/payments/:paymentId", requireAdminAccess, async (req, res) => {
  const { playerId, paymentId } = DeletePlayerPaymentParams.parse(req.params);
  const result = await db
    .delete(playerPaymentsTable)
    .where(and(eq(playerPaymentsTable.id, paymentId), eq(playerPaymentsTable.playerId, playerId)))
    .returning({ id: playerPaymentsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await recomputePlayerAggregates(playerId);
  res.status(204).send();
});

router.get("/:id/access-token", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [player] = await db
    .select({ accessToken: playersTable.accessToken })
    .from(playersTable)
    .where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ accessToken: player.accessToken ?? null });
});

router.post("/send-travel-reminders", requireSession, async (req, res) => {
  const { playerIds } = SendTravelRemindersBody.parse(req.body ?? {});

  const missingCondition = or(
    isNull(playersTable.flightArrivalDateTime),
    eq(playersTable.flightArrivalDateTime, "")
  )!;

  const whereClause = playerIds && playerIds.length > 0
    ? and(inArray(playersTable.id, playerIds), missingCondition)
    : missingCondition;

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;

  for (const { player, teamName } of players) {
    const success = await sendTravelReminderEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
    });
    if (success) {
      sent++;
      await db.update(playersTable).set({ travelReminderSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`[travel-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
  res.json({ sent, failed, total: players.length });
});

router.post("/send-onboarding-invites", requireSession, async (req, res) => {
  const { playerIds } = SendOnboardingInvitesBody.parse(req.body ?? {});

  const whereClause = playerIds && playerIds.length > 0
    ? inArray(playersTable.id, playerIds)
    : isNull(playersTable.onboardingInviteSentAt);

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;
  const sentPlayerIds: number[] = [];

  for (const { player, teamName } of players) {
    if (!player.email) {
      skippedNoEmail++;
      continue;
    }
    let accessToken = player.accessToken;
    if (!accessToken) {
      accessToken = crypto.randomUUID();
      await db.update(playersTable).set({ accessToken }).where(eq(playersTable.id, player.id));
    }
    const success = await sendOnboardingInviteEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
      accessToken,
    });
    if (success) {
      sent++;
      sentPlayerIds.push(player.id);
      await db.update(playersTable).set({ onboardingInviteSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
    await new Promise((r) => setTimeout(r, 600));
  }

  // Log to email_blasts for audit trail
  if (sent > 0 || failed > 0) {
    const recipientCount = players.filter(p => !!p.player.email).length;
    await db.insert(emailBlastsTable).values({
      subject: "Onboarding Invitation",
      body: `Player portal access link${sent !== 1 ? "s" : ""} sent to ${sent} player${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed to deliver)` : ""}.`,
      audienceType: "onboarding",
      playerIds: JSON.stringify(sentPlayerIds),
      recipientCount,
      sentCount: sent,
      failedCount: failed,
      sentByEmail: null,
    });
  }

  console.log(`[onboarding-invites] Sent ${sent}, failed ${failed}, skipped-no-email ${skippedNoEmail} out of ${players.length} targeted players`);
  res.json({ sent, failed, skippedNoEmail, total: players.length });
});

router.post("/send-fee-reminders", requireSession, async (req, res) => {
  const { playerIds } = SendFeeRemindersBody.parse(req.body ?? {});

  const unpaidCondition = eq(playersTable.feePaid, false);

  const whereClause = playerIds && playerIds.length > 0
    ? and(inArray(playersTable.id, playerIds), unpaidCondition)
    : unpaidCondition;

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;

  for (const { player, teamName } of players) {
    const success = await sendFeeReminderEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
      amountDue: player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : null,
      amountPaid: player.paymentAmountPaid ? parseFloat(player.paymentAmountPaid) : null,
    });
    if (success) {
      sent++;
      await db.update(playersTable).set({ feeReminderSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`[fee-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
  res.json({ sent, failed, total: players.length });
});

router.post("/send-insurance-reminders", requireSession, async (req, res) => {
  const { playerIds } = SendInsuranceRemindersBody.parse(req.body ?? {});

  const missingCondition = or(
    isNull(playersTable.insuranceProvider),
    eq(playersTable.insuranceProvider, "")
  )!;

  const whereClause = playerIds && playerIds.length > 0
    ? and(inArray(playersTable.id, playerIds), missingCondition)
    : missingCondition;

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;
  const sentPlayerIds: number[] = [];

  for (const { player, teamName } of players) {
    if (!player.email) { failed++; continue; }
    let accessToken = player.accessToken;
    if (!accessToken) {
      accessToken = crypto.randomUUID();
      await db.update(playersTable).set({ accessToken }).where(eq(playersTable.id, player.id));
    }
    const portalUrl = `${process.env.PUBLIC_URL || "https://www.hkmastershockey.com"}/my-details/${encodeURIComponent(accessToken)}`;
    const success = await sendInsuranceReminderEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
      portalUrl,
    });
    if (success) {
      sent++;
      sentPlayerIds.push(player.id);
      await db.update(playersTable).set({ insuranceReminderSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  if (sent > 0 || failed > 0) {
    const recipientCount = players.filter(p => !!p.player.email).length;
    await db.insert(emailBlastsTable).values({
      subject: "Insurance Details Reminder",
      body: `Insurance reminder${sent !== 1 ? "s" : ""} sent to ${sent} player${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed to deliver)` : ""}.`,
      audienceType: "insurance-reminder",
      playerIds: JSON.stringify(sentPlayerIds),
      recipientCount,
      sentCount: sent,
      failedCount: failed,
      sentByEmail: null,
    });
  }

  console.log(`[insurance-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
  res.json({ sent, failed, total: players.length });
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdatePlayerParams.parse(req.params);
  const body = UpdatePlayerBody.parse(req.body);
  // Strip ledger-derived fields from the direct update — they are
  // owned by player_payments and recomputed below. If the caller
  // provided an explicit paymentAmountPaid, treat it as a delta and
  // append a single ledger adjustment so the new ledger sum equals
  // the requested value (preserves backward compat for older admin
  // pages like Players.tsx / Travel.tsx that still PUT these fields).
  const {
    paymentAmountPaid: requestedPaid,
    paymentDate: requestedDate,
    feePaid: requestedFeePaid,
    ...directUpdate
  } = body;
  // Admin-initiated passport upload: stamp passportCopyUploadedAt + isUpdate
  // so the file shows up correctly in passport timestamps. Unlike the player
  // self PATCH route we do NOT reset passportCopyReviewed (admin uploaded it
  // themselves so they trust it) and we do NOT send a notification email.
  if (
    "passportCopyUrl" in directUpdate &&
    typeof directUpdate.passportCopyUrl === "string" &&
    directUpdate.passportCopyUrl.length > 0
  ) {
    const [existing] = await db
      .select({
        passportCopyUrl: playersTable.passportCopyUrl,
      })
      .from(playersTable)
      .where(eq(playersTable.id, id));
    if (existing && existing.passportCopyUrl !== directUpdate.passportCopyUrl) {
      const isUpdate =
        existing.passportCopyUrl !== null && existing.passportCopyUrl !== "";
      (directUpdate as Record<string, unknown>).passportCopyUploadedAt = new Date();
      (directUpdate as Record<string, unknown>).passportCopyUploadedIsUpdate = isUpdate;
    }
  }
  if (Object.keys(directUpdate).length > 0) {
    await db.update(playersTable).set(directUpdate).where(eq(playersTable.id, id));
  }
  if (typeof requestedPaid === "number" && Number.isFinite(requestedPaid)) {
    const existing = await db
      .select()
      .from(playerPaymentsTable)
      .where(eq(playerPaymentsTable.playerId, id));
    const currentSum = existing.reduce((s, p) => s + parseFloat(p.amount), 0);
    const delta = requestedPaid - currentSum;
    if (Math.abs(delta) > 1e-6) {
      await db.insert(playerPaymentsTable).values({
        playerId: id,
        amount: delta.toFixed(2),
        paymentDate: requestedDate || new Date().toISOString().slice(0, 10),
        method: "",
        notes: "Adjustment from player edit",
      });
    }
  }
  await recomputePlayerAggregates(id, { feePaidOverride: requestedFeePaid });
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
  res.json(mapPlayer(player, team?.name));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeletePlayerParams.parse(req.params);
  await db.delete(playersTable).where(eq(playersTable.id, id));
  res.status(204).send();
});

router.post("/send-bulk-email", requireAdminAccess, emailUpload.array("attachments", 5), async (req, res) => {
  // Fields arrive as strings from multipart/form-data
  const rawBody = {
    audienceType: req.body.audienceType,
    teamIds: req.body.teamIds ? JSON.parse(req.body.teamIds) : undefined,
    playerIds: req.body.playerIds ? JSON.parse(req.body.playerIds) : undefined,
    subject: req.body.subject,
    body: req.body.body,
  };
  const parseResult = SendBulkEmailBody.safeParse(rawBody);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    return;
  }
  const { audienceType, teamIds, playerIds, subject, body } = parseResult.data;

  const files = req.files as Express.Multer.File[] | undefined;
  const attachments = (files ?? []).map((f) => ({ filename: f.originalname, content: f.buffer }));

  let players: Array<typeof playersTable.$inferSelect>;

  if (audienceType === "all") {
    players = await db.select().from(playersTable);
  } else if (audienceType === "teams" && teamIds && teamIds.length > 0) {
    players = await db.select().from(playersTable).where(inArray(playersTable.teamId, teamIds));
  } else if (audienceType === "individuals" && playerIds && playerIds.length > 0) {
    players = await db.select().from(playersTable).where(inArray(playersTable.id, playerIds));
  } else {
    res.status(400).json({ error: "No recipients matched the provided audience" });
    return;
  }

  const recipientCount = players.length;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  type RecipientResult = { playerId: number | null; playerName: string; playerEmail: string; sent: boolean };
  const recipientResults: RecipientResult[] = [];

  for (const player of players) {
    if (!player.email) { skipped++; continue; }
    const ok = await sendBulkAnnouncementEmail({
      playerName: player.name,
      playerEmail: player.email,
      subject,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (ok) sent++; else failed++;
    recipientResults.push({ playerId: player.id, playerName: player.name, playerEmail: player.email, sent: ok });
    // Resend rate-limit: 2 req/s. Wait 600 ms between sends to stay safely under.
    await sleep(600);
  }

  const [blast] = await db.insert(emailBlastsTable).values({
    subject,
    body,
    audienceType,
    teamIds: teamIds ? JSON.stringify(teamIds) : null,
    playerIds: playerIds ? JSON.stringify(playerIds) : null,
    recipientCount,
    sentCount: sent,
    failedCount: failed,
    sentByEmail: null,
  }).returning();

  // Record per-recipient delivery status
  if (recipientResults.length > 0) {
    await db.insert(emailBlastRecipientsTable).values(
      recipientResults.map((r) => ({
        blastId: blast.id,
        playerId: r.playerId,
        playerName: r.playerName,
        playerEmail: r.playerEmail,
        sent: r.sent,
        errorMessage: r.sent ? null : "rate_limit_exceeded",
      }))
    );
  }

  console.log(`[bulk-email] audienceType=${audienceType} sent=${sent} failed=${failed} skipped=${skipped} blastId=${blast.id}`);
  res.json({ sent, failed, skipped, total: recipientCount, blastId: blast.id });
});

router.get("/email-blasts/:id/recipients", requireAdminAccess, async (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db
    .select()
    .from(emailBlastRecipientsTable)
    .where(eq(emailBlastRecipientsTable.blastId, id))
    .orderBy(emailBlastRecipientsTable.sent, emailBlastRecipientsTable.playerName);
  res.json(rows.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    playerName: r.playerName,
    playerEmail: r.playerEmail,
    sent: r.sent,
    errorMessage: r.errorMessage ?? null,
  })));
});

router.get("/onboarding-invite-log", requireAdminAccess, async (req, res) => {
  const lastSessionSq = db
    .select({
      playerId: playerSessionsTable.playerId,
      lastSessionAt: sql<string>`max(${playerSessionsTable.createdAt})`.as("last_session_at"),
    })
    .from(playerSessionsTable)
    .groupBy(playerSessionsTable.playerId)
    .as("last_sessions");

  const rows = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      email: playersTable.email,
      teamName: teamsTable.name,
      invitedAt: playersTable.onboardingInviteSentAt,
      lastPortalAccessAt: playersTable.lastPortalAccessAt,
      lastSessionAt: lastSessionSq.lastSessionAt,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .leftJoin(lastSessionSq, eq(playersTable.id, lastSessionSq.playerId))
    .where(isNotNull(playersTable.onboardingInviteSentAt))
    .orderBy(desc(playersTable.onboardingInviteSentAt));

  res.json(rows.map(r => {
    const t1 = r.lastPortalAccessAt?.toISOString() ?? null;
    const t2 = r.lastSessionAt ?? null;
    const lastLoginAt = t1 && t2 ? (t1 > t2 ? t1 : t2) : (t1 ?? t2);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      teamName: r.teamName ?? null,
      invitedAt: r.invitedAt!.toISOString(),
      lastLoginAt,
    };
  }));
});

router.get("/email-blasts", requireAdminAccess, async (req, res) => {
  const rows = await db
    .select({
      id: emailBlastsTable.id,
      subject: emailBlastsTable.subject,
      body: emailBlastsTable.body,
      audienceType: emailBlastsTable.audienceType,
      teamIds: emailBlastsTable.teamIds,
      playerIds: emailBlastsTable.playerIds,
      recipientCount: emailBlastsTable.recipientCount,
      sentCount: emailBlastsTable.sentCount,
      failedCount: emailBlastsTable.failedCount,
      sentByEmail: emailBlastsTable.sentByEmail,
      sentAt: emailBlastsTable.sentAt,
    })
    .from(emailBlastsTable)
    .orderBy(desc(emailBlastsTable.sentAt));

  const individualBlastIds = rows
    .filter((r) => r.audienceType === "individuals" || r.audienceType === "pledge-digest")
    .map((r) => r.id);

  const recipientNamesByBlastId = new Map<number, string[]>();
  if (individualBlastIds.length > 0) {
    const recipientRows = await db
      .select({
        blastId: emailBlastRecipientsTable.blastId,
        playerName: emailBlastRecipientsTable.playerName,
      })
      .from(emailBlastRecipientsTable)
      .where(inArray(emailBlastRecipientsTable.blastId, individualBlastIds));

    for (const row of recipientRows) {
      const existing = recipientNamesByBlastId.get(row.blastId) ?? [];
      existing.push(row.playerName);
      recipientNamesByBlastId.set(row.blastId, existing);
    }
  }

  const teamBlastRows = rows.filter((r) => r.audienceType === "teams");
  const allTeamIds = new Set<number>();
  for (const r of teamBlastRows) {
    try {
      const ids: number[] = JSON.parse(r.teamIds ?? "[]");
      ids.forEach((id) => allTeamIds.add(id));
    } catch {
    }
  }

  const teamNamesById = new Map<number, string>();
  if (allTeamIds.size > 0) {
    const teamRows = await db
      .select({ id: teamsTable.id, name: teamsTable.name })
      .from(teamsTable)
      .where(inArray(teamsTable.id, [...allTeamIds]));
    for (const t of teamRows) {
      teamNamesById.set(t.id, t.name);
    }
  }

  res.json(rows.map((r) => {
    let teamNames: string[] | undefined;
    if (r.audienceType === "teams") {
      try {
        const ids: number[] = JSON.parse(r.teamIds ?? "[]");
        teamNames = ids.map((id) => teamNamesById.get(id) ?? String(id));
      } catch {
        teamNames = [];
      }
    }
    return {
      ...r,
      sentAt: r.sentAt.toISOString(),
      recipientNames: recipientNamesByBlastId.get(r.id) ?? [],
      teamNames,
    };
  }));
});

router.get("/arrivals", requireAdminAccess, async (_req, res) => {
  const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/;

  const allRows = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      arrival: playersTable.flightArrivalDateTime,
      arrivalCity: playersTable.arrivalCity,
      travelNote: playersTable.travelNote,
      departure: playersTable.flightDepartureDateTime,
      departureNote: playersTable.departureNote,
      teamCategory: teamsTable.category,
      teamName: teamsTable.name,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .orderBy(playersTable.flightArrivalDateTime);

  const withArrival = allRows
    .filter((r) => r.arrival && ISO_DATE_RE.test(r.arrival))
    .map((r) => ({
      id: r.id,
      name: r.name,
      arrival: r.arrival!,
      arrivalCity: r.arrivalCity ?? null,
      travelNote: r.travelNote ?? null,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  const withoutArrival = allRows
    .filter((r) => !r.arrival || !ISO_DATE_RE.test(r.arrival))
    .map((r) => ({
      id: r.id,
      name: r.name,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  const departureRows = [...allRows].sort((a, b) =>
    (a.departure ?? "").localeCompare(b.departure ?? "")
  );

  const withDeparture = departureRows
    .filter((r) => r.departure && ISO_DATE_RE.test(r.departure))
    .map((r) => ({
      id: r.id,
      name: r.name,
      departure: r.departure!,
      departureCity: r.arrivalCity ?? null,
      departureNote: r.departureNote ?? null,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  const withoutDeparture = departureRows
    .filter((r) => !r.departure || !ISO_DATE_RE.test(r.departure))
    .map((r) => ({
      id: r.id,
      name: r.name,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  res.json({ withArrival, withoutArrival, withDeparture, withoutDeparture });
});

export default router;
