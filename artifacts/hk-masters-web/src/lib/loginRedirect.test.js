import { describe, expect, it } from "vitest";
import { parseLoginParameters } from "./loginRedirect";

describe("login invitation parameters", () => {
  it("prefills the email and permits the schedule destination", () => {
    expect(parseLoginParameters("?email=trialist%40example.com&next=%2Fschedule")).toEqual({
      email: "trialist@example.com",
      destination: "/schedule",
    });
  });

  it("rejects external and unknown destinations", () => {
    expect(parseLoginParameters("?next=https%3A%2F%2Fevil.example")).toEqual({
      email: "",
      destination: "/dashboard",
    });
    expect(parseLoginParameters("?next=%2Fadmin")).toEqual({
      email: "",
      destination: "/dashboard",
    });
  });
});