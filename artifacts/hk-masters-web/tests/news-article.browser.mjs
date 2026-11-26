// node artifacts/hk-masters-web/tests/news-article.browser.mjs
// Synthetic read-only article/image fixtures; no database changes.
import { chromium } from "playwright-core";
import assert from "node:assert/strict";

const browser = await chromium.launch({
  executablePath: "/repl/tools/bin/chromium", headless: true, args: ["--no-sandbox"],
});
try {
  for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport });
    await page.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== "GET") return route.abort();
      if (path === "/api/news") return route.fulfill({ json: { configured: true, posts: [{
        id: 1, title: "Road to Kuala Lumpur: HK Masters Begins the Journey",
        slug: "render-check", coverImage: "/api/news/serve-image/test-cover",
        category: "Announcement", excerpt: "The campaign begins.",
      }] } });
      if (path === "/api/news/render-check") return route.fulfill({ json: {
        title: "Road to Kuala Lumpur", slug: "render-check", author: "Test Author",
        coverImage: "/api/news/serve-image/test-cover", category: "Announcement",
        bodyHtml: '<p>First paragraph with a <a href="https://example.org/">tournament link</a>.</p>' +
          '<img src="/api/news/serve-image/test-poster" alt="Tournament poster" onerror="window.unsafeArticle=true">' +
          '<p>Second paragraph after the poster.</p><script>window.unsafeArticle=true</script>',
      } });
      if (path.startsWith("/api/news/serve-image/test-")) {
        const [width, height] = path.endsWith("cover") ? [1200, 260] : [600, 900];
        return route.fulfill({ contentType: "image/svg+xml", body:
          `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#1e3a6e"/></svg>` });
      }
      return route.continue();
    });
    await page.goto(`${process.env.NEWS_TEST_URL ?? "http://localhost:80"}/news/render-check`);
    const poster = page.getByAltText("Tournament poster", { exact: true });
    await poster.waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll('img[alt="Tournament poster"], img[alt="Road to Kuala Lumpur"]')]
      .every(img => img.complete && img.naturalWidth > 0));
    const geometry = await page.evaluate(() => {
      const poster = document.querySelector('img[alt="Tournament poster"]');
      const cover = document.querySelector('img[alt="Road to Kuala Lumpur"]');
      const paragraph = poster.parentElement.querySelector("p");
      const link = paragraph.querySelector("a");
      return {
        posterUrl: poster.src, posterAttribute: poster.getAttribute("src"),
        coverRatio: cover.clientWidth / cover.clientHeight,
        posterRatio: poster.clientWidth / poster.clientHeight,
        spacing: parseFloat(getComputedStyle(paragraph).marginBottom),
        underline: getComputedStyle(link).textDecorationLine,
        unsafe: window.unsafeArticle === true || poster.hasAttribute("onerror"),
        overflow: document.documentElement.scrollWidth > innerWidth,
      };
    });
    assert(geometry.posterAttribute.includes("/api/news/serve-image/test-poster"));
    assert(Math.abs(geometry.coverRatio - 1200 / 260) < 0.1, "Cover must retain its full aspect ratio");
    assert(Math.abs(geometry.posterRatio - 600 / 900) < 0.02, "Poster must retain its full aspect ratio");
    assert(geometry.spacing > 0, "Typography must add paragraph spacing");
    assert(geometry.underline.includes("underline"), "Article links must have visible formatting");
    assert.equal(geometry.unsafe, false, "Article HTML must remain sanitized");
    assert.equal(geometry.overflow, false, "Article images must fit the mobile viewport");
    console.log(`PASS ${viewport.width}px: images load uncropped, typography works, HTML remains sanitized.`);
    await page.goto(`${process.env.NEWS_TEST_URL ?? "http://localhost:80"}/news`);
    const thumbnail = page.locator("article img");
    await thumbnail.waitFor();
    await thumbnail.scrollIntoViewIfNeeded();
    await page.waitForFunction(() => document.querySelector("article img")?.naturalWidth > 0);
    await thumbnail.hover();
    const card = await thumbnail.evaluate(img => {
      const style = getComputedStyle(img);
      const heading = img.closest("article").querySelector("h2");
      return { fit: style.objectFit, transform: style.transform,
        headingVisible: heading.scrollWidth <= heading.clientWidth,
        overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.equal(card.fit, "contain", "News card must show all banner lettering, not crop to fill");
    assert.equal(card.transform, "none", "Hover must not zoom and crop the banner");
    assert.equal(card.headingVisible, true, "The article title must wrap inside the card");
    assert.equal(card.overflow, false);
    console.log(`PASS ${viewport.width}px: listing card preserves the whole banner and wraps its title.`);
    await page.close();
  }
} finally {
  await browser.close();
}
