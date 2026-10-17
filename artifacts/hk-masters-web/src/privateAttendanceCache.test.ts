import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./sw.ts", import.meta.url), "utf8");
const expression = source.match(/const isPrivateAttendance = \(url: URL\) =>\s*(\/.+\/)\.test\(url.pathname\)/)![1];
const matcher = new RegExp(expression.slice(1, -1));

describe("private attendance offline cache exclusions", () => {
  it("excludes match and training snapshots, including trailing slashes and query strings", () => {
    for (const path of ["/api/player-auth/matches/rsvps", "/api/events/training-attendance"]) {
      for (const suffix of ["", "/", "?refresh=1"]) {
        expect(matcher.test(new URL(`https://example.com${path}${suffix}`).pathname)).toBe(true);
      }
    }
    expect(matcher.test("/api/events/public")).toBe(false);
  });

  it("uses the same matcher for NetworkOnly, activation purge, and shared-cache exclusion", () => {
    expect(source).toContain("registerRoute(({ url }) => isPrivateAttendance(url), new NetworkOnly())");
    expect(source).toContain("isPrivateAttendance(new URL(key.url))");
    expect(source).toContain("!isPrivateAttendance(url)");
  });
});
