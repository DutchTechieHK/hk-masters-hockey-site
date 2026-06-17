import cron from "node-cron";
import { db } from "@workspace/db";
import { fundraisingTable, playersTable } from "@workspace/db/schema";
import { isNotNull, gte, lt, ne } from "drizzle-orm";
import { sendDailyPledgeDigestEmail } from "../utils/email";

/**
 * Returns the start and end of "today" in HKT (UTC+8) as UTC Date objects.
 * This ensures pledges created between 00:00 and 23:59 HKT are included.
 */
function getTodayRangeHKT(): { start: Date; end: Date } {
  const nowUtc = new Date();
  // Offset now to HKT to find today's date in that zone
  const hktOffsetMs = 8 * 60 * 60 * 1000;
  const nowHKT = new Date(nowUtc.getTime() + hktOffsetMs);

  const year = nowHKT.getUTCFullYear();
  const month = nowHKT.getUTCMonth();
  const day = nowHKT.getUTCDate();

  // Midnight HKT = 16:00 UTC previous day
  const start = new Date(Date.UTC(year, month, day) - hktOffsetMs);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);

  return { start, end };
}

async function runDailyPledgeDigest() {
  console.log("[daily-pledge-digest] Running...");

  const { start, end } = getTodayRangeHKT();

  // 1. Fetch today's pledges that have a named beneficiary
  const pledges = await db
    .select()
    .from(fundraisingTable)
    .where(
      // beneficiary is set + createdAt falls within today HKT
      // Using sql operators via gte/lt
      isNotNull(fundraisingTable.beneficiary)
    );

  // Filter in JS for today's range (Drizzle gte/lt on timestamps)
  const todayPledges = pledges.filter((p) => {
    if (!p.beneficiary?.trim()) return false;
    const created = p.createdAt;
    if (!created) return false;
    return created >= start && created < end;
  });

  if (todayPledges.length === 0) {
    console.log("[daily-pledge-digest] No new player pledges today — nothing to send.");
    return;
  }

  // 2. Group by beneficiary name (normalised to lowercase for grouping)
  const byPlayer = new Map<string, typeof todayPledges>();
  for (const pledge of todayPledges) {
    const key = pledge.beneficiary!.trim().toLowerCase();
    if (!byPlayer.has(key)) byPlayer.set(key, []);
    byPlayer.get(key)!.push(pledge);
  }

  // 3. Build player name → email map
  const players = await db
    .select({ name: playersTable.name, email: playersTable.email })
    .from(playersTable);

  const playerEmailMap = new Map<string, string>();
  for (const p of players) {
    if (p.email) {
      playerEmailMap.set(p.name.trim().toLowerCase(), p.email);
    }
  }

  // 4. Send a digest email to each matched player
  let sent = 0;
  let skipped = 0;

  for (const [normalisedName, playerPledges] of byPlayer) {
    const email = playerEmailMap.get(normalisedName);
    const displayName = playerPledges[0].beneficiary!.trim();

    if (!email) {
      console.log(`[daily-pledge-digest] No email found for beneficiary "${displayName}" — skipping.`);
      skipped++;
      continue;
    }

    try {
      await sendDailyPledgeDigestEmail({
        playerName: displayName,
        playerEmail: email,
        pledges: playerPledges.map((p) => ({
          donorName: p.donorName,
          amountPledged: parseFloat(p.amountPledged ?? "0"),
          paymentMethod: p.paymentMethod ?? null,
          notes: p.notes ?? null,
        })),
      });
      sent++;
    } catch (err) {
      console.error(`[daily-pledge-digest] Failed to send to ${displayName} <${email}>:`, err);
    }
  }

  console.log(`[daily-pledge-digest] Done — sent: ${sent}, skipped (no email match): ${skipped}.`);
}

/**
 * Schedules the daily pledge digest email at 9 PM HKT (13:00 UTC).
 * Call this once on server startup.
 */
export function scheduleDailyPledgeDigest() {
  // 0 13 * * * = 13:00 UTC = 21:00 HKT
  cron.schedule("0 13 * * *", () => {
    runDailyPledgeDigest().catch((err) =>
      console.error("[daily-pledge-digest] Unhandled error:", err)
    );
  });
  console.log("[daily-pledge-digest] Scheduled — will run daily at 21:00 HKT (13:00 UTC).");
}
