/**
 * Page-texts route tests: URL/HTML sanitization, mandatory conflict guard,
 * and deep-merge of nested objects (contact social links).
 *
 * Hits the real routes (real DB) with auth mocked out; the site_content row's
 * page-text fields are snapshotted and restored afterwards.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import express from "express";
import request from "supertest";
import { db } from "@workspace/db";
import { siteContentTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

vi.mock("../middleware/adminAuth", () => ({
  requireAdminAccess: (_req: any, _res: any, next: any) => next(),
}));

const { default: siteContentRouter } = await import("./site-content");

const app = express();
app.use(express.json());
app.use("/api/site-content", siteContentRouter);

let original: typeof siteContentTable.$inferSelect | undefined;

beforeAll(async () => {
  const rows = await db.select().from(siteContentTable).limit(1);
  original = rows[0];
});

afterAll(async () => {
  if (!original) return;
  await db
    .update(siteContentTable)
    .set({
      pageTexts: original.pageTexts,
      pageTextsUpdatedAt: original.pageTextsUpdatedAt,
    })
    .where(eq(siteContentTable.id, original.id));
});

async function currentVersion(): Promise<string | null> {
  const res = await request(app).get("/api/site-content/page-texts");
  expect(res.status).toBe(200);
  return res.body.updatedAt as string | null;
}

describe("PUT /api/site-content/page-texts", () => {
  it("requires updatedAt (conflict guard is mandatory)", async () => {
    const res = await request(app)
      .put("/api/site-content/page-texts")
      .send({ page: "media", texts: { intro: "x" } });
    expect(res.status).toBe(400);
  });

  it("rejects unknown pages and non-object texts", async () => {
    const v = await currentVersion();
    const bad = await request(app)
      .put("/api/site-content/page-texts")
      .send({ page: "nope", texts: {}, updatedAt: v });
    expect(bad.status).toBe(400);
    const badTexts = await request(app)
      .put("/api/site-content/page-texts")
      .send({ page: "media", texts: "hi", updatedAt: v });
    expect(badTexts.status).toBe(400);
  });

  it("strips script tags and event handlers from text fields", async () => {
    const v = await currentVersion();
    const res = await request(app)
      .put("/api/site-content/page-texts")
      .send({
        page: "contact",
        texts: { address: 'HK <script>alert(1)</script> <u onclick="x()">ok</u>' },
        updatedAt: v,
      });
    expect(res.status).toBe(200);
    expect(res.body.pages.contact.address).toBe("HK alert(1) <u>ok</u>");
  });

  it("rejects obfuscated javascript: URLs and keeps https URLs", async () => {
    const v = await currentVersion();
    const res = await request(app)
      .put("/api/site-content/page-texts")
      .send({
        page: "contact",
        texts: {
          maps_embed_src: "java\nscript:alert(1)",
          social: {
            facebook: "javascript:alert(1)",
            instagram: "java\tscript:alert(1)",
            twitter: "https://x.com/hkm",
            youtube: "youtube.com/@hkm",
          },
        },
        updatedAt: v,
      });
    expect(res.status).toBe(200);
    const c = res.body.pages.contact;
    expect(c.maps_embed_src).toBe("");
    expect(c.social.facebook).toBe("");
    expect(c.social.instagram).toBe("");
    expect(c.social.twitter).toBe("https://x.com/hkm");
    expect(c.social.youtube).toMatch(/^https:\/\/youtube\.com\/@hkm/);
  });

  it("deep-merges partial social saves without dropping sibling links", async () => {
    const v1 = await currentVersion();
    const seed = await request(app)
      .put("/api/site-content/page-texts")
      .send({
        page: "contact",
        texts: { social: { facebook: "https://fb.com/a", instagram: "https://insta.com/a" } },
        updatedAt: v1,
      });
    expect(seed.status).toBe(200);
    const partial = await request(app)
      .put("/api/site-content/page-texts")
      .send({
        page: "contact",
        texts: { social: { instagram: "https://insta.com/b" } },
        updatedAt: seed.body.updatedAt,
      });
    expect(partial.status).toBe(200);
    expect(partial.body.pages.contact.social.facebook).toBe("https://fb.com/a");
    expect(partial.body.pages.contact.social.instagram).toBe("https://insta.com/b");
  });

  it("rejects the second of two saves made from the same baseline", async () => {
    const baseline = await currentVersion();
    const [a, b] = await Promise.all([
      request(app)
        .put("/api/site-content/page-texts")
        .send({ page: "media", texts: { intro: "Writer A" }, updatedAt: baseline }),
      request(app)
        .put("/api/site-content/page-texts")
        .send({ page: "media", texts: { intro: "Writer B" }, updatedAt: baseline }),
    ]);
    const statuses = [a.status, b.status].sort();
    expect(statuses).toEqual([200, 409]);
  });
});
