import type { LineupBoard, LineupPerson, LineupPlacement } from "@workspace/db";

// Ambiguous/multiple roles are intentionally left for the coach to decide.
export function positionGroup(position: string | null): "gk" | "defence" | "midfield" | "forward" | null {
  const value = position?.trim().toLowerCase().replace(/[._-]/g, " ");
  if (!value) return null;
  const groups = [
    ["gk", /^(gk|goal\s?keeper|goalie|keeper)$/],
    ["defence", /^(defen[cs]e|defender|defence|def|back|full\s?back|left back|right back|centre back|center back|lb|rb|cb|sweeper)$/],
    ["midfield", /^(midfield|midfielder|mid|centre midfield|center midfield|left midfield|right midfield|cm|lm|rm|halfback|half back)$/],
    ["forward", /^(forward|striker|attack|attacker|winger|left wing|right wing|centre forward|center forward|lw|rw|cf)$/],
  ] as const;
  return groups.find(([, regex]) => regex.test(value))?.[0] ?? null;
}

export function suggestLineup(people: LineupPerson[], formation: LineupBoard["formation"]): LineupPlacement[] {
  const [defenders, midfielders, forwards] = formation.split("-").map(Number);
  const rows = [
    { group: "gk", count: 1, y: 91 },
    { group: "defence", count: defenders, y: 72 },
    { group: "midfield", count: midfielders, y: 48 },
    { group: "forward", count: forwards, y: 24 },
  ];
  const sorted = people.filter((p) => p.status === "yes").sort((a, b) => a.name.localeCompare(b.name, "en") || a.playerId - b.playerId);
  return rows.flatMap(({ group, count, y }) => sorted.filter((p) => positionGroup(p.position) === group).slice(0, count)
    .map((p, i) => ({ playerId: p.playerId, area: "pitch" as const, x: 100 * (i + 1) / (count + 1), y })));
}

export function placementIssues(board: LineupBoard, people: LineupPerson[]) {
  const byId = new Map(people.map((p) => [p.playerId, p]));
  return board.players.flatMap((p) => {
    const current = byId.get(p.playerId);
    const reason = !current ? `${p.name} is no longer in this match's eligible squad.`
      : current.status !== "yes" && current.status !== "maybe" ? `${p.name} is ${current.status === "no" ? "Not going" : "not yet confirmed"}.`
      : current.status !== p.status ? `${p.name}'s availability changed to ${current.status === "maybe" ? "Maybe" : "Going"}. Save a reviewed draft before publishing.`
      : null;
    return reason ? [{ playerId: p.playerId, reason }] : [];
  });
}

export function validatePlacements(placements: LineupPlacement[]) {
  if (new Set(placements.map((p) => p.playerId)).size !== placements.length) return "A player can only appear once.";
  if (placements.filter((p) => p.area === "pitch").length > 11) return "Only eleven players can be on the pitch.";
  if (placements.some((p) => !Number.isSafeInteger(p.playerId) || p.playerId < 1 ||
    !Number.isFinite(p.x) || !Number.isFinite(p.y) || p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100 ||
    (p.area !== "pitch" && p.area !== "bench"))) return "Invalid player or pitch coordinates.";
  return null;
}
