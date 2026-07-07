import crypto from "crypto";
import { type Request, type Response, type NextFunction } from "express";
import { validateSession } from "./adminSession.js";

// Constant-time string comparison (S3). Avoids leaking, via response timing,
// how many leading characters of a guessed admin key are correct. The length
// check short-circuits mismatched lengths (timingSafeEqual requires equal
// lengths); revealing only the length is standard and acceptable here.
export function safeKeyEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function requireAdminKey(req: Request, res: Response, next: NextFunction): Promise<void> {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.error("[adminAuth] ADMIN_API_KEY is not set — blocking all admin requests");
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  const provided =
    req.headers["x-admin-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (typeof provided !== "string" || !safeKeyEqual(provided, adminKey)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export async function requireAdminAccess(req: Request, res: Response, next: NextFunction): Promise<void> {
  const sessionToken =
    (req.headers["x-session-token"] as string | undefined) ||
    undefined;
  if (sessionToken && (await validateSession(sessionToken))) {
    next();
    return;
  }
  return requireAdminKey(req, res, next);
}

export async function hasAdminAccess(req: Request): Promise<boolean> {
  const sessionToken = req.headers["x-session-token"] as string | undefined;
  if (sessionToken && (await validateSession(sessionToken))) return true;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  const provided =
    req.headers["x-admin-key"] ||
    req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "");
  return typeof provided === "string" && safeKeyEqual(provided, adminKey);
}
