import crypto from "crypto";
import { Client, isFullDatabase, isFullPage } from "@notionhq/client";
import {
  db,
  pool,
  membershipInterestSubmissionsTable,
  membershipSyncRunsTable,
  playerParticipationsTable,
  playersTable,
  teamsTable,
} from "@workspace/db";
import { and, desc, eq, sql } from "drizzle-orm";

const SOURCE = "notion_join";
const HOLDING_TEAM_NAME = "Awaiting Selection";
const NOTION_API_VERSION = "2025-09-03";
const REQUIRED_PROPERTIES: Record<string, string> = {
  "First Name": "title",
  "Last Name": "rich_text",
  Email: "email",
  "WhatsApp / Phone": "phone_number",
  "Year of Birth": "date",
  "Position(s)": "multi_select",
  Submitted: "created_time",
  "Consent to Be Contacted": "checkbox",
};

export type NotionApplicant = {
  externalId: string;
  sourceUpdatedAt: Date;
  submittedAt: Date;
  name: string;
  email: string;
  phone: string | null;
  dateOfBirth: string | null;
  position: string | null;
  consent: boolean;
  rawData: Record<string, unknown>;
};

export type NotionMemberSyncResult = {
  imported: number;
  created: number;
  matched: number;
  needsReview: number;
  skipped: number;
};

export class NotionMemberSyncAlreadyRunningError extends Error {
  constructor() {
    super("A Notion membership sync is already running.");
    this.name = "NotionMemberSyncAlreadyRunningError";
  }
}

let syncInFlight: Promise<NotionMemberSyncResult> | null = null;
let cachedDataSourceId: string | null = null;

function configuration() {
  const token = process.env.NOTION_API_TOKEN?.trim() ?? "";
  const databaseId = process.env.NOTION_MEMBERS_DATABASE_ID?.trim() ?? "";
  if (!token || !databaseId) {
    throw new Error("Notion member sync is not configured. NOTION_API_TOKEN and NOTION_MEMBERS_DATABASE_ID are required.");
  }
  return { token, databaseId };
}

function textValue(property: any): string {
  if (!property) return "";
  const values = property.type === "title" ? property.title
    : property.type === "rich_text" ? property.rich_text
    : null;
  return Array.isArray(values)
    ? values.map((item: any) => item?.plain_text ?? "").join("").trim()
    : "";
}

function multiSelectValue(property: any): string[] {
  return property?.type === "multi_select" && Array.isArray(property.multi_select)
    ? property.multi_select.map((item: any) => String(item?.name ?? "")).filter(Boolean)
    : [];
}

function plainPropertyValue(property: any): unknown {
  if (!property) return null;
  if (property.type === "title" || property.type === "rich_text") return textValue(property);
  if (property.type === "email") return property.email ?? null;
  if (property.type === "phone_number") return property.phone_number ?? null;
  if (property.type === "checkbox") return Boolean(property.checkbox);
  if (property.type === "created_time") return property.created_time ?? null;
  if (property.type === "date") return property.date?.start ?? null;
  if (property.type === "select") return property.select?.name ?? null;
  if (property.type === "multi_select") return multiSelectValue(property);
  return null;
}

export function validateNotionMemberProperties(properties: Record<string, any>): void {
  const invalid = Object.entries(REQUIRED_PROPERTIES)
    .filter(([name, type]) => properties[name]?.type !== type)
    .map(([name, type]) => `${name} (${type})`);
  if (invalid.length > 0) {
    throw new Error(
      `Notion join database property mapping is invalid or missing: ${invalid.join(", ")}.`,
    );
  }
}

export function pageToNotionApplicant(page: any): NotionApplicant | null {
  if (!isFullPage(page)) return null;
  const properties = (page.properties ?? {}) as Record<string, any>;
  const firstName = textValue(properties["First Name"]);
  const lastName = textValue(properties["Last Name"]);
  const name = `${firstName} ${lastName}`.trim();
  const email = String(properties["Email"]?.email ?? "").trim().toLowerCase();
  const phone = String(properties["WhatsApp / Phone"]?.phone_number ?? "").trim() || null;
  const rawDateOfBirth = properties["Year of Birth"]?.type === "date"
    ? String(properties["Year of Birth"].date?.start ?? "")
    : "";
  const dateOfBirth = /^\d{4}-\d{2}-\d{2}/.test(rawDateOfBirth)
    ? rawDateOfBirth.slice(0, 10)
    : null;
  const positionValues = multiSelectValue(properties["Position(s)"])
    .map((value) => value.trim())
    .filter(Boolean);
  const position = positionValues.length > 0 ? positionValues.join(", ") : null;
  const consent = properties["Consent to Be Contacted"]?.type === "checkbox"
    ? Boolean(properties["Consent to Be Contacted"].checkbox)
    : false;
  const submitted = properties["Submitted"]?.created_time ?? page.created_time;
  const rawData = Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [key, plainPropertyValue(value)]),
  );
  return {
    externalId: page.id,
    sourceUpdatedAt: new Date(page.last_edited_time),
    submittedAt: new Date(submitted),
    name,
    email,
    phone,
    dateOfBirth,
    position,
    consent,
    rawData,
  };
}

async function resolveDataSourceId(client: Client, databaseId: string): Promise<string> {
  if (cachedDataSourceId) return cachedDataSourceId;
  try {
    const source = await (client as any).dataSources.retrieve({ data_source_id: databaseId });
    if (source?.id) {
      cachedDataSourceId = source.id;
      return source.id;
    }
  } catch {
    const database = await client.databases.retrieve({ database_id: databaseId });
    if (!isFullDatabase(database)) throw new Error("Notion member database returned a partial response.");
    const sources = (database as any).data_sources as Array<{ id: string }> | undefined;
    cachedDataSourceId = sources?.[0]?.id ?? databaseId;
    return cachedDataSourceId;
  }
  throw new Error("Could not resolve the Notion member data source.");
}

async function fetchApplicants(): Promise<NotionApplicant[]> {
  const { token, databaseId } = configuration();
  const client = new Client({ auth: token, notionVersion: NOTION_API_VERSION });
  const dataSourceId = await resolveDataSourceId(client, databaseId);
  const source = await (client as any).dataSources.retrieve({ data_source_id: dataSourceId });
  validateNotionMemberProperties(source?.properties ?? {});
  const applicants: NotionApplicant[] = [];
  let cursor: string | undefined;
  do {
    const response = await (client as any).dataSources.query({
      data_source_id: dataSourceId,
      page_size: 100,
      start_cursor: cursor,
      sorts: [{ property: "Submitted", direction: "ascending" }],
    });
    for (const page of response.results ?? []) {
      const applicant = pageToNotionApplicant(page);
      if (applicant) applicants.push(applicant);
    }
    cursor = response.has_more && response.next_cursor ? response.next_cursor : undefined;
  } while (cursor);
  return applicants;
}

async function ensureHoldingTeam(tx: any): Promise<number> {
  const [existing] = await tx.select({ id: teamsTable.id }).from(teamsTable)
    .where(eq(teamsTable.name, HOLDING_TEAM_NAME)).limit(1);
  if (existing) {
    await tx.update(teamsTable).set({ isInternal: true }).where(eq(teamsTable.id, existing.id));
    return existing.id;
  }
  const [created] = await tx.insert(teamsTable).values({
    name: HOLDING_TEAM_NAME,
    category: "Awaiting Selection",
    managerName: "",
    managerEmail: "",
    managerPhone: "",
    description: "Holding team for new membership applicants awaiting selection.",
    isInternal: true,
  }).returning({ id: teamsTable.id });
  return created.id;
}

export function isValidNotionApplicant(applicant: NotionApplicant): boolean {
  return applicant.consent &&
    applicant.name.length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(applicant.email);
}

export function notionApplicantStorageData(applicant: NotionApplicant) {
  if (!applicant.consent) {
    return {
      submittedName: "(Consent not granted)",
      submittedEmail: "(Not retained)",
      submittedPhone: null,
      rawData: { reason: "consent_not_granted", notionPageId: applicant.externalId },
    };
  }
  return {
    submittedName: applicant.name || "(Missing name)",
    submittedEmail: applicant.email || "(Missing email)",
    submittedPhone: applicant.phone,
    rawData: applicant.rawData,
  };
}

export function shouldApplyImportedTier(source: string, currentTier: string): boolean {
  return source !== SOURCE || currentTier === "awaiting_selection";
}

export function isNotionSnapshotCurrent(stored: Date | null, incoming: Date): boolean {
  return Boolean(stored && stored.getTime() >= incoming.getTime());
}

type MemberProfile = {
  dateOfBirth: string | null;
  position: string | null;
};

export type NotionMemberConflict = {
  field: "email" | "dateOfBirth" | "position";
  kind: "identity" | "profile";
  existingValue: string | null;
  submittedValue: string | null;
};

function normalizedValue(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function getNotionMemberConflicts(
  applicant: Pick<NotionApplicant, "consent" | "email" | "dateOfBirth" | "position">,
  current: MemberProfile & { email: string | null },
): NotionMemberConflict[] {
  if (!applicant.consent) return [];

  const conflicts: NotionMemberConflict[] = [];
  const existingEmail = normalizedValue(current.email)?.toLowerCase() ?? null;
  const submittedEmail = normalizedValue(applicant.email)?.toLowerCase() ?? null;
  if (!existingEmail || existingEmail !== submittedEmail) {
    conflicts.push({
      field: "email",
      kind: "identity",
      existingValue: existingEmail,
      submittedValue: submittedEmail,
    });
  }

  for (const field of ["dateOfBirth", "position"] as const) {
    const submittedValue = normalizedValue(applicant[field]);
    const existingValue = normalizedValue(current[field]);
    if (submittedValue && existingValue && submittedValue !== existingValue) {
      conflicts.push({
        field,
        kind: "profile",
        existingValue,
        submittedValue,
      });
    }
  }
  return conflicts;
}

export function resolveNotionMemberProfile(
  applicant: Pick<NotionApplicant, "consent" | "dateOfBirth" | "position">,
  current: MemberProfile,
  notionCreated: boolean,
): { updates: Partial<MemberProfile>; conflict: boolean } {
  if (!applicant.consent) return { updates: {}, conflict: false };

  const updates: Partial<MemberProfile> = {};
  let conflict = false;
  for (const field of ["dateOfBirth", "position"] as const) {
    const incoming = applicant[field];
    const existing = current[field]?.trim() || null;
    if (notionCreated) {
      if (incoming !== existing) updates[field] = incoming;
    } else if (incoming && !existing) {
      updates[field] = incoming;
    } else if (incoming && existing !== incoming) {
      conflict = true;
    }
  }
  return { updates, conflict };
}

export function resolveProfileSubmissionStatus(
  currentStatus: string,
  profileConflict: boolean,
): "conflict" | "matched" | null {
  if (profileConflict && currentStatus !== "conflict") return "conflict";
  if (!profileConflict && currentStatus === "conflict") return "matched";
  return null;
}

export function hasNotionIdentityConflict(
  linkedEmail: string | null | undefined,
  applicantEmail: string,
): boolean {
  return !linkedEmail || linkedEmail.trim().toLowerCase() !== applicantEmail.trim().toLowerCase();
}

export function resolveNotionMemberSyncProfile(
  applicant: Pick<NotionApplicant, "consent" | "email" | "dateOfBirth" | "position">,
  current: MemberProfile & { email: string | null },
  notionCreated: boolean,
): { updates: Partial<MemberProfile>; conflict: boolean } {
  const resolution = resolveNotionMemberProfile(applicant, current, notionCreated);
  return {
    updates: resolution.updates,
    conflict: resolution.conflict || hasNotionIdentityConflict(current.email, applicant.email),
  };
}

export function shouldSyncUnchangedNotionProfile(
  submission: { matchStatus: string; matchedPlayerId: number | null } | null | undefined,
  applicantValid: boolean,
): submission is { matchStatus: string; matchedPlayerId: number } {
  return applicantValid &&
    Boolean(submission?.matchedPlayerId) &&
    submission?.matchStatus !== "dismissed";
}

async function syncNotionMemberProfile(
  tx: any,
  applicant: NotionApplicant,
  playerId: number,
): Promise<{ updated: boolean; conflict: boolean }> {
  const [player] = await tx.select({
    email: playersTable.email,
    dateOfBirth: playersTable.dateOfBirth,
    position: playersTable.position,
  }).from(playersTable).where(eq(playersTable.id, playerId)).limit(1);
  if (!player) return { updated: false, conflict: true };

  const [notionParticipation] = await tx.select({ id: playerParticipationsTable.id })
    .from(playerParticipationsTable)
    .where(and(
      eq(playerParticipationsTable.playerId, playerId),
      eq(playerParticipationsTable.source, SOURCE),
    ))
    .limit(1);
  const resolution = resolveNotionMemberSyncProfile(
    applicant,
    player,
    Boolean(notionParticipation),
  );
  const updated = Object.keys(resolution.updates).length > 0;
  if (updated) {
    await tx.update(playersTable).set(resolution.updates).where(eq(playersTable.id, playerId));
  }
  return {
    updated,
    conflict: resolution.conflict,
  };
}

async function performSync(currentSeasonId: number): Promise<NotionMemberSyncResult> {
  const lockClient = await pool.connect();
  let lockHeld = false;
  try {
    const lockResult = await lockClient.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(hashtext($1)) AS acquired",
      ["notion_join_members_sync"],
    );
    if (!lockResult.rows[0]?.acquired) throw new NotionMemberSyncAlreadyRunningError();
    lockHeld = true;

    const [run] = await db.insert(membershipSyncRunsTable).values({
      source: SOURCE,
      status: "running",
    }).returning();
    try {
      const applicants = await fetchApplicants();
      const result = await db.transaction(async (tx) => {
      const holdingTeamId = await ensureHoldingTeam(tx);
      const counts: NotionMemberSyncResult = {
        imported: 0,
        created: 0,
        matched: 0,
        needsReview: 0,
        skipped: 0,
      };

      for (const applicant of applicants) {
        const [existingSubmission] = await tx.select()
          .from(membershipInterestSubmissionsTable)
          .where(and(
            eq(membershipInterestSubmissionsTable.source, SOURCE),
            eq(membershipInterestSubmissionsTable.externalId, applicant.externalId),
          ))
          .limit(1);
        if (isNotionSnapshotCurrent(existingSubmission?.sourceUpdatedAt ?? null, applicant.sourceUpdatedAt)) {
          if (shouldSyncUnchangedNotionProfile(existingSubmission, isValidNotionApplicant(applicant))) {
            const profile = await syncNotionMemberProfile(
              tx,
              applicant,
              existingSubmission.matchedPlayerId,
            );
            const nextStatus = resolveProfileSubmissionStatus(
              existingSubmission.matchStatus,
              profile.conflict,
            );
            if (nextStatus) {
              await tx.update(membershipInterestSubmissionsTable).set({
                matchStatus: nextStatus,
                reviewedAt: nextStatus === "matched" ? new Date() : null,
              }).where(eq(membershipInterestSubmissionsTable.id, existingSubmission.id));
              if (nextStatus === "conflict") counts.needsReview++;
              else counts.matched++;
              counts.imported++;
              continue;
            }
            if (profile.updated) {
              counts.imported++;
              continue;
            }
          }
          counts.skipped++;
          continue;
        }

        let matchedPlayerId = existingSubmission?.matchedPlayerId ?? null;
        let matchStatus = "invalid";
        const valid = isValidNotionApplicant(applicant);

        if (!applicant.consent && matchedPlayerId) {
          const [notionParticipation] = await tx.select({ id: playerParticipationsTable.id })
            .from(playerParticipationsTable)
            .where(and(
              eq(playerParticipationsTable.playerId, matchedPlayerId),
              eq(playerParticipationsTable.seasonId, currentSeasonId),
              eq(playerParticipationsTable.source, SOURCE),
            ))
            .limit(1);
          if (notionParticipation) {
            await tx.update(playersTable).set({ memberStatus: "inactive" })
              .where(eq(playersTable.id, matchedPlayerId));
            await tx.update(playerParticipationsTable).set({
              participationStatus: "inactive",
              updatedAt: new Date(),
            }).where(eq(playerParticipationsTable.id, notionParticipation.id));
          }
        }

        if (valid && matchedPlayerId) {
          const [linkedPlayer] = await tx.select().from(playersTable)
            .where(eq(playersTable.id, matchedPlayerId)).limit(1);
          if (linkedPlayer && linkedPlayer.email.trim().toLowerCase() === applicant.email) {
            matchStatus = "matched";
          } else {
            matchStatus = "conflict";
            counts.needsReview++;
          }
        } else if (valid) {
          const candidates = await tx.select().from(playersTable)
            .where(sql`lower(trim(${playersTable.email})) = ${applicant.email}`);
          if (candidates.length > 1) {
            matchStatus = "ambiguous";
            counts.needsReview++;
          } else if (candidates.length === 1) {
            matchedPlayerId = candidates[0].id;
            matchStatus = "matched";
            counts.matched++;
          } else {
            const [player] = await tx.insert(playersTable).values({
              teamId: holdingTeamId,
              accessToken: crypto.randomUUID(),
              name: applicant.name,
              email: applicant.email,
              phone: applicant.phone,
              dateOfBirth: applicant.dateOfBirth,
              position: applicant.position,
              memberStatus: "active",
              currentMembershipTier: "awaiting_selection",
              membershipTierUpdatedAt: new Date(),
              notes: "Joined via the Notion membership form.",
            }).returning();
            matchedPlayerId = player.id;
            matchStatus = "matched";
            await tx.insert(playerParticipationsTable).values({
              playerId: player.id,
              seasonId: currentSeasonId,
              teamId: holdingTeamId,
              participationStatus: "active",
              membershipTier: "awaiting_selection",
              source: SOURCE,
            });
            counts.created++;
          }
        } else {
          counts.needsReview++;
        }

        if (valid && matchedPlayerId && matchStatus === "matched") {
          const profile = await syncNotionMemberProfile(tx, applicant, matchedPlayerId);
          if (profile.conflict) {
            matchStatus = "conflict";
            counts.needsReview++;
          }
        }

        const storedApplicant = notionApplicantStorageData(applicant);
        const values = {
          seasonId: currentSeasonId,
          submittedName: storedApplicant.submittedName,
          submittedEmail: storedApplicant.submittedEmail,
          submittedPhone: storedApplicant.submittedPhone,
          membershipTier: "awaiting_selection",
          matchedPlayerId,
          matchStatus,
          rawData: storedApplicant.rawData,
          source: SOURCE,
          externalId: applicant.externalId,
          sourceUpdatedAt: applicant.sourceUpdatedAt,
          submittedAt: applicant.submittedAt,
          reviewedAt: matchStatus === "matched" ? new Date() : null,
        };
        if (existingSubmission) {
          await tx.update(membershipInterestSubmissionsTable).set(values)
            .where(eq(membershipInterestSubmissionsTable.id, existingSubmission.id));
        } else {
          await tx.insert(membershipInterestSubmissionsTable).values(values);
        }
        counts.imported++;
      }
        return counts;
      });

      await db.update(membershipSyncRunsTable).set({
        status: "succeeded",
        importedCount: result.imported,
        createdCount: result.created,
        matchedCount: result.matched,
        reviewCount: result.needsReview,
        skippedCount: result.skipped,
        completedAt: new Date(),
      }).where(eq(membershipSyncRunsTable.id, run.id));
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown Notion sync error";
      await db.update(membershipSyncRunsTable).set({
        status: "failed",
        errorMessage: message.slice(0, 1000),
        completedAt: new Date(),
      }).where(eq(membershipSyncRunsTable.id, run.id));
      throw error;
    }
  } finally {
    if (lockHeld) {
      await lockClient.query("SELECT pg_advisory_unlock(hashtext($1))", ["notion_join_members_sync"]);
    }
    lockClient.release();
  }
}

export function syncNotionMembers(currentSeasonId: number): Promise<NotionMemberSyncResult> {
  if (syncInFlight) return syncInFlight;
  syncInFlight = performSync(currentSeasonId).finally(() => {
    syncInFlight = null;
  });
  return syncInFlight;
}

export async function getLatestNotionMemberSync() {
  const [latest] = await db.select().from(membershipSyncRunsTable)
    .where(eq(membershipSyncRunsTable.source, SOURCE))
    .orderBy(desc(membershipSyncRunsTable.startedAt))
    .limit(1);
  return latest ?? null;
}

export function isNotionMemberSyncConfigured(): boolean {
  return Boolean(process.env.NOTION_API_TOKEN?.trim() && process.env.NOTION_MEMBERS_DATABASE_ID?.trim());
}