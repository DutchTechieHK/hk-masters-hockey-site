import { strict as assert } from "node:assert";
import { test } from "node:test";
import { publishedImageSource, renderLineupImage, lineupImageFilename } from "./lineup-image";
import type { LineupBoard } from "@workspace/api-client-react";

const published: LineupBoard = { formation: "4-3-3", players: [
  { playerId: 1, name: "Published Starter", shirtNumber: 7, position: null, status: "yes", area: "pitch", x: 0, y: 100 },
  { playerId: 2, name: "Provisional Substitute", shirtNumber: 19, position: null, status: "maybe", area: "bench", x: 0, y: 0 },
  { playerId: 3, name: "Provisional Starter", shirtNumber: null, position: null, status: "maybe", area: "pitch", x: 50, y: 50 },
] };
const publishedAt = "2026-11-12T04:05:00.000Z";

test("exports only the publication, with a detached snapshot and no draft fallback", () => {
  const workspace = { published, publishedAt, draft: { formation: "3-4-3", players: [{ name: "SECRET DRAFT" }] } };
  const source = publishedImageSource(workspace);
  assert.deepEqual(source.board, published);
  source.board.players[0].name = "Changed local copy";
  assert.equal(published.players[0].name, "Published Starter");
  assert.throws(() => publishedImageSource({ published: null, publishedAt }), /No lineup is published/);
  assert.throws(() => publishedImageSource({ published, publishedAt: null }), /No lineup is published/);
  assert.match(lineupImageFilename(52, publishedAt), /^match-52-published-.*\.png$/);
  assert(!lineupImageFilename(52, publishedAt).includes(":"));
});

test("PNG contains title, Hong Kong publication time, all names/numbers and explicit Maybe labels", async () => {
  const written: string[] = [];
  const context = new Proxy({
    measureText: (s: string) => ({ width: s.length * 17 }),
    fillText: (s: string) => { written.push(s); },
  }, { get: (target, key) => Reflect.get(target, key) ?? (() => {}) });
  const canvas = { width: 0, height: 0, getContext: () => context,
    toBlob: (callback: (blob: Blob) => void, mime: string) => callback(new Blob(["png"], { type: mime })) };
  const oldDocument = globalThis.document;
  const oldPath = globalThis.Path2D;
  Object.assign(globalThis, { document: { createElement: () => canvas }, Path2D: class {} });
  try {
    const blob = await renderLineupImage(publishedImageSource({ published, publishedAt }), "HK Masters vs Visitors");
    assert.equal(blob.type, "image/png");
    assert.equal(canvas.width, 1080);
    assert(canvas.height > canvas.width);
    const content = written.join("\n");
    for (const expected of ["HK Masters vs Visitors", "12 Nov 2026, 12:05 HKT", "#7  Published Starter",
      "#19  Provisional Substitute · Maybe (provisional)", "No number  Provisional Starter · Maybe (provisional)", "Incomplete XI"]) {
      assert(content.includes(expected), `missing ${expected}`);
    }
    assert(!content.includes("SECRET DRAFT"));
  } finally {
    Object.assign(globalThis, { document: oldDocument, Path2D: oldPath });
  }
});
