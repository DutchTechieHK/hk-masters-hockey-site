// Single source of truth for league team names, divisions and fixture filters.
// sourceTeamName must match `teamName` in GET /api/league-fixtures/ladies.

export const MEN_TEAM = {
  slug: "men",
  label: "Men's Masters",
  teamName: "Masters A",
  division: "Division 1",
};

export const LADIES_TEAMS = [
  { slug: "ladies-a", label: "Ladies Masters A", sourceTeamName: "Masters A", division: "Premier League" },
  { slug: "ladies-b", label: "Ladies Masters B", sourceTeamName: "Masters B", division: "Division 2" },
  { slug: "ladies-c", label: "Ladies Masters C", sourceTeamName: "Masters C", division: "Division 3" },
];

export const TEAM_FILTERS = [
  { slug: "all", label: "All teams" },
  { slug: MEN_TEAM.slug, label: MEN_TEAM.label },
  ...LADIES_TEAMS.map((t) => ({ slug: t.slug, label: t.label })),
];

export const LADIES_SOURCE_URL = "https://www.hockey.org.hk/WomenFixture.asp";

export function fixturesHref(slug) {
  return `/fixtures?team=${slug}`;
}

export function parseTeamFilter(search) {
  const value = new URLSearchParams(search || "").get("team");
  return TEAM_FILTERS.some((f) => f.slug === value) ? value : "all";
}

export function ladiesTeamForSource(sourceTeamName) {
  return LADIES_TEAMS.find((t) => t.sourceTeamName === sourceTeamName) || null;
}

// Fixtures with a source flag or inactive marker must never read as confirmed.
export function isUnconfirmed(fixture) {
  return Boolean(fixture.isInactive) || Boolean(fixture.sourceStatus && fixture.sourceStatus.trim());
}

export function splitLadiesFixtures(fixtures, now = Date.now()) {
  const upcoming = [];
  const flagged = [];
  const past = [];
  for (const f of fixtures) {
    const t = new Date(f.kickoffAt).getTime();
    if (isUnconfirmed(f)) flagged.push(f);
    else if (t < now - 3 * 60 * 60 * 1000) past.push(f);
    else upcoming.push(f);
  }
  const asc = (a, b) => new Date(a.kickoffAt) - new Date(b.kickoffAt);
  return { upcoming: upcoming.sort(asc), flagged: flagged.sort(asc), past: past.sort(asc).reverse() };
}
