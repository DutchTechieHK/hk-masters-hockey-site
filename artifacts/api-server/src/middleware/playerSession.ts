import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { db, playerSessionsTable, playersTable } from "@workspace/db";
import { eq, and, gt } from "drizzle-orm";

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export async function createPlayerSession(playerId: number): Promise<string> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(playerSessionsTable).values({ token, playerId, expiresAt });
  return token;
}

export async function destroyPlayerSession(token: string): Promise<void> {
  await db.delete(playerSessionsTable).where(eq(playerSessionsTable.token, token));
}

async function lookupSessionPlayer(token: string) {
  const now = new Date();
  const [row] = await db
    .select({ player: playersTable })
    .from(playerSessionsTable)
    .innerJoin(playersTable, eq(playersTable.id, playerSessionsTable.playerId))
    .where(and(eq(playerSessionsTable.token, token), gt(playerSessionsTable.expiresAt, now)));
  return row?.player ?? null;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      player?: typeof playersTable.$inferSelect;
    }
  }
}

export async function requirePlayerSession(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.headers["x-player-session"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return res.status(401).json({ error: "Not signed in" });
  }
  const player = await lookupSessionPlayer(token);
  if (!player) {
    return res.status(401).json({ error: "Session expired" });
  }
  req.player = player;
  next();
}
