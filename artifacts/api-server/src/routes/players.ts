import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { playersTable, teamsTable, playerPaymentsTable } from "@workspace/db/schema";
import { eq, isNull, or, and, inArray, desc } from "drizzle-orm";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  UpdatePlayerParams,
  DeletePlayerParams,
  ListPlayersQueryParams,
  SendTravelRemindersBody,
  SendFeeRemindersBody,
  SendOnboardingInvitesBody,
  UpdateSelfPlayerBody,
  CreatePlayerPaymentBody,
  CreatePlayerPaymentParams,
  ListPlayerPaymentsParams,
  DeletePlayerPaymentParams,
} from "@workspace/api-zod";
import { sendTravelReminderEmail, sendFeeReminderEmail, sendOnboardingInviteEmail, sendPassportUploadNotificationEmail } from "../utils/email";
import { requireSession } from "../middleware/adminSession";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

export function mapPlayer(player: typeof playersTable.$inferSelect, teamName?: string | null) {
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
    passportNumber: player.passportNumber,
    passportExpiry: player.passportExpiry,
    passportCopyUrl: player.passportCopyUrl,
    passportCopyReviewed: player.passportCopyReviewed,
    emergencyContactName: player.emergencyContactName,
    emergencyContactPhone: player.emergencyContactPhone,
    flightArrivalDateTime: player.flightArrivalDateTime,
    flightDepartureDateTime: player.flightDepartureDateTime,
    arrivalCity: player.arrivalCity,
    roomSharingPreference: player.roomSharingPreference,
    roomSharingWith: player.roomSharingWith,
    shirtSize: player.shirtSize,
    shortsSize: player.shortsSize,
    jacketSize: player.jacketSize,
    travelDates: player.travelDates,
    feePaid: player.feePaid,
    paymentAmountDue: player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : undefined,
    paymentAmountPaid: player.paymentAmountPaid ? parseFloat(player.paymentAmountPaid) : undefined,
    paymentDate: player.paymentDate,
    dietaryRequirements: player.dietaryRequirements,
    medicalNotes: player.medicalNotes,
    notes: player.notes,
    travelReminderSentAt: player.travelReminderSentAt?.toISOString() ?? null,
    feeReminderSentAt: player.feeReminderSentAt?.toISOString() ?? null,
    onboardingInviteSentAt: player.onboardingInviteSentAt?.toISOString() ?? null,
    createdAt: player.createdAt?.toISOString(),
  };
}

router.get("/", requireAdminAccess, async (req, res) => {
  const query = ListPlayersQueryParams.parse(req.query);
  let players;
  if (query.teamId) {
    players = await db
      .select({ player: playersTable, teamName: teamsTable.name })
      .from(playersTable)
      .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
      .where(eq(playersTable.teamId, query.teamId))
      .orderBy(playersTable.id);
  } else {
    players = await db
      .select({ player: playersTable, teamName: teamsTable.name })
      .from(playersTable)
      .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
      .orderBy(playersTable.id);
  }
  res.json(players.map(({ player, teamName }) => mapPlayer(player, teamName)));
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
  "phone",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
  "passportCopyUrl",
  "emergencyContactName",
  "emergencyContactPhone",
  "flightArrivalDateTime",
  "flightDepartureDateTime",
  "arrivalCity",
  "roomSharingPreference",
  "shirtSize",
  "shortsSize",
  "jacketSize",
  "dietaryRequirements",
  "medicalNotes",
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
    passportNumber: player.passportNumber ?? undefined,
    passportExpiry: player.passportExpiry ?? undefined,
    passportCopyUrl: player.passportCopyUrl ?? undefined,
    emergencyContactName: player.emergencyContactName ?? undefined,
    emergencyContactPhone: player.emergencyContactPhone ?? undefined,
    flightArrivalDateTime: player.flightArrivalDateTime ?? undefined,
    flightDepartureDateTime: player.flightDepartureDateTime ?? undefined,
    arrivalCity: player.arrivalCity ?? undefined,
    roomSharingPreference: player.roomSharingPreference ?? undefined,
    shirtSize: player.shirtSize ?? undefined,
    shortsSize: player.shortsSize ?? undefined,
    jacketSize: player.jacketSize ?? undefined,
    dietaryRequirements: player.dietaryRequirements ?? undefined,
    medicalNotes: player.medicalNotes ?? undefined,
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

  const [updated] = Object.keys(updates).length > 0
    ? await db.update(playersTable).set(updates).where(eq(playersTable.id, existing.id)).returning()
    : [existing];
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, updated.teamId));
  res.json(mapSelfPlayer(updated, team?.name));

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

async function recomputePlayerAggregates(playerId: number) {
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
  const feePaid = due != null ? totalPaid + 1e-6 >= due && totalPaid > 0 : totalPaid > 0;
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
      await db.update(playersTable).set({ onboardingInviteSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
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
  }

  console.log(`[fee-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
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
    feePaid: _ignoredFeePaid,
    ...directUpdate
  } = body;
  void _ignoredFeePaid;
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
  await recomputePlayerAggregates(id);
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
  res.json(mapPlayer(player, team?.name));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeletePlayerParams.parse(req.params);
  await db.delete(playersTable).where(eq(playersTable.id, id));
  res.status(204).send();
});

export default router;
