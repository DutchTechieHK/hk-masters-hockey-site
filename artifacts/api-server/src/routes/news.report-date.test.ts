/**
 * Tests for backdated "report date" behavior on news posts.
 *
 * Covers:
 *  - POST /  setting reportDate; invalid date rejected
 *  - PATCH /:id  setting and clearing reportDate
 *  - GET /  ordering by COALESCE(report_date, published_at) DESC (mixed rows)
 *  - Timezone-boundary: date-only value must render as the same calendar day
 *    when sliced to YYYY-MM-DD (matching the public News page's date-format logic)
 *
 * Hits the real routes (real DB) with auth mocked out.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { newsPostsTable } from "@workspace/db/schema";
import { inArray } from "drizzle-orm";

vi.mock("../middleware/adminSession", () => ({
  requireSession: (_req: any, _res: any, next: any) => next(),
}));
vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

const { default: newsRouter } = await import("./news");

const app = express();
app.use(express.json());
app.use("/api/news", newsRouter);

// ── Shared test data ──────────────────────────────────────────────────────────

const TAG = `rdate-news-test-${Date.now()}`;
let seedIds: number[] = [];

// Row layout for ordering test:
//   X: reportDate=2020-01-01, publishedAt=2022-05-01  → COALESCE = 2020-01-01 (oldest → last)
//   Y: no reportDate, publishedAt=2021-08-15          → COALESCE = 2021-08-15 (mid)
//   Z: reportDate=2023-11-01, publishedAt=2019-03-10  → COALESCE = 2023-11-01 (newest → first)
beforeAll(async () => {
  const rows = await db
    .insert(newsPostsTable)
    .values([
      {
        title: `${TAG} X`,
        slug: `${TAG}-x`,
        status: "published",
        publishedAt: new Date("2022-05-01T12:00:00Z"),
        reportDate: new Date("2020-01-01T12:00:00Z"),
      },
      {
        title: `${TAG} Y`,
        slug: `${TAG}-y`,
        status: "published",
        publishedAt: new Date("2021-08-15T12:00:00Z"),
        reportDate: null,
      },
      {
        title: `${TAG} Z`,
        slug: `${TAG}-z`,
        status: "published",
        publishedAt: new Date("2019-03-10T12:00:00Z"),
        reportDate: new Date("2023-11-01T12:00:00Z"),
      },
    ])
    .returning({ id: newsPostsTable.id });
  seedIds = rows.map((r) => r.id);
});

afterAll(async () => {
  if (seedIds.length === 0) return;
  await db.delete(newsPostsTable).where(inArray(newsPostsTable.id, seedIds));
});

// ── POST /  reportDate ────────────────────────────────────────────────────────

describe("POST /api/news reportDate", () => {
  let createdId: number | undefined;

  afterAll(async () => {
    if (createdId !== undefined) {
      await db.delete(newsPostsTable).where(inArray(newsPostsTable.id, [createdId]));
    }
  });

  it("sets reportDate when creating a post", async () => {
    const slug = `${TAG}-post-set-${Date.now()}`;
    const dateStr = "2024-03-20T12:00:00.000Z";
    const res = await request(app)
      .post("/api/news")
      .send({ title: "Report-date POST test", slug, status: "draft", reportDate: dateStr });
    expect(res.status).toBe(201);
    expect(res.body.reportDate).toBe(dateStr);
    createdId = res.body.id;
  });

  it("rejects an invalid reportDate on POST", async () => {
    const slug = `${TAG}-post-bad-${Date.now()}`;
    const res = await request(app)
      .post("/api/news")
      .send({ title: "Bad date POST", slug, status: "draft", reportDate: "not-a-date" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reportDate/i);
  });

  it("omitting reportDate on POST returns null", async () => {
    const slug = `${TAG}-post-omit-${Date.now()}`;
    const res = await request(app)
      .post("/api/news")
      .send({ title: "No date POST", slug, status: "draft" });
    expect(res.status).toBe(201);
    expect(res.body.reportDate).toBeNull();
    // clean up immediately
    if (res.body.id) {
      await db.delete(newsPostsTable).where(inArray(newsPostsTable.id, [res.body.id]));
    }
  });
});

// ── PATCH /:id  reportDate ────────────────────────────────────────────────────

describe("PATCH /api/news/:id reportDate", () => {
  let patchId: number | undefined;

  beforeAll(async () => {
    const [row] = await db
      .insert(newsPostsTable)
      .values({ title: `${TAG} patch-target`, slug: `${TAG}-patch`, status: "draft" })
      .returning({ id: newsPostsTable.id });
    patchId = row.id;
  });

  afterAll(async () => {
    if (patchId !== undefined) {
      await db.delete(newsPostsTable).where(inArray(newsPostsTable.id, [patchId]));
    }
  });

  it("sets reportDate via PATCH", async () => {
    const dateStr = "2024-06-15T12:00:00.000Z";
    const res = await request(app)
      .patch(`/api/news/${patchId}`)
      .send({ reportDate: dateStr });
    expect(res.status).toBe(200);
    expect(res.body.reportDate).toBe(dateStr);
  });

  it("clears reportDate when null is sent via PATCH", async () => {
    const res = await request(app)
      .patch(`/api/news/${patchId}`)
      .send({ reportDate: null });
    expect(res.status).toBe(200);
    expect(res.body.reportDate).toBeNull();
  });

  it("leaves reportDate unchanged when reportDate is omitted from PATCH", async () => {
    // First set a date
    const dateStr = "2024-09-01T12:00:00.000Z";
    await request(app).patch(`/api/news/${patchId}`).send({ reportDate: dateStr });
    // Then patch without mentioning reportDate
    const res = await request(app).patch(`/api/news/${patchId}`).send({ title: "Updated title" });
    expect(res.status).toBe(200);
    expect(res.body.reportDate).toBe(dateStr);
  });

  it("rejects an invalid reportDate via PATCH", async () => {
    const res = await request(app)
      .patch(`/api/news/${patchId}`)
      .send({ reportDate: "banana" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/reportDate/i);
  });
});

// ── GET /  COALESCE ordering ──────────────────────────────────────────────────

describe("GET /api/news COALESCE ordering", () => {
  it("orders by COALESCE(report_date, published_at) DESC — Z first, Y mid, X last", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);

    const ourIds = new Set(seedIds);
    const ordered = (res.body.posts as any[])
      .filter((p: any) => ourIds.has(p.id))
      .map((p: any) => p.id);

    // Expected: Z (reportDate 2023), Y (publishedAt 2021), X (reportDate 2020)
    expect(ordered).toEqual([seedIds[2], seedIds[1], seedIds[0]]);
  });

  it("each published post exposes reportDate (or null when absent)", async () => {
    const res = await request(app).get("/api/news");
    expect(res.status).toBe(200);

    const posts: any[] = res.body.posts;
    const x = posts.find((p: any) => p.id === seedIds[0]);
    const y = posts.find((p: any) => p.id === seedIds[1]);
    const z = posts.find((p: any) => p.id === seedIds[2]);

    expect(x?.reportDate).toBeTruthy();
    expect(y?.reportDate).toBeNull();
    expect(z?.reportDate).toBeTruthy();
  });
});

// ── Timezone boundary ─────────────────────────────────────────────────────────

describe("news reportDate timezone boundary", () => {
  let tzId: number | undefined;

  beforeAll(async () => {
    const [row] = await db
      .insert(newsPostsTable)
      .values({ title: `${TAG} tz-check`, slug: `${TAG}-tz`, status: "draft" })
      .returning({ id: newsPostsTable.id });
    tzId = row.id;
  });

  afterAll(async () => {
    if (tzId !== undefined) {
      await db.delete(newsPostsTable).where(inArray(newsPostsTable.id, [tzId]));
    }
  });

  it.each([
    ["2025-12-31", "2025-12-31T12:00:00Z"],
    ["2024-01-01", "2024-01-01T12:00:00Z"],
    ["2025-03-15", "2025-03-15"],  // date-only string → same calendar day
  ])("reportDate set to %s returns YYYY-MM-DD slice = %s prefix", async (calendarDay, input) => {
    const res = await request(app)
      .patch(`/api/news/${tzId}`)
      .send({ reportDate: input });
    expect(res.status).toBe(200);
    expect((res.body.reportDate as string).slice(0, 10)).toBe(calendarDay);
  });
});
