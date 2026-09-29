import { Router, type IRouter } from "express";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
} from "drizzle-orm";
import {
  db,
  eventRsvpsTable,
  eventsTable,
  matchRsvpsTable,
  matchesTable,
  playerParticipationsTable,
  playerPaymentsTable,
  playersTable,
  seasonsTable,
  teamsTable,
} from "@workspace/db";
import { requireAdminAccess } from "../middleware/adminAuth";
import { buildSeasonFeeAccount } from "../utils/membershipFees";

const router: IRouter = Router();
const CURRENT_SEASON_SLUG = "membership-2026-27";
const CURRENT_OPERATIONAL_SCOPE = "local_2026_27";

type ReportResponseStatus = "yes" | "maybe" | "no" | "none";

type SessionResponse = {
  playerId: number;
  playerName: string;
  teamName: string | null;
  status: ReportResponseStatus;
  respondedAt: string | null;
};

function numberOrNull(value: string | null): number | null {
  return value == null ? null : Number(value);
}

router.get("/reports/current", requireAdminAccess, async (_req, res): Promise<void> => {
  const [season] = await db
    .select({ id: seasonsTable.id })
    .from(seasonsTable)
    .where(eq(seasonsTable.slug, CURRENT_SEASON_SLUG))
    .limit(1);

  if (!season) {
    res.status(500).json({ error: `Membership season ${CURRENT_SEASON_SLUG} was not found` });
    return;
  }

  const [participations, paymentRows, trainingEvents, localMatches, allPlayers] = await Promise.all([
    db
      .select({
        playerId: playersTable.id,
        name: playersTable.name,
        email: playersTable.email,
        memberStatus: playersTable.memberStatus,
        section: playerParticipationsTable.membershipSection,
        tier: playerParticipationsTable.membershipTier,
        teamId: playerParticipationsTable.teamId,
        teamName: teamsTable.name,
        due: playerParticipationsTable.amountDue,
      })
      .from(playerParticipationsTable)
      .innerJoin(playersTable, eq(playersTable.id, playerParticipationsTable.playerId))
      .leftJoin(teamsTable, eq(teamsTable.id, playerParticipationsTable.teamId))
      .where(eq(playerParticipationsTable.seasonId, season.id))
      .orderBy(asc(playersTable.name)),
    db
      .select({
        id: playerPaymentsTable.id,
        playerId: playerPaymentsTable.playerId,
        seasonId: playerPaymentsTable.seasonId,
        playerName: playersTable.name,
        teamId: playerParticipationsTable.teamId,
        teamName: teamsTable.name,
        method: playerPaymentsTable.method,
        amount: playerPaymentsTable.amount,
        paymentDate: playerPaymentsTable.paymentDate,
      })
      .from(playerPaymentsTable)
      .innerJoin(playersTable, eq(playersTable.id, playerPaymentsTable.playerId))
      .leftJoin(
        playerParticipationsTable,
        and(
          eq(playerParticipationsTable.playerId, playerPaymentsTable.playerId),
          eq(playerParticipationsTable.seasonId, season.id),
        ),
      )
      .leftJoin(teamsTable, eq(teamsTable.id, playerParticipationsTable.teamId))
      .where(eq(playerPaymentsTable.seasonId, season.id))
      .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id)),
    db
      .select({
        id: eventsTable.id,
        title: eventsTable.title,
        date: eventsTable.startsAt,
        teamId: eventsTable.teamId,
        teamName: teamsTable.name,
      })
      .from(eventsTable)
      .leftJoin(teamsTable, eq(teamsTable.id, eventsTable.teamId))
      .where(and(
        eq(eventsTable.kind, "training"),
        eq(eventsTable.operationalScope, CURRENT_OPERATIONAL_SCOPE),
      ))
      .orderBy(asc(eventsTable.startsAt)),
    db
      .select({
        id: matchesTable.id,
        title: matchesTable.opponent,
        date: matchesTable.kickoffAt,
        status: matchesTable.status,
        teamId: matchesTable.teamId,
        teamName: teamsTable.name,
      })
      .from(matchesTable)
      .leftJoin(teamsTable, eq(teamsTable.id, matchesTable.teamId))
      .where(eq(matchesTable.operationalScope, CURRENT_OPERATIONAL_SCOPE))
      .orderBy(asc(matchesTable.kickoffAt)),
    db
      .select({
        id: playersTable.id,
        name: playersTable.name,
        legacyTeamId: playersTable.teamId,
        legacyTeamName: teamsTable.name,
      })
      .from(playersTable)
      .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
      .orderBy(asc(playersTable.name)),
  ]);

  const currentParticipationRows = await db
    .select({
      playerId: playerParticipationsTable.playerId,
      teamId: playerParticipationsTable.teamId,
      teamName: teamsTable.name,
    })
    .from(playerParticipationsTable)
    .leftJoin(teamsTable, eq(teamsTable.id, playerParticipationsTable.teamId))
    .where(and(
      eq(playerParticipationsTable.seasonId, season.id),
      eq(playerParticipationsTable.participationStatus, "active"),
    ));

  const activeCurrentTeamByPlayer = new Map(
    currentParticipationRows.map((row) => [row.playerId, { teamId: row.teamId, teamName: row.teamName }]),
  );
  const resolvedPlayerTeams = new Map(
    allPlayers.map((player) => {
      const current = activeCurrentTeamByPlayer.get(player.id);
      return [player.id, {
        teamId: current?.teamId ?? player.legacyTeamId,
        teamName: current?.teamName ?? player.legacyTeamName ?? null,
      }];
    }),
  );

  const paymentsByPlayer = new Map<number, typeof paymentRows>();
  for (const payment of paymentRows) {
    const rows = paymentsByPlayer.get(payment.playerId) ?? [];
    rows.push(payment);
    paymentsByPlayer.set(payment.playerId, rows);
  }

  const members = participations.map((member) => {
    const due = numberOrNull(member.due);
    const account = buildSeasonFeeAccount(
      season.id,
      due,
      paymentsByPlayer.get(member.playerId) ?? [],
    );
    return {
      id: member.playerId,
      name: member.name,
      email: member.email ?? null,
      memberStatus: member.memberStatus,
      section: member.section ?? "",
      tier: member.tier ?? "",
      teamId: member.teamId,
      teamName: member.teamName ?? null,
      due,
      paid: account.amountPaid,
      feePaid: account.feePaid,
      lastPaymentDate: account.latestPaymentDate,
    };
  });

  const payments = paymentRows.map((payment) => ({
    id: payment.id,
    playerId: payment.playerId,
    playerName: payment.playerName,
    teamId: payment.teamId,
    teamName: payment.teamName ?? null,
    method: payment.method ?? "",
    amount: Number(payment.amount),
    paymentDate: payment.paymentDate,
  }));

  const inviteesForTraining = (eventTeamId: number | null) => allPlayers
    .map((player) => ({
      id: player.id,
      name: player.name,
      ...resolvedPlayerTeams.get(player.id)!,
    }))
    .filter((player) => eventTeamId == null || player.teamId === eventTeamId);

  const training = await Promise.all(trainingEvents.map(async (event) => {
    const invitees = inviteesForTraining(event.teamId);
    const inviteeIds = invitees.map((player) => player.id);
    const rsvps = inviteeIds.length
      ? await db.select().from(eventRsvpsTable).where(and(
        eq(eventRsvpsTable.eventId, event.id),
        inArray(eventRsvpsTable.playerId, inviteeIds),
      ))
      : [];
    const rsvpByPlayer = new Map(rsvps.map((rsvp) => [rsvp.playerId, rsvp]));
    const responses: SessionResponse[] = invitees.map((player) => {
      const rsvp = rsvpByPlayer.get(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        teamName: player.teamName,
        status: rsvp?.status === "yes" || rsvp?.status === "maybe" || rsvp?.status === "no"
          ? rsvp.status
          : "none",
        respondedAt: rsvp?.respondedAt.toISOString() ?? null,
      };
    });
    const counts = {
      yes: responses.filter((response) => response.status === "yes").length,
      maybe: responses.filter((response) => response.status === "maybe").length,
      no: responses.filter((response) => response.status === "no").length,
      noResponse: responses.filter((response) => response.status === "none").length,
      invited: invitees.length,
    };
    return {
      id: event.id,
      title: event.title,
      date: event.date.toISOString(),
      teamId: event.teamId,
      teamName: event.teamName ?? null,
      counts,
      responses,
    };
  }));

  const matches = await Promise.all(localMatches.map(async (match) => {
    const squad = currentParticipationRows
      .filter((participation) => participation.teamId === match.teamId)
      .map((participation) => participation.playerId);
    const eligible = participations
      .filter((member) => member.memberStatus === "active" && squad.includes(member.playerId))
      .map((member) => ({
        id: member.playerId,
        name: member.name,
        teamName: member.teamName ?? null,
      }));
    const eligibleIds = eligible.map((player) => player.id);
    const rsvps = eligibleIds.length
      ? await db.select().from(matchRsvpsTable).where(and(
        eq(matchRsvpsTable.matchId, match.id),
        inArray(matchRsvpsTable.playerId, eligibleIds),
      ))
      : [];
    const rsvpByPlayer = new Map(rsvps.map((rsvp) => [rsvp.playerId, rsvp]));
    const responses: SessionResponse[] = eligible.map((player) => {
      const rsvp = rsvpByPlayer.get(player.id);
      return {
        playerId: player.id,
        playerName: player.name,
        teamName: player.teamName,
        status: rsvp?.status === "yes" || rsvp?.status === "maybe" || rsvp?.status === "no"
          ? rsvp.status
          : "none",
        respondedAt: rsvp?.respondedAt.toISOString() ?? null,
      };
    });
    const counts = {
      yes: responses.filter((response) => response.status === "yes").length,
      maybe: responses.filter((response) => response.status === "maybe").length,
      no: responses.filter((response) => response.status === "no").length,
      noResponse: responses.filter((response) => response.status === "none").length,
      invited: eligible.length,
    };
    return {
      id: match.id,
      title: match.status === "cancelled" ? `${match.title} (Cancelled)` : match.title,
      date: match.date.toISOString(),
      teamId: match.teamId,
      teamName: match.teamName ?? null,
      counts,
      responses,
    };
  }));

  res.json({ season: "2026/27", members, payments, training, matches });
});

export default router;