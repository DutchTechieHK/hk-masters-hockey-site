import { TRAVEL_DATE_BOUNDS } from "../src/lib/travelDateBounds.js";

function withinBounds(value, { min, max }) {
  return value >= min && value <= max;
}

let passed = 0;
let failed = 0;

function assert(description, condition) {
  if (condition) {
    console.log(`  PASS  ${description}`);
    passed++;
  } else {
    console.error(`  FAIL  ${description}`);
    failed++;
  }
}

console.log("\nTravel date bounds — unit tests\n");

console.log("flightArrivalDateTime (Arrives in Europe)");
assert("21 Jul 2026 12:00 is accepted (reported bug case)",
  withinBounds("2026-07-21T12:00", TRAVEL_DATE_BOUNDS.flightArrivalDateTime));
assert("15 Jul 2026 00:00 (lower bound) is accepted",
  withinBounds("2026-07-15T00:00", TRAVEL_DATE_BOUNDS.flightArrivalDateTime));
assert("22 Jul 2026 08:00 (tournament start) is accepted",
  withinBounds("2026-07-22T08:00", TRAVEL_DATE_BOUNDS.flightArrivalDateTime));
assert("01 Aug 2026 23:59 (upper bound) is accepted",
  withinBounds("2026-08-01T23:59", TRAVEL_DATE_BOUNDS.flightArrivalDateTime));
assert("14 Jul 2026 (before lower bound) is rejected",
  !withinBounds("2026-07-14T23:59", TRAVEL_DATE_BOUNDS.flightArrivalDateTime));

console.log("\nflightDepartureDateTime (Departs Europe)");
assert("22 Jul 2026 (lower bound) is accepted",
  withinBounds("2026-07-22T08:00", TRAVEL_DATE_BOUNDS.flightDepartureDateTime));
assert("01 Aug 2026 (tournament end) is accepted",
  withinBounds("2026-08-01T18:00", TRAVEL_DATE_BOUNDS.flightDepartureDateTime));
assert("08 Aug 2026 23:59 (upper bound) is accepted",
  withinBounds("2026-08-08T23:59", TRAVEL_DATE_BOUNDS.flightDepartureDateTime));

console.log("\noutboundDepartureDateTime (Departs Hong Kong)");
assert("13 Jul 2026 (lower bound) is accepted",
  withinBounds("2026-07-13T00:00", TRAVEL_DATE_BOUNDS.outboundDepartureDateTime));
assert("21 Jul 2026 is accepted",
  withinBounds("2026-07-21T10:00", TRAVEL_DATE_BOUNDS.outboundDepartureDateTime));

console.log("\nreturnArrivalDateTime (Arrives Hong Kong)");
assert("09 Aug 2026 23:59 (upper bound) is accepted",
  withinBounds("2026-08-09T23:59", TRAVEL_DATE_BOUNDS.returnArrivalDateTime));

console.log(`\n${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
