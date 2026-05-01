import { Router } from "express";
import { db } from "@workspace/db";
import { contributionsTable } from "@workspace/db/schema";
import { eq, desc, isNull, and } from "drizzle-orm";

const router = Router();

const SITE_BASE_URL =
  process.env["SITE_BASE_URL"] ?? "https://www.hkmastershockey.com";

const STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/journal", priority: "0.9", changefreq: "daily" },
];

function xmlEscape(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

router.get("/sitemap.xml", async (_req, res) => {
  const contributions = await db
    .select({
      id: contributionsTable.id,
      slug: contributionsTable.slug,
      reviewedAt: contributionsTable.reviewedAt,
    })
    .from(contributionsTable)
    .where(and(eq(contributionsTable.status, "approved"), isNull(contributionsTable.deletedAt)))
    .orderBy(desc(contributionsTable.reviewedAt));

  const staticEntries = STATIC_PAGES.map(
    (page) => `
  <url>
    <loc>${xmlEscape(`${SITE_BASE_URL}${page.loc}`)}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`
  ).join("");

  const articleEntries = contributions
    .map((c) => {
      const pathSegment = c.slug ?? String(c.id);
      const lastmod = c.reviewedAt
        ? c.reviewedAt.toISOString().split("T")[0]
        : undefined;
      return `
  <url>
    <loc>${xmlEscape(`${SITE_BASE_URL}/journal/${pathSegment}`)}</loc>${lastmod ? `\n    <lastmod>${xmlEscape(lastmod)}</lastmod>` : ""}
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${articleEntries}
</urlset>`;

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.status(200).send(xml);
});

export default router;
