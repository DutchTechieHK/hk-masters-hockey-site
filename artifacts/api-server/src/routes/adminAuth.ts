import { Router } from "express";
import { createSession, destroySession, validateSession } from "../middleware/adminSession.js";

const router = Router();

router.post("/", async (req, res) => {
  const { password } = req.body ?? {};
  const adminKey = process.env.ADMIN_API_KEY;
  if (!adminKey) {
    res.status(503).json({ error: "Admin access not configured" });
    return;
  }
  if (!password || password !== adminKey) {
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
  if (token) await destroySession(token);
  res.status(204).send();
});

router.get("/", async (req, res) => {
  const token =
    (req.headers["x-session-token"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token && (await validateSession(token))) {
    res.json({ authenticated: true });
  } else {
    res.json({ authenticated: false });
  }
});

export default router;
