// node artifacts/hk-masters/tests/attendance-editor.browser.mjs
// Synthetic API fixtures only; never reads or changes real member replies.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  for (const viewport of [{ width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const match = { id: 99002, teamId: 99001, teamName: "Test squad", teamCategory: "Men's Squad",
      opponent: "Test Visitors", kickoffAt: "2026-12-20T12:30:00Z", status: "scheduled" };
    const responses = Array.from({ length: 33 }, (_, i) => ({
      id: i + 1, revision: 1, playerId: i + 1, playerName: `Test Player ${i + 1}`,
      shirtNumber: i + 1, status: "yes", note: null, source: "player",
      respondedAt: "2026-11-20T00:00:00Z",
    }));
    const counts = { invited: 34, yes: 33, maybe: 0, no: 0, noResponse: 1 };
    const writes = [];
    await page.addInitScript(() => localStorage.setItem("hkm_admin_session", "synthetic-attendance-test"));
    await page.route("**/api/**", async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (request.method() !== "GET") writes.push(path);
      let body = [];
      if (path === "/api/admin/auth") body = { authenticated: true, kind: "admin" };
      else if (path === "/api/teams") body = [{ id: match.teamId, name: "Test squad", category: "Men's Squad" }];
      else if (path === "/api/matches") body = [match];
      else if (path === "/api/matches/rsvps/summary") body = { matches: [{ matchId: match.id, counts }] };
      else if (path === `/api/matches/${match.id}/rsvps`) body = {
        counts, responses, history: [],
        noResponse: [{ playerId: 34, playerName: "Test Nonresponder", shirtNumber: 34 }],
      };
      await route.fulfill({ json: body });
    });
    await page.goto(`${process.env.ATTENDANCE_TEST_URL ?? "http://localhost:80"}/admin/matches`);
    await page.getByRole("button", { name: "Attendance", exact: true }).click();
    await page.getByRole("button", { name: "Edit attendance for Test Player 1", exact: true }).click();
    const editor = page.getByRole("region", { name: "Edit attendance for Test Player 1", exact: true });
    await editor.waitFor({ state: "visible" });
    assert(await editor.evaluate(el => {
      const box = el.getBoundingClientRect();
      return document.activeElement === el && box.top >= 0 && box.bottom <= innerHeight;
    }), "Clicking Edit must bring the editor into view and focus it");
    await editor.getByRole("combobox").selectOption("maybe");
    await editor.getByLabel("Reason", { exact: true }).fill("Synthetic test only");
    await editor.getByRole("button", { name: "Review change" }).click();
    await editor.getByRole("button", { name: "Confirm change" }).waitFor({ state: "visible" });
    await editor.getByRole("button", { name: "Cancel", exact: true }).click();
    await page.getByRole("button", { name: "Record attendance for Test Nonresponder" }).click();
    const record = page.getByRole("region", { name: "Edit attendance for Test Nonresponder" });
    await record.waitFor({ state: "visible" });
    assert(await record.evaluate(el => document.activeElement === el));
    await record.getByRole("button", { name: "Save reply" }).waitFor({ state: "visible" });
    assert.equal(writes.length, 0, "Opening, reviewing and cancelling must not change attendance");
    console.log(`PASS ${viewport.width}px: Edit and Record reply focus visible editors; review/cancel do not save.`);
    await page.close();
  }
} finally {
  await browser.close();
}
