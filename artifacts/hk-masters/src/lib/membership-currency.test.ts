import assert from "node:assert/strict";
import { formatMembershipCurrency } from "./utils";

assert.equal(formatMembershipCurrency(125.5), "HK$125.50");
assert.equal(formatMembershipCurrency(125.51), "HK$125.51");
assert.equal(formatMembershipCurrency(0.01), "HK$0.01");
assert.equal(formatMembershipCurrency(0), "HK$0");
assert.equal(formatMembershipCurrency(500), "HK$500");
