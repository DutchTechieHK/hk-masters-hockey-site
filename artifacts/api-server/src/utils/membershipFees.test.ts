import { describe, expect, it } from "vitest";
import { buildSeasonFeeAccount } from "./membershipFees";

describe("buildSeasonFeeAccount", () => {
  const payments = [
    { id: 1, seasonId: 10, amount: "100.00", paymentDate: "2026-09-05" },
    { id: 2, seasonId: 20, amount: "900.00", paymentDate: "2026-08-01" },
  ];

  it("never lets a Rotterdam payment satisfy the current membership balance", () => {
    expect(buildSeasonFeeAccount(10, 500, payments)).toMatchObject({
      amountPaid: 100,
      balance: 400,
      feePaid: false,
      latestPaymentDate: "2026-09-05",
    });
  });

  it("keeps archived payments in their own account", () => {
    const archive = buildSeasonFeeAccount(20, 900, payments);
    expect(archive).toMatchObject({ amountPaid: 900, balance: 0, feePaid: true });
    expect(archive.payments.map((payment) => payment.id)).toEqual([2]);
  });

  it("ignores unowned legacy rows until they are backfilled", () => {
    const withLegacy = [...payments, { id: 3, seasonId: null, amount: "500.00", paymentDate: "2026-07-01" }];
    expect(buildSeasonFeeAccount(10, 500, withLegacy).amountPaid).toBe(100);
  });
});