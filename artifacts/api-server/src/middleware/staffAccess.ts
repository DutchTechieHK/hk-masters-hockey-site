import type { Request, Response, NextFunction } from "express";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db, playersTable, seasonsTable, staffSessionsTable, staffTeamGrantsTable, teamsTable } from "@workspace/db";
import { isArchivedRotterdamTeam } from "../utils/archivedTeams";

export class StaffAccessError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

declare global {
  namespace Express {
    interface Request {
      staffTeamId?: number;
      staffActor?: string;
      staffIdentity?: NonNullable<Awaited<ReturnType<typeof lookupStaffIdentity>>>;
    }
  }
}

export async function currentStaffSeason() {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Hong_Kong", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const rows = await db.select().from(seasonsTable).where(and(
    eq(seasonsTable.kind, "membership"), eq(seasonsTable.isCurrent, true), eq(seasonsTable.status, "current"),
    sql`(${seasonsTable.startsOn} IS NULL OR ${seasonsTable.startsOn} <= ${today})`,
    sql`(${seasonsTable.endsOn} IS NULL OR ${seasonsTable.endsOn} >= ${today})`,
  ));
  if (rows.length !== 1) throw new StaffAccessError(403, "There is no unambiguous active membership season for staff access.");
  return rows[0];
}

export async function lookupStaffIdentity(token: string) {
  const [session] = await db.select({ player: playersTable }).from(staffSessionsTable)
    .innerJoin(playersTable, eq(playersTable.id, staffSessionsTable.playerId))
    .where(and(eq(staffSessionsTable.token, token), gt(staffSessionsTable.expiresAt, new Date())));
  if (!session || session.player.memberStatus !== "active") return null;
  const email = session.player.email.trim().toLowerCase();
  if (!email) return null;
  const duplicates = await db.select({ id: playersTable.id }).from(playersTable).where(and(
    eq(playersTable.memberStatus, "active"), sql`lower(trim(${playersTable.email})) = ${email}`,
  ));
  if (duplicates.length !== 1) return null;
  let season;
  try { season = await currentStaffSeason(); }
  catch (error) { if (error instanceof StaffAccessError) return null; throw error; }
  const rows = await db.select({ grant: staffTeamGrantsTable, teamName: teamsTable.name, internal: teamsTable.isInternal })
    .from(staffTeamGrantsTable).innerJoin(teamsTable, eq(teamsTable.id, staffTeamGrantsTable.teamId))
    .where(and(eq(staffTeamGrantsTable.playerId, session.player.id), eq(staffTeamGrantsTable.seasonId, season.id), isNull(staffTeamGrantsTable.revokedAt)));
  const grants = [];
  for (const row of rows) {
    if (!row.internal && !await isArchivedRotterdamTeam(row.grant.teamId)) {
      grants.push({ ...row.grant, revokedAt: null, playerName: session.player.name, teamName: row.teamName });
    }
  }
  if (!grants.length) return null;
  return { playerId: session.player.id, name: session.player.name, seasonId: season.id, seasonName: season.name, grants };
}

export async function requireStaff(req: Request, res: Response, next: NextFunction) {
  res.set("Cache-Control", "private, no-store");
  res.vary("X-Session-Token");
  const token = req.headers["x-session-token"];
  const identity = typeof token === "string" ? await lookupStaffIdentity(token) : null;
  if (!identity) { res.status(403).json({ error: "Staff access has expired, was revoked, or is not available. Please sign in again or contact an administrator." }); return; }
  req.staffIdentity = identity;
  req.staffActor = `${identity.name} (staff #${identity.playerId})`;
  next();
}

export function requireStaffTeam(capability: "view" | "attendance" | "schedule") {
  return (req: Request, res: Response, next: NextFunction) => {
    const teamId = Number(req.params.teamId);
    const grant = req.staffIdentity?.grants.find((g) => g.teamId === teamId);
    if (!grant || (capability === "attendance" && !grant.manageAttendance) ||
      (capability === "schedule" && !grant.manageSchedule)) {
      res.status(403).json({ error: "You do not have this permission for this team." }); return;
    }
    req.staffTeamId = teamId;
    next();
  };
}

// Use this again where a legacy handler reads or locks the actual record:
// checking only the submitted team or a pre-read permits ownership races.
export function assertStaffResource(req: Request, row: { teamId: number | null; operationalScope: string | null; audienceMode?: string; isPublic?: boolean }) {
  if (req.staffTeamId === undefined) return;
  if (row.teamId !== req.staffTeamId || row.operationalScope !== "local_2026_27" ||
    (row.audienceMode !== undefined && (row.audienceMode !== "squad" || row.isPublic !== false))) {
    throw new StaffAccessError(403, "This record is not an exclusively private, current-team resource you can manage.");
  }
}

// A staff token is intentionally not an admin session. Block legacy fallback
// routes even if one happens to omit its own admin guard.
export async function isolateStaffSession(req: Request, res: Response, next: NextFunction) {
  const token = req.headers["x-session-token"];
  if (typeof token !== "string" || req.path === "/staff" || req.path.startsWith("/staff/") ||
    (req.path === "/admin/auth" && (req.method === "GET" || req.method === "DELETE"))) return next();
  const [knownStaffToken] = await db.select({ playerId: staffSessionsTable.playerId })
    .from(staffSessionsTable).where(eq(staffSessionsTable.token, token));
  if (knownStaffToken) {
    res.set("Cache-Control", "private, no-store");
    res.status(403).json({ error: "This page requires full-admin access. Use the team workspace." });
    return;
  }
  next();
}
