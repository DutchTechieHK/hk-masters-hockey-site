---
name: Prod contribution writes send emails
description: Why bulk-updating journal contributions via the admin PUT endpoint is unsafe in production
---

The admin contributions update endpoint (PUT /api/contributions/:id) always sends an approval/decline decision email to the author whenever status is approved or declined — which the body requires. Since prod DB is read-only from the workspace, there is currently no email-free way to bulk-rewrite contribution fields (e.g. photo URLs) in production.

**Why:** rewriting photo_urls for already-approved articles via PUT would re-email every contributor.

**How to apply:** for prod data fixes on contributions, add a dedicated no-side-effect admin endpoint first (see follow-up on migrating prod journal photos), or accept the emails knowingly. Sponsors PUT has no such side effect and is safe.
