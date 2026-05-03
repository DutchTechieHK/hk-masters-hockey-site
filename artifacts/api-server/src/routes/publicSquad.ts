import { Router } from "express";
import { db } from "@workspace/db";
import { playersTable, teamsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/squad", async (_req, res) => {
  const rows = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      shirtNumber: playersTable.shirtNumber,
      position: playersTable.position,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      teamCategory: teamsTable.category,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .orderBy(playersTable.id);

  res.set("Cache-Control", "public, max-age=60");
  res.json(
    rows.map((r) => ({
      id: r.id,
      name: r.name,
      shirtNumber: r.shirtNumber ?? null,
      position: r.position ?? null,
      teamId: r.teamId,
      teamName: r.teamName ?? null,
      teamCategory: r.teamCategory ?? null,
    })),
  );
});

router.get("/teams", async (_req, res) => {
  const teams = await db.select().from(teamsTable).orderBy(teamsTable.id);
  res.set("Cache-Control", "public, max-age=60");
  res.json(
    teams.map((t) => ({
      id: t.id,
      name: t.name,
      category: t.category,
    })),
  );
});

export default router;
