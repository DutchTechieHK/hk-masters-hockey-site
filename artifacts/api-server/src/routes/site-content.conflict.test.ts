/**
 * Conflict-guard tests for the site-content optimistic-concurrency checks.
 *
 * Two admins saving from the same baseline must not silently overwrite each
 * other: the guard is enforced atomically in the UPDATE's WHERE clause, so
 * exactly one writer succeeds and the other gets a 409.
 *
 * Hits the real routes (real DB) with auth mocked out; the single site_content
 * row's album/gallery fields are snapshotted and restored afterwards.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { siteContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

const { default: siteContentRouter } = await import("./site-content");

const app = express();
app.use(express.json());
app.use("/api/site-content", siteContentRouter);

let original: typeof siteContentTable.$inferSelect | undefined;

beforeAll(async () => {
  const rows = await db.select().from(siteContentTable).limit(1);
  original = rows[0];
});

afterAll(async () => {
  if (!original) return;
  await db
    .update(siteContentTable)
    .set({
      galleryImages: original.galleryImages,
      mediaAlbums: original.mediaAlbums,
      galleryUpdatedAt: original.galleryUpdatedAt,
      mediaAlbumsUpdatedAt: original.mediaAlbumsUpdatedAt,
    })
    .where(eq(siteContentTable.id, original.id));
});

describe("PUT /api/site-content/media-albums conflict guard", () => {
  it("rejects the second of two saves made from the same baseline", async () => {
    // Establish a known baseline version.
    const first = await request(app)
      .put("/api/site-content/media-albums")
      .send({ albums: [{ name: "Baseline", photos: [] }] });
    expect(first.status).toBe(200);
    const baseline = first.body.updatedAt as string;
    expect(baseline).toBeTruthy();

    // Two admins load the same baseline, then both save.
    const [a, b] = await Promise.all([
      request(app)
        .put("/api/site-content/media-albums")
        .send({ albums: [{ name: "Admin A", photos: [] }], updatedAt: baseline }),
      request(app)
        .put("/api/site-content/media-albums")
        .send({ albums: [{ name: "Admin B", photos: [] }], updatedAt: baseline }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
    const loser = a.status === 409 ? a : b;
    expect(loser.body.error).toMatch(/reload/i);
  });

  it("rejects a save based on a stale (older) version", async () => {
    const current = await request(app).get("/api/site-content/media-albums");
    const res = await request(app)
      .put("/api/site-content/media-albums")
      .send({
        albums: [{ name: "Stale", photos: [] }],
        updatedAt: "2020-01-01T00:00:00.000Z",
      });
    expect(res.status).toBe(409);
    // Stored albums untouched.
    const after = await request(app).get("/api/site-content/media-albums");
    expect(after.body.albums).toEqual(current.body.albums);
  });

  it("still accepts legacy saves that send no updatedAt", async () => {
    const res = await request(app)
      .put("/api/site-content/media-albums")
      .send({ albums: [{ name: "Legacy", photos: [] }] });
    expect(res.status).toBe(200);
  });
});

describe("PUT /api/site-content gallery conflict guard", () => {
  it("rejects the second of two gallery saves made from the same baseline", async () => {
    const first = await request(app)
      .put("/api/site-content")
      .send({ galleryImages: [{ url: "/baseline.jpg" }] });
    expect(first.status).toBe(200);
    const baseline = first.body.galleryUpdatedAt as string;
    expect(baseline).toBeTruthy();

    const [a, b] = await Promise.all([
      request(app)
        .put("/api/site-content")
        .send({ galleryImages: [{ url: "/a.jpg" }], galleryUpdatedAt: baseline }),
      request(app)
        .put("/api/site-content")
        .send({ galleryImages: [{ url: "/b.jpg" }], galleryUpdatedAt: baseline }),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it("does not guard hero/squad photo saves that don't touch the gallery", async () => {
    const res = await request(app)
      .put("/api/site-content")
      .send({ heroImage: "/hero-test.jpg" });
    expect(res.status).toBe(200);
    // Restore hero afterwards via afterAll not needed — hero not snapshotted;
    // put it back explicitly.
    await request(app)
      .put("/api/site-content")
      .send({ heroImage: original?.heroImage ?? "" });
  });
});
