import { Router } from "express";
import crypto from "crypto";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db/schema";
import { eq, isNull, or, and, inArray } from "drizzle-orm";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  UpdatePlayerParams,
  DeletePlayerParams,
  ListPlayersQueryParams,
  SendTravelRemindersBody,
  SendFeeRemindersBody,
  UpdateSelfPlayerBody,
} from "@workspace/api-zod";
import { sendTravelReminderEmail, sendFeeReminderEmail } from "../utils/email";
import { requireSession } from "../middleware/adminSession";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

function mapPlayer(player: typeof playersTable.$inferSelect, teamName?: string | null) {
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
    createdAt: player.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
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

router.post("/", async (req, res) => {
  const body = CreatePlayerBody.parse(req.body);
  const [player] = await db
    .insert(playersTable)
    .values({ ...(body as any), accessToken: crypto.randomUUID() })
    .returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
  res.status(201).json(mapPlayer(player, team?.name));
});

const SELF_EDITABLE_FIELDS = [
  "phone",
  "dateOfBirth",
  "nationality",
  "passportNumber",
  "passportExpiry",
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
  const [updated] = Object.keys(updates).length > 0
    ? await db.update(playersTable).set(updates).where(eq(playersTable.id, existing.id)).returning()
    : [existing];
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, updated.teamId));
  res.json(mapSelfPlayer(updated, team?.name));
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

router.put("/:id", async (req, res) => {
  const { id } = UpdatePlayerParams.parse(req.params);
  const body = UpdatePlayerBody.parse(req.body);
  const [player] = await db.update(playersTable).set(body as any).where(eq(playersTable.id, id)).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
  res.json(mapPlayer(player, team?.name));
});

router.delete("/:id", async (req, res) => {
  const { id } = DeletePlayerParams.parse(req.params);
  await db.delete(playersTable).where(eq(playersTable.id, id));
  res.status(204).send();
});

export default router;
