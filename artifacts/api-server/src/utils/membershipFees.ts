export type SeasonPayment = {
  seasonId: number | null;
  amount: string;
  paymentDate: string;
};

export const MEMBERSHIP_CATEGORIES = [
  "awaiting_selection",
  "community_member",
  "social_player",
  "masters_division_one",
] as const;

export type MembershipCategory = (typeof MEMBERSHIP_CATEGORIES)[number];

export const MEMBERSHIP_CATEGORY_FEES: Record<MembershipCategory, number | null> = {
  awaiting_selection: null,
  community_member: 100,
  social_player: 300,
  masters_division_one: 500,
};

export function membershipCategoryAmountDue(category: string | null | undefined): number | null {
  return category != null && Object.prototype.hasOwnProperty.call(MEMBERSHIP_CATEGORY_FEES, category)
    ? MEMBERSHIP_CATEGORY_FEES[category as MembershipCategory]
    : null;
}

export function buildSeasonFeeAccount<T extends SeasonPayment>(
  seasonId: number,
  amountDue: number | null,
  allPayments: T[],
) {
  const payments = allPayments.filter((payment) => payment.seasonId === seasonId);
  const amountPaid = payments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
  return {
    amountDue,
    amountPaid: Number(amountPaid.toFixed(2)),
    balance: amountDue == null ? null : Math.max(0, Number((amountDue - amountPaid).toFixed(2))),
    feePaid: amountDue != null ? amountPaid > 0 && amountPaid + 1e-6 >= amountDue : amountPaid > 0,
    latestPaymentDate: payments[0]?.paymentDate ?? null,
    payments,
  };
}