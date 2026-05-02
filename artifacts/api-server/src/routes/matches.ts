import { Router } from "express";
import { db } from "@workspace/db";
import { matchesTable, teamsTable } from "@workspace/db/schema";
import { eq, asc } from "drizzle-orm";
import {
  CreateMatchBody,
  UpdateMatchBody,
  UpdateMatchParams,
  DeleteMatchParams,
  ListMatchesQueryParams,
} from "@workspace/api-zod";
import { requireAdminAccess } from "../middleware/adminAuth";

const router = Router();

type MatchRow = typeof matchesTable.$inferSelect;

function serialize(row: MatchRow, teamName?: string | null, teamCategory?: string | null) {
  return {
    id: row.id,
    teamId: row.teamId,
    teamName: teamName ?? undefined,
    teamCategory: teamCategory ?? undefined,
    opponent: row.opponent,
    kickoffAt: row.kickoffAt.toISOString(),
    venue: row.venue ?? undefined,
    ourScore: row.ourScore,
    theirScore: row.theirScore,
    status: row.status,
    notes: row.notes ?? undefined,
    createdAt: row.createdAt?.toISOString(),
  };
}

router.get("/", async (req, res) => {
  const query = ListMatchesQueryParams.parse(req.query);
  const baseQuery = db
    .select({ match: matchesTable, teamName: teamsTable.name, teamCategory: teamsTable.category })
    .from(matchesTable)
    .leftJoin(teamsTable, eq(matchesTable.teamId, teamsTable.id))
    .orderBy(asc(matchesTable.kickoffAt));
  const rows = query.teamId
    ? await baseQuery.where(eq(matchesTable.teamId, query.teamId))
    : await baseQuery;
  res.json(rows.map(({ match, teamName, teamCategory }) => serialize(match, teamName, teamCategory)));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreateMatchBody.parse(req.body);
  const [match] = await db.insert(matchesTable).values({
    teamId: body.teamId,
    opponent: body.opponent,
    kickoffAt: new Date(body.kickoffAt),
    venue: body.venue || null,
    ourScore: body.ourScore ?? null,
    theirScore: body.theirScore ?? null,
    status: body.status,
    notes: body.notes || null,
  }).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, match.teamId));
  res.status(201).json(serialize(match, team?.name, team?.category));
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdateMatchParams.parse(req.params);
  const body = UpdateMatchBody.parse(req.body);
  const [match] = await db.update(matchesTable).set({
    teamId: body.teamId,
    opponent: body.opponent,
    kickoffAt: new Date(body.kickoffAt),
    venue: body.venue || null,
    ourScore: body.ourScore ?? null,
    theirScore: body.theirScore ?? null,
    status: body.status,
    notes: body.notes || null,
  }).where(eq(matchesTable.id, id)).returning();
  if (!match) {
    res.status(404).json({ error: "Match not found" });
    return;
  }
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, match.teamId));
  res.json(serialize(match, team?.name, team?.category));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeleteMatchParams.parse(req.params);
  await db.delete(matchesTable).where(eq(matchesTable.id, id));
  res.status(204).send();
});

export default router;
