import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MatchCard } from "./Schedule";

const match = {
  id: 7, opponent: "Valley", teamCategory: "Men", venue: "Happy Valley",
  status: "scheduled", kickoffAt: "2099-10-17T10:00:00.000Z",
};
const attendance = {
  rsvpCounts: { yes: 2, maybe: 1, no: 0 },
  goingPlayers: [{ id: 1, name: "Private Teammate" }, { id: 2, name: "Another Teammate" }],
};
const render = (props = {}) => renderToStaticMarkup(createElement(MatchCard, {
  match, attendance, attendanceLoading: false, attendanceError: "",
  onRefreshAttendance: () => {}, ...props,
}));

describe("Fixtures attendance", () => {
  it("adds the existing private disclosure to an eligible upcoming fixture", () => {
    const html = render();
    expect(html).toContain("Who’s going (2)");
    expect(html).toContain("2 going");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Private Teammate");
    expect(html).toContain("Add to calendar");
  });

  it("leaves public and other-squad fixtures without attendance data unchanged", () => {
    const html = render({ attendance: undefined });
    expect(html).not.toContain("Who’s going");
    expect(html).not.toContain("Private Teammate");
    expect(html).toContain("vs Valley");
  });

  it("does not show attendance on final, cancelled, live or elapsed matches", () => {
    for (const status of ["final", "cancelled", "in_progress"]) {
      expect(render({ match: { ...match, status } })).not.toContain("Who’s going");
    }
    expect(render({ match: { ...match, kickoffAt: "2020-01-01T10:00:00.000Z" } })).not.toContain("Who’s going");
  });

  it("shows loading or failure rather than a stale count", () => {
    expect(render({ attendanceLoading: true })).toContain("Updating attendance");
    const failed = render({ attendanceError: "Attendance could not be loaded" });
    expect(failed).toContain("Retry");
    expect(failed).not.toContain("Who’s going (2)");
  });
});
