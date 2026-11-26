import assert from "node:assert/strict";
import { chromium } from "playwright-core";

const origin = process.env.LADIES_TEST_URL || "http://localhost:80";
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
const future = new Date(Date.now() + 10 * 86_400_000).toISOString();
const past = new Date(Date.now() - 10 * 86_400_000).toISOString();
const makeFixture = (team, date, suffix, extra = {}) => ({
  id: `${team}-${suffix}`, teamName: `Masters ${team}`, division: team === "A" ? "Premier League" : `Division ${team === "B" ? 2 : 3}`,
  homeTeam: `Masters ${team}`, awayTeam: `Opponent ${suffix}`, opponent: `Opponent ${suffix}`, kickoffAt: date,
  venue: "KP", sourceStatus: "", isInactive: false, ...extra,
});
const fixtures = [
  makeFixture("A", future, "a"), makeFixture("B", future, "b"), makeFixture("C", future, "c"),
  makeFixture("C", future, "changed", { sourceStatus: "Res", isInactive: true }),
  makeFixture("A", past, "past"),
];
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    let feedMode = "ok";
    const writes = [];
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() !== "GET") {
        writes.push(path);
        return route.abort();
      }
      if (path === "/api/site-content/page-texts") return route.fulfill({ json: { pages: { teams: {
        header_subtitle: "OLD MEN ONLY INTRO", ladies_text: "OLD INCORRECT DIVISIONS",
        join_heading: "Trials Start 18 September", join_text: "OLD MEN ONLY JOIN",
      } } } });
      if (path === "/api/matches") return route.fulfill({ json: [{
        id: 999, teamId: 1, teamName: "Masters Div.1", teamCategory: "Men's Masters",
        opponent: "Men fixture opponent", kickoffAt: future, venue: "HKFC", status: "scheduled",
      }] });
      if (path === "/api/league-fixtures/ladies") {
        if (feedMode === "error") return route.fulfill({ status: 502, json: { error: "Source offline" } });
        return route.fulfill({ json: {
          sourceUrl: "https://www.hockey.org.hk/WomenFixture.asp", fetchedAt: new Date().toISOString(),
          season: "2026/27", stale: feedMode === "stale", fixtures,
        } });
      }
      return route.continue();
    });
    await page.goto(`${origin}/teams`);
    await page.getByTestId("link-fixtures-ladies-b").waitFor();
    for (const [team, division] of [["a", "Premier League"], ["b", "Division 2"], ["c", "Division 3"]]) {
      assert.match(await page.getByTestId(`link-fixtures-ladies-${team}`).innerText(), new RegExp(division, "i"));
    }
    const ladiesY = await page.locator("#ladies").evaluate(el => el.getBoundingClientRect().top);
    const feesY = await page.locator("#fees-heading").evaluate(el => el.getBoundingClientRect().top);
    assert(ladiesY < feesY, "Ladies teams must precede fees");
    assert.match(await page.locator("main").innerText(), /same fees apply to Men's and Ladies/);
    assert(!/OLD MEN ONLY|OLD INCORRECT/.test(await page.locator("main").innerText()));
    for (const amount of ["HK$100", "HK$300", "HK$500"]) assert((await page.locator("main").innerText()).includes(amount));
    await page.getByTestId("link-fixtures-ladies-b").click();
    await page.waitForURL("**/fixtures?team=ladies-b");
    await page.getByTestId("card-ladies-fixture-B-b").waitFor();
    assert.equal(await page.locator('[data-testid^="card-ladies-fixture-"]:visible').count(), 1);
    assert.equal(await page.locator("#men-fixtures-heading").count(), 0);
    await page.getByTestId("filter-team-all").click();
    await page.getByTestId("card-ladies-fixture-A-a").waitFor();
    await page.getByText("Men fixture opponent", { exact: false }).first().waitFor();
    assert.match(await page.getByTestId("card-ladies-fixture-C-changed").innerText(), /Inactive: Res/);
    assert.equal(await page.getByTestId("card-ladies-fixture-C-changed").getByText("Check official schedule").count(), 1);
    const pastDetails = page.getByTestId("section-ladies-fixtures").locator("details");
    await pastDetails.locator("summary").click();
    await page.getByTestId("card-ladies-fixture-A-past").waitFor({ state: "visible" });
    const ladiesText = await page.getByTestId("section-ladies-fixtures").innerText();
    assert(!/Full Time|Add to calendar|attendance|RSVP|0 – 0|Scores at official source/.test(ladiesText));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false, "No horizontal overflow");
    feedMode = "error";
    await page.reload();
    await page.getByTestId("button-retry-ladies").waitFor();
    await page.getByText("Men fixture opponent", { exact: false }).first().waitFor();
    feedMode = "stale";
    await page.getByTestId("button-retry-ladies").click();
    await page.getByText("Showing previously saved fixtures", { exact: false }).waitFor();
    assert.equal(writes.length, 0, "Public fixtures must not write data");
    assert.deepEqual(errors, [], "No runtime errors");
    console.log(`PASS ${viewport.width}px: team links, divisions, fees, filters, source flags, partial failure and stale recovery.`);
    await page.close();
  }
} finally {
  await browser.close();
}
