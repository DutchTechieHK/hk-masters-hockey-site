import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db, pool } from "@workspace/db";
import {
  membershipInterestSubmissionsTable,
  playerParticipationsTable,
  playersTable,
  teamsTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

const { default: playersRouter } = await import("./players");

const app = express();
app.use(express.json());
app.use("/api/players", playersRouter);
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(500).json({ error: "forced database failure" });
});

const runId = `${process.pid}-${Date.now()}`;
const firstEmail = `membership-import-first-${runId}@example.com`;
const failingEmail = `membership-import-fail-${runId}@example.com`;
const manualEmail = `membership-import-manual-${runId}@example.com`;
const notionConflictEmail = `membership-import-conflict-${runId}@example.com`;
const triggerName = `fail_membership_import_${process.pid}_${Date.now()}`.replaceAll("-", "_");
const functionName = `${triggerName}_fn`;
let playerIds: number[] = [];
let manualSubmissionId: number;
let notionConflictSubmissionId: number;

beforeAll(async () => {
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).limit(1);
  if (!team) throw new Error("A team is required for the membership import transaction test");

  const inserted = await db.insert(playersTable).values([
    {
      teamId: team.id,
      name: "Membership Import First",
      email: firstEmail,
      currentMembershipTier: "awaiting_selection",
    },
    {
      teamId: team.id,
      name: "Membership Import Failure",
      email: failingEmail,
      currentMembershipTier: "awaiting_selection",
    },
    {
      teamId: team.id,
      name: "Membership Import Manual",
      email: manualEmail,
      currentMembershipTier: "awaiting_selection",
    },
    {
      teamId: team.id,
      name: "Membership Import Conflict",
      email: notionConflictEmail,
      currentMembershipTier: "awaiting_selection",
    },
  ]).returning({ id: playersTable.id });
  playerIds = inserted.map(({ id }) => id);

  const [season] = await db.select({ id: playerParticipationsTable.seasonId })
    .from(playerParticipationsTable)
    .limit(1);
  if (!season) throw new Error("A season is required for the membership import transaction test");
  const [manualSubmission] = await db.insert(membershipInterestSubmissionsTable).values({
    seasonId: season.id,
    submittedName: "Manual",
    submittedEmail: manualEmail,
    membershipTier: "social_player",
    matchStatus: "unmatched",
  }).returning({ id: membershipInterestSubmissionsTable.id });
  manualSubmissionId = manualSubmission.id;
  const [notionConflictSubmission] = await db.insert(membershipInterestSubmissionsTable).values({
    seasonId: season.id,
    submittedName: "Notion Conflict",
    submittedEmail: notionConflictEmail,
    membershipTier: "awaiting_selection",
    matchedPlayerId: playerIds[3],
    matchStatus: "conflict",
    source: "notion_join",
    sourceUpdatedAt: new Date("2026-09-02T10:00:00.000Z"),
    rawData: { "Position(s)": ["Forward"] },
  }).returning({ id: membershipInterestSubmissionsTable.id });
  notionConflictSubmissionId = notionConflictSubmission.id;

  await pool.query(`
    CREATE FUNCTION ${functionName}() RETURNS trigger AS $$
    BEGIN
      IF NEW.submitted_email IN ('${failingEmail}', '${manualEmail}') THEN
        RAISE EXCEPTION 'forced membership submission failure';
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
    CREATE TRIGGER ${triggerName}
      BEFORE INSERT OR UPDATE ON membership_interest_submissions
      FOR EACH ROW EXECUTE FUNCTION ${functionName}();
  `);
});

afterAll(async () => {
  await pool.query(`DROP TRIGGER IF EXISTS ${triggerName} ON membership_interest_submissions`);
  await pool.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
  if (playerIds.length) {
    await db.delete(membershipInterestSubmissionsTable)
      .where(inArray(membershipInterestSubmissionsTable.matchedPlayerId, playerIds));
    await db.delete(playerParticipationsTable)
      .where(inArray(playerParticipationsTable.playerId, playerIds));
    await db.delete(playersTable).where(inArray(playersTable.id, playerIds));
  }
});

describe("membership interest import transaction", () => {
  it("rolls back earlier rows when a later audit insert fails", async () => {
    const response = await request(app)
      .post("/api/players/membership/interest-submissions")
      .send({
        submissions: [
          { name: "First", email: firstEmail, membershipTier: "social_player" },
          { name: "Failure", email: failingEmail, membershipTier: "social_player" },
        ],
      });

    expect(response.status).toBe(500);

    const players = await db.select({
      email: playersTable.email,
      membershipTier: playersTable.currentMembershipTier,
    }).from(playersTable).where(inArray(playersTable.id, playerIds));
    expect(players).toHaveLength(4);
    expect(players.every(({ membershipTier }) => membershipTier === "awaiting_selection")).toBe(true);

    const firstAudits = await db.select({ id: membershipInterestSubmissionsTable.id })
      .from(membershipInterestSubmissionsTable)
      .where(eq(membershipInterestSubmissionsTable.submittedEmail, firstEmail));
    expect(firstAudits).toHaveLength(0);

    const participations = await db.select({ playerId: playerParticipationsTable.playerId })
      .from(playerParticipationsTable)
      .where(inArray(playerParticipationsTable.playerId, playerIds));
    expect(participations).toHaveLength(0);
  });

  it("rolls back a manual member resolution when its audit update fails", async () => {
    const manualPlayerId = playerIds[2];
    const response = await request(app)
      .patch(`/api/players/membership/interest-submissions/${manualSubmissionId}`)
      .send({ playerId: manualPlayerId, membershipTier: "social_player" });

    expect(response.status).toBe(500);

    const [player] = await db.select({
      membershipTier: playersTable.currentMembershipTier,
    }).from(playersTable).where(eq(playersTable.id, manualPlayerId));
    expect(player.membershipTier).toBe("awaiting_selection");

    const [submission] = await db.select({
      matchedPlayerId: membershipInterestSubmissionsTable.matchedPlayerId,
      matchStatus: membershipInterestSubmissionsTable.matchStatus,
    }).from(membershipInterestSubmissionsTable)
      .where(eq(membershipInterestSubmissionsTable.id, manualSubmissionId));
    expect(submission).toMatchObject({ matchedPlayerId: null, matchStatus: "unmatched" });

    const participations = await db.select({ playerId: playerParticipationsTable.playerId })
      .from(playerParticipationsTable)
      .where(eq(playerParticipationsTable.playerId, manualPlayerId));
    expect(participations).toHaveLength(0);
  });

  it("accepts Awaiting Selection when keeping existing Notion member values", async () => {
    const notionPlayerId = playerIds[3];
    const response = await request(app)
      .patch(`/api/players/membership/interest-submissions/${notionConflictSubmissionId}`)
      .send({
        playerId: notionPlayerId,
        membershipTier: "awaiting_selection",
      });

    expect(response.status).toBe(200);

    const [submission] = await db.select().from(membershipInterestSubmissionsTable)
      .where(eq(membershipInterestSubmissionsTable.id, notionConflictSubmissionId));
    expect(submission).toMatchObject({
      matchedPlayerId: notionPlayerId,
      matchStatus: "matched",
    });
    expect(submission.rawData).toMatchObject({
      _profileConflictResolvedForSourceUpdatedAt: "2026-09-02T10:00:00.000Z",
    });
  });
});