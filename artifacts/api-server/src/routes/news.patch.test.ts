/**
 * Regression tests for PATCH /api/news/:id publishedAt handling.
 *
 * A past regression silently NULLed publishedAt on every edit that omitted
 * `status`. These tests hit the real route (real DB) with auth mocked out.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { newsPostsTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

// Bypass admin auth: these middlewares are exercised elsewhere; here we test
// the PATCH handler's publishedAt semantics.
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

const TEST_SLUG = `test-publishedat-regression-${Date.now()}`;
let postId: number;
const originalPublishedAt = new Date("2026-01-15T08:30:00.000Z");

beforeAll(async () => {
  const [row] = await db
    .insert(newsPostsTable)
    .values({
      title: "PublishedAt regression test post",
      slug: TEST_SLUG,
      status: "published",
      publishedAt: originalPublishedAt,
    })
    .returning();
  postId = row.id;
});

afterAll(async () => {
  await db.delete(newsPostsTable).where(eq(newsPostsTable.slug, TEST_SLUG));
});

describe("PATCH /api/news/:id publishedAt handling", () => {
  it("keeps publishedAt unchanged when editing content fields without status", async () => {
    const res = await request(app)
      .patch(`/api/news/${postId}`)
      .send({ title: "Edited title only", excerpt: "New excerpt", bodyHtml: "<p>Body</p>" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.publishedAt).toBe(originalPublishedAt.toISOString());
  });

  it("clears publishedAt on published -> draft transition", async () => {
    const res = await request(app).patch(`/api/news/${postId}`).send({ status: "draft" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("draft");
    expect(res.body.publishedAt).toBeNull();
  });

  it("sets a fresh publishedAt on draft -> published transition", async () => {
    const before = Date.now();
    const res = await request(app).patch(`/api/news/${postId}`).send({ status: "published" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("published");
    expect(res.body.publishedAt).not.toBeNull();
    const ts = new Date(res.body.publishedAt).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(Date.now() + 1000);
  });

  it("keeps existing publishedAt when status is re-sent as published (no transition)", async () => {
    const [row] = await db.select().from(newsPostsTable).where(eq(newsPostsTable.id, postId));
    const current = row.publishedAt!.toISOString();
    const res = await request(app)
      .patch(`/api/news/${postId}`)
      .send({ status: "published", title: "Edited again" });
    expect(res.status).toBe(200);
    expect(res.body.publishedAt).toBe(current);
  });
});
