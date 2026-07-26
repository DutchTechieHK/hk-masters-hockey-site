---
name: Relative image URLs break stale deployed frontends
description: Storing relative /api/... image URLs in the DB breaks the live site until the frontend that prefixes them is published.
---

# Relative image URLs break stale deployed frontends

Content rows (site_content, sponsors, news) store image URLs as relative `/api/...` paths. The public frontend prefixes those with API_BASE at render time — but only in builds that have that logic.

**Why:** Migrating prod photo URLs from absolute Cloudinary links to relative object paths broke every image on the live site, because the published frontend predated the API_BASE-prefixing code: the browser resolved `/api/...` against the public domain, which returns SPA HTML, not images.

**How to apply:**
- Any task that rewrites stored media URLs to relative paths must land together with (or after) a publish of the frontend that resolves them.
- Emergency fix without publishing: rewrite the stored URLs to absolute `https://app.hkmastershockey.com/api/...` via the deployed API with x-admin-key — absolute URLs work in both old and new builds (the prefix logic only fires on `startsWith("/")`).
- As of July 2026, the published public-site build prefixes relative URLs everywhere (site-content, sponsors, news, journal), so relative `/api/...` paths in prod are safe; verified sponsor/news/journal images load live. To re-verify quickly: grep the deployed bundle for `startsWith("/")` prefix helpers.
- As of 26 Jul 2026, all stored media URLs (site-content, sponsors, news) are absolute `https://app.hkmastershockey.com/api/...`, and the public-site vite config only injects the Replit dev-domain API base when `command === "serve"` — builds can no longer bake a `.replit.app` domain into the bundle.
- **News PATCH trap:** the deployed news update endpoint recomputes `publishedAt` from the `status` field on every PATCH — omitting `status` on a published post NULLs its publish date. Always send `status: "published"` when patching published posts; the only recovery via API is a draft→published toggle, which resets the date to now.
