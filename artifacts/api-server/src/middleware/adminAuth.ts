import { type Request, type Response, type NextFunction } from "express";
import { validateSession } from "./adminSession.js";

export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.error("[adminAuth] ADMIN_API_KEY is not set — blocking all admin requests");
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  const provided =
    req.headers["x-admin-key"] ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (!provided || provided !== adminKey) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
}

export function requireAdminAccess(req: Request, res: Response, next: NextFunction) {
  const sessionToken =
    (req.headers["x-session-token"] as string | undefined) ||
    undefined;
  if (sessionToken && validateSession(sessionToken)) {
    return next();
  }
  return requireAdminKey(req, res, next);
}

export function hasAdminAccess(req: Request): boolean {
  const sessionToken = req.headers["x-session-token"] as string | undefined;
  if (sessionToken && validateSession(sessionToken)) return true;
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) return false;
  const provided =
    req.headers["x-admin-key"] ||
    req.headers["authorization"]?.toString().replace(/^Bearer\s+/i, "");
  return Boolean(provided && provided === adminKey);
}
