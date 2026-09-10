import webpush from "web-push";
import { db, playersTable, pushSubscriptionsTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

let configured = false;

function ensureConfigured() {
  if (configured) return;
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@hkmastershockey.com";
  if (!publicKey || !privateKey) return;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  configured = true;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

async function deliverAndClean(
  subs: { endpoint: string; p256dh: string; auth: string }[],
  payload: PushPayload
): Promise<void> {
  const expiredEndpoints: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
          { TTL: 86400 }
        );
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      }
    })
  );

  if (expiredEndpoints.length > 0) {
    await db
      .delete(pushSubscriptionsTable)
      .where(inArray(pushSubscriptionsTable.endpoint, expiredEndpoints));
  }
}

export async function sendPushToAll(payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!configured) return;
  const subs = await db.select().from(pushSubscriptionsTable);
  await deliverAndClean(subs, payload);
}

export async function sendPushToTeam(teamId: number, payload: PushPayload): Promise<void> {
  ensureConfigured();
  if (!configured) return;

  const rows = await db
    .select({ sub: pushSubscriptionsTable })
    .from(pushSubscriptionsTable)
    .innerJoin(playersTable, eq(playersTable.id, pushSubscriptionsTable.playerId))
    .where(eq(playersTable.teamId, teamId));

  await deliverAndClean(rows.map((r) => r.sub), payload);
}

export async function sendPushToMembershipSection(
  membershipSection: "men" | "women",
  payload: PushPayload,
): Promise<void> {
  ensureConfigured();
  if (!configured) return;

  const rows = await db
    .select({ sub: pushSubscriptionsTable })
    .from(pushSubscriptionsTable)
    .innerJoin(playersTable, eq(playersTable.id, pushSubscriptionsTable.playerId))
    .where(and(
      eq(playersTable.memberStatus, "active"),
      eq(playersTable.currentMembershipSection, membershipSection),
    ));

  await deliverAndClean(rows.map((r) => r.sub), payload);
}
