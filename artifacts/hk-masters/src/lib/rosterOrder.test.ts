import assert from "node:assert/strict";
import { compareRosterOrder } from "./rosterOrder";

// Selection status first, then shirt number (no number last), then name.
const squad = [
  { name: "Zed", selected: false, shirtNumber: 3 },
  { name: "Bob", selected: true, shirtNumber: null },
  { name: "Cal", selected: true, shirtNumber: 12 },
  { name: "amy", selected: false, shirtNumber: null },
  { name: "Dan", selected: true, shirtNumber: 7 },
  { name: "Abe", selected: true, shirtNumber: null },
  { name: "Ben", selected: false, shirtNumber: null },
];
assert.deepEqual(
  [...squad].sort(compareRosterOrder).map((r) => r.name),
  ["Dan", "Cal", "Abe", "Bob", "Zed", "amy", "Ben"],
);

// A plain roster has no selection status: shirt number, then name.
const roster = [{ name: "B", shirtNumber: 9 }, { name: "A", shirtNumber: 9 }, { name: "C", shirtNumber: 1 }];
assert.deepEqual([...roster].sort(compareRosterOrder).map((r) => r.name), ["C", "A", "B"]);
