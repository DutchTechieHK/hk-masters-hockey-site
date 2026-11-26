import { describe, expect, it, vi } from "vitest";
import { createLadiesFixtureFeed, parseLadiesFixtures } from "./ladiesLeagueFixtures";

const header = "<table><tr><th>C/P</th><th>Div</th><th>Time</th><th>Venue</th><th>Home</th><th>Away</th><th>Umpire 1</th><th>Umpire 2</th><th>Match Official</th></tr>";
const date = (day = "30112026") => `<tr><td colspan="9" class="title"><a name="${day}"></a></td></tr>`;
const row = (home: string, away: string, div = "P", flag = "", inactive = false) =>
  `<tr>${[flag, div, "20:30", "HV1", home, away, "Masters B", "Masters C", ""]
    .map((value) => `<td class="${inactive ? "inactive" : "even"}"><div>${value}</div></td>`).join("")}</tr>`;
const html = header + date() + row("HKFC A", "Masters A") + row("Masters B", "RHINO", "2")
  + row("HKFC G", "Masters C", "3") + row("KCC A", "Valley A") + "</table>";

describe("official Ladies fixture parsing", () => {
  it("uses home/away only, with correct teams, divisions, opponents and Hong Kong times", () => {
    const result = parseLadiesFixtures(html);
    expect(result.season).toBe("2026/27");
    expect(result.fixtures).toHaveLength(3);
    expect(result.fixtures.find((match) => match.teamName === "Masters A")).toMatchObject({
      opponent: "HKFC A", division: "Premier League", kickoffAt: "2026-11-30T20:30:00+08:00",
      venue: "HV1", sourceStatus: "", isInactive: false,
    });
    expect(result.fixtures.find((match) => match.teamName === "Masters B")?.opponent).toBe("RHINO");
    expect(result.fixtures.find((match) => match.teamName === "Masters C")?.division).toBe("Division 3");
  });

  it("retains changed/inactive flags without treating them as confirmed or inventing scores", () => {
    const result = parseLadiesFixtures(header + date() + row("Masters C", "HKCC C", "3", "Res", true) + "</table>");
    expect(result.fixtures[0]).toMatchObject({ sourceStatus: "Res", isInactive: true });
    expect(result.fixtures[0]).not.toHaveProperty("ourScore");
  });

  it("ignores duplicates and supports the calendar-year boundary", () => {
    const result = parseLadiesFixtures(header + date() + row("Masters A", "HKFC A") + row("Masters A", "HKFC A")
      + date("06012027") + row("Masters C", "HKUHC", "3") + "</table>");
    expect(result.fixtures).toHaveLength(2);
    expect(result.fixtures[1]?.kickoffAt).toBe("2027-01-06T20:30:00+08:00");
    expect(result.season).toBe("2026/27");
  });

  it("fails explicitly on changed structure, missing dates, invalid times and division drift", () => {
    expect(() => parseLadiesFixtures("<html>Service unavailable</html>")).toThrow();
    expect(() => parseLadiesFixtures(header + date() + row("KCC A", "HKFC A") + "</table>")).toThrow();
    expect(() => parseLadiesFixtures(header + row("Masters A", "HKFC A") + "</table>")).toThrow();
    expect(() => parseLadiesFixtures(html.replaceAll("20:30", "TBC"))).toThrow();
    expect(() => parseLadiesFixtures(header + date() + row("Masters B", "RHINO", "1") + "</table>")).toThrow();
  });
});

describe("official Ladies feed cache", () => {
  it("shares requests and refreshes after fifteen minutes", async () => {
    let time = Date.parse("2026-11-26T10:00:00Z");
    const fetchPage = vi.fn(async () => html);
    const get = createLadiesFixtureFeed(fetchPage, () => time);
    const [a, b] = await Promise.all([get(), get()]);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    await get();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    time += 16 * 60_000;
    await get();
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it("marks cached data stale on failure, backs off and refuses data over a day old", async () => {
    let time = Date.parse("2026-11-26T10:00:00Z");
    const fetchPage = vi.fn(async () => html);
    const get = createLadiesFixtureFeed(fetchPage, () => time);
    const initial = await get();
    fetchPage.mockRejectedValue(new Error("Network failure"));
    time += 16 * 60_000;
    expect(await get()).toMatchObject({ stale: true, fetchedAt: initial.fetchedAt });
    await get();
    expect(fetchPage).toHaveBeenCalledTimes(2);
    time += 25 * 60 * 60_000;
    await expect(get()).rejects.toThrow("temporarily unavailable");
  });

  it("does not disguise initial failures as an empty schedule", async () => {
    const fetchPage = vi.fn(async () => { throw new Error("Network failure"); });
    const get = createLadiesFixtureFeed(fetchPage);
    await expect(get()).rejects.toThrow("temporarily unavailable");
    await expect(get()).rejects.toThrow("temporarily unavailable");
    expect(fetchPage).toHaveBeenCalledTimes(1);
  });
});
