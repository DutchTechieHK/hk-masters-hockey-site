import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, playerPaymentsTable, playerParticipationsTable, matchesTable, eventsTable } from "@workspace/db/schema";
import { eq, gte, ne, and, asc, inArray, notInArray } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { ensureMembershipFoundation } from "./players";

const router = Router();

router.get("/", requireAdminAccess, async (_req, res) => {
  const teams = await db
    .select()
    .from(teamsTable)
    .where(notInArray(teamsTable.category, ["MO40", "MO50"]))
    .orderBy(teamsTable.id);

  const allPlayers = await db.select().from(playersTable)
    .where(eq(playersTable.memberStatus, "active"));
  const foundation = await ensureMembershipFoundation();
  const playerIds = allPlayers.map((player) => player.id);
  const currentParticipations = playerIds.length === 0 ? [] : await db.select({
    playerId: playerParticipationsTable.playerId,
    amountDue: playerParticipationsTable.amountDue,
  }).from(playerParticipationsTable).where(and(
    eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
    inArray(playerParticipationsTable.playerId, playerIds),
  ));
  const currentPayments = playerIds.length === 0 ? [] : await db.select().from(playerPaymentsTable).where(and(
    eq(playerPaymentsTable.seasonId, foundation.currentSeasonId),
    inArray(playerPaymentsTable.playerId, playerIds),
  ));
  const feesByPlayer = new Map(currentParticipations.map((participation) => {
    const due = participation.amountDue == null ? 0 : parseFloat(participation.amountDue);
    const paid = currentPayments
      .filter((payment) => payment.playerId === participation.playerId)
      .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
    return [participation.playerId, { due, paid, isPaid: due > 0 && paid + 1e-6 >= due }] as const;
  }));

  const teamStats = teams.map((team) => {
    const players = allPlayers.filter((p) => p.teamId === team.id);
    const feesPaid = players.filter((player) => feesByPlayer.get(player.id)?.isPaid).length;
    const feesOutstanding = players.filter((player) => {
      const fee = feesByPlayer.get(player.id);
      return fee != null && fee.due > 0 && !fee.isPaid;
    }).length;
    return {
      teamId: team.id,
      teamName: team.name,
      category: team.category,
      playerCount: players.length,
      feesPaid,
      feesOutstanding,
    };
  });

  const totalPlayers = teamStats.reduce((sum, t) => sum + t.playerCount, 0);
  const feeAccounts = [...feesByPlayer.values()];
  const playersPaidCount = feeAccounts.filter((fee) => fee.isPaid).length;
  const feesAmountDue = feeAccounts.reduce((sum, fee) => sum + fee.due, 0);
  const feesAmountPaid = feeAccounts.reduce((sum, fee) => sum + fee.paid, 0);
  const feesAmountOutstanding = feeAccounts.reduce((sum, fee) => sum + Math.max(0, fee.due - fee.paid), 0);

  const fundraisingTarget = 300000;

  const upcomingDeadlines: Array<{ title: string; dueDate: string; category: string }> = [];

  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const upcomingMatches = await db
    .select()
    .from(matchesTable)
    .where(and(gte(matchesTable.kickoffAt, cutoff), ne(matchesTable.status, "cancelled"), eq(matchesTable.operationalScope, "local_2026_27")))
    .orderBy(asc(matchesTable.kickoffAt));
  const upcomingMatchCount = upcomingMatches.length;
  const nextMatchKickoffAt = upcomingMatches[0]?.kickoffAt?.toISOString() ?? null;

  const eventsCutoff = new Date();
  const upcomingEvents = await db
    .select()
    .from(eventsTable)
    .where(and(gte(eventsTable.startsAt, eventsCutoff), eq(eventsTable.operationalScope, "local_2026_27")))
    .orderBy(asc(eventsTable.startsAt));
  const upcomingEventCount = upcomingEvents.length;
  const nextEventStartsAt = upcomingEvents[0]?.startsAt?.toISOString() ?? null;
  const nextEventTitle = upcomingEvents[0]?.title ?? null;

  const documentCounts = {
    total: 0,
    mandatory: 0,
    regulation: 0,
    information: 0,
  };

  const fundraisingBreakdown = {
    onlinePledges: 0, legoJar: 0, sponsors: 0, funRun: 0, auction: 0,
  };
  const totalFundsRaised = 0;

  // Payout summary
  const payoutBySource: Record<string, number> = {};
  const totalPaidOut = 0;
  const payoutNetBalance = totalFundsRaised - totalPaidOut;

  // Payout breakdown by team
  const payoutByTeam: Array<{ teamId: number | null; teamName: string; total: number }> = [];

  res.json({
    upcomingEventCount,
    nextEventStartsAt,
    nextEventTitle,
    totalPlayers,
    playersPaidCount,
    feesAmountDue,
    feesAmountPaid,
    feesAmountOutstanding,
    upcomingMatchCount,
    nextMatchKickoffAt,
    teamStats,
    totalFundsRaised,
    fundraisingTarget,
    fundraisingBreakdown,
    upcomingDeadlines,
    documentCounts,
    sponsorStats: {
       count: 0,
       contributionTotal: 0,
       tierBreakdown: { gold: 0, silver: 0, bronze: 0 },
    },
    auctionStats: {
       itemCount: 0, itemsWithBids: 0, totalBidValue: 0, isLive: false,
    },
    payoutStats: {
      totalPaidOut,
      totalFundsRaised,
      netBalance: payoutNetBalance,
      bySource: {
        fundraising: payoutBySource["fundraising"] ?? 0,
        legoJar: payoutBySource["lego_jar"] ?? 0,
        general: payoutBySource["general"] ?? 0,
      },
      byTeam: payoutByTeam,
    },
  });
});

export default router;
