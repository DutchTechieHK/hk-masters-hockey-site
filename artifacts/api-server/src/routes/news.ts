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
  // Refresh MUST be secret-verified. If no secret is configured, refuse —
  // an open invalidation endpoint is an easy DoS vector.
  if (!expected) {
    res.status(503).json({ error: "Refresh endpoint not configured" });
    return;
  }
  // Header-only — never accept secrets via query string (they leak into
  // access logs, browser history, and Referer headers).
  const provided = req.headers["x-webhook-secret"];
  const providedStr = typeof provided === "string" ? provided : "";
  if (providedStr !== expected) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  clearNewsCache();
  res.json({ ok: true, refreshedAt: new Date().toISOString() });
});

// Only proxy Notion-hosted images. Exact host match, https only, no redirects,
// content-type allowlist, and bounded body size to mitigate SSRF / DoS.
const ALLOWED_IMAGE_HOSTS = new Set([
  "prod-files-secure.s3.us-west-2.amazonaws.com",
  "file.notion.so",
  "s3.us-west-2.amazonaws.com",
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const IMAGE_FETCH_TIMEOUT_MS = 10_000;

router.get("/image", async (req, res) => {
  const url = typeof req.query.url === "string" ? req.query.url : "";
  if (!url) {
    res.status(400).json({ error: "url required" });
    return;
  }
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid url" });
    return;
  }
  if (parsed.protocol !== "https:") {
    res.status(400).json({ error: "Only https URLs are allowed" });
    return;
  }
  if (!ALLOWED_IMAGE_HOSTS.has(parsed.hostname)) {
    res.status(400).json({ error: "Host not allowed" });
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
  try {
    const upstream = await fetch(parsed.toString(), {
      redirect: "manual", // do not follow redirects — prevents SSRF via redirect to internal targets
      signal: controller.signal,
    });
    // Reject any redirect — caller must give us the final URL.
    if (upstream.status >= 300 && upstream.status < 400) {
      res.status(502).json({ error: "Upstream redirected; refusing to follow" });
      return;
    }
    if (!upstream.ok) {
      res.status(502).json({ error: "Upstream image fetch failed" });
      return;
    }
    const contentType = (upstream.headers.get("content-type") || "").toLowerCase();
    if (!contentType.startsWith("image/")) {
      res.status(502).json({ error: "Upstream response is not an image" });
      return;
    }
    const contentLengthHeader = upstream.headers.get("content-length");
    if (contentLengthHeader && Number(contentLengthHeader) > MAX_IMAGE_BYTES) {
      res.status(502).json({ error: "Upstream image too large" });
      return;
    }

    // Stream-read with a hard byte cap.
    const reader = upstream.body?.getReader();
    if (!reader) {
      res.status(502).json({ error: "Upstream image had no body" });
      return;
    }
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        received += value.byteLength;
        if (received > MAX_IMAGE_BYTES) {
          await reader.cancel();
          res.status(502).json({ error: "Upstream image too large" });
          return;
        }
        chunks.push(value);
      }
    }
    const buffer = Buffer.concat(chunks.map((c) => Buffer.from(c)));
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=86400");
    res.send(buffer);
  } catch (err) {
    console.error("[news] image proxy failed:", err);
    if (!res.headersSent) {
      res.status(502).json({ error: "Image proxy failed" });
    }
  } finally {
    clearTimeout(timer);
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
