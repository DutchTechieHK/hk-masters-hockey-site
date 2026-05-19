import { Router } from "express";
import {
  isNotionConfigured,
  getCachedList,
  getCachedPost,
  clearNewsCache,
} from "../lib/notionNews";

const router = Router();

router.get("/", async (_req, res) => {
  if (!isNotionConfigured()) {
    res.json({ configured: false, posts: [] });
    return;
  }
  try {
    const posts = await getCachedList();
    res.set("Cache-Control", "public, max-age=60");
    res.json({ configured: true, posts });
  } catch (err) {
    console.error("[news] list failed:", err);
    res.status(503).json({ configured: true, posts: [], error: "Temporarily unavailable" });
  }
});

router.post("/refresh", (req, res) => {
  const expected = process.env.NOTION_WEBHOOK_SECRET;
  if (expected) {
    const provided =
      (req.headers["x-webhook-secret"] as string | undefined) ||
      (req.query.secret as string | undefined);
    if (provided !== expected) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
  }
  clearNewsCache();
  res.json({ ok: true, refreshedAt: new Date().toISOString() });
});

router.get("/image", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!url) {
    res.status(400).json({ error: "url required" });
    return;
  }
  // Only proxy Notion-hosted images (signed S3 URLs Notion serves)
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }
  const allowedHosts = [
    "prod-files-secure.s3.us-west-2.amazonaws.com",
    "s3.us-west-2.amazonaws.com",
    "file.notion.so",
    "www.notion.so",
    "images.unsplash.com",
  ];
  if (!allowedHosts.some((h) => parsed.hostname === h || parsed.hostname.endsWith("." + h))) {
    res.status(400).json({ error: "Host not allowed" });
    return;
  }
  try {
    const upstream = await fetch(url);
    if (!upstream.ok) {
      res.status(502).json({ error: "Upstream image fetch failed" });
      return;
    }
    const contentType = upstream.headers.get("content-type") || "image/jpeg";
    const buffer = Buffer.from(await upstream.arrayBuffer());
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.send(buffer);
  } catch (err) {
    console.error("[news] image proxy failed:", err);
    res.status(502).json({ error: "Image proxy failed" });
  }
});

router.get("/:slug", async (req, res) => {
  if (!isNotionConfigured()) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const post = await getCachedPost(req.params.slug);
    if (!post) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.set("Cache-Control", "public, max-age=60");
    res.json(post);
  } catch (err) {
    console.error(`[news] post fetch failed for "${req.params.slug}":`, err);
    res.status(503).json({ error: "Temporarily unavailable" });
  }
});

export default router;
