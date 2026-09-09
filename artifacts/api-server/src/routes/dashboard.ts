import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, playerPaymentsTable, playerParticipationsTable, fundraisingTable, logisticsTable, matchesTable, eventsTable, documentsTable, auctionItemsTable, auctionBidsTable, auctionSettingsTable, sponsorsTable, legoJarGuessesTable, legoJarConfigTable, funRunIncomeTable, playerPayoutsTable } from "@workspace/db/schema";
import { eq, sql, gte, ne, and, asc, inArray } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import { ensureMembershipFoundation } from "./players";

const router = Router();

router.get("/", requireAdminAccess, async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);

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

  // Online pledges
  const fundraisingRows = await db.select().from(fundraisingTable);
  const onlinePledges = fundraisingRows.reduce((sum, f) => sum + parseFloat(f.amountReceived ?? "0"), 0);

  // Lego Jar: sum of amountPaid for paid guesses (fallback to pricePerGuess from config)
  const [legoConfig] = await db.select().from(legoJarConfigTable).where(eq(legoJarConfigTable.id, 1));
  const pricePerGuess = Number(legoConfig?.pricePerGuess ?? 50);
  const [legoTotals] = await db
    .select({
      total: sql<string>`COALESCE(SUM(CASE WHEN paid THEN COALESCE(amount_paid, ${pricePerGuess}) ELSE 0 END), 0)`,
    })
    .from(legoJarGuessesTable);
  const legoJarTotal = Number(legoTotals?.total ?? 0);

  // Sponsors: sum of contribution_amount for active sponsors, with tier breakdown
  const sponsorRows = await db.select({ contributionAmount: sponsorsTable.contributionAmount, tier: sponsorsTable.tier }).from(sponsorsTable).where(eq(sponsorsTable.active, true));
  const sponsorsTotal = sponsorRows.reduce((sum, s) => sum + (s.contributionAmount != null ? Number(s.contributionAmount) : 0), 0);
  const sponsorCount = sponsorRows.length;
  const sponsorTierBreakdown = {
    gold: sponsorRows.filter((s) => s.tier?.toLowerCase() === "gold").length,
    silver: sponsorRows.filter((s) => s.tier?.toLowerCase() === "silver").length,
    bronze: sponsorRows.filter((s) => s.tier?.toLowerCase() === "bronze").length,
  };

  // Fun Run: sum of all income entries
  const [funRunTotals] = await db
    .select({
      total: sql<string>`COALESCE(SUM(amount_hkd), 0)`,
    })
    .from(funRunIncomeTable);
  const funRunTotal = Number(funRunTotals?.total ?? 0);

  const fundraisingTarget = 300000;

  const upcomingTasks = await db
    .select({ task: logisticsTable, teamName: teamsTable.name })
    .from(logisticsTable)
    .leftJoin(teamsTable, eq(logisticsTable.teamId, teamsTable.id))
    .where(sql`${logisticsTable.dueDate} IS NOT NULL AND ${logisticsTable.status} != 'done'`);

  const upcomingDeadlines = upcomingTasks
    .filter((t) => t.task.dueDate)
    .sort((a, b) => (a.task.dueDate ?? "").localeCompare(b.task.dueDate ?? ""))
    .slice(0, 5)
    .map((t) => ({
      title: t.task.title,
      dueDate: t.task.dueDate!,
      category: t.task.category,
    }));

  const cutoff = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const upcomingMatches = await db
    .select()
    .from(matchesTable)
    .where(and(gte(matchesTable.kickoffAt, cutoff), ne(matchesTable.status, "cancelled")))
    .orderBy(asc(matchesTable.kickoffAt));
  const upcomingMatchCount = upcomingMatches.length;
  const nextMatchKickoffAt = upcomingMatches[0]?.kickoffAt?.toISOString() ?? null;

  const eventsCutoff = new Date();
  const upcomingEvents = await db
    .select()
    .from(eventsTable)
    .where(gte(eventsTable.startsAt, eventsCutoff))
    .orderBy(asc(eventsTable.startsAt));
  const upcomingEventCount = upcomingEvents.length;
  const nextEventStartsAt = upcomingEvents[0]?.startsAt?.toISOString() ?? null;
  const nextEventTitle = upcomingEvents[0]?.title ?? null;

  const allDocuments = await db.select({ category: documentsTable.category }).from(documentsTable);
  const documentCounts = {
    total: allDocuments.length,
    mandatory: allDocuments.filter((d) => d.category === "mandatory-form").length,
    regulation: allDocuments.filter((d) => d.category === "regulation").length,
    information: allDocuments.filter((d) => d.category === "information").length,
  };

  // Auction stats: sum top bids per item
  const auctionItems = await db.select({ id: auctionItemsTable.id }).from(auctionItemsTable);
  const auctionSettings = await db.select().from(auctionSettingsTable).limit(1);
  const auctionIsLive = auctionSettings[0]?.isLive ?? false;
  const topBidRows = await db.execute<{ item_id: number; amount: string }>(sql`
    SELECT DISTINCT ON (item_id) item_id, amount::text
    FROM auction_bids
    ORDER BY item_id, amount DESC, placed_at DESC
  `);
  const auctionItemCount = auctionItems.length;
  const auctionItemsWithBids = topBidRows.rows.length;
  const auctionTotalBidValue = topBidRows.rows.reduce((sum, r) => sum + parseFloat(r.amount), 0);

  const fundraisingBreakdown = {
    onlinePledges,
    legoJar: legoJarTotal,
    sponsors: sponsorsTotal,
    funRun: funRunTotal,
    auction: auctionTotalBidValue,
  };
  const totalFundsRaised = onlinePledges + legoJarTotal + sponsorsTotal + funRunTotal + auctionTotalBidValue;

  // Payout summary
  const payoutSourceRows = await db
    .select({
      source: playerPayoutsTable.source,
      total: sql<string>`COALESCE(SUM(${playerPayoutsTable.amount}), 0)`,
    })
    .from(playerPayoutsTable)
    .groupBy(playerPayoutsTable.source);
  const payoutBySource: Record<string, number> = {};
  for (const row of payoutSourceRows) {
    payoutBySource[row.source] = parseFloat(row.total);
  }
  const totalPaidOut = Object.values(payoutBySource).reduce((s, v) => s + v, 0);
  const payoutNetBalance = totalFundsRaised - totalPaidOut;

  // Payout breakdown by team
  const payoutByTeamRows = await db
    .select({
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      total: sql<string>`COALESCE(SUM(${playerPayoutsTable.amount}), 0)`,
    })
    .from(playerPayoutsTable)
    .innerJoin(playersTable, eq(playerPayoutsTable.playerId, playersTable.id))
    .innerJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .groupBy(playersTable.teamId, teamsTable.name)
    .orderBy(teamsTable.name);
  const payoutByTeam = payoutByTeamRows.map((r) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    total: parseFloat(r.total),
  }));

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
      count: sponsorCount,
      contributionTotal: sponsorsTotal,
      tierBreakdown: sponsorTierBreakdown,
    },
    auctionStats: {
      itemCount: auctionItemCount,
      itemsWithBids: auctionItemsWithBids,
      totalBidValue: auctionTotalBidValue,
      isLive: auctionIsLive,
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
