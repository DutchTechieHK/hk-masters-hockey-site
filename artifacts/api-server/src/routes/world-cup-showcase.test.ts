import { describe, expect, it } from "vitest";
import request from "supertest";
import app from "../app";

describe("World Cup 2026 historical showcase", () => {
  it("rejects anonymous requests", async () => {
    await request(app).get("/api/showcase/world-cup-2026").expect(401);
  });

  it("returns an aggregate historical archive without player-level data to an admin", async () => {
    const response = await request(app)
      .get("/api/showcase/world-cup-2026")
      .set("x-admin-key", process.env.ADMIN_API_KEY ?? "")
      .expect(200);

    expect(response.body.historical).toBe(true);
    expect(response.body.tournament.seasonSlug).toBe("rotterdam-2026");
    expect(Array.isArray(response.body.teams)).toBe(true);
    expect(Array.isArray(response.body.schedule)).toBe(true);
    expect(response.body).not.toHaveProperty("players");

    const serialized = JSON.stringify(response.body);
    expect(serialized).not.toContain("access_token");
    expect(serialized).not.toContain("passport_copy_url");
    expect(serialized).not.toContain("@");
  });

  it("accepts a valid existing admin session", async () => {
    const login = await request(app)
      .post("/api/admin/auth")
      .send({ password: process.env.ADMIN_API_KEY })
      .expect(200);

    try {
      await request(app)
        .get("/api/showcase/world-cup-2026")
        .set("x-session-token", login.body.token)
        .expect(200);
    } finally {
      await request(app)
        .delete("/api/admin/auth")
        .set("x-session-token", login.body.token)
        .expect(204);
    }
  });

  it("has no mutation operation", async () => {
    await request(app).post("/api/showcase/world-cup-2026").expect(404);
    await request(app).patch("/api/showcase/world-cup-2026").expect(404);
    await request(app).delete("/api/showcase/world-cup-2026").expect(404);
  });
});