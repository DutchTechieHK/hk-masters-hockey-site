/**
 * Tests for backdated "report date" behavior on contributions.
 *
 * Covers:
 *  - PUT /:id  setting, clearing (null), and rejecting invalid reportDate
 *  - GET /approved  ordering by COALESCE(report_date, reviewed_at) DESC
 *  - Timezone-boundary: date-only value stored as T00:00Z must render as the
 *    same calendar day when the public page slices to YYYY-MM-DD
 *
 * Hits the real routes (real DB) with auth and email mocked out.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { contributionsTable } from "@workspace/db/schema";
import { inArray, sql } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

vi.mock("../utils/email", () => ({
  sendNewContributionEmail: () => Promise.resolve(),
  sendContributionDecisionEmail: () => Promise.resolve(),
  sendContributionConfirmationEmail: () => Promise.resolve(),
  sendContributionDeletedEmail: () => Promise.resolve(),
  sendContributionDeletionNoticeToAuthorEmail: () => Promise.resolve(),
}));

const { default: contributionsRouter } = await import("./contributions");

const app = express();
app.use(express.json());
app.use("/api/contributions", contributionsRouter);

// ── Shared test data ──────────────────────────────────────────────────────────

const TAG = `rdate-test-${Date.now()}`;
let seedIds: number[] = [];

// Insert rows directly so we can control reviewedAt precisely.
// Row layout for ordering test:
//   A: reportDate=2020-01-01 (earliest COALESCE → should appear last)
//   B: no reportDate, reviewedAt=2021-06-01 (mid)
//   C: reportDate=2023-03-15 (latest COALESCE → should appear first)
beforeAll(async () => {
  const rows = await db
    .insert(contributionsTable)
    .values([
      {
        title: `${TAG} A`,
        authorName: "Tester",
        authorEmail: "tester@example.com",
        contentType: "article",
        status: "approved",
        reviewedAt: new Date("2022-09-01T12:00:00Z"),
        reportDate: new Date("2020-01-01T12:00:00Z"),
      },
      {
        title: `${TAG} B`,
        authorName: "Tester",
        authorEmail: "tester@example.com",
        contentType: "article",
        status: "approved",
        reviewedAt: new Date("2021-06-01T12:00:00Z"),
        reportDate: null,
      },
      {
        title: `${TAG} C`,
        authorName: "Tester",
        authorEmail: "tester@example.com",
        contentType: "article",
        status: "approved",
        reviewedAt: new Date("2019-01-01T12:00:00Z"),
        reportDate: new Date("2023-03-15T12:00:00Z"),
      },
      // A pending contribution used for PUT tests
      {
        title: `${TAG} pending`,
        authorName: "Tester",
        authorEmail: "tester@example.com",
        contentType: "article",
        status: "pending",
      },
    ])
    .returning({ id: contributionsTable.id });
  seedIds = rows.map((r) => r.id);
});

afterAll(async () => {
  if (seedIds.length === 0) return;
  await db
    .delete(contributionsTable)
    .where(inArray(contributionsTable.id, seedIds));
});

// ── PUT /:id  reportDate field ────────────────────────────────────────────────

describe("PUT /api/contributions/:id reportDate", () => {
  it("sets reportDate on approve", async () => {
    const pendingId = seedIds[3];
    const dateStr = "2024-07-04T12:00:00.000Z";
    const res = await request(app)
      .put(`/api/contributions/${pendingId}`)
      .send({ status: "approved", reportDate: dateStr });
    expect(res.status).toBe(200);
    expect(res.body.reportDate).toBe(dateStr);
  });

  it("clears reportDate when null is sent", async () => {
    const pendingId = seedIds[3];
    const res = await request(app)
      .put(`/api/contributions/${pendingId}`)
      .send({ status: "approved", reportDate: null });
    expect(res.status).toBe(200);
    expect(res.body.reportDate).toBeUndefined();
  });

  it("rejects an invalid date string", async () => {
    const pendingId = seedIds[3];
    const res = await request(app)
      .put(`/api/contributions/${pendingId}`)
      .send({ status: "approved", reportDate: "not-a-date" });
    expect(res.status).toBe(400);
  });

  it("accepts a date-only string (YYYY-MM-DD) and returns the same calendar day", async () => {
    const pendingId = seedIds[3];
    const calendarDay = "2025-12-31";
    const res = await request(app)
      .put(`/api/contributions/${pendingId}`)
      .send({ status: "approved", reportDate: calendarDay });
    expect(res.status).toBe(200);
    // The public page slices reportDate to YYYY-MM-DD; assert no calendar-day drift.
    expect(res.body.reportDate).toBeDefined();
    expect((res.body.reportDate as string).slice(0, 10)).toBe(calendarDay);
  });

  it("returns 404 for non-existent contribution", async () => {
    const res = await request(app)
      .put("/api/contributions/999999999")
      .send({ status: "approved", reportDate: "2024-01-01" });
    expect(res.status).toBe(404);
  });
});

// ── GET /approved  COALESCE ordering ─────────────────────────────────────────

describe("GET /api/contributions/approved COALESCE ordering", () => {
  it("orders by COALESCE(report_date, reviewed_at) DESC — C first, B mid, A last", async () => {
    const res = await request(app).get("/api/contributions/approved");
    expect(res.status).toBe(200);

    // Pull only our seed rows in the order returned.
    const ourIds = new Set([seedIds[0], seedIds[1], seedIds[2]]);
    const ordered = (res.body as any[])
      .filter((c: any) => ourIds.has(c.id))
      .map((c: any) => c.id);

    // Expected: C (reportDate 2023), B (reviewedAt 2021), A (reportDate 2020)
    expect(ordered).toEqual([seedIds[2], seedIds[1], seedIds[0]]);
  });

  it("each approved item includes reportDate when set, omits it when absent", async () => {
    const res = await request(app).get("/api/contributions/approved");
    expect(res.status).toBe(200);

    const items: any[] = res.body;
    const a = items.find((c: any) => c.id === seedIds[0]);
    const b = items.find((c: any) => c.id === seedIds[1]);
    const c = items.find((c: any) => c.id === seedIds[2]);

    expect(a?.reportDate).toBeTruthy();
    expect(b?.reportDate).toBeFalsy(); // null/undefined — no report_date
    expect(c?.reportDate).toBeTruthy();
  });
});

// ── Timezone boundary ─────────────────────────────────────────────────────────

describe("reportDate timezone boundary", () => {
  it("boundary date (2025-12-31) stored and returned as same YYYY-MM-DD", async () => {
    const pendingId = seedIds[3];
    const calendarDay = "2025-12-31";
    const res = await request(app)
      .put(`/api/contributions/${pendingId}`)
      .send({ status: "approved", reportDate: `${calendarDay}T12:00:00Z` });
    expect(res.status).toBe(200);
    expect((res.body.reportDate as string).slice(0, 10)).toBe(calendarDay);
  });

  it("boundary date (2024-01-01) stored and returned as same YYYY-MM-DD", async () => {
    const pendingId = seedIds[3];
    const calendarDay = "2024-01-01";
    const res = await request(app)
      .put(`/api/contributions/${pendingId}`)
      .send({ status: "approved", reportDate: `${calendarDay}T12:00:00Z` });
    expect(res.status).toBe(200);
    expect((res.body.reportDate as string).slice(0, 10)).toBe(calendarDay);
  });
});
