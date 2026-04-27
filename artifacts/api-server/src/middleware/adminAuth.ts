import { type Request, type Response, type NextFunction } from "express";

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
