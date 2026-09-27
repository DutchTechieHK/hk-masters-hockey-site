import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const send = vi.hoisted(() => vi.fn());
vi.mock("resend", () => ({
  Resend: class {
    emails = { send };
  },
}));

import { sendBulkAnnouncementEmail } from "./email";

const originalKey = process.env.RESEND_API_KEY;
const request = {
  playerName: "Member",
  playerEmail: "member@example.com",
  subject: "News",
  body: "<p>See you there</p>",
};

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-only";
  send.mockReset().mockResolvedValue({ error: null });
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.RESEND_API_KEY;
  else process.env.RESEND_API_KEY = originalKey;
});

describe("announcement email sender", () => {
  it.each(["play@hkmastershockey.com", "mens@hkmastershockey.com"] as const)(
    "uses %s for From, Reply-To and both contact footers",
    async (fromEmail) => {
      expect(await sendBulkAnnouncementEmail({ ...request, fromEmail })).toBe(true);
      expect(send).toHaveBeenCalledTimes(1);
      expect(send).toHaveBeenCalledWith(expect.objectContaining({
        from: `HK Masters Hockey <${fromEmail}>`,
        replyTo: fromEmail,
        html: expect.stringContaining(`mailto:${fromEmail}`),
        text: expect.stringContaining(`Questions? Email us at ${fromEmail}.`),
      }));
    },
  );

  it("does not retry with the fallback address when the selected sender is rejected", async () => {
    send.mockResolvedValue({ error: { statusCode: 403, message: "Sender not allowed" } });
    expect(await sendBulkAnnouncementEmail({ ...request, fromEmail: "mens@hkmastershockey.com" })).toBe(false);
    expect(send).toHaveBeenCalledTimes(1);
  });
});