import type { RequestHandler } from "express";

/** World Cup archive modules are intentionally read-only. */
export const retiredArchiveReadOnly: RequestHandler = (req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.status(409).json({ error: "Archived content is read-only" });
    return;
  }
  next();
  return;
};