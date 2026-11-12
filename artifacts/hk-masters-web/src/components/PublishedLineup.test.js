import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PublishedLineupBody, sanitizePublication } from "./PublishedLineup";

const render = (state) => renderToStaticMarkup(createElement(PublishedLineupBody, { state }));

describe("Published lineup viewer", () => {
  it("shows an empty state when nothing is published", () => {
    const html = render({ status: "ready", ...sanitizePublication({ published: null, publishedAt: null }) });
    expect(html).toContain("No lineup published yet");
  });

  it("renders the published board with publication label and incomplete warning", () => {
    const s = sanitizePublication({
      publishedAt: "2099-01-01T10:00:00Z",
      published: { formation: "4-3-3", players: [
        { playerId: 1, area: "pitch", x: 50, y: 90, name: "Ada Keeper", shirtNumber: 1 },
        { playerId: 2, area: "bench", x: 0, y: 0, name: "Ben Sub", shirtNumber: null },
      ] },
    });
    const html = render({ status: "ready", ...s });
    expect(html).toContain("Ada Keeper");
    expect(html).toContain("Ben Sub");
    expect(html).toContain("Published");
    expect(html).toContain("Incomplete eleven");
  });

  it("drops draft and private fields from responses", () => {
    const s = sanitizePublication({
      draft: { players: [{ name: "Secret Draft" }] }, people: [{ name: "x", note: "private" }],
      published: { formation: "3-4-3", players: [{ playerId: 3, area: "pitch", x: 1, y: 2, name: "Cy", shirtNumber: 7, note: "private", email: "a@b.c", status: "maybe" }] },
      publishedAt: null,
    });
    const json = JSON.stringify(s);
    expect(json).not.toContain("Secret Draft");
    expect(json).not.toContain("private");
    expect(json).not.toContain("a@b.c");
    expect(json).toContain('"status":"maybe"');
    expect(render({ status: "ready", ...s })).toContain("Maybe");
  });

  it("fails closed on error without showing a board", () => {
    const html = render({ status: "error", board: null, publishedAt: null, message: "This lineup isn't available to your account." });
    expect(html).toContain("isn&#x27;t available");
    expect(html).not.toContain("lineup-marker");
  });
});
