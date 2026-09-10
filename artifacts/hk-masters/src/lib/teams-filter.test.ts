import { isTeamVisibleForScope } from "./teamScope";

export function runTeamsFilterTests() {
  // Current operations (no scope)
  if (!isTeamVisibleForScope("Men's Squad", undefined)) throw new Error("Men's Squad should be visible in current ops");
  if (!isTeamVisibleForScope("League Team", undefined)) throw new Error("League Team should be visible in current ops");
  if (isTeamVisibleForScope("MO40", undefined)) throw new Error("MO40 should NOT be visible in current ops");

  // Archive operations (scope = world_cup_2026)
  if (isTeamVisibleForScope("Men's Squad", "world_cup_2026")) throw new Error("Men's Squad should NOT be visible in archive");
  if (!isTeamVisibleForScope("MO40", "world_cup_2026")) throw new Error("MO40 should be visible in archive");

  console.log("Teams filter tests passed.");
}

runTeamsFilterTests();
