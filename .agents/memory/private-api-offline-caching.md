---
name: Private API offline caching
description: Why HTTP cache headers alone do not protect private player data from the installed portal's offline cache.
---

For sensitive authenticated responses, explicitly bypass the portal service worker's shared API cache as well as setting private/no-store HTTP headers. Purge prior entries when changing an endpoint from cached to private.

**Why:** Workbox strategies with a status-only CacheableResponsePlugin can cache successful responses despite HTTP no-store headers. A shared URL-based offline cache can otherwise serve one player's previously authorized data without rechecking the next viewer's session or squad.

**How to apply:** When adding squad-only names or other private player API data, check the installed-app service worker's route matching and activation cleanup. Do not assume fetch cache:no-store or server headers control Workbox Cache Storage. Keep failed refreshes explicit rather than presenting old private data as current.
