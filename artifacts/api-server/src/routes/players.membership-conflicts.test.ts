import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import {
  membershipInterestSubmissionsTable,
  playersTable,
  seasonsTable,
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

const runId = `${process.pid}-${Date.now()}`;
const externalIds = {
  consented: `conflict-consented-${runId}`,
  private: `conflict-private-${runId}`,
  manual: `conflict-manual-${runId}`,
  matched: `conflict-matched-${runId}`,
  dismissed: `conflict-dismissed-${runId}`,
};
let playerId: number;

beforeAll(async () => {
  const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).limit(1);
  const [season] = await db.select({ id: seasonsTable.id }).from(seasonsTable).limit(1);
  if (!team || !season) throw new Error("A team and season are required for conflict response tests");

  const [player] = await db.insert(playersTable).values({
    teamId: team.id,
    name: "Conflict Response Member",
    email: `existing-${runId}@example.com`,
    dateOfBirth: "1985-07-13",
    position: "Goalkeeper",
  }).returning({ id: playersTable.id });
  playerId = player.id;

  const base = {
    seasonId: season.id,
    submittedName: "Submitted Member",
    submittedEmail: `submitted-${runId}@example.com`,
    membershipTier: "active_player",
    matchedPlayerId: playerId,
  };
  await db.insert(membershipInterestSubmissionsTable).values([
    {
      ...base,
      matchStatus: "conflict",
      source: "notion_join",
      externalId: externalIds.consented,
      rawData: {
        "Year of Birth": "1984-06-12",
        "Position(s)": ["Forward"],
      },
    },
    {
      ...base,
      submittedEmail: `private-${runId}@example.com`,
      matchStatus: "conflict",
      source: "notion_join",
      externalId: externalIds.private,
      rawData: {
        reason: "consent_not_granted",
        "Year of Birth": "1980-01-01",
        "Position(s)": ["Private Position"],
      },
    },
    {
      ...base,
      matchStatus: "conflict",
      source: "manual_import",
      externalId: externalIds.manual,
      rawData: {
        "Year of Birth": "1981-02-03",
        "Position(s)": ["Manual Position"],
      },
    },
    {
      ...base,
      matchStatus: "matched",
      source: "notion_join",
      externalId: externalIds.matched,
      rawData: {
        "Year of Birth": "1982-03-04",
        "Position(s)": ["Matched Position"],
      },
    },
    {
      ...base,
      matchStatus: "dismissed",
      source: "notion_join",
      externalId: externalIds.dismissed,
      rawData: {
        "Year of Birth": "1983-04-05",
        "Position(s)": ["Dismissed Position"],
      },
    },
  ]);
});

afterAll(async () => {
  await db.delete(membershipInterestSubmissionsTable)
    .where(inArray(membershipInterestSubmissionsTable.externalId, Object.values(externalIds)));
  if (playerId) await db.delete(playersTable).where(eq(playersTable.id, playerId));
});

describe("GET /api/players/membership/interest-submissions conflict privacy", () => {
  it("only returns Notion conflict values for consented unresolved conflicts", async () => {
    const response = await request(app).get("/api/players/membership/interest-submissions");
    expect(response.status).toBe(200);

    type ResponseRow = {
      externalId: string;
      conflictDetails: Array<{
        field: string;
        kind: string;
        existingValue: string | null;
        submittedValue: string | null;
      }>;
    };
    const rows = new Map<string, ResponseRow>(
      response.body
        .filter((row: ResponseRow) =>
          row.externalId && Object.values(externalIds).includes(row.externalId))
        .map((row: ResponseRow): [string, ResponseRow] => [row.externalId, row]),
    );
    expect(rows.size).toBe(5);

    expect(rows.get(externalIds.consented)?.conflictDetails).toEqual([
      {
        field: "email",
        kind: "identity",
        existingValue: `existing-${runId}@example.com`,
        submittedValue: `submitted-${runId}@example.com`,
      },
      {
        field: "dateOfBirth",
        kind: "profile",
        existingValue: "1985-07-13",
        submittedValue: "1984-06-12",
      },
      {
        field: "position",
        kind: "profile",
        existingValue: "Goalkeeper",
        submittedValue: "Forward",
      },
    ]);
    expect(rows.get(externalIds.private)?.conflictDetails).toEqual([]);
    expect(rows.get(externalIds.manual)?.conflictDetails).toEqual([]);
    expect(rows.get(externalIds.matched)?.conflictDetails).toEqual([]);
    expect(rows.get(externalIds.dismissed)?.conflictDetails).toEqual([]);
  });
});