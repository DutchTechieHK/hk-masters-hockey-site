import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { adminSessionsTable } from "@workspace/db";
import { eq, lt } from "drizzle-orm";

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;

async function pruneExpired(): Promise<void> {
  await db.delete(adminSessionsTable).where(lt(adminSessionsTable.expiresAt, new Date()));
}

export async function createSession(label?: string): Promise<string> {
  await pruneExpired();
  const token = crypto.randomBytes(32).toString("hex");
  const resolvedLabel = label ?? process.env.ADMIN_NAME ?? "Admin";
  await db.insert(adminSessionsTable).values({
    token,
    label: resolvedLabel,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
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
  if (session.expiresAt < new Date()) {
    await db.delete(adminSessionsTable).where(eq(adminSessionsTable.token, token));
    return false;
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
