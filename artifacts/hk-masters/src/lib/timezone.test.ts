import {
  getScopeTimezone,
  getScopeTimezoneLabel,
  zoneInputToIso,
  ROTTERDAM_TZ,
  HK_TZ,
} from "./timezone";

// Node.js test runner is not configured in package.json by default for this workspace.
// This is a pure helper type-safe test file demonstrating the timezone selection logic.
export function runTests() {
  const scopeWorldCup = getScopeTimezone("world_cup_2026");
  const scopeCurrent = getScopeTimezone(undefined);

  if (scopeWorldCup !== ROTTERDAM_TZ) throw new Error("Expected ROTTERDAM_TZ for world_cup_2026 scope");
  if (scopeCurrent !== HK_TZ) throw new Error("Expected HK_TZ for default scope");

  const labelWorldCup = getScopeTimezoneLabel("world_cup_2026");

  const labelCurrent = getScopeTimezoneLabel(undefined);
  
  if (labelWorldCup !== "Rotterdam time") throw new Error("Expected Rotterdam time label");
  if (labelCurrent !== "HKT") throw new Error("Expected HKT label");

  // Test zoneInputToIso with HKT
  // 2024-09-15T20:00 in HKT (UTC+8) should be 2024-09-15T12:00:00.000Z in UTC
  
  const iso = zoneInputToIso("2024-09-15T20:00", HK_TZ);
  if (iso !== "2024-09-15T12:00:00.000Z") {
    throw new Error("zoneInputToIso failed for HKT. Expected 2024-09-15T12:00:00.000Z but got " + iso);
  }


  const wallClock = "2026-09-18T20:00";
  if (zoneInputToIso(wallClock, scopeCurrent) !== "2026-09-18T12:00:00.000Z") {
    throw new Error("Expected current Hong Kong wall-clock time to convert using UTC+8");
  }
  if (zoneInputToIso(wallClock, scopeWorldCup) !== "2026-09-18T18:00:00.000Z") {
    throw new Error("Expected archived Rotterdam wall-clock time to convert using CEST");
  }

  console.log("Timezone helper tests passed.");
}

runTests();
