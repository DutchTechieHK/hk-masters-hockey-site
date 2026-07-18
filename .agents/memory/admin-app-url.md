---
name: Admin app URL & custom domain
description: The correct production URL for the admin portal and why it must be split across dev/prod env vars.
---

The admin portal (`artifacts/hk-masters`) is documented in `docs/ARCHITECTURE.md`:

- **Production**: `https://app.hkmastershockey.com/admin/`
- **Dev/staging**: `https://masters-world-hub.replit.app/admin/`

The base path is `/admin/` in both environments (confirmed by dev workflow log showing `http://localhost:80/admin/`).

**Why:** The `ADMIN_APP_URL` env var drives all admin deep-links in notification emails (players list, journal, lego-jar). If set to the wrong domain or wrong path, email buttons 404.

**How to apply:**
- `ADMIN_APP_URL` must be set in **development** and **production** environments separately — NOT in **shared** (shared blocks per-env overrides).
- Development: `https://masters-world-hub.replit.app/admin`
- Production: `https://app.hkmastershockey.com/admin`
- Never guess the path — check the dev workflow log (`http://localhost:80/<base>/`) or `docs/ARCHITECTURE.md` to confirm.

**The `/hk-masters` trap:** The artifact ID is `artifacts/hk-masters` and Vite's BASE_PATH env is also used internally, but the *served path* is `/admin/` — these are different things. Do not confuse artifact ID with the URL path.
