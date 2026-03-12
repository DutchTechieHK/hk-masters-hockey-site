import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  UpdatePlayerParams,
  DeletePlayerParams,
  ListPlayersQueryParams,
} from "@workspace/api-zod";

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
  const [player] = await db.insert(playersTable).values(body as any).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
  res.status(201).json(mapPlayer(player, team?.name));
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
