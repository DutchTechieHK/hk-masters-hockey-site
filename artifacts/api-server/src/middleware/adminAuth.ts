import { type Request, type Response, type NextFunction } from "express";

export function requireAdminKey(req: Request, res: Response, next: NextFunction) {
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    console.warn("[adminAuth] ADMIN_API_KEY not set — admin endpoints are unprotected");
    return next();
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
