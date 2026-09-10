import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { and, eq, inArray } from "drizzle-orm";
import { announcementsTable, db, playersTable, teamsTable } from "@workspace/db";

const pushMocks = vi.hoisted(() => ({
  all: vi.fn(async () => undefined),
  section: vi.fn(async () => undefined),
  team: vi.fn(async () => undefined),
}));

vi.mock("../middleware/adminAuth", () => ({
  hasAdminAccess: async (req: express.Request) => req.headers["x-test-admin"] === "true",
  requireAdminAccess: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.headers["x-test-admin"] === "true") return next();
    return res.status(401).json({ error: "Admin access required" });
  },
}));

vi.mock("../middleware/playerSession", () => ({
  requirePlayerSession: (req: express.Request, _res: express.Response, next: express.NextFunction) => {
    const membershipSection = req.headers["x-test-section"];
    req.player = {
      id: 900001,
      teamId: null,
      memberStatus: "active",
      currentMembershipSection: membershipSection,
    } as unknown as NonNullable<express.Request["player"]>;
    next();
  },
}));

vi.mock("../utils/push", () => ({
  sendPushToAll: pushMocks.all,
  sendPushToMembershipSection: pushMocks.section,
  sendPushToTeam: pushMocks.team,
}));

const { default: announcementsRouter } = await import("./announcements");

const app = express();
app.use(express.json());
app.use("/api/announcements", announcementsRouter);

const titlePrefix = `section-targeting-${Date.now()}`;
let countTeamId: number;
let countPlayerIds: number[] = [];

beforeAll(async () => {
  const [countTeam] = await db.insert(teamsTable).values({
    name: `${titlePrefix}-count-team`,
    category: "TEST",
    managerName: "Test Manager",
    managerEmail: `${titlePrefix}@example.com`,
    managerPhone: "test",
  }).returning({ id: teamsTable.id });
  countTeamId = countTeam.id;
  const countPlayers = await db.insert(playersTable).values([
    {
      teamId: countTeamId,
      name: `${titlePrefix}-active-one`,
      email: `${titlePrefix}-active-one@example.com`,
      memberStatus: "active",
      feePaid: false,
    },
    {
      teamId: countTeamId,
      name: `${titlePrefix}-active-two`,
      email: `${titlePrefix}-active-two@example.com`,
      memberStatus: "active",
      feePaid: false,
    },
    {
      teamId: countTeamId,
      name: `${titlePrefix}-archived`,
      email: `${titlePrefix}-archived@example.com`,
      memberStatus: "archived",
      feePaid: false,
    },
  ]).returning({ id: playersTable.id });
  countPlayerIds = countPlayers.map((player) => player.id);
  await db.insert(announcementsTable).values([
    { title: `${titlePrefix}-all`, body: "All players", membershipSection: null, operationalScope: "local_2026_27" },
    { title: `${titlePrefix}-men`, body: "Men only", membershipSection: "men", operationalScope: "local_2026_27" },
    { title: `${titlePrefix}-women`, body: "Women only", membershipSection: "women", operationalScope: "local_2026_27" },
  ]);
});

afterAll(async () => {
  await db
    .delete(announcementsTable)
    .where(inArray(announcementsTable.title, [
      `${titlePrefix}-all`,
      `${titlePrefix}-men`,
      `${titlePrefix}-women`,
      `${titlePrefix}-created`,
    ]));
  if (countPlayerIds.length > 0) {
    await db.delete(playersTable).where(inArray(playersTable.id, countPlayerIds));
  }
  if (countTeamId) {
    await db.delete(teamsTable).where(eq(teamsTable.id, countTeamId));
  }
});

describe("announcement membership-section targeting", () => {
  it("shows active players only all-player and matching-section announcements", async () => {
    const menResponse = await request(app)
      .get("/api/announcements")
      .set("x-test-section", "men");
    const womenResponse = await request(app)
      .get("/api/announcements")
      .set("x-test-section", "women");

    expect(menResponse.status).toBe(200);
    expect(womenResponse.status).toBe(200);

    const menTitles = menResponse.body.map((item: { title: string }) => item.title);
    const womenTitles = womenResponse.body.map((item: { title: string }) => item.title);

    expect(menTitles).toEqual(expect.arrayContaining([`${titlePrefix}-all`, `${titlePrefix}-men`]));
    expect(menTitles).not.toContain(`${titlePrefix}-women`);
    expect(womenTitles).toEqual(expect.arrayContaining([`${titlePrefix}-all`, `${titlePrefix}-women`]));
    expect(womenTitles).not.toContain(`${titlePrefix}-men`);
  });

  it("stores the section and sends push to the same audience", async () => {
    const response = await request(app)
      .post("/api/announcements")
      .set("x-test-admin", "true")
      .send({
        title: `${titlePrefix}-created`,
        body: "Section update",
        membershipSection: "women",
        teamId: null,
        sendPush: true,
      });

    expect(response.status).toBe(201);
    expect(response.body.membershipSection).toBe("women");
    expect(pushMocks.section).toHaveBeenCalledWith(
      "women",
      expect.objectContaining({ title: `${titlePrefix}-created` }),
    );
    expect(pushMocks.all).not.toHaveBeenCalled();
    expect(pushMocks.team).not.toHaveBeenCalled();

    const [stored] = await db
      .select()
      .from(announcementsTable)
      .where(and(
        eq(announcementsTable.title, `${titlePrefix}-created`),
        eq(announcementsTable.membershipSection, "women"),
      ));
    expect(stored).toBeDefined();
  });

  it("rejects conflicting squad and section targets", async () => {
    const response = await request(app)
      .post("/api/announcements")
      .set("x-test-admin", "true")
      .send({
        title: "Invalid audience",
        body: "Cannot target both",
        membershipSection: "men",
        teamId: 1,
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/either a squad or a membership section/i);
  });

  it("previews the number of active players in the selected audience", async () => {
    const response = await request(app)
      .get(`/api/announcements/recipient-count?teamId=${countTeamId}`)
      .set("x-test-admin", "true");

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ recipientCount: 2 });
  });

  it("requires admin access for recipient counts", async () => {
    const response = await request(app)
      .get(`/api/announcements/recipient-count?teamId=${countTeamId}`);

    expect(response.status).toBe(401);
  });
});