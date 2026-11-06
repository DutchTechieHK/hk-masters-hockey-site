import { Router } from "express";
import { createSession, destroySession, validateSession } from "../middleware/adminSession.js";
import { safeKeyEqual } from "../middleware/adminAuth.js";
import { db, staffSessionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { lookupStaffIdentity } from "../middleware/staffAccess";

const router = Router();

router.post("/", async (req, res) => {
  const { password } = req.body ?? {};
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  if (typeof password !== "string" || !safeKeyEqual(password, adminKey)) {
    res.status(401).json({ error: "Invalid password" });
    return;
  }
  const token = await createSession();
  res.json({ token });
});

router.delete("/", async (req, res) => {
  const token =
    (req.headers["x-session-token"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token) {
    await destroySession(token);
    await db.delete(staffSessionsTable).where(eq(staffSessionsTable.token, token));
  }
  res.status(204).send();
});

router.get("/", async (req, res) => {
  res.set("Cache-Control", "private, no-store");
  const token =
    (req.headers["x-session-token"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token && (await validateSession(token))) {
    res.json({ authenticated: true, kind: "admin" });
  } else {
    const staff = token ? await lookupStaffIdentity(token) : null;
    res.json(staff ? { authenticated: true, kind: "staff", staff } : { authenticated: false });
  }
});

export default router;
