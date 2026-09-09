import cron from "node-cron";
import { ensureMembershipFoundation } from "../routes/players";
import {
  isNotionMemberSyncConfigured,
  NotionMemberSyncAlreadyRunningError,
  syncNotionMembers,
} from "../lib/notionMemberSync";

async function runNotionMemberSync() {
  const foundation = await ensureMembershipFoundation();
  const result = await syncNotionMembers(foundation.currentSeasonId);
  console.log(
    `[notion-members] Sync complete — imported ${result.imported}, created ${result.created}, ` +
    `matched ${result.matched}, review ${result.needsReview}, skipped ${result.skipped}.`,
  );
}

export function scheduleNotionMemberSync() {
  if (!isNotionMemberSyncConfigured()) {
    console.log("[notion-members] Sync disabled — Notion member database is not configured.");
    return;
  }
  const expression = process.env.NOTION_MEMBERS_SYNC_CRON?.trim() || "*/15 * * * *";
  if (!cron.validate(expression)) {
    console.error(`[notion-members] Invalid NOTION_MEMBERS_SYNC_CRON "${expression}" — sync not scheduled.`);
    return;
  }
  cron.schedule(expression, () => {
    runNotionMemberSync().catch((error) => {
      if (error instanceof NotionMemberSyncAlreadyRunningError) {
        console.log("[notion-members] Scheduled sync skipped because another instance is running.");
      } else {
        console.error("[notion-members] Scheduled sync failed:", error);
      }
    });
  });
  setTimeout(() => {
    runNotionMemberSync().catch((error) =>
      console.error("[notion-members] Initial sync failed:", error),
    );
  }, 5_000);
  console.log(`[notion-members] Scheduled with cron "${expression}" and an initial startup sync.`);
}