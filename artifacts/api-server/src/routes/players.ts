import { Router } from "express";
import multer from "multer";
import crypto from "crypto";
import { db } from "@workspace/db";
import {
  playersTable,
  teamsTable,
  playerPaymentsTable,
  emailBlastsTable,
  emailBlastRecipientsTable,
  playerSessionsTable,
  seasonsTable,
  playerParticipationsTable,
  membershipInterestSubmissionsTable,
} from "@workspace/db/schema";
import { eq, isNull, isNotNull, or, and, inArray, desc, sql } from "drizzle-orm";
import {
  CreatePlayerBody,
  UpdatePlayerBody,
  UpdatePlayerParams,
  DeletePlayerParams,
  ListPlayersQueryParams,
  SendTravelRemindersBody,
  SendFeeRemindersBody,
  SendInsuranceRemindersBody,
  SendOnboardingInvitesBody,
  UpdateSelfPlayerBody,
  CreatePlayerPaymentBody,
  CreatePlayerPaymentParams,
  ListPlayerPaymentsParams,
  DeletePlayerPaymentParams,
  SendBulkEmailBody,
  ImportMembershipInterestSubmissionsBody,
  ResolveMembershipInterestSubmissionBody,
  ResolveMembershipInterestSubmissionParams,
  ListPlayerParticipationsParams,
} from "@workspace/api-zod";
import { sendTravelReminderEmail, sendFeeReminderEmail, sendInsuranceReminderEmail, sendOnboardingInviteEmail, sendPassportUploadNotificationEmail, sendHkidUploadNotificationEmail, sendProfileUpdateNotificationEmail, sendBulkAnnouncementEmail } from "../utils/email";
import { requireSession } from "../middleware/adminSession";
import { requireAdminAccess } from "../middleware/adminAuth";
import { buildSeasonFeeAccount, membershipCategoryAmountDue, MEMBERSHIP_CATEGORIES } from "../utils/membershipFees";
import {
  getLatestNotionMemberSync,
  getNotionMemberConflicts,
  isNotionMemberSyncConfigured,
  markNotionProfileConflictResolved,
  NotionMemberSyncAlreadyRunningError,
  shouldApplyImportedTier,
  syncNotionMembers,
} from "../lib/notionMemberSync";

const router = Router();

const CURRENT_SEASON_SLUG = "membership-2026-27";
const ROTTERDAM_SEASON_SLUG = "rotterdam-2026";
const ROTTERDAM_MIGRATION_CUTOFF = new Date("2026-09-09T00:00:00.000Z");

const MEMBERSHIP_TIERS = new Set<string>(MEMBERSHIP_CATEGORIES);
const MEMBERSHIP_SECTIONS = new Set(["not_set", "men", "women"]);
const LEGACY_MEMBERSHIP_TIERS = ["masters_registration", "active_player", "division_one_squad"] as const;

const emailUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
});

type MembershipFeeAccount = {
  amountDue: number | null;
  amountPaid: number;
  balance: number | null;
  feePaid: boolean;
  latestPaymentDate: string | null;
};

export function mapPlayer(
  player: typeof playersTable.$inferSelect,
  teamName?: string | null,
  lastSessionAt?: string | null,
  membershipFee?: MembershipFeeAccount,
) {
  const t1 = player.lastPortalAccessAt?.toISOString() ?? null;
  const t2 = lastSessionAt ?? null;
  const lastLoginAt = t1 && t2 ? (t1 > t2 ? t1 : t2) : (t1 ?? t2);
  return {
    id: player.id,
    teamId: player.teamId,
    teamName: teamName ?? undefined,
    name: player.name,
    shirtNumber: player.shirtNumber ?? undefined,
    email: player.email,
    phone: player.phone,
    position: player.position,
    dateOfBirth: player.dateOfBirth,
    nationality: player.nationality,
    hkidNumber: player.hkidNumber,
    passportNumber: player.passportNumber,
    passportExpiry: player.passportExpiry,
    passportCopyUrl: player.passportCopyUrl,
    passportCopyReviewed: player.passportCopyReviewed,
    passportCopyUploadedAt: player.passportCopyUploadedAt?.toISOString() ?? null,
    passportCopyUploadedIsUpdate: player.passportCopyUploadedIsUpdate,
    hkidCopyUrl: player.hkidCopyUrl,
    hkidCopyReviewed: player.hkidCopyReviewed,
    hkidCopyUploadedAt: player.hkidCopyUploadedAt?.toISOString() ?? null,
    hkidCopyUploadedIsUpdate: player.hkidCopyUploadedIsUpdate,
    emergencyContactName: player.emergencyContactName,
    emergencyContactPhone: player.emergencyContactPhone,
    flightArrivalDateTime: player.flightArrivalDateTime,
    flightDepartureDateTime: player.flightDepartureDateTime,
    arrivalCity: player.arrivalCity,
    outboundFlightNumber: player.outboundFlightNumber,
    outboundDepartureDateTime: player.outboundDepartureDateTime,
    returnFlightNumber: player.returnFlightNumber,
    returnArrivalDateTime: player.returnArrivalDateTime,
    roomSharingPreference: player.roomSharingPreference,
    roomSharingWith: player.roomSharingWith,
    accommodationName: player.accommodationName,
    accommodationAddress: player.accommodationAddress,
    accommodationPhone: player.accommodationPhone,
    accommodationEmail: player.accommodationEmail,
    insuranceProvider: player.insuranceProvider,
    insurancePolicyNumber: player.insurancePolicyNumber,
    insuranceEmergencyPhone: player.insuranceEmergencyPhone,
    insurancePolicyHolder: player.insurancePolicyHolder,
    insuranceExpiry: player.insuranceExpiry,
    insuranceEmail: player.insuranceEmail,
    shirtSize: player.shirtSize,
    shortsSize: player.shortsSize,
    jacketSize: player.jacketSize,
    poloSize: player.poloSize,
    trackTopSize: player.trackTopSize,
    goalieSmockSize: player.goalieSmockSize,
    travelDates: player.travelDates,
    feePaid: player.feePaid,
    paymentAmountDue: player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : undefined,
    paymentAmountPaid: player.paymentAmountPaid ? parseFloat(player.paymentAmountPaid) : undefined,
    paymentDate: player.paymentDate,
    membershipFeeAmountDue: membershipFee?.amountDue ?? null,
    membershipFeeAmountPaid: membershipFee?.amountPaid ?? 0,
    membershipFeeBalance: membershipFee?.balance ?? null,
    membershipFeePaid: membershipFee?.feePaid ?? false,
    membershipFeePaymentDate: membershipFee?.latestPaymentDate ?? null,
    dietaryRequirements: player.dietaryRequirements,
    medicalNotes: player.medicalNotes,
    notes: player.notes,
    instagramHandle: player.instagramHandle,
    facebookHandle: player.facebookHandle,
    memberStatus: player.memberStatus,
    currentMembershipSection: player.currentMembershipSection,
    currentMembershipTier: player.currentMembershipTier,
    membershipTierUpdatedAt: player.membershipTierUpdatedAt?.toISOString() ?? null,
    travelReminderSentAt: player.travelReminderSentAt?.toISOString() ?? null,
    feeReminderSentAt: player.feeReminderSentAt?.toISOString() ?? null,
    insuranceReminderSentAt: player.insuranceReminderSentAt?.toISOString() ?? null,
    onboardingInviteSentAt: player.onboardingInviteSentAt?.toISOString() ?? null,
    lastLoginAt: lastLoginAt ?? null,
    createdAt: player.createdAt?.toISOString(),
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function legacyRotterdamSnapshot(player: typeof playersTable.$inferSelect) {
  return {
    teamId: player.teamId,
    shirtNumber: player.shirtNumber,
    position: player.position,
    flightArrivalDateTime: player.flightArrivalDateTime,
    flightDepartureDateTime: player.flightDepartureDateTime,
    arrivalCity: player.arrivalCity,
    outboundFlightNumber: player.outboundFlightNumber,
    outboundDepartureDateTime: player.outboundDepartureDateTime,
    returnFlightNumber: player.returnFlightNumber,
    returnArrivalDateTime: player.returnArrivalDateTime,
    roomSharingPreference: player.roomSharingPreference,
    roomSharingWith: player.roomSharingWith,
    accommodationName: player.accommodationName,
    accommodationAddress: player.accommodationAddress,
    accommodationPhone: player.accommodationPhone,
    accommodationEmail: player.accommodationEmail,
    insuranceProvider: player.insuranceProvider,
    insurancePolicyNumber: player.insurancePolicyNumber,
    insuranceEmergencyPhone: player.insuranceEmergencyPhone,
    insurancePolicyHolder: player.insurancePolicyHolder,
    insuranceExpiry: player.insuranceExpiry,
    insuranceEmail: player.insuranceEmail,
    shirtSize: player.shirtSize,
    shortsSize: player.shortsSize,
    jacketSize: player.jacketSize,
    poloSize: player.poloSize,
    trackTopSize: player.trackTopSize,
    goalieSmockSize: player.goalieSmockSize,
    travelDates: player.travelDates,
    feePaid: player.feePaid,
    paymentAmountDue: player.paymentAmountDue,
    paymentAmountPaid: player.paymentAmountPaid,
    paymentDate: player.paymentDate,
    dietaryRequirements: player.dietaryRequirements,
    medicalNotes: player.medicalNotes,
    notes: player.notes,
  };
}

type MembershipDbExecutor = Pick<typeof db, "execute" | "insert" | "select" | "update">;

async function ensureCanonicalTeam(
  executor: MembershipDbExecutor,
  values: typeof teamsTable.$inferInsert,
) {
  const [existing] = await executor.select({ id: teamsTable.id })
    .from(teamsTable)
    .where(eq(teamsTable.name, values.name))
    .limit(1);
  if (existing) {
    await executor.update(teamsTable)
      .set({
        isInternal: values.isInternal ?? false,
        membershipSection: values.membershipSection ?? "not_set",
      })
      .where(eq(teamsTable.id, existing.id));
    return existing.id;
  }
  const [created] = await executor.insert(teamsTable).values(values)
    .onConflictDoNothing()
    .returning({ id: teamsTable.id });
  if (created) return created.id;
  const [concurrent] = await executor.select({ id: teamsTable.id })
    .from(teamsTable)
    .where(eq(teamsTable.name, values.name))
    .limit(1);
  if (!concurrent) throw new Error(`Failed to provision canonical team "${values.name}"`);
  return concurrent.id;
}

export async function clearLegacyCopiedCurrentTeamLinks(
  executor: MembershipDbExecutor,
  currentSeasonId: number,
  playerId?: number,
) {
  await executor.update(playerParticipationsTable).set({
    teamId: null,
    updatedAt: new Date(),
  }).where(and(
    eq(playerParticipationsTable.seasonId, currentSeasonId),
    playerId === undefined ? undefined : eq(playerParticipationsTable.playerId, playerId),
    eq(playerParticipationsTable.source, "membership_backfill"),
    sql`${playerParticipationsTable.teamId} IS NOT NULL`,
    sql`EXISTS (
      SELECT 1 FROM ${playersTable} legacy_player
      WHERE legacy_player.id = ${playerParticipationsTable.playerId}
        AND legacy_player.team_id = ${playerParticipationsTable.teamId}
    )`,
  ));
}

async function ensureMembershipFoundationWithExecutor(executor: MembershipDbExecutor) {
  const [rotterdam] = await executor.insert(seasonsTable).values({
    slug: ROTTERDAM_SEASON_SLUG,
    name: "Rotterdam Masters World Cup 2026",
    kind: "event",
    status: "archived",
    isCurrent: false,
    startsOn: "2026-08-01",
    endsOn: "2026-08-31",
  }).onConflictDoUpdate({
    target: seasonsTable.slug,
    set: { name: "Rotterdam Masters World Cup 2026", status: "archived", isCurrent: false, updatedAt: new Date() },
  }).returning();

  const [current] = await executor.insert(seasonsTable).values({
    slug: CURRENT_SEASON_SLUG,
    name: "2026/27 Membership",
    kind: "membership",
    status: "current",
    isCurrent: true,
    startsOn: "2026-09-01",
    endsOn: "2027-08-31",
  }).onConflictDoUpdate({
    target: seasonsTable.slug,
    set: { name: "2026/27 Membership", status: "current", isCurrent: true, updatedAt: new Date() },
  }).returning();

  await ensureCanonicalTeam(executor, {
    name: "Awaiting Selection",
    category: "Awaiting Selection",
    membershipSection: "not_set",
    managerName: "",
    managerEmail: "",
    managerPhone: "",
    description: "Internal holding team for members awaiting current category or squad selection.",
    isInternal: true,
  });
  await ensureCanonicalTeam(executor, {
    name: "Masters Div. 1",
    category: "Men's Squad",
    membershipSection: "men",
    managerName: "",
    managerEmail: "",
    managerPhone: "",
    description: "Active Hong Kong Hockey League squad. Player selection is managed separately from membership category.",
    isInternal: false,
  });

  const players = await executor.select().from(playersTable).orderBy(playersTable.id);
  await executor.update(playerPaymentsTable)
    .set({ seasonId: rotterdam.id })
    .where(isNull(playerPaymentsTable.seasonId));
  for (const player of players) {
    if (player.createdAt < ROTTERDAM_MIGRATION_CUTOFF) {
      await executor.insert(playerParticipationsTable).values({
        playerId: player.id,
        seasonId: rotterdam.id,
        teamId: player.teamId,
        participationStatus: "archived",
        membershipTier: null,
        source: "rotterdam_backfill",
        legacySnapshot: legacyRotterdamSnapshot(player),
      }).onConflictDoNothing();
    }
    await executor.insert(playerParticipationsTable).values({
      playerId: player.id,
      seasonId: current.id,
      teamId: null,
      participationStatus: player.memberStatus === "active" ? "active" : player.memberStatus,
      membershipSection: player.currentMembershipSection,
      membershipTier: player.currentMembershipTier,
      amountDue: membershipCategoryAmountDue(player.currentMembershipTier)?.toFixed(2) ?? null,
      source: "membership_backfill",
    }).onConflictDoNothing();
  }

  // Idempotent cleanup of pre-category values, scoped to the current season.
  await executor.update(playersTable).set({
    currentMembershipTier: "awaiting_selection",
    membershipTierUpdatedAt: new Date(),
  }).where(and(
    inArray(playersTable.currentMembershipTier, [...LEGACY_MEMBERSHIP_TIERS]),
    sql`EXISTS (
      SELECT 1 FROM ${playerParticipationsTable} current_participation
      WHERE current_participation.player_id = ${playersTable.id}
        AND current_participation.season_id = ${current.id}
    )`,
  ));
  await executor.update(playerParticipationsTable).set({
    teamId: null,
    membershipTier: "awaiting_selection",
    amountDue: null,
    updatedAt: new Date(),
  }).where(and(
    eq(playerParticipationsTable.seasonId, current.id),
    inArray(playerParticipationsTable.membershipTier, [...LEGACY_MEMBERSHIP_TIERS]),
  ));
  // Older current-season rows copied the legacy player.teamId. Remove only
  // those copied links; independently selected league squads remain intact.
  await clearLegacyCopiedCurrentTeamLinks(executor, current.id);
  for (const category of MEMBERSHIP_CATEGORIES) {
    const expectedAmountDue = membershipCategoryAmountDue(category)?.toFixed(2) ?? null;
    await executor.update(playerParticipationsTable).set({
      amountDue: expectedAmountDue,
      updatedAt: new Date(),
    }).where(and(
      eq(playerParticipationsTable.seasonId, current.id),
      eq(playerParticipationsTable.membershipTier, category),
      sql`${playerParticipationsTable.amountDue} IS DISTINCT FROM ${expectedAmountDue}`,
    ));
  }
  await executor.execute(sql`
    UPDATE ${playerParticipationsTable} AS current_participation
    SET membership_section = member.current_membership_section,
        updated_at = NOW()
    FROM ${playersTable} AS member
    WHERE current_participation.player_id = member.id
      AND current_participation.season_id = ${current.id}
      AND current_participation.membership_section IS DISTINCT FROM member.current_membership_section
  `);

  const participations = await executor.select({
    seasonId: playerParticipationsTable.seasonId,
  }).from(playerParticipationsTable);
  const emailCounts = new Map<string, number>();
  for (const player of players) {
    const email = normalizeEmail(player.email);
    if (email) emailCounts.set(email, (emailCounts.get(email) ?? 0) + 1);
  }
  return {
    players: players.length,
    rotterdamParticipations: participations.filter((p) => p.seasonId === rotterdam.id).length,
    currentParticipations: participations.filter((p) => p.seasonId === current.id).length,
    duplicateEmails: [...emailCounts.entries()].filter(([, count]) => count > 1).map(([email]) => email),
    currentSeasonId: current.id,
    rotterdamSeasonId: rotterdam.id,
  };
}

export async function ensureMembershipFoundation(executor?: MembershipDbExecutor) {
  if (executor && executor !== db) {
    await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hk-masters-membership-foundation'))`);
    return ensureMembershipFoundationWithExecutor(executor);
  }
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('hk-masters-membership-foundation'))`);
    return ensureMembershipFoundationWithExecutor(tx);
  });
}

async function getMembershipFeeAccounts(playerIds: number[]): Promise<Map<number, MembershipFeeAccount>> {
  const accounts = new Map<number, MembershipFeeAccount>();
  if (playerIds.length === 0) return accounts;
  const foundation = await ensureMembershipFoundation();
  const participations = await db.select({
    playerId: playerParticipationsTable.playerId,
    amountDue: playerParticipationsTable.amountDue,
  }).from(playerParticipationsTable).where(and(
    eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
    inArray(playerParticipationsTable.playerId, playerIds),
  ));
  const payments = await db.select().from(playerPaymentsTable).where(and(
    eq(playerPaymentsTable.seasonId, foundation.currentSeasonId),
    inArray(playerPaymentsTable.playerId, playerIds),
  )).orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  const paymentsByPlayer = new Map<number, typeof payments>();
  for (const payment of payments) {
    const rows = paymentsByPlayer.get(payment.playerId) ?? [];
    rows.push(payment);
    paymentsByPlayer.set(payment.playerId, rows);
  }
  for (const participation of participations) {
    const rows = paymentsByPlayer.get(participation.playerId) ?? [];
    const amountDue = participation.amountDue == null ? null : parseFloat(participation.amountDue);
    const account = buildSeasonFeeAccount(foundation.currentSeasonId, amountDue, rows);
    accounts.set(participation.playerId, {
      amountDue,
      amountPaid: account.amountPaid,
      balance: account.balance,
      feePaid: account.feePaid,
      latestPaymentDate: account.latestPaymentDate,
    });
  }
  return accounts;
}

async function getSelfMembershipFeeAccount(
  player: typeof playersTable.$inferSelect,
): Promise<MembershipFeeAccount> {
  const [currentSeason] = await db.select({ id: seasonsTable.id })
    .from(seasonsTable)
    .where(eq(seasonsTable.slug, CURRENT_SEASON_SLUG))
    .limit(1);
  const effectiveCategory = MEMBERSHIP_TIERS.has(player.currentMembershipTier)
    ? player.currentMembershipTier
    : "awaiting_selection";
  const categoryAmountDue = membershipCategoryAmountDue(effectiveCategory);
  if (!currentSeason) {
    return {
      amountDue: categoryAmountDue,
      amountPaid: 0,
      balance: categoryAmountDue,
      feePaid: false,
      latestPaymentDate: null,
    };
  }
  const payments = await db.select().from(playerPaymentsTable).where(and(
    eq(playerPaymentsTable.playerId, player.id),
    eq(playerPaymentsTable.seasonId, currentSeason.id),
  )).orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  const amountDue = categoryAmountDue;
  const account = buildSeasonFeeAccount(currentSeason.id, amountDue, payments);
  return {
    amountDue,
    amountPaid: account.amountPaid,
    balance: account.balance,
    feePaid: account.feePaid,
    latestPaymentDate: account.latestPaymentDate,
  };
}

async function syncCurrentParticipation(playerId: number) {
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return;
  const foundation = await ensureMembershipFoundation();
  await db.update(playerParticipationsTable).set({
    teamId: sql`CASE
      WHEN ${playerParticipationsTable.teamId} IS NULL THEN NULL
      WHEN EXISTS (
        SELECT 1 FROM ${teamsTable} assigned_team
        WHERE assigned_team.id = ${playerParticipationsTable.teamId}
          AND assigned_team.membership_section = ${player.currentMembershipSection}
      ) THEN ${playerParticipationsTable.teamId}
      ELSE NULL
    END`,
    membershipSection: player.currentMembershipSection,
    membershipTier: player.currentMembershipTier,
    amountDue: membershipCategoryAmountDue(player.currentMembershipTier)?.toFixed(2) ?? null,
    participationStatus: player.memberStatus === "active" ? "active" : player.memberStatus,
    updatedAt: new Date(),
  }).where(and(
    eq(playerParticipationsTable.playerId, playerId),
    eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
  ));
}

function mapInterestSubmission(row: {
  submission: typeof membershipInterestSubmissionsTable.$inferSelect;
  matchedPlayer: Pick<
    typeof playersTable.$inferSelect,
    "name" | "email" | "dateOfBirth" | "position" | "currentMembershipSection"
  > | null;
}) {
  const rawData = row.submission.rawData && typeof row.submission.rawData === "object"
    ? row.submission.rawData as Record<string, unknown>
    : {};
  const hasConsent = row.submission.source === "notion_join" &&
    rawData.reason !== "consent_not_granted";
  const notionPosition = Array.isArray(rawData["Position(s)"])
    ? rawData["Position(s)"].map(String).join(", ")
    : null;
  const notionDateOfBirth = typeof rawData["Year of Birth"] === "string"
    ? rawData["Year of Birth"].slice(0, 10)
    : null;
  const conflictDetails = row.submission.matchStatus === "conflict" &&
    hasConsent &&
    row.matchedPlayer
    ? getNotionMemberConflicts({
        consent: true,
        email: row.submission.submittedEmail,
        dateOfBirth: notionDateOfBirth,
        position: notionPosition,
        membershipSection: row.submission.membershipSection === "not_set"
          ? null
          : row.submission.membershipSection as "men" | "women",
      }, row.matchedPlayer)
    : [];
  return {
    id: row.submission.id,
    submittedName: row.submission.submittedName,
    submittedEmail: row.submission.submittedEmail,
    submittedPhone: row.submission.submittedPhone,
    membershipTier: row.submission.membershipTier,
    membershipSection: row.submission.membershipSection,
    matchedPlayerId: row.submission.matchedPlayerId,
    matchedPlayerName: row.matchedPlayer?.name ?? null,
    matchStatus: row.submission.matchStatus,
    source: row.submission.source,
    externalId: row.submission.externalId,
    submittedAt: row.submission.submittedAt.toISOString(),
    reviewedAt: row.submission.reviewedAt?.toISOString() ?? null,
    conflictDetails,
  };
}

router.post("/membership/initialize", requireAdminAccess, async (_req, res) => {
  const result = await ensureMembershipFoundation();
  res.json({
    players: result.players,
    rotterdamParticipations: result.rotterdamParticipations,
    currentParticipations: result.currentParticipations,
    duplicateEmails: result.duplicateEmails,
  });
});

router.get("/membership/notion-sync", requireAdminAccess, async (_req, res) => {
  const latest = await getLatestNotionMemberSync();
  res.json({
    configured: isNotionMemberSyncConfigured(),
    latest: latest ? {
      status: latest.status,
      imported: latest.importedCount,
      created: latest.createdCount,
      matched: latest.matchedCount,
      needsReview: latest.reviewCount,
      skipped: latest.skippedCount,
      error: latest.errorMessage,
      startedAt: latest.startedAt.toISOString(),
      completedAt: latest.completedAt?.toISOString() ?? null,
    } : null,
  });
});

router.post("/membership/notion-sync", requireAdminAccess, async (_req, res) => {
  if (!isNotionMemberSyncConfigured()) {
    res.status(503).json({ error: "Notion member sync is not configured." });
    return;
  }
  try {
    const foundation = await ensureMembershipFoundation();
    const result = await syncNotionMembers(foundation.currentSeasonId);
    res.json(result);
  } catch (error) {
    if (error instanceof NotionMemberSyncAlreadyRunningError) {
      res.status(409).json({ error: error.message });
      return;
    }
    throw error;
  }
});

router.get("/membership/interest-submissions", requireAdminAccess, async (_req, res) => {
  const rows = await db.select({
    submission: membershipInterestSubmissionsTable,
    matchedPlayer: {
      name: playersTable.name,
      email: playersTable.email,
      dateOfBirth: playersTable.dateOfBirth,
      position: playersTable.position,
      currentMembershipSection: playersTable.currentMembershipSection,
    },
  }).from(membershipInterestSubmissionsTable)
    .leftJoin(playersTable, eq(membershipInterestSubmissionsTable.matchedPlayerId, playersTable.id))
    .orderBy(desc(membershipInterestSubmissionsTable.submittedAt));
  res.json(rows.map(mapInterestSubmission));
});

router.post("/membership/interest-submissions", requireAdminAccess, async (req, res) => {
  const { submissions } = ImportMembershipInterestSubmissionsBody.parse(req.body);
  const { matched, needsReview } = await db.transaction(async (tx) => {
    const foundation = await ensureMembershipFoundation(tx);
    let matched = 0;
    let needsReview = 0;

    for (const input of submissions) {
      const normalizedEmail = normalizeEmail(input.email);
      const membershipSection = input.membershipSection ?? "not_set";
      const candidates = await tx.select().from(playersTable)
        .where(sql`lower(trim(${playersTable.email})) = ${normalizedEmail}`);
      let matchedPlayerId: number | null = null;
      let matchStatus = "unmatched";
      let matchedCandidate: typeof playersTable.$inferSelect | null = null;

      if (candidates.length > 1) {
        matchStatus = "ambiguous";
      } else if (candidates.length === 1) {
        const candidate = candidates[0];
        if (
          candidate.currentMembershipTier !== "awaiting_selection" &&
          candidate.currentMembershipTier !== input.membershipTier
        ) {
          matchedPlayerId = candidate.id;
          matchStatus = "conflict";
        } else {
          matchedPlayerId = candidate.id;
          matchStatus = "matched";
          matchedCandidate = candidate;
        }
        if (
          matchedCandidate &&
          membershipSection !== "not_set" &&
          matchedCandidate.currentMembershipSection !== "not_set" &&
          matchedCandidate.currentMembershipSection !== membershipSection
        ) {
          matchedPlayerId = matchedCandidate.id;
          matchedCandidate = null;
          matchStatus = "conflict";
        }
      }

      if (matchedCandidate) {
        const now = new Date();
        const resolvedMembershipSection = membershipSection === "not_set"
          ? matchedCandidate.currentMembershipSection
          : membershipSection;
        await tx.update(playersTable).set({
          currentMembershipTier: input.membershipTier,
          currentMembershipSection: resolvedMembershipSection,
          membershipTierUpdatedAt: now,
        }).where(eq(playersTable.id, matchedCandidate.id));
        await tx.update(playerParticipationsTable).set({
          membershipTier: input.membershipTier,
          membershipSection: resolvedMembershipSection,
          amountDue: membershipCategoryAmountDue(input.membershipTier)?.toFixed(2) ?? null,
          updatedAt: now,
        }).where(and(
          eq(playerParticipationsTable.playerId, matchedCandidate.id),
          eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
        ));
      }
      await tx.insert(membershipInterestSubmissionsTable).values({
        seasonId: foundation.currentSeasonId,
        submittedName: input.name.trim(),
        submittedEmail: normalizedEmail,
        submittedPhone: input.phone?.trim() || null,
        membershipTier: input.membershipTier,
        membershipSection,
        matchedPlayerId,
        matchStatus,
        rawData: input.rawData ?? input,
        reviewedAt: matchStatus === "matched" ? new Date() : null,
      });
      if (matchStatus === "matched") matched++;
      else needsReview++;
    }

    return { matched, needsReview };
  });

  res.json({ imported: submissions.length, matched, needsReview });
});

router.patch("/membership/interest-submissions/:id", requireAdminAccess, async (req, res) => {
  const { id } = ResolveMembershipInterestSubmissionParams.parse(req.params);
  const body = ResolveMembershipInterestSubmissionBody.parse(req.body);
  const [existing] = await db.select().from(membershipInterestSubmissionsTable)
    .where(eq(membershipInterestSubmissionsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Interest submission not found" });
    return;
  }

  let matchStatus = "dismissed";
  let matchedPlayerId: number | null = null;
  let matchedPlayer: typeof playersTable.$inferSelect | null = null;
  if (!body.dismiss && body.playerId) {
    const [player] = await db.select().from(playersTable).where(eq(playersTable.id, body.playerId));
    if (!player) {
      res.status(404).json({ error: "Member not found" });
      return;
    }
    matchedPlayerId = player.id;
    matchStatus = "matched";
    matchedPlayer = player;
  }
  const updated = await db.transaction(async (tx) => {
    const now = new Date();
    const membershipSection = body.membershipSection ?? existing.membershipSection ?? "not_set";
    const rawData = !body.dismiss &&
      existing.source === "notion_join" &&
      existing.matchStatus === "conflict"
      ? markNotionProfileConflictResolved(existing.rawData, existing.sourceUpdatedAt)
      : existing.rawData;
    if (matchedPlayer) {
      const foundation = await ensureMembershipFoundation(tx);
      const shouldApplyTier = shouldApplyImportedTier(
        existing.source,
        matchedPlayer.currentMembershipTier,
      );
      if (shouldApplyTier) {
        await tx.update(playersTable).set({
          currentMembershipTier: body.membershipTier,
          membershipTierUpdatedAt: now,
        }).where(eq(playersTable.id, matchedPlayer.id));
        await tx.update(playerParticipationsTable).set({
          membershipTier: body.membershipTier,
          amountDue: membershipCategoryAmountDue(body.membershipTier)?.toFixed(2) ?? null,
          participationStatus: matchedPlayer.memberStatus === "active" ? "active" : matchedPlayer.memberStatus,
          updatedAt: now,
        }).where(and(
          eq(playerParticipationsTable.playerId, matchedPlayer.id),
          eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
        ));
      }
      if (
        membershipSection !== "not_set" &&
        (existing.source !== "notion_join" || matchedPlayer.currentMembershipSection === "not_set")
      ) {
        await tx.update(playersTable).set({
          currentMembershipSection: membershipSection,
        }).where(eq(playersTable.id, matchedPlayer.id));
        await tx.update(playerParticipationsTable).set({
          membershipSection,
          updatedAt: now,
        }).where(and(
          eq(playerParticipationsTable.playerId, matchedPlayer.id),
          eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
        ));
      }
    }
    const [submission] = await tx.update(membershipInterestSubmissionsTable).set({
      matchedPlayerId,
      membershipTier: body.membershipTier,
      membershipSection,
      matchStatus,
      rawData,
      reviewedAt: now,
    }).where(eq(membershipInterestSubmissionsTable.id, id)).returning();
    return submission;
  });
  res.json(mapInterestSubmission({ submission: updated, matchedPlayer }));
});

router.get("/:id/participations", requireAdminAccess, async (req, res) => {
  const { id } = ListPlayerParticipationsParams.parse(req.params);
  await ensureMembershipFoundation();
  const rows = await db.select({
    participation: playerParticipationsTable,
    season: seasonsTable,
    teamName: teamsTable.name,
  }).from(playerParticipationsTable)
    .innerJoin(seasonsTable, eq(playerParticipationsTable.seasonId, seasonsTable.id))
    .leftJoin(teamsTable, eq(playerParticipationsTable.teamId, teamsTable.id))
    .where(eq(playerParticipationsTable.playerId, id))
    .orderBy(desc(seasonsTable.startsOn));
  res.json(rows.map(({ participation, season, teamName }) => ({
    id: participation.id,
    playerId: participation.playerId,
    seasonId: participation.seasonId,
    seasonSlug: season.slug,
    seasonName: season.name,
    seasonKind: season.kind,
    seasonStatus: season.status,
    teamId: participation.teamId,
    teamName,
    participationStatus: participation.participationStatus,
    membershipSection: participation.membershipSection,
    membershipTier: participation.membershipTier,
    source: participation.source,
    legacySnapshot: participation.legacySnapshot,
    createdAt: participation.createdAt.toISOString(),
  })));
});

router.get("/", requireAdminAccess, async (req, res) => {
  const query = ListPlayersQueryParams.parse(req.query);
  const filters = [
    query.teamId ? eq(playersTable.teamId, query.teamId) : undefined,
    query.position
      ? sql`EXISTS (
          SELECT 1
          FROM unnest(string_to_array(${playersTable.position}, ',')) AS player_position
          WHERE lower(trim(player_position)) = lower(${query.position})
        )`
      : undefined,
    query.membershipSection
      ? eq(playersTable.currentMembershipSection, query.membershipSection)
      : undefined,
  ].filter((filter): filter is NonNullable<typeof filter> => filter !== undefined);

  const lastLoginSq = db
    .select({
      playerId: playerSessionsTable.playerId,
      lastLoginAt: sql<string>`max(${playerSessionsTable.createdAt})`.as("last_login_at"),
    })
    .from(playerSessionsTable)
    .groupBy(playerSessionsTable.playerId)
    .as("last_logins");

  const baseQuery = db
    .select({ player: playersTable, teamName: teamsTable.name, lastLoginAt: lastLoginSq.lastLoginAt })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .leftJoin(lastLoginSq, eq(playersTable.id, lastLoginSq.playerId));
  const players = filters.length > 0
    ? await baseQuery.where(and(...filters)).orderBy(playersTable.id)
    : await baseQuery.orderBy(playersTable.id);
  const membershipFees = await getMembershipFeeAccounts(players.map(({ player }) => player.id));
  res.json(players.map(({ player, teamName, lastLoginAt }) =>
    mapPlayer(player, teamName, lastLoginAt, membershipFees.get(player.id))));
});

router.post("/", requireAdminAccess, async (req, res) => {
  const body = CreatePlayerBody.parse(req.body);
  const [player] = await db
    .insert(playersTable)
    .values({ ...(body as any), accessToken: crypto.randomUUID() })
    .returning();
  const membershipFoundation = await ensureMembershipFoundation();
  // If an initial paid amount was supplied via the legacy fields,
  // mirror it into the ledger so the new payments table remains the
  // source of truth and the next recompute cannot lose the value.
  const initialPaid = body.paymentAmountPaid;
  if (typeof initialPaid === "number" && Number.isFinite(initialPaid) && initialPaid > 0) {
    await db.insert(playerPaymentsTable).values({
      playerId: player.id,
      seasonId: membershipFoundation.rotterdamSeasonId,
      amount: initialPaid.toFixed(2),
      paymentDate: body.paymentDate ?? "",
      method: "",
      notes: "Initial payment recorded at player creation",
    });
    await recomputePlayerAggregates(player.id);
  }
  const [refreshed] = await db.select().from(playersTable).where(eq(playersTable.id, player.id));
  await syncCurrentParticipation(refreshed.id);
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, refreshed.teamId));
  res.status(201).json(mapPlayer(refreshed, team?.name));
});

const SELF_EDITABLE_FIELDS = [
  "name",
  "phone",
  "dateOfBirth",
  "nationality",
  "hkidNumber",
  "passportNumber",
  "passportExpiry",
  "passportCopyUrl",
  "hkidCopyUrl",
  "emergencyContactName",
  "emergencyContactPhone",
  "flightArrivalDateTime",
  "flightDepartureDateTime",
  "arrivalCity",
  "outboundFlightNumber",
  "outboundDepartureDateTime",
  "returnFlightNumber",
  "returnArrivalDateTime",
  "roomSharingPreference",
  "roomSharingWith",
  "accommodationName",
  "accommodationAddress",
  "accommodationPhone",
  "accommodationEmail",
  "insuranceProvider",
  "insurancePolicyNumber",
  "insuranceEmergencyPhone",
  "insurancePolicyHolder",
  "insuranceExpiry",
  "insuranceEmail",
  "shirtSize",
  "shortsSize",
  "jacketSize",
  "poloSize",
  "trackTopSize",
  "goalieSmockSize",
  "dietaryRequirements",
  "medicalNotes",
  "instagramHandle",
  "facebookHandle",
] as const;

function mapSelfPlayer(
  player: typeof playersTable.$inferSelect,
  teamName?: string | null,
  membershipFee?: MembershipFeeAccount,
) {
  const effectiveMembershipTier = MEMBERSHIP_TIERS.has(player.currentMembershipTier)
    ? player.currentMembershipTier
    : "awaiting_selection";
  return {
    id: player.id,
    teamId: player.teamId,
    teamName: teamName ?? undefined,
    name: player.name,
    shirtNumber: player.shirtNumber ?? undefined,
    email: player.email,
    phone: player.phone ?? undefined,
    dateOfBirth: player.dateOfBirth ?? undefined,
    nationality: player.nationality ?? undefined,
    hkidNumber: player.hkidNumber ?? undefined,
    passportNumber: player.passportNumber ?? undefined,
    passportExpiry: player.passportExpiry ?? undefined,
    passportCopyUrl: player.passportCopyUrl ?? undefined,
    hkidCopyUrl: player.hkidCopyUrl ?? undefined,
    emergencyContactName: player.emergencyContactName ?? undefined,
    emergencyContactPhone: player.emergencyContactPhone ?? undefined,
    flightArrivalDateTime: player.flightArrivalDateTime ?? undefined,
    flightDepartureDateTime: player.flightDepartureDateTime ?? undefined,
    arrivalCity: player.arrivalCity ?? undefined,
    outboundFlightNumber: player.outboundFlightNumber ?? undefined,
    outboundDepartureDateTime: player.outboundDepartureDateTime ?? undefined,
    returnFlightNumber: player.returnFlightNumber ?? undefined,
    returnArrivalDateTime: player.returnArrivalDateTime ?? undefined,
    roomSharingPreference: player.roomSharingPreference ?? undefined,
    roomSharingWith: player.roomSharingWith ?? undefined,
    accommodationName: player.accommodationName ?? undefined,
    accommodationAddress: player.accommodationAddress ?? undefined,
    accommodationPhone: player.accommodationPhone ?? undefined,
    accommodationEmail: player.accommodationEmail ?? undefined,
    insuranceProvider: player.insuranceProvider ?? undefined,
    insurancePolicyNumber: player.insurancePolicyNumber ?? undefined,
    insuranceEmergencyPhone: player.insuranceEmergencyPhone ?? undefined,
    insurancePolicyHolder: player.insurancePolicyHolder ?? undefined,
    insuranceExpiry: player.insuranceExpiry ?? undefined,
    insuranceEmail: player.insuranceEmail ?? undefined,
    shirtSize: player.shirtSize ?? undefined,
    shortsSize: player.shortsSize ?? undefined,
    jacketSize: player.jacketSize ?? undefined,
    poloSize: player.poloSize ?? undefined,
    trackTopSize: player.trackTopSize ?? undefined,
    goalieSmockSize: player.goalieSmockSize ?? undefined,
    dietaryRequirements: player.dietaryRequirements ?? undefined,
    medicalNotes: player.medicalNotes ?? undefined,
    instagramHandle: player.instagramHandle ?? undefined,
    facebookHandle: player.facebookHandle ?? undefined,
    memberStatus: player.memberStatus,
    currentMembershipSection: player.currentMembershipSection,
    currentMembershipTier: effectiveMembershipTier,
    feePaid: membershipFee?.feePaid ?? false,
    paymentAmountDue: membershipFee?.amountDue ?? null,
    paymentAmountPaid: membershipFee?.amountPaid ?? 0,
    paymentBalance: membershipFee?.balance ?? null,
    paymentDate: membershipFee?.latestPaymentDate ?? null,
  };
}

router.get("/self/:token", async (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 8) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [row] = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(eq(playersTable.accessToken, token));
  if (!row) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (row.player.memberStatus !== "active") {
    res.status(403).json({ error: "Membership is not active" });
    return;
  }
  // Record when the player last accessed the portal via their invite link
  await db
    .update(playersTable)
    .set({ lastPortalAccessAt: new Date() })
    .where(eq(playersTable.id, row.player.id));
  const membershipFee = await getSelfMembershipFeeAccount(row.player);
  res.json(mapSelfPlayer(row.player, row.teamName, membershipFee));
});

router.patch("/self/:token", async (req, res) => {
  const token = req.params.token;
  if (!token || token.length < 8) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const [existing] = await db.select().from(playersTable).where(eq(playersTable.accessToken, token));
  if (!existing) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  if (existing.memberStatus !== "active") {
    res.status(403).json({ error: "Membership is not active" });
    return;
  }
  const parseResult = UpdateSelfPlayerBody.safeParse(req.body ?? {});
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request body", details: parseResult.error.flatten() });
    return;
  }
  const body = parseResult.data as Record<string, unknown>;
  const updates: Record<string, unknown> = {};
  for (const field of SELF_EDITABLE_FIELDS) {
    if (field in body) {
      const value = body[field];
      updates[field] = value === "" ? null : value;
    }
  }
  const newPassportCopyUrl = updates.passportCopyUrl as string | null | undefined;
  const passportCopyChanged =
    "passportCopyUrl" in updates &&
    newPassportCopyUrl !== existing.passportCopyUrl &&
    typeof newPassportCopyUrl === "string" &&
    newPassportCopyUrl.length > 0;

  const newHkidCopyUrl = updates.hkidCopyUrl as string | null | undefined;
  const hkidCopyChanged =
    "hkidCopyUrl" in updates &&
    newHkidCopyUrl !== existing.hkidCopyUrl &&
    typeof newHkidCopyUrl === "string" &&
    newHkidCopyUrl.length > 0;

  // If the player is uploading a new (or replacement) passport copy, clear the
  // admin's reviewed flag automatically — the admin must review the new file.
  if (passportCopyChanged) {
    const isUpdate = existing.passportCopyUrl !== null && existing.passportCopyUrl !== "";
    updates.passportCopyReviewed = false;
    updates.passportCopyUploadedAt = new Date();
    updates.passportCopyUploadedIsUpdate = isUpdate;
  }

  // Same for HKID copy.
  if (hkidCopyChanged) {
    const isUpdate = existing.hkidCopyUrl !== null && existing.hkidCopyUrl !== "";
    updates.hkidCopyReviewed = false;
    updates.hkidCopyUploadedAt = new Date();
    updates.hkidCopyUploadedIsUpdate = isUpdate;
  }

  const allUpdates = { ...updates, lastPortalAccessAt: new Date() };
  const [updated] = await db.update(playersTable).set(allUpdates).where(eq(playersTable.id, existing.id)).returning();
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, updated.teamId));
  const membershipFee = await getSelfMembershipFeeAccount(updated);
  res.json(mapSelfPlayer(updated, team?.name, membershipFee));

  const updatedFields = Object.keys(updates);

  if (passportCopyChanged) {
    sendPassportUploadNotificationEmail({
      playerName: updated.name,
      playerEmail: updated.email,
      teamName: team?.name ?? "Unknown Team",
      passportCopyUrl: newPassportCopyUrl as string,
      isUpdate: existing.passportCopyUrl !== null && existing.passportCopyUrl !== "",
    }).catch((err) => {
      console.error("[passport-notify] Failed to send notification email:", err);
    });
  }

  if (hkidCopyChanged) {
    sendHkidUploadNotificationEmail({
      playerName: updated.name,
      playerEmail: updated.email,
      teamName: team?.name ?? "Unknown Team",
      hkidCopyUrl: newHkidCopyUrl as string,
      isUpdate: existing.hkidCopyUrl !== null && existing.hkidCopyUrl !== "",
    }).catch((err) => {
      console.error("[hkid-notify] Failed to send notification email:", err);
    });
  }

  const changedFields = updatedFields
    .filter(f => f !== "passportCopyUrl" && f !== "hkidCopyUrl")
    .map(f => ({
      key: f,
      oldValue: (existing as Record<string, unknown>)[f] ?? null,
      newValue: updates[f] ?? null,
    }))
    .filter(({ oldValue, newValue }) => {
      const oldStr = (oldValue === null || oldValue === undefined || oldValue === "") ? "" : String(oldValue);
      const newStr = (newValue === null || newValue === undefined || newValue === "") ? "" : String(newValue);
      return oldStr !== newStr;
    });

  if (changedFields.length > 0) {
    sendProfileUpdateNotificationEmail({
      playerName: updated.name,
      playerEmail: updated.email,
      teamName: team?.name ?? "Unknown Team",
      changedFields,
    }).catch((err) => {
      console.error("[profile-update-notify] Failed to send notification email:", err);
    });
  }
});

function mapPayment(
  p: typeof playerPaymentsTable.$inferSelect,
  season: typeof seasonsTable.$inferSelect,
) {
  return {
    id: p.id,
    playerId: p.playerId,
    seasonId: p.seasonId,
    seasonSlug: season.slug,
    seasonName: season.name,
    amount: parseFloat(p.amount),
    paymentDate: p.paymentDate,
    method: p.method,
    notes: p.notes,
    createdAt: p.createdAt?.toISOString(),
  };
}

async function recomputePlayerAggregates(playerId: number, opts: { feePaidOverride?: boolean } = {}) {
  const foundation = await ensureMembershipFoundation();
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, playerId));
  if (!player) return;
  const payments = await db
    .select()
    .from(playerPaymentsTable)
    .where(and(
      eq(playerPaymentsTable.playerId, playerId),
      eq(playerPaymentsTable.seasonId, foundation.rotterdamSeasonId),
    ))
    .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
  const latestDate = payments.length > 0 ? payments[0].paymentDate : null;
  const due = player.paymentAmountDue ? parseFloat(player.paymentAmountDue) : null;
  let feePaid = due != null ? totalPaid + 1e-6 >= due && totalPaid > 0 : totalPaid > 0;
  // Zero-fee participants (coaches, physios, staff) have no amount due and make
  // no payments, so the payment ledger can never mark them paid. For them the
  // admin's manual "Tournament Fee Fully Paid" checkbox is the source of truth.
  if (!feePaid && totalPaid === 0 && (due == null || due <= 0) && opts.feePaidOverride === true) {
    feePaid = true;
  }
  await db
    .update(playersTable)
    .set({
      paymentAmountPaid: totalPaid > 0 ? totalPaid.toFixed(2) : null,
      paymentDate: latestDate,
      feePaid,
    })
    .where(eq(playersTable.id, playerId));
}

router.get("/:id/payments", requireAdminAccess, async (req, res) => {
  const { id } = ListPlayerPaymentsParams.parse(req.params);
  const [player] = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const foundation = await ensureMembershipFoundation();
  const seasonId = foundation.rotterdamSeasonId;
  const payments = await db
    .select({ payment: playerPaymentsTable, season: seasonsTable })
    .from(playerPaymentsTable)
    .innerJoin(seasonsTable, eq(playerPaymentsTable.seasonId, seasonsTable.id))
    .where(and(eq(playerPaymentsTable.playerId, id), eq(playerPaymentsTable.seasonId, seasonId)))
    .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  res.json(payments.map(({ payment, season }) => mapPayment(payment, season)));
});

router.post("/:id/payments", requireAdminAccess, async (req, res) => {
  const { id } = CreatePlayerPaymentParams.parse(req.params);
  const body = CreatePlayerPaymentBody.parse(req.body);
  const [player] = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const foundation = await ensureMembershipFoundation();
  const seasonId = foundation.rotterdamSeasonId;
  const [created] = await db
    .insert(playerPaymentsTable)
    .values({
      playerId: id,
      seasonId,
      amount: body.amount.toFixed(2),
      paymentDate: body.paymentDate,
      method: body.method ?? "",
      notes: body.notes ?? "",
    })
    .returning();
  if (seasonId === foundation.rotterdamSeasonId) await recomputePlayerAggregates(id);
  const [season] = await db.select().from(seasonsTable).where(eq(seasonsTable.id, seasonId));
  res.status(201).json(mapPayment(created, season));
});

router.get("/:id/membership-payments", requireAdminAccess, async (req, res) => {
  const { id } = ListPlayerPaymentsParams.parse(req.params);
  const [player] = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const foundation = await ensureMembershipFoundation();
  const payments = await db
    .select({ payment: playerPaymentsTable, season: seasonsTable })
    .from(playerPaymentsTable)
    .innerJoin(seasonsTable, eq(playerPaymentsTable.seasonId, seasonsTable.id))
    .where(and(
      eq(playerPaymentsTable.playerId, id),
      eq(playerPaymentsTable.seasonId, foundation.currentSeasonId),
    ))
    .orderBy(desc(playerPaymentsTable.paymentDate), desc(playerPaymentsTable.id));
  res.json(payments.map(({ payment, season }) => mapPayment(payment, season)));
});

router.post("/:id/membership-payments", requireAdminAccess, async (req, res) => {
  const { id } = CreatePlayerPaymentParams.parse(req.params);
  const body = CreatePlayerPaymentBody.parse(req.body);
  const [player] = await db.select({ id: playersTable.id }).from(playersTable).where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  const foundation = await ensureMembershipFoundation();
  const [created] = await db.insert(playerPaymentsTable).values({
    playerId: id,
    seasonId: foundation.currentSeasonId,
    amount: body.amount.toFixed(2),
    paymentDate: body.paymentDate,
    method: body.method ?? "",
    notes: body.notes ?? "",
  }).returning();
  const [season] = await db.select().from(seasonsTable)
    .where(eq(seasonsTable.id, foundation.currentSeasonId));
  res.status(201).json(mapPayment(created, season));
});

router.delete("/:playerId/payments/:paymentId", requireAdminAccess, async (req, res) => {
  const { playerId, paymentId } = DeletePlayerPaymentParams.parse(req.params);
  const foundation = await ensureMembershipFoundation();
  const result = await db
    .delete(playerPaymentsTable)
    .where(and(
      eq(playerPaymentsTable.id, paymentId),
      eq(playerPaymentsTable.playerId, playerId),
      eq(playerPaymentsTable.seasonId, foundation.rotterdamSeasonId),
    ))
    .returning({ id: playerPaymentsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  await recomputePlayerAggregates(playerId);
  res.status(204).send();
});

router.delete("/:playerId/membership-payments/:paymentId", requireAdminAccess, async (req, res) => {
  const { playerId, paymentId } = DeletePlayerPaymentParams.parse(req.params);
  const foundation = await ensureMembershipFoundation();
  const result = await db.delete(playerPaymentsTable).where(and(
    eq(playerPaymentsTable.id, paymentId),
    eq(playerPaymentsTable.playerId, playerId),
    eq(playerPaymentsTable.seasonId, foundation.currentSeasonId),
  )).returning({ id: playerPaymentsTable.id });
  if (result.length === 0) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.status(204).send();
});

router.get("/:id/access-token", requireAdminAccess, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }
  const [player] = await db
    .select({ accessToken: playersTable.accessToken })
    .from(playersTable)
    .where(eq(playersTable.id, id));
  if (!player) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ accessToken: player.accessToken ?? null });
});

router.post("/send-travel-reminders", requireSession, async (req, res) => {
  const { playerIds } = SendTravelRemindersBody.parse(req.body ?? {});

  const missingCondition = and(
    eq(playersTable.memberStatus, "active"),
    or(
      isNull(playersTable.flightArrivalDateTime),
      eq(playersTable.flightArrivalDateTime, ""),
    )!,
  )!;

  const whereClause = playerIds && playerIds.length > 0
    ? and(inArray(playersTable.id, playerIds), missingCondition)
    : missingCondition;

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;

  for (const { player, teamName } of players) {
    const success = await sendTravelReminderEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
    });
    if (success) {
      sent++;
      await db.update(playersTable).set({ travelReminderSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`[travel-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
  res.json({ sent, failed, total: players.length });
});

router.post("/send-onboarding-invites", requireSession, async (req, res) => {
  const { playerIds } = SendOnboardingInvitesBody.parse(req.body ?? {});

  const whereClause = playerIds && playerIds.length > 0
    ? and(inArray(playersTable.id, playerIds), eq(playersTable.memberStatus, "active"))
    : and(isNull(playersTable.onboardingInviteSentAt), eq(playersTable.memberStatus, "active"));

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;
  let skippedNoEmail = 0;
  const sentPlayerIds: number[] = [];

  for (const { player, teamName } of players) {
    if (!player.email) {
      skippedNoEmail++;
      continue;
    }
    let accessToken = player.accessToken;
    if (!accessToken) {
      accessToken = crypto.randomUUID();
      await db.update(playersTable).set({ accessToken }).where(eq(playersTable.id, player.id));
    }
    const success = await sendOnboardingInviteEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
      accessToken,
    });
    if (success) {
      sent++;
      sentPlayerIds.push(player.id);
      await db.update(playersTable).set({ onboardingInviteSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
    await new Promise((r) => setTimeout(r, 600));
  }

  // Log to email_blasts for audit trail
  if (sent > 0 || failed > 0) {
    const recipientCount = players.filter(p => !!p.player.email).length;
    await db.insert(emailBlastsTable).values({
      subject: "Onboarding Invitation",
      body: `Player portal access link${sent !== 1 ? "s" : ""} sent to ${sent} player${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed to deliver)` : ""}.`,
      audienceType: "onboarding",
      playerIds: JSON.stringify(sentPlayerIds),
      recipientCount,
      sentCount: sent,
      failedCount: failed,
      sentByEmail: null,
    });
  }

  console.log(`[onboarding-invites] Sent ${sent}, failed ${failed}, skipped-no-email ${skippedNoEmail} out of ${players.length} targeted players`);
  res.json({ sent, failed, skippedNoEmail, total: players.length });
});

router.post("/send-fee-reminders", requireSession, async (req, res) => {
  const { playerIds } = SendFeeRemindersBody.parse(req.body ?? {});
  const activePlayers = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(playerIds && playerIds.length > 0
      ? and(inArray(playersTable.id, playerIds), eq(playersTable.memberStatus, "active"))
      : eq(playersTable.memberStatus, "active"));
  const membershipFees = await getMembershipFeeAccounts(activePlayers.map(({ player }) => player.id));
  const players = activePlayers.filter(({ player }) => {
    const fee = membershipFees.get(player.id);
    return fee?.amountDue != null && !fee.feePaid;
  });

  let sent = 0;
  let failed = 0;

  for (const { player, teamName } of players) {
    const fee = membershipFees.get(player.id)!;
    const success = await sendFeeReminderEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
      amountDue: fee.amountDue,
      amountPaid: fee.amountPaid,
    });
    if (success) {
      sent++;
      await db.update(playersTable).set({ feeReminderSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else failed++;
    await new Promise((r) => setTimeout(r, 600));
  }

  console.log(`[fee-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
  res.json({ sent, failed, total: players.length });
});

router.post("/send-insurance-reminders", requireSession, async (req, res) => {
  const { playerIds } = SendInsuranceRemindersBody.parse(req.body ?? {});

  const missingCondition = and(
    eq(playersTable.memberStatus, "active"),
    or(
      isNull(playersTable.insuranceProvider),
      eq(playersTable.insuranceProvider, ""),
    )!,
  )!;

  const whereClause = playerIds && playerIds.length > 0
    ? and(inArray(playersTable.id, playerIds), missingCondition)
    : missingCondition;

  const players = await db
    .select({ player: playersTable, teamName: teamsTable.name })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .where(whereClause);

  let sent = 0;
  let failed = 0;
  const sentPlayerIds: number[] = [];

  for (const { player, teamName } of players) {
    if (!player.email) { failed++; continue; }
    let accessToken = player.accessToken;
    if (!accessToken) {
      accessToken = crypto.randomUUID();
      await db.update(playersTable).set({ accessToken }).where(eq(playersTable.id, player.id));
    }
    const portalUrl = `${process.env.PUBLIC_URL || "https://www.hkmastershockey.com"}/my-details/${encodeURIComponent(accessToken)}`;
    const success = await sendInsuranceReminderEmail({
      playerName: player.name,
      playerEmail: player.email,
      teamName: teamName ?? "your team",
      portalUrl,
    });
    if (success) {
      sent++;
      sentPlayerIds.push(player.id);
      await db.update(playersTable).set({ insuranceReminderSentAt: new Date() }).where(eq(playersTable.id, player.id));
    } else {
      failed++;
    }
    await new Promise((r) => setTimeout(r, 600));
  }

  if (sent > 0 || failed > 0) {
    const recipientCount = players.filter(p => !!p.player.email).length;
    await db.insert(emailBlastsTable).values({
      subject: "Insurance Details Reminder",
      body: `Insurance reminder${sent !== 1 ? "s" : ""} sent to ${sent} player${sent !== 1 ? "s" : ""}${failed > 0 ? ` (${failed} failed to deliver)` : ""}.`,
      audienceType: "insurance-reminder",
      playerIds: JSON.stringify(sentPlayerIds),
      recipientCount,
      sentCount: sent,
      failedCount: failed,
      sentByEmail: null,
    });
  }

  console.log(`[insurance-reminders] Sent ${sent}, failed ${failed} out of ${players.length} targeted players`);
  res.json({ sent, failed, total: players.length });
});

router.put("/:id", requireAdminAccess, async (req, res) => {
  const { id } = UpdatePlayerParams.parse(req.params);
  const body = UpdatePlayerBody.parse(req.body);
  // Strip ledger-derived fields from the direct update — they are
  // owned by player_payments and recomputed below. If the caller
  // provided an explicit paymentAmountPaid, treat it as a delta and
  // append a single ledger adjustment so the new ledger sum equals
  // the requested value (preserves backward compat for older admin
  // pages like Players.tsx / Travel.tsx that still PUT these fields).
  const {
    paymentAmountPaid: requestedPaid,
    paymentDate: requestedDate,
    feePaid: requestedFeePaid,
    membershipFeeAmountDue,
    ...directUpdate
  } = body;
  if (
    "currentMembershipTier" in directUpdate &&
    directUpdate.currentMembershipTier &&
    !MEMBERSHIP_TIERS.has(directUpdate.currentMembershipTier)
  ) {
    res.status(400).json({ error: "Invalid membership tier" });
    return;
  }
  if (
    "currentMembershipSection" in directUpdate &&
    directUpdate.currentMembershipSection &&
    !MEMBERSHIP_SECTIONS.has(directUpdate.currentMembershipSection)
  ) {
    res.status(400).json({ error: "Invalid membership section" });
    return;
  }
  if ("currentMembershipTier" in directUpdate) {
    (directUpdate as Record<string, unknown>).membershipTierUpdatedAt = new Date();
  }
  // Admin-initiated passport upload: stamp passportCopyUploadedAt + isUpdate
  // so the file shows up correctly in passport timestamps. Unlike the player
  // self PATCH route we do NOT reset passportCopyReviewed (admin uploaded it
  // themselves so they trust it) and we do NOT send a notification email.
  if (
    "passportCopyUrl" in directUpdate &&
    typeof directUpdate.passportCopyUrl === "string" &&
    directUpdate.passportCopyUrl.length > 0
  ) {
    const [existing] = await db
      .select({
        passportCopyUrl: playersTable.passportCopyUrl,
      })
      .from(playersTable)
      .where(eq(playersTable.id, id));
    if (existing && existing.passportCopyUrl !== directUpdate.passportCopyUrl) {
      const isUpdate =
        existing.passportCopyUrl !== null && existing.passportCopyUrl !== "";
      (directUpdate as Record<string, unknown>).passportCopyUploadedAt = new Date();
      (directUpdate as Record<string, unknown>).passportCopyUploadedIsUpdate = isUpdate;
    }
  }
  if (Object.keys(directUpdate).length > 0) {
    await db.update(playersTable).set(directUpdate as typeof playersTable.$inferInsert).where(eq(playersTable.id, id));
  }
  if (membershipFeeAmountDue !== undefined) {
    const foundation = await ensureMembershipFoundation();
    await db.update(playerParticipationsTable).set({
      amountDue: membershipFeeAmountDue == null ? null : membershipFeeAmountDue.toFixed(2),
      updatedAt: new Date(),
    }).where(and(
      eq(playerParticipationsTable.playerId, id),
      eq(playerParticipationsTable.seasonId, foundation.currentSeasonId),
    ));
  }
  if (typeof requestedPaid === "number" && Number.isFinite(requestedPaid)) {
    const foundation = await ensureMembershipFoundation();
    const existing = await db
      .select()
      .from(playerPaymentsTable)
      .where(and(
        eq(playerPaymentsTable.playerId, id),
        eq(playerPaymentsTable.seasonId, foundation.rotterdamSeasonId),
      ));
    const currentSum = existing.reduce((s, p) => s + parseFloat(p.amount), 0);
    const delta = requestedPaid - currentSum;
    if (Math.abs(delta) > 1e-6) {
      await db.insert(playerPaymentsTable).values({
        playerId: id,
        seasonId: foundation.rotterdamSeasonId,
        amount: delta.toFixed(2),
        paymentDate: requestedDate || new Date().toISOString().slice(0, 10),
        method: "",
        notes: "Adjustment from player edit",
      });
    }
  }
  await recomputePlayerAggregates(id, { feePaidOverride: requestedFeePaid });
  await syncCurrentParticipation(id);
  const [player] = await db.select().from(playersTable).where(eq(playersTable.id, id));
  const [team] = await db.select().from(teamsTable).where(eq(teamsTable.id, player.teamId));
  const membershipFees = await getMembershipFeeAccounts([id]);
  res.json(mapPlayer(player, team?.name, undefined, membershipFees.get(id)));
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const { id } = DeletePlayerParams.parse(req.params);
  const [player] = await db.update(playersTable).set({
    memberStatus: "archived",
  }).where(eq(playersTable.id, id)).returning({ id: playersTable.id });
  if (!player) {
    res.status(404).json({ error: "Member not found" });
    return;
  }
  await syncCurrentParticipation(id);
  res.status(204).send();
});

router.post("/send-bulk-email", requireAdminAccess, emailUpload.array("attachments", 5), async (req, res) => {
  // Fields arrive as strings from multipart/form-data
  const rawBody = {
    audienceType: req.body.audienceType,
    teamIds: req.body.teamIds ? JSON.parse(req.body.teamIds) : undefined,
    playerIds: req.body.playerIds ? JSON.parse(req.body.playerIds) : undefined,
    subject: req.body.subject,
    body: req.body.body,
  };
  const parseResult = SendBulkEmailBody.safeParse(rawBody);
  if (!parseResult.success) {
    res.status(400).json({ error: "Invalid request", details: parseResult.error.flatten() });
    return;
  }
  const { audienceType, teamIds, playerIds, subject, body } = parseResult.data;

  const files = req.files as Express.Multer.File[] | undefined;
  const attachments = (files ?? []).map((f) => ({ filename: f.originalname, content: f.buffer }));

  let players: Array<typeof playersTable.$inferSelect>;

  if (audienceType === "all") {
    players = await db.select().from(playersTable).where(eq(playersTable.memberStatus, "active"));
  } else if (audienceType === "teams" && teamIds && teamIds.length > 0) {
    players = await db.select().from(playersTable).where(and(
      inArray(playersTable.teamId, teamIds),
      eq(playersTable.memberStatus, "active"),
    ));
  } else if (audienceType === "individuals" && playerIds && playerIds.length > 0) {
    players = await db.select().from(playersTable).where(and(
      inArray(playersTable.id, playerIds),
      eq(playersTable.memberStatus, "active"),
    ));
  } else {
    res.status(400).json({ error: "No recipients matched the provided audience" });
    return;
  }

  const recipientCount = players.length;
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

  type RecipientResult = { playerId: number | null; playerName: string; playerEmail: string; sent: boolean };
  const recipientResults: RecipientResult[] = [];

  for (const player of players) {
    if (!player.email) { skipped++; continue; }
    const ok = await sendBulkAnnouncementEmail({
      playerName: player.name,
      playerEmail: player.email,
      subject,
      body,
      attachments: attachments.length > 0 ? attachments : undefined,
    });
    if (ok) sent++; else failed++;
    recipientResults.push({ playerId: player.id, playerName: player.name, playerEmail: player.email, sent: ok });
    // Resend rate-limit: 2 req/s. Wait 600 ms between sends to stay safely under.
    await sleep(600);
  }

  const [blast] = await db.insert(emailBlastsTable).values({
    subject,
    body,
    audienceType,
    teamIds: teamIds ? JSON.stringify(teamIds) : null,
    playerIds: playerIds ? JSON.stringify(playerIds) : null,
    recipientCount,
    sentCount: sent,
    failedCount: failed,
    sentByEmail: null,
  }).returning();

  // Record per-recipient delivery status
  if (recipientResults.length > 0) {
    await db.insert(emailBlastRecipientsTable).values(
      recipientResults.map((r) => ({
        blastId: blast.id,
        playerId: r.playerId,
        playerName: r.playerName,
        playerEmail: r.playerEmail,
        sent: r.sent,
        errorMessage: r.sent ? null : "rate_limit_exceeded",
      }))
    );
  }

  console.log(`[bulk-email] audienceType=${audienceType} sent=${sent} failed=${failed} skipped=${skipped} blastId=${blast.id}`);
  res.json({ sent, failed, skipped, total: recipientCount, blastId: blast.id });
});

router.get("/email-blasts/:id/recipients", requireAdminAccess, async (req, res) => {
  const id = parseInt(String(req.params.id), 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid id" }); return; }
  const rows = await db
    .select()
    .from(emailBlastRecipientsTable)
    .where(eq(emailBlastRecipientsTable.blastId, id))
    .orderBy(emailBlastRecipientsTable.sent, emailBlastRecipientsTable.playerName);
  res.json(rows.map((r) => ({
    id: r.id,
    playerId: r.playerId,
    playerName: r.playerName,
    playerEmail: r.playerEmail,
    sent: r.sent,
    errorMessage: r.errorMessage ?? null,
  })));
});

router.get("/onboarding-invite-log", requireAdminAccess, async (req, res) => {
  const lastSessionSq = db
    .select({
      playerId: playerSessionsTable.playerId,
      lastSessionAt: sql<string>`max(${playerSessionsTable.createdAt})`.as("last_session_at"),
    })
    .from(playerSessionsTable)
    .groupBy(playerSessionsTable.playerId)
    .as("last_sessions");

  const rows = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      email: playersTable.email,
      teamName: teamsTable.name,
      invitedAt: playersTable.onboardingInviteSentAt,
      lastPortalAccessAt: playersTable.lastPortalAccessAt,
      lastSessionAt: lastSessionSq.lastSessionAt,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .leftJoin(lastSessionSq, eq(playersTable.id, lastSessionSq.playerId))
    .where(isNotNull(playersTable.onboardingInviteSentAt))
    .orderBy(desc(playersTable.onboardingInviteSentAt));

  res.json(rows.map(r => {
    const t1 = r.lastPortalAccessAt?.toISOString() ?? null;
    const t2 = r.lastSessionAt ?? null;
    const lastLoginAt = t1 && t2 ? (t1 > t2 ? t1 : t2) : (t1 ?? t2);
    return {
      id: r.id,
      name: r.name,
      email: r.email,
      teamName: r.teamName ?? null,
      invitedAt: r.invitedAt!.toISOString(),
      lastLoginAt,
    };
  }));
});

router.get("/email-blasts", requireAdminAccess, async (req, res) => {
  const rows = await db
    .select({
      id: emailBlastsTable.id,
      subject: emailBlastsTable.subject,
      body: emailBlastsTable.body,
      audienceType: emailBlastsTable.audienceType,
      teamIds: emailBlastsTable.teamIds,
      playerIds: emailBlastsTable.playerIds,
      recipientCount: emailBlastsTable.recipientCount,
      sentCount: emailBlastsTable.sentCount,
      failedCount: emailBlastsTable.failedCount,
      sentByEmail: emailBlastsTable.sentByEmail,
      sentAt: emailBlastsTable.sentAt,
    })
    .from(emailBlastsTable)
    .orderBy(desc(emailBlastsTable.sentAt));

  const individualBlastIds = rows
    .filter((r) => r.audienceType === "individuals" || r.audienceType === "pledge-digest")
    .map((r) => r.id);

  const recipientNamesByBlastId = new Map<number, string[]>();
  if (individualBlastIds.length > 0) {
    const recipientRows = await db
      .select({
        blastId: emailBlastRecipientsTable.blastId,
        playerName: emailBlastRecipientsTable.playerName,
      })
      .from(emailBlastRecipientsTable)
      .where(inArray(emailBlastRecipientsTable.blastId, individualBlastIds));

    for (const row of recipientRows) {
      const existing = recipientNamesByBlastId.get(row.blastId) ?? [];
      existing.push(row.playerName);
      recipientNamesByBlastId.set(row.blastId, existing);
    }
  }

  const teamBlastRows = rows.filter((r) => r.audienceType === "teams");
  const allTeamIds = new Set<number>();
  for (const r of teamBlastRows) {
    try {
      const ids: number[] = JSON.parse(r.teamIds ?? "[]");
      ids.forEach((id) => allTeamIds.add(id));
    } catch {
    }
  }

  const teamNamesById = new Map<number, string>();
  if (allTeamIds.size > 0) {
    const teamRows = await db
      .select({ id: teamsTable.id, name: teamsTable.name })
      .from(teamsTable)
      .where(inArray(teamsTable.id, [...allTeamIds]));
    for (const t of teamRows) {
      teamNamesById.set(t.id, t.name);
    }
  }

  res.json(rows.map((r) => {
    let teamNames: string[] | undefined;
    if (r.audienceType === "teams") {
      try {
        const ids: number[] = JSON.parse(r.teamIds ?? "[]");
        teamNames = ids.map((id) => teamNamesById.get(id) ?? String(id));
      } catch {
        teamNames = [];
      }
    }
    return {
      ...r,
      sentAt: r.sentAt.toISOString(),
      recipientNames: recipientNamesByBlastId.get(r.id) ?? [],
      teamNames,
    };
  }));
});

router.get("/arrivals", requireAdminAccess, async (_req, res) => {
  const ISO_DATE_RE = /^[0-9]{4}-[0-9]{2}-[0-9]{2}/;

  const allRows = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      arrival: playersTable.flightArrivalDateTime,
      arrivalCity: playersTable.arrivalCity,
      travelNote: playersTable.travelNote,
      departure: playersTable.flightDepartureDateTime,
      departureNote: playersTable.departureNote,
      teamCategory: teamsTable.category,
      teamName: teamsTable.name,
    })
    .from(playersTable)
    .leftJoin(teamsTable, eq(playersTable.teamId, teamsTable.id))
    .orderBy(playersTable.flightArrivalDateTime);

  const withArrival = allRows
    .filter((r) => r.arrival && ISO_DATE_RE.test(r.arrival))
    .map((r) => ({
      id: r.id,
      name: r.name,
      arrival: r.arrival!,
      arrivalCity: r.arrivalCity ?? null,
      travelNote: r.travelNote ?? null,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  const withoutArrival = allRows
    .filter((r) => !r.arrival || !ISO_DATE_RE.test(r.arrival))
    .map((r) => ({
      id: r.id,
      name: r.name,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  const departureRows = [...allRows].sort((a, b) =>
    (a.departure ?? "").localeCompare(b.departure ?? "")
  );

  const withDeparture = departureRows
    .filter((r) => r.departure && ISO_DATE_RE.test(r.departure))
    .map((r) => ({
      id: r.id,
      name: r.name,
      departure: r.departure!,
      departureCity: r.arrivalCity ?? null,
      departureNote: r.departureNote ?? null,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  const withoutDeparture = departureRows
    .filter((r) => !r.departure || !ISO_DATE_RE.test(r.departure))
    .map((r) => ({
      id: r.id,
      name: r.name,
      teamCategory: r.teamCategory ?? null,
      teamName: r.teamName ?? null,
    }));

  res.json({ withArrival, withoutArrival, withDeparture, withoutDeparture });
});

export default router;
