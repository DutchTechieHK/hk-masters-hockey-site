export type SeasonPayment = {
  seasonId: number | null;
  amount: string;
  paymentDate: string;
};

export function membershipCategoryAmountDue(category: string | null | undefined, catalogue: readonly { key: string; defaultFee: string | number | null }[]): number | null {
  const row = catalogue.find(c => c.key === category);
  return row?.defaultFee == null ? null : Number(row.defaultFee);
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