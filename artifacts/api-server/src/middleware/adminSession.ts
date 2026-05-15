import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { adminSessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const IDLE_TTL_MS = 12 * 60 * 60 * 1000;
const ABSOLUTE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const SLIDE_THRESHOLD_MS = 5 * 60 * 1000;

async function pruneExpired(): Promise<void> {
  await db.delete(adminSessionsTable).where(lt(adminSessionsTable.expiresAt, new Date()));
}

function computeNewExpiry(createdAt: Date, now: Date): Date {
  const idleExpiry = new Date(now.getTime() + IDLE_TTL_MS);
  const absoluteExpiry = new Date(createdAt.getTime() + ABSOLUTE_TTL_MS);
  return idleExpiry < absoluteExpiry ? idleExpiry : absoluteExpiry;
}

export async function createSession(label?: string): Promise<string> {
  await pruneExpired();
  const token = crypto.randomBytes(32).toString("hex");
  const resolvedLabel = label ?? process.env.ADMIN_NAME ?? "Admin";
  const now = new Date();
  await db.insert(adminSessionsTable).values({
    token,
    label: resolvedLabel,
    expiresAt: new Date(now.getTime() + IDLE_TTL_MS),
  });
  return token;
}

export async function validateSession(token: string): Promise<boolean> {
  const rows = await db
    .select()
    .from(adminSessionsTable)
    .where(eq(adminSessionsTable.token, token));
  const session = rows[0];
  if (!session) return false;
  const now = new Date();
  if (session.expiresAt < now) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, token));
    return false;
  }
  const newExpiry = computeNewExpiry(session.createdAt, now);
  if (newExpiry.getTime() - session.expiresAt.getTime() > SLIDE_THRESHOLD_MS) {
    await db
      .update(adminSessionsTable)
      .set({ expiresAt: newExpiry })
      .where(eq(adminSessionsTable.token, token));
  }
  return true;
}

export async function getSessionLabel(token: string): Promise<string | null> {
  const rows = await db
    .select()
    .from(adminSessionsTable)
    .where(eq(adminSessionsTable.token, token));
  const session = rows[0];
  if (!session || session.expiresAt < new Date()) return null;
  return session.label;
}

export async function destroySession(token: string): Promise<void> {
  await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, token));
}

export async function requireSession(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token =
    (req.headers["x-session-token"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token && (await validateSession(token))) {
    (req as Request & { sessionToken?: string }).sessionToken = token;
    next();
    return;
  }
  res.status(401).json({ error: "Not authenticated" });
}
