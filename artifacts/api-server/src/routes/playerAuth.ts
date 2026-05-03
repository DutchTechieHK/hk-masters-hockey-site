import crypto from "crypto";
import { Router, type IRouter } from "express";
import { eq, and, isNull, gt, sql } from "drizzle-orm";
import { db, playersTable, playerLoginCodesTable } from "@workspace/db";
import { sendPlayerLoginCodeEmail } from "../utils/email";
import { createPlayerSession, destroyPlayerSession, requirePlayerSession } from "../middleware/playerSession";
import { mapPlayer } from "./players";
import { listEventsForPlayer } from "./events";

const router: IRouter = Router();

const CODE_TTL_MINUTES = 15;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{6}$/;

function normaliseEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function generateCode(): string {
  return String(crypto.randomInt(0, 1000000)).padStart(6, "0");
}

function hashCode(code: string): string {
  return crypto.createHash("sha256").update(code).digest("hex");
}

router.post("/request-code", async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  if (!EMAIL_RE.test(rawEmail.trim())) {
    return res.status(400).json({ error: "Valid email required" });
  }
  const email = normaliseEmail(rawEmail);

  // Opportunistic cleanup: drop expired/consumed codes globally so the table
  // doesn't grow forever. Cheap because of the email index.
  await db.execute(sql`DELETE FROM player_login_codes WHERE expires_at < NOW() OR consumed_at IS NOT NULL`);

  // Look up the player but always respond OK (don't leak which emails exist).
  const [player] = await db
    .select()
    .from(playersTable)
    .where(sql`lower(${playersTable.email}) = ${email}`)
    .limit(1);

  if (player) {
    // Invalidate any still-valid codes from earlier requests so only the
    // newest one works.
    await db.delete(playerLoginCodesTable).where(eq(playerLoginCodesTable.email, email));

    const code = generateCode();
    const codeHash = hashCode(code);
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await db.insert(playerLoginCodesTable).values({ email, codeHash, expiresAt });
    await sendPlayerLoginCodeEmail({
      playerName: player.name,
      playerEmail: player.email,
      code,
      expiresInMinutes: CODE_TTL_MINUTES,
    });
  } else {
    console.log(`[player-auth] request-code for unknown email ${email} — silently ignored`);
  }

  res.json({ ok: true, expiresInMinutes: CODE_TTL_MINUTES });
});

router.post("/verify-code", async (req, res) => {
  const rawEmail = typeof req.body?.email === "string" ? req.body.email : "";
  const rawCode = typeof req.body?.code === "string" ? req.body.code.trim() : "";
  if (!EMAIL_RE.test(rawEmail.trim()) || !CODE_RE.test(rawCode)) {
    return res.status(400).json({ error: "Email and 6-digit code required" });
  }
  const email = normaliseEmail(rawEmail);
  const codeHash = hashCode(rawCode);
  const now = new Date();

  // Atomic single-use redemption: only one concurrent caller can flip
  // consumed_at from NULL to now(). Returning the row guarantees the caller
  // is the unique winner.
  const claimed = await db
    .update(playerLoginCodesTable)
    .set({ consumedAt: now })
    .where(and(
      eq(playerLoginCodesTable.email, email),
      eq(playerLoginCodesTable.codeHash, codeHash),
      isNull(playerLoginCodesTable.consumedAt),
      gt(playerLoginCodesTable.expiresAt, now),
    ))
    .returning({ id: playerLoginCodesTable.id });

  if (claimed.length === 0) {
    return res.status(401).json({ error: "Code is invalid or has expired" });
  }

  const [player] = await db
    .select()
    .from(playersTable)
    .where(sql`lower(${playersTable.email}) = ${email}`)
    .limit(1);

  if (!player) {
    return res.status(401).json({ error: "No player found for this email" });
  }

  const sessionToken = await createPlayerSession(player.id);
  res.json({ sessionToken, player: { ...mapPlayer(player, null), accessToken: player.accessToken } });
});

router.get("/me", requirePlayerSession, async (req, res) => {
  res.json({ ...mapPlayer(req.player!, null), accessToken: req.player!.accessToken });
});

router.get("/my-schedule", requirePlayerSession, async (req, res) => {
  const events = await listEventsForPlayer(req.player!.teamId ?? null);
  res.json({ events });
});

router.post("/logout", requirePlayerSession, async (req, res) => {
  const token =
    (req.headers["x-player-session"] as string | undefined) ||
    req.headers["authorization"]?.replace(/^Bearer\s+/i, "");
  if (token) await destroyPlayerSession(token);
  res.json({ ok: true });
});

export default router;
