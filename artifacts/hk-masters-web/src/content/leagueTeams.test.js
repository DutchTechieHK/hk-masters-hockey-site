import { describe, expect, it } from "vitest";
import { parseTeamFilter, splitLadiesFixtures, isUnconfirmed, ladiesTeamForSource } from "./leagueTeams";

describe("league team config", () => {
  it("parses team filter with all default", () => {
    expect(parseTeamFilter("?team=ladies-b")).toBe("ladies-b");
    expect(parseTeamFilter("team=men")).toBe("men");
    expect(parseTeamFilter("?team=bogus")).toBe("all");
    expect(parseTeamFilter("")).toBe("all");
  });
  it("maps source names to divisions", () => {
    expect(ladiesTeamForSource("Masters A").division).toBe("Premier League");
    expect(ladiesTeamForSource("Masters C").division).toBe("Division 3");
  });
  it("segregates inactive fixtures and keeps past ones separate", () => {
    const now = Date.parse("2026-10-10T12:00:00+08:00");
    const fx = [
      { id: "1", kickoffAt: "2026-10-20T10:00:00+08:00", isInactive: false, sourceStatus: "" },
      { id: "2", kickoffAt: "2026-10-21T10:00:00+08:00", isInactive: true, sourceStatus: "Postponed" },
      { id: "3", kickoffAt: "2026-10-01T10:00:00+08:00", isInactive: false, sourceStatus: "" },
      { id: "4", kickoffAt: "2026-10-22T10:00:00+08:00", isInactive: false, sourceStatus: "TBC" },
    ];
    const s = splitLadiesFixtures(fx, now);
    expect(s.upcoming.map((f) => f.id)).toEqual(["1"]);
    expect(s.flagged.map((f) => f.id)).toEqual(["2", "4"]);
    expect(s.past.map((f) => f.id)).toEqual(["3"]);
    expect(isUnconfirmed(fx[1])).toBe(true);
    expect(isUnconfirmed({ sourceStatus: "TBC" })).toBe(true);
    expect(isUnconfirmed(fx[0])).toBe(false);
  });
});
