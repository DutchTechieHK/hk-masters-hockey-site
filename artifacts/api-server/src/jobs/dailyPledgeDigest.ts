import cron from "node-cron";
import { db } from "@workspace/db";
import { fundraisingTable, playersTable, emailBlastsTable, emailBlastRecipientsTable } from "@workspace/db/schema";
import { isNotNull } from "drizzle-orm";
import { sendDailyPledgeDigestEmail, sendPledgeDigestAdminSummaryEmail } from "../utils/email";

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

  type DigestEntry = {
    playerName: string;
    playerEmail: string;
    sent: boolean;
    pledgeCount: number;
    totalAmount: number;
  };
  const digestLog: DigestEntry[] = [];

  for (const [normalisedName, playerPledges] of byPlayer) {
    const email = playerEmailMap.get(normalisedName);
    const displayName = playerPledges[0].beneficiary!.trim();

    if (!email) {
      console.log(`[daily-pledge-digest] No email found for beneficiary "${displayName}" — skipping.`);
      skipped++;
      continue;
    }

    const pledgeMapped = playerPledges.map((p) => ({
      donorName: p.donorName,
      donorEmail: p.donorEmail ?? null,
      amountPledged: parseFloat(p.amountPledged ?? "0"),
      paymentMethod: p.paymentMethod ?? null,
      notes: p.notes ?? null,
    }));
    const totalAmount = pledgeMapped.reduce((s, p) => s + p.amountPledged, 0);

    let didSend = false;
    try {
      await sendDailyPledgeDigestEmail({
        playerName: displayName,
        playerEmail: email,
        pledges: pledgeMapped,
      });
      sent++;
      didSend = true;
    } catch (err) {
      console.error(`[daily-pledge-digest] Failed to send to ${displayName} <${email}>:`, err);
    }

    digestLog.push({
      playerName: displayName,
      playerEmail: email,
      sent: didSend,
      pledgeCount: pledgeMapped.length,
      totalAmount,
    });
  }

  console.log(`[daily-pledge-digest] Done — sent: ${sent}, skipped (no email match): ${skipped}.`);

  // 5. Log to DB and send admin summary
  if (digestLog.length > 0) {
    try {
      const sentEntries = digestLog.filter((e) => e.sent);
      const failedEntries = digestLog.filter((e) => !e.sent);

      const bodyLines = digestLog.map((e) =>
        `${e.sent ? "✓" : "✗"} ${e.playerName} <${e.playerEmail}>: ${e.pledgeCount} pledge${e.pledgeCount !== 1 ? "s" : ""}, HK$${e.totalAmount.toLocaleString()}`
      );
      if (skipped > 0) {
        bodyLines.push(`\n${skipped} beneficiar${skipped !== 1 ? "ies" : "y"} skipped — no matching player email found.`);
      }

      const [blast] = await db
        .insert(emailBlastsTable)
        .values({
          subject: `Pledge digest — ${sentEntries.length} player${sentEntries.length !== 1 ? "s" : ""} notified`,
          body: bodyLines.join("\n"),
          audienceType: "pledge-digest",
          recipientCount: digestLog.length,
          sentCount: sentEntries.length,
          failedCount: failedEntries.length,
          sentByEmail: "system",
        })
        .returning();

      if (blast && digestLog.length > 0) {
        await db.insert(emailBlastRecipientsTable).values(
          digestLog.map((e) => ({
            blastId: blast.id,
            playerName: e.playerName,
            playerEmail: e.playerEmail,
            sent: e.sent,
            errorMessage: e.sent ? null : "Send failed",
          }))
        );
      }

      if (sentEntries.length > 0) {
        await sendPledgeDigestAdminSummaryEmail({
          recipients: sentEntries,
          skippedCount: skipped,
        }).catch((err) =>
          console.error("[daily-pledge-digest] Failed to send admin summary email:", err)
        );
      }
    } catch (err) {
      console.error("[daily-pledge-digest] Failed to log digest to DB:", err);
    }
  }
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
