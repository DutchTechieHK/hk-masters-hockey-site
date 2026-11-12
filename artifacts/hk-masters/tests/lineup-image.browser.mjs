// Run from the workspace root with the admin frontend running:
// node artifacts/hk-masters/tests/lineup-image.browser.mjs
// All API responses are synthetic; this never writes to the database.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const base = process.env.LINEUP_TEST_URL ?? "http://localhost:80";
const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const match = { id: 902, teamId: 901, teamName: "HK Test Team", opponent: "Test Visitors", kickoffAt: "2026-11-15T04:00:00Z", status: "scheduled" };
  const person = (playerId, name, shirtNumber, status, area, x = 50, y = 50) => ({ playerId, name, shirtNumber, status, position: null, area, x, y });
  let mode = "published";
  let denied = false;
  let isStaff = false;
  let staffReads = 0;
  let adminReads = 0;
  const requests = [];
  await page.addInitScript(() => localStorage.setItem("hkm_admin_session", "synthetic-lineup-test"));
  await page.route("**/api/**", async (route) => {
    const request = route.request();
    requests.push(request.method());
    const url = new URL(request.url());
    let body = [];
    if (url.pathname === "/api/admin/auth") body = { authenticated: true, kind: isStaff ? "staff" : "admin",
      staff: isStaff ? { playerId: 700, name: "Test Coach", seasonId: 800, seasonName: "Test Season", grants: [{ id: 1, teamId: 901, teamName: "HK Test Team", version: 1, manageLineups: true }] } : undefined };
    else if (url.pathname === "/api/staff/teams/901/matches/902/lineup") {
      if (denied) return route.fulfill({ status: 403, json: { error: "Access revoked" } });
      body = {
        revision: 2, canEdit: true, updatedAt: "2026-11-12T04:05:00Z",
        publishedAt: mode === "published" ? "2026-11-12T04:05:00Z" : null,
        people: [], issues: [], suggestions433: [], suggestions343: [],
        draft: { formation: "3-4-3", players: [person(10, "SECRET PRIVATE DRAFT", 99, "yes", "pitch")] },
        published: mode === "published" ? { formation: "4-3-3", players: [
          person(1, "Published Starter", 7, "yes", "pitch", 20, 25),
          person(2, "Maybe Starter", 12, "maybe", "pitch", 80, 75),
          person(3, "Bench Provisional", 19, "maybe", "bench"),
        ] } : null,
      };
    } else if (url.pathname === "/api/staff/teams/901") { staffReads++; body = { roster: [], events: [], matches: [match] }; }
    else if (url.pathname === "/api/matches") { adminReads++; body = [match]; }
    await route.fulfill({ json: body });
  });
  // Capture what is actually painted, not just the source data or DOM labels.
  await page.addInitScript(() => {
    window.lineupPainted = [];
    const original = CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText = function (text, ...args) {
      window.lineupPainted.push(text);
      return original.call(this, text, ...args);
    };
  });
  const visit = () => page.goto(`${base}/admin/staff/teams/901/matches/902/lineup`);
  await visit();
  await page.getByTestId("button-export-published").click();
  const image = page.getByTestId("image-published-lineup");
  await image.waitFor();
  await assert.doesNotReject(() => image.evaluate((img) => img.decode()));
  const content = await page.evaluate(() => window.lineupPainted.join("\n"));
  for (const expected of ["HK Test Team vs Test Visitors", "Published 12 Nov 2026, 12:05 HKT", "#7  Published Starter", "#19  Bench Provisional · Maybe (provisional)", "Maybe", "4-3-3"]) assert(content.includes(expected), expected);
  assert(!content.includes("SECRET PRIVATE DRAFT"));
  assert(!content.includes("#99"));
  assert.equal(staffReads, 0, "full admin must not call the staff-only team endpoint");
  assert(adminReads > 0);
  const box = await image.boundingBox();
  assert(box.x >= 0 && box.x + box.width <= 390);
  const downloadPromise = page.waitForEvent("download");
  await page.getByTestId("link-download-lineup").click();
  const download = await downloadPromise;
  assert.match(download.suggestedFilename(), /^match-902-published-.*\.png$/);
  const png = await readFile(await download.path());
  assert.equal(png.subarray(1, 4).toString(), "PNG");
  assert.equal(png.readUInt32BE(16), 1080);
  assert(png.readUInt32BE(20) > 1080);
  await image.screenshot({ path: "/tmp/published-lineup-image.png" });
  await page.screenshot({ path: "/tmp/published-lineup-phone.png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  denied = true;
  await page.getByTestId("button-export-published").click();
  await page.getByRole("alert").filter({ hasText: "Not permitted" }).waitFor();
  assert.equal(await image.count(), 0);
  denied = false; mode = "none";
  await visit();
  await assert.doesNotReject(() => page.getByTestId("button-export-published").waitFor());
  assert(await page.getByTestId("button-export-published").isDisabled());
  // Confirm the separate restricted-staff metadata path works too.
  isStaff = true; mode = "published";
  await visit();
  await page.getByTestId("button-export-published").click();
  await image.waitFor();
  assert(staffReads > 0);
  assert(requests.every((method) => method === "GET"), "export must not mutate or send messages");
  console.log("PASS: phone preview, real PNG download, published-only painted content, staff/admin API paths, unpublished state, fresh 403 failure, read-only requests.");
} finally {
  await browser.close();
}
