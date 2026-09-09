import { describe, expect, it } from "vitest";
import { buildMembershipFeeReminderEmail } from "./email";

describe("membership fee reminder email", () => {
  it("uses current-season membership language and HKD amounts", () => {
    const message = buildMembershipFeeReminderEmail({
      playerName: "Test Member",
      playerEmail: "member@example.com",
      teamName: "HK Masters",
      amountDue: 500,
      amountPaid: 100,
    });

    expect(message.subject).toContain("2026/27 membership fee");
    expect(message.html).toContain("HK$500");
    expect(message.text).toContain("Outstanding balance: HK$400");
    expect(`${message.subject}\n${message.html}\n${message.text}`).not.toMatch(
      /Rotterdam|Netherlands|World Cup|tournament contribution/i,
    );
  });
});