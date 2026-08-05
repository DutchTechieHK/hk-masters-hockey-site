/**
 * Unit tests for the shared date-display utilities.
 *
 * These functions are used by every public page that renders a date for a news
 * post or journal contribution. The key invariant: when an admin sets a
 * reportDate, that calendar day — not publishedAt / createdAt — must be shown.
 */
import { describe, it, expect } from "vitest";
import { newsDisplayDate, contributionDisplayDate, isoToCalendarDay } from "./dates.js";

// ── newsDisplayDate ───────────────────────────────────────────────────────────

describe("newsDisplayDate", () => {
  it("prefers reportDate over publishedAt", () => {
    const result = newsDisplayDate(
      "2024-03-10T12:00:00.000Z", // reportDate — backdated
      "2026-01-01T08:00:00.000Z"  // publishedAt — recent
    );
    expect(result).toBe("10 Mar 2024");
  });

  it("falls back to publishedAt when reportDate is null", () => {
    const result = newsDisplayDate(null, "2025-06-15T12:00:00.000Z");
    expect(result).toBe("15 Jun 2025");
  });

  it("falls back to publishedAt when reportDate is undefined", () => {
    const result = newsDisplayDate(undefined, "2025-06-15T00:00:00.000Z");
    expect(result).toBe("15 Jun 2025");
  });

  it("returns null when both are null", () => {
    expect(newsDisplayDate(null, null)).toBeNull();
  });

  it("returns null when both are undefined", () => {
    expect(newsDisplayDate(undefined, undefined)).toBeNull();
  });

  // Timezone-boundary: noon UTC always renders as the same calendar day
  it("renders 2025-12-31T12:00:00Z as '31 Dec 2025'", () => {
    expect(newsDisplayDate("2025-12-31T12:00:00.000Z", null)).toBe("31 Dec 2025");
  });

  it("renders 2024-01-01T12:00:00Z as '1 Jan 2024'", () => {
    expect(newsDisplayDate("2024-01-01T12:00:00.000Z", null)).toBe("1 Jan 2024");
  });

  // Date-only string (admin sends YYYY-MM-DD without time)
  it("renders a date-only string '2025-03-15' as '15 Mar 2025'", () => {
    expect(newsDisplayDate("2025-03-15", null)).toBe("15 Mar 2025");
  });

  // The YYYY-MM-DD slice must match the calendar day the admin chose
  it("sliced YYYY-MM-DD from a T12:00Z reportDate matches the chosen calendar day", () => {
    const reportDate = "2024-07-04T12:00:00.000Z";
    const calendarDay = reportDate.slice(0, 10);
    expect(calendarDay).toBe("2024-07-04");
    // newsDisplayDate uses the same slice internally
    expect(newsDisplayDate(reportDate, null)).toBe("4 Jul 2024");
  });

  // Home.jsx backdated-news scenario: backdated post shows backdated date, not publishedAt
  it("backdated news post: shows reportDate (2023-11-01) not publishedAt (2026-05-01)", () => {
    const result = newsDisplayDate(
      "2023-11-01T12:00:00.000Z",
      "2026-05-01T12:00:00.000Z"
    );
    expect(result).toBe("1 Nov 2023");
  });
});

// ── contributionDisplayDate ───────────────────────────────────────────────────

describe("contributionDisplayDate", () => {
  it("prefers reportDate over createdAt", () => {
    const result = contributionDisplayDate(
      "2022-08-20T12:00:00.000Z", // reportDate — backdated
      "2026-01-01T08:00:00.000Z"  // createdAt — recent
    );
    expect(result).toBe("20 Aug 2022");
  });

  it("falls back to createdAt when reportDate is null", () => {
    const result = contributionDisplayDate(null, "2025-09-30T12:00:00.000Z");
    expect(result).toBe("30 Sep 2025");
  });

  it("falls back to createdAt when reportDate is undefined", () => {
    const result = contributionDisplayDate(undefined, "2025-04-01T08:00:00.000Z");
    expect(result).toBe("1 Apr 2025");
  });

  it("returns null when both are null", () => {
    expect(contributionDisplayDate(null, null)).toBeNull();
  });

  // Timezone-boundary
  it("renders 2025-12-31T12:00:00Z as '31 Dec 2025'", () => {
    expect(contributionDisplayDate("2025-12-31T12:00:00.000Z", null)).toBe("31 Dec 2025");
  });

  // Home.jsx latest-journal-card scenario: backdated contribution shows reportDate
  it("backdated contribution: shows reportDate (2020-01-01) not createdAt (2026-03-01)", () => {
    const result = contributionDisplayDate(
      "2020-01-01T12:00:00.000Z",
      "2026-03-01T12:00:00.000Z"
    );
    expect(result).toBe("1 Jan 2020");
  });
});

// ── isoToCalendarDay ──────────────────────────────────────────────────────────

describe("isoToCalendarDay", () => {
  it("extracts YYYY-MM-DD from a full ISO timestamp", () => {
    expect(isoToCalendarDay("2025-06-15T12:00:00.000Z")).toBe("2025-06-15");
  });

  it("passes through a date-only string unchanged", () => {
    expect(isoToCalendarDay("2025-06-15")).toBe("2025-06-15");
  });

  it("returns null for null input", () => {
    expect(isoToCalendarDay(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(isoToCalendarDay(undefined)).toBeNull();
  });
});
