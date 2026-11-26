import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";

vi.mock("../middleware/adminAuth", () => ({
  hasAdminAccess: vi.fn(async () => false),
  requireAdminAccess: (_req: unknown, _res: unknown, next: () => void) => next(),
}));
const { default: teamsRouter } = await import("./teams");
const app = express();
app.use(express.json());
app.use("/api/teams", teamsRouter);

// Uses the real development records, but every attempted mutation is rejected.
describe("Ladies CMS team integration", () => {
  it("exposes CMS-owned public identity and division, without private contacts", async () => {
    const response = await request(app).get("/api/teams");
    expect(response.status).toBe(200);
    for (const key of ["ladies-a", "ladies-b", "ladies-c"]) {
      const team = response.body.find((item: any) => item.leagueKey === key);
      expect(team).toMatchObject({ membershipSection: "women" });
      expect(team.name).toBeTruthy();
      expect(team.category).toBeTruthy();
      expect(team.managerEmail).toBeUndefined();
      expect(team.managerPhone).toBeUndefined();
    }
  });

  it("prevents duplicate setup and rejects a wrong section or empty division", async () => {
    const body = { name: "Duplicate", leagueKey: "ladies-a", membershipSection: "women", category: "Premier League" };
    expect((await request(app).post("/api/teams").send(body)).status).toBe(409);
    expect((await request(app).post("/api/teams").send({ ...body, membershipSection: "men" })).status).toBe(400);
    expect((await request(app).post("/api/teams").send({ ...body, category: "" })).status).toBe(400);
  });

  it("preserves the league identity and section on edit", async () => {
    const teams = (await request(app).get("/api/teams")).body;
    const team = teams.find((item: any) => item.leagueKey === "ladies-a");
    expect((await request(app).put(`/api/teams/${team.id}`).send({ name: team.name, leagueKey: "ladies-b" })).status).toBe(400);
    expect((await request(app).put(`/api/teams/${team.id}`).send({ name: team.name, membershipSection: "men" })).status).toBe(400);
    expect((await request(app).put(`/api/teams/${team.id}`).send({ name: team.name, category: "" })).status).toBe(400);
  });
});
