import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { EventCard } from "./MySchedule";

const ev = { id: 4, kind: "social", title: "Team Drinks", startsAt: "2099-12-11T14:00:00Z",
  rsvpCounts: { yes: 99, maybe: 99, no: 99 } };
const eventAttendance = { eventId: 4, rsvpCounts: { yes: 1, maybe: 1, no: 0 },
  goingPlayers: [{ id: 1, name: "Private Going Name" }],
  maybePlayers: [{ id: 2, name: "Private Maybe Name" }] };
const render = (props = {}) => renderToStaticMarkup(createElement(EventCard, {
  ev, eventAttendance, rsvpSaving: {}, submitRsvp: () => {}, refreshEvents: () => {}, ...props,
}));

describe("My schedule event attendance", () => {
  it("shows the shared Going and Maybe disclosure for all upcoming event kinds", () => {
    for (const kind of ["social", "game", "meeting", "training", "team_dinner"]) {
      const html = render({ ev: { ...ev, kind } });
      expect(html).toContain("Who’s going (1)");
      expect(html).toContain("Maybe (1)");
      expect(html).toContain('aria-expanded="false"');
      expect(html).not.toContain("Private Going Name");
      expect(html).not.toContain("Private Maybe Name");
      expect(html).not.toContain("99 going");
    }
  });

  it("does not show stale counts or names during refresh, saving, missing access or failure", () => {
    for (const props of [{ eventLoading: true }, { rsvpSaving: { 4: true } },
      { eventAttendance: undefined }, { eventError: "Offline" }]) {
      const html = render(props);
      expect(html).not.toContain("Who’s going (1)");
      expect(html).not.toContain("99 going");
      expect(html).not.toContain("Private Maybe Name");
    }
    expect(render({ eventAttendance: undefined })).toContain("Event attendance is unavailable");
  });

  it("does not add the current-attendance disclosure to past events", () => {
    expect(render({ ev: { ...ev, startsAt: "2020-01-01T00:00:00Z" } })).not.toContain("Who’s going");
  });
});
