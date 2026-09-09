import { describe, expect, it } from "vitest";
import { formatEventDateTime } from "./eventTime";

describe("event notification time formatting", () => {
  it("formats event instants in Hong Kong time", () => {
    expect(formatEventDateTime(new Date("2026-07-22T07:00:00.000Z"))).toEqual({
      eventDate: "Wednesday, 22 July 2026",
      eventTime: "15:00 HKT",
    });
  });
});