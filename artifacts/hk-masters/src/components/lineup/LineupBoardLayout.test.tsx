import { strict as assert } from "node:assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { LineupBoardLayout } from "./LineupBoardLayout";

const slots = {
  pitch: <div>Pitch fixture</div>, count: <p>Count fixture</p>,
  bench: <section>Bench fixture</section>, available: <section>Roster fixture</section>,
};
const draft = renderToStaticMarkup(<LineupBoardLayout {...slots} publication={<section>Publication fixture</section>} />);
assert(draft.indexOf("Pitch fixture") < draft.indexOf("Bench fixture"));
assert(draft.indexOf("Bench fixture") < draft.indexOf("Roster fixture"), "mobile order keeps bench beside pitch in the reading order");
assert(draft.indexOf("Roster fixture") < draft.indexOf("Publication fixture"));
assert(draft.includes("lg:grid-cols-[380px_minmax(0,1fr)]"), "desktop pitch stays within its existing maximum width");
assert.equal((draft.match(/lg:row-start-4/g) ?? []).length, 2, "bench and publication occupy one shared row");
assert(draft.includes("lg:[contain:size]") && draft.includes("lg:overflow-y-auto"), "large rosters scroll rather than stretching the pitch row");
assert(draft.includes('aria-label="Available players" tabindex="0"'), "keyboard users can focus the roster scroll region");

const readonly = renderToStaticMarkup(<LineupBoardLayout {...slots} />);
assert(!readonly.includes('data-testid="layout-publication"'), "view-only mode does not create a publication placeholder");
const published = renderToStaticMarkup(<LineupBoardLayout {...slots} published />);
assert(published.includes('aria-label="Published lineup information"'));
assert(!published.includes("lg:[contain:size]"), "short publication information is not forced into a fixed scrolling panel");
assert(!published.includes('tabindex="0"'));
console.log("Lineup panel layout checks passed.");
