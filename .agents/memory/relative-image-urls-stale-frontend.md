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
