import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MatchAttendanceSummary, { MatchGoingList } from "./MatchAttendanceSummary";
import TrainingAttendanceSummary from "./TrainingAttendanceSummary";

const attendance = {
  matchId: 42,
  rsvpCounts: { yes: 20, maybe: 2, no: 1 },
  goingPlayers: Array.from({ length: 20 }, (_, id) => ({ id, name: `Teammate ${id}` })),
};
const render = (component, props = {}) => renderToStaticMarkup(createElement(component, {
  attendance, loading: false, error: "", onRefresh: () => {}, ...props,
}));

describe("player match attendance display", () => {
  it("reuses the disclosure for training without calling it a match or a lineup", () => {
    const html = render(TrainingAttendanceSummary);
    expect(html).toContain("Who’s going (20)");
    expect(html).toContain('aria-expanded="false"');
    const list = render(MatchGoingList, { kind: "training" });
    expect(list).toContain('aria-label="Players going to this training"');
    expect(list).toContain("Players marked Going to training");
    expect(list).not.toContain("lineup");
    expect(list.match(/<li /g)).toHaveLength(20);
  });

  it("does not invent zero counts when a training session is missing or refresh fails", () => {
    const missing = render(TrainingAttendanceSummary, { attendance: undefined });
    expect(missing).toContain("Attendance unavailable");
    expect(missing).not.toContain("Who’s going (");
    const pending = render(TrainingAttendanceSummary, { attendance: undefined, loading: true });
    expect(pending).toContain("Updating attendance");
    const failed = render(TrainingAttendanceSummary, { error: "Offline" });
    expect(failed).toContain("Retry");
    expect(failed).not.toContain("20 going");
  });

  it("keeps names collapsed by default with an accessible disclosure and accurate count", () => {
    const html = render(MatchAttendanceSummary);
    expect(html).toContain("Who’s going (20)");
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain("aria-controls=");
    expect(html).not.toContain("Teammate");
  });

  it("renders the complete list above sixteen names and makes its meaning clear", () => {
    const html = render(MatchGoingList);
    expect(html.match(/<li /g)).toHaveLength(20);
    expect(html).toContain("Teammate 19");
    expect(html).toContain("not a confirmed lineup");
    expect(html).toContain('aria-label="Players going to this match"');
    expect(html).toContain("sm:grid-cols-2");
  });

  it("hides the previous names and totals while refreshing or on failure", () => {
    const loading = render(MatchGoingList, { loading: true });
    expect(loading).toContain("Loading who’s going");
    expect(loading).not.toContain("Teammate");
    const failed = render(MatchGoingList, { error: "Connection unavailable" });
    expect(failed).toContain('role="alert"');
    expect(failed).toContain("Retry");
    expect(failed).not.toContain("Teammate");
    const summary = render(MatchAttendanceSummary, { error: "Connection unavailable" });
    expect(summary).toContain("Attendance unavailable");
    expect(summary).not.toContain("Who’s going (20)");
  });

  it("shows an explicit empty state and escapes player names", () => {
    const empty = render(MatchGoingList, { attendance: { ...attendance, goingPlayers: [] } });
    expect(empty).toContain("No players have signed on yet");
    const escaped = render(MatchGoingList, {
      attendance: { ...attendance, goingPlayers: [{ id: 1, name: "<script>alert(1)</script>" }] },
    });
    expect(escaped).not.toContain("<script>");
    expect(escaped).toContain("&lt;script&gt;");
  });
});
