import { load } from "cheerio";
import { GetLadiesLeagueFixturesResponse } from "@workspace/api-zod";
import type { z } from "zod";

export const LADIES_FIXTURE_SOURCE = "https://www.hockey.org.hk/WomenFixture.asp";
type Schedule = z.infer<typeof GetLadiesLeagueFixturesResponse>;
type Fixture = Schedule["fixtures"][number];
const TEAM_DIVISIONS = new Map([
  ["Masters A", "Premier League"],
  ["Masters B", "Division 2"],
  ["Masters C", "Division 3"],
]);
const FRESH_MS = 15 * 60_000;
const MAX_STALE_MS = 24 * 60 * 60_000;
const FAILURE_BACKOFF_MS = 60_000;
const normalize = (text: string) => text.replace(/\s+/g, " ").trim();

/** Read only Home/Away columns: Masters teams also appear as umpiring duties. */
export function parseLadiesFixtures(html: string): Pick<Schedule, "season" | "fixtures"> {
  const $ = load(html);
  const table = $("table").filter((_index, element) => {
    const headings = $(element).find("th").map((_i, th) => normalize($(th).text())).get();
    return headings.includes("Home") && headings.includes("Away") && headings.includes("Umpire 1");
  }).last();
  if (!table.length) throw new Error("Official fixture table was not recognized");
  const headings = table.find("th").map((_i, th) => normalize($(th).text())).get();
  const column = (name: string) => {
    const index = headings.indexOf(name);
    if (index < 0) throw new Error(`Missing official fixture column: ${name}`);
    return index;
  };
  const homeColumn = column("Home");
  const awayColumn = column("Away");
  const timeColumn = column("Time");
  const venueColumn = column("Venue");
  const divisionColumn = column("Div");
  const statusColumn = column("C/P");
  let day = "";
  const fixtures: Fixture[] = [];
  const seen = new Set<string>();
  table.find("tr").each((_i, row) => {
    const cells = $(row).children("td");
    const anchor = cells.find("a[name]").first().attr("name");
    if (anchor && /^\d{8}$/.test(anchor)) {
      day = `${anchor.slice(4)}-${anchor.slice(2, 4)}-${anchor.slice(0, 2)}`;
      // Reject invalid dates rather than attaching matches to the preceding day.
      if (new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day) {
        throw new Error("Invalid official fixture date");
      }
      return;
    }
    if (cells.length <= Math.max(homeColumn, awayColumn)) return;
    const values = cells.map((_j, cell) => normalize($(cell).text())).get();
    const homeTeam = values[homeColumn] ?? "";
    const awayTeam = values[awayColumn] ?? "";
    const teamName = TEAM_DIVISIONS.has(homeTeam) ? homeTeam : TEAM_DIVISIONS.has(awayTeam) ? awayTeam : null;
    if (!teamName) return;
    const time = values[timeColumn] ?? "";
    if (!day || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
      throw new Error("Official Masters fixture has no valid date or time");
    }
    const sourceDivision = values[divisionColumn];
    const expectedDivision = teamName === "Masters A" ? "P" : teamName === "Masters B" ? "2" : "3";
    if (sourceDivision !== expectedDivision) {
      throw new Error("Official Masters division has changed; review the team information");
    }
    const id = [day, time, homeTeam, awayTeam].join("|");
    if (seen.has(id)) return;
    seen.add(id);
    fixtures.push({
      id,
      teamName: teamName as Fixture["teamName"],
      division: TEAM_DIVISIONS.get(teamName)!,
      homeTeam,
      awayTeam,
      opponent: homeTeam === teamName ? awayTeam : homeTeam,
      kickoffAt: `${day}T${time}:00+08:00`,
      venue: values[venueColumn] ?? "",
      sourceStatus: values[statusColumn] ?? "",
      isInactive: cells.toArray().some((cell) => $(cell).hasClass("inactive")),
    });
  });
  if (!fixtures.length) throw new Error("No Masters playing fixtures found in the official schedule");
  fixtures.sort((a, b) => a.kickoffAt.localeCompare(b.kickoffAt));
  const firstDate = fixtures[0]!.kickoffAt;
  const year = Number(firstDate.slice(0, 4));
  const seasonStart = Number(firstDate.slice(5, 7)) >= 7 ? year : year - 1;
  return { fixtures, season: `${seasonStart}/${String(seasonStart + 1).slice(-2)}` };
}

async function fetchOfficialPage(): Promise<string> {
  const response = await fetch(LADIES_FIXTURE_SOURCE, {
    signal: AbortSignal.timeout(12_000),
    headers: { Accept: "text/html" },
    redirect: "error",
  });
  if (!response.ok) throw new Error(`Official schedule returned HTTP ${response.status}`);
  if (!response.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Official schedule did not return HTML");
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Official schedule returned an empty response");
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 2_000_000) throw new Error("Official schedule response exceeded the size limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** Brief in-memory cache, shared in-flight work and failure backoff protect HK Hockey. */
export function createLadiesFixtureFeed(
  fetchPage: () => Promise<string> = fetchOfficialPage,
  now: () => number = Date.now,
) {
  let cached: Schedule | null = null;
  let inflight: Promise<Schedule> | null = null;
  let retryAfter = 0;
  const previousOrThrow = (): Schedule => {
    if (cached && now() - Date.parse(cached.fetchedAt) < MAX_STALE_MS) return { ...cached, stale: true };
    throw new Error("The official Ladies schedule is temporarily unavailable");
  };
  return async (): Promise<Schedule> => {
    if (cached && now() - Date.parse(cached.fetchedAt) < FRESH_MS) return cached;
    if (now() < retryAfter) return previousOrThrow();
    if (!inflight) {
      inflight = (async () => {
        try {
          const parsed = parseLadiesFixtures(await fetchPage());
          cached = GetLadiesLeagueFixturesResponse.parse({
            ...parsed, sourceUrl: LADIES_FIXTURE_SOURCE, fetchedAt: new Date(now()).toISOString(), stale: false,
          });
          return cached;
        } catch {
          retryAfter = now() + FAILURE_BACKOFF_MS;
          return previousOrThrow();
        } finally {
          inflight = null;
        }
      })();
    }
    return inflight;
  };
}

export const getLadiesLeagueFixtures = createLadiesFixtureFeed();
