import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";

const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map<string, { expiresAt: number }>();

function pruneExpired() {
  const now = Date.now();
  for (const [token, meta] of sessions) {
    if (meta.expiresAt < now) sessions.delete(token);
  }
}

export function createSession(): string {
  pruneExpired();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { expiresAt: Date.now() + TOKEN_TTL_MS });
  return token;
}

export function validateSession(token: string): boolean {
  pruneExpired();
  const session = sessions.get(token);
  if (!session) return false;
  if (session.expiresAt < Date.now()) {
    sessions.delete(token);
    return false;
  }
  return true;
}

export function destroySession(token: string) {
  sessions.delete(token);
}

export function requireSession(req: Request, res: Response, next: NextFunction) {
  const token =
    (req.headers["x-session-token"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token && validateSession(token)) {
    return next();
  }
  res.status(401).json({ error: "Not authenticated" });
}
