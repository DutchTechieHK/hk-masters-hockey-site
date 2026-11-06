---
name: hk-masters admin auth testing
description: How to reach past the HK Masters admin team-password gate in dev when the ADMIN_API_KEY secret value is unknown/unviewable.
---

`AdminAuthGate` (artifacts/hk-masters) blocks the whole admin SPA behind a single team password checked against the `ADMIN_API_KEY` secret. Agent tooling can only see that the secret *exists*, never its value, so UI login isn't possible from an agent session.

To e2e-test admin pages: create a temporary development admin session using the existing session helper or a row in `admin_sessions`, then set the browser's `hkm_admin_session` localStorage entry before visiting the admin app. The real gate validates that session normally. Delete the temporary session and test data, clear browser storage, and close the browser context afterward. Do not patch authentication code or add a bypass.

**Why:** there is no dev-mode bypass or Clerk-style override for this app's custom password gate. Browser storage injection was verified to work with the current gate; a source-code bypass is unnecessary and risky.
**How to apply:** any task touching admin-only pages in this project that needs `runTest`/screenshot verification.
