import { Router } from "express";
import { db } from "@workspace/db";
import { teamsTable, playersTable, fundraisingTable, logisticsTable } from "@workspace/db/schema";
import { eq, sql } from "drizzle-orm";

const router = Router();

router.get("/", async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);

  const teamStats = await Promise.all(teams.map(async (team) => {
    const players = await db.select().from(playersTable).where(eq(playersTable.teamId, team.id));
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
  }));

  const totalPlayers = teamStats.reduce((sum, t) => sum + t.playerCount, 0);

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

  res.json({
    totalPlayers,
    teamStats,
    totalFundsRaised,
    fundraisingTarget,
    upcomingDeadlines,
  });
});

export default router;
