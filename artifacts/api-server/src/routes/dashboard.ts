import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, fundraisingTable, logisticsTable, matchesTable, eventsTable, documentsTable } from "@workspace/db/schema";
import { eq, sql, gte, ne, and, asc } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

router.get("/", requireAdminAccess, async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);

  const allPlayers = await db.select().from(playersTable);

  const teamStats = teams.map((team) => {
    const players = allPlayers.filter((p) => p.teamId === team.id);
    const feesPaid = players.filter((p) => p.feePaid).length;
    const feesOutstanding = players.filter((p) => !p.feePaid).length;
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
  const playersPaidCount = allPlayers.filter((p) => p.feePaid).length;
  const feesAmountDue = allPlayers.reduce((sum, p) => sum + parseFloat(p.paymentAmountDue ?? "0"), 0);
  const feesAmountPaid = allPlayers.reduce((sum, p) => sum + parseFloat(p.paymentAmountPaid ?? "0"), 0);
  const feesAmountOutstanding = allPlayers.reduce((sum, p) => {
    const due = parseFloat(p.paymentAmountDue ?? "0");
    const paid = parseFloat(p.paymentAmountPaid ?? "0");
    return sum + Math.max(0, due - paid);
  }, 0);

  const fundraisingRows = await db.select().from(fundraisingTable);
  const totalFundsRaised = fundraisingRows.reduce((sum, f) => sum + parseFloat(f.amountReceived ?? "0"), 0);
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
    upcomingDeadlines,
    documentCounts,
  });
});

export default router;
