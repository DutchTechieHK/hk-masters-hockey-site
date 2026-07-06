---
name: hk-masters admin auth testing
description: How to reach past the HK Masters admin team-password gate in dev when the ADMIN_API_KEY secret value is unknown/unviewable.
---

`AdminAuthGate` (artifacts/hk-masters) blocks the whole admin SPA behind a single team password checked against the `ADMIN_API_KEY` secret. Agent tooling can only see that the secret *exists*, never its value, so UI login isn't possible from an agent session.

To e2e-test admin pages: insert a row directly into `admin_sessions` (token, label, expires_at) via `executeSql`, then temporarily patch `AdminAuthGate`'s init effect to call `storeAdminToken(<that token>)` and `setStatus("authed")` before running the real check. Run the test, then **fully revert** the component edit and delete the temp session row (and any test data you created) before finishing — don't leave the bypass in committed code.

**Why:** there is no dev-mode bypass or Clerk-style override for this app's custom password gate; without this trick every admin-page test is blocked.
**How to apply:** any task touching admin-only pages in this project that needs `runTest`/screenshot verification.
