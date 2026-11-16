// Test fixtures only. Production pricing is always read from the catalogue.
import { membershipCategoryAmountDue as amountDue } from "./membershipFees";
export const MEMBERSHIP_CATEGORIES = ["awaiting_selection", "trials", "community_member", "social_player", "masters_division_one"] as const;
export const CATEGORY_FIXTURES = MEMBERSHIP_CATEGORIES.map((key, index) => ({
  key, defaultFee: [null, null, 100, 300, 500][index],
}));
export const membershipCategoryAmountDue = (key: string) => amountDue(key, CATEGORY_FIXTURES);
