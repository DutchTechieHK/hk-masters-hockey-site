// Synthetic API data only. No requests can mutate real member or team records.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser = await chromium.launch({ executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"] });
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let teams = [];
    const writes = [];
    await page.addInitScript(() => localStorage.setItem("hkm_admin_session", "synthetic-cms-test"));
    await page.route("**/api/**", async (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      let body = [];
      if (path === "/api/admin/auth") body = { authenticated: true, kind: "admin" };
      else if (path === "/api/teams") {
        if (req.method() === "POST") {
          writes.push(req.postDataJSON());
          teams.push({ ...req.postDataJSON(), id: teams.length + 1, managerName: "", managerPhone: "", managerEmail: "" });
          body = teams.at(-1);
        } else body = teams;
      } else if (/\/api\/teams\/\d+$/.test(path) && req.method() === "PUT") {
        const update = req.postDataJSON();
        teams = teams.map((team) => team.id === Number(path.split("/").at(-1)) ? { ...team, ...update } : team);
        body = teams.find((team) => team.id === Number(path.split("/").at(-1)));
      } else if (path === "/api/public/squad") {
        body = [{ id: 77, teamId: 1, name: "Synthetic Squad Member" }];
      } else if (path === "/api/site-content/page-texts") body = { pages: {} };
      await route.fulfill({ json: body });
    });
    await page.goto("http://localhost:80/admin/teams");
    await page.getByTestId("setup-ladies-teams").click();
    await page.getByRole("heading", { name: "Ladies Masters A", exact: true }).waitFor();
    assert.equal(writes.length, 3);
    assert.deepEqual(writes.map((team) => [team.leagueKey, team.membershipSection]), [
      ["ladies-a", "women"], ["ladies-b", "women"], ["ladies-c", "women"],
    ]);
    assert.equal(await page.getByTestId("setup-ladies-teams").count(), 0);
    await page.getByRole("heading", { name: "Ladies Masters A", exact: true }).click();
    await page.getByRole("heading", { name: "Squad", exact: true }).waitFor();
    await page.getByRole("button", { name: /Edit Team/ }).click();
    await page.locator("#league-division").fill("CMS Premier Division");
    const nameInput = page.locator('input[name="name"]');
    await nameInput.fill("CMS Ladies A");
    await page.getByRole("button", { name: /Save Changes|Update Team|Save Team/ }).click();
    await page.getByRole("heading", { name: "CMS Ladies A", exact: true }).waitFor();
    await page.goto("http://localhost:80/teams");
    const card = page.getByTestId("cms-team-ladies-a");
    await card.getByRole("heading", { name: "CMS Ladies A" }).waitFor();
    assert.match(await card.innerText(), /CMS Premier Division/i);
    assert.match(await card.innerText(), /Synthetic Squad Member/);
    assert.match(await page.getByTestId("cms-team-ladies-b").innerText(), /names will follow/i);
    assert.equal(await page.getByTestId("link-fixtures-ladies-a").getAttribute("href"), "/fixtures?team=ladies-a");
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    console.log(`PASS ${viewport.width}px: CMS setup, edit, stable links and public squad names.`);
    await page.close();
  }
} finally { await browser.close(); }
