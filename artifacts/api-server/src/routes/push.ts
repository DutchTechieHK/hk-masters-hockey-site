import { Router, type IRouter } from "express";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requirePlayerSession } from "../middleware/playerSession";

const router: IRouter = Router();

router.get("/vapid-public-key", (_req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(503).json({ error: "Push notifications not configured" });
  res.json({ key });
});

router.post("/subscribe", requirePlayerSession, async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (
    typeof endpoint !== "string" ||
    !endpoint ||
    typeof keys?.p256dh !== "string" ||
    typeof keys?.auth !== "string"
  ) {
    return res.status(400).json({ error: "Invalid subscription object" });
  }

  const playerId = req.player!.id;

  await db
    .insert(pushSubscriptionsTable)
    .values({ playerId, endpoint, p256dh: keys.p256dh, auth: keys.auth })
    .onConflictDoUpdate({
      target: pushSubscriptionsTable.endpoint,
      set: { playerId, p256dh: keys.p256dh, auth: keys.auth, updatedAt: new Date() },
    });

  res.status(201).json({ ok: true });
});

router.delete("/unsubscribe", requirePlayerSession, async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (typeof endpoint !== "string" || !endpoint) {
    return res.status(400).json({ error: "endpoint required" });
  }
  await db
    .delete(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.endpoint, endpoint),
        eq(pushSubscriptionsTable.playerId, req.player!.id)
      )
    );
  res.json({ ok: true });
});

export default router;
