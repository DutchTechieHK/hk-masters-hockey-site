---
name: Public site service-worker navigation denylist
description: Why cross-artifact links 404 only in production, and the denylist rule that prevents it
---

The public site (`hk-masters-web`) registers a workbox service worker at scope `/` (`artifacts/hk-masters-web/src/sw.ts`). Its `NavigationRoute` serves the public site's app shell (`index.html`) for ALL navigations not in its `denylist`.

**Rule:** every sibling artifact that is path-routed under the same origin (e.g. `/admin/`, `/admin-video-series/`, `/admin-tutorial-videos/`, `/pwa-install-video/`, `/api/`) MUST be added to the SW `NavigationRoute` denylist. If a path is missing, the SW hijacks navigations to it and serves the public-site shell → that artifact's route renders the public 404.

**Why:** the SW intercepts client navigations (link clicks, window.open) but a hard refresh bypasses the SW. So a missing denylist entry shows up as: hard-refresh works, normal click 404s. The SW is disabled in dev, so the bug is invisible in dev and only appears in the deployed build — reproduces identically across browsers/devices (not a per-browser cache issue).

**How to apply:** when adding a new path-routed artifact, add its base path regex to the denylist in `sw.ts` and re-publish the public site. The SW uses `skipWaiting()` + `clients.claim()`, so the new SW auto-updates on next visit without manual cache clearing.
