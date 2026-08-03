---
name: Hosting topology
description: Where the public site vs admin/API actually run — Netlify still hosts the public site.
---

# Hosting topology (per user, Aug 2026)

- Public site **hkmastershockey.com is still hosted on Netlify** — the user publishes through Replit, but Netlify serves the public site (builds from the repo).
- Admin portal + API live at **app.hkmastershockey.com** on Replit's deployment.
- **Why it matters:** "republish via Replit" statements about the public site may be incomplete — public-site changes reach visitors via the Netlify build pipeline. Legacy Netlify CMS (`artifacts/hk-masters-web/netlify-cms/config.yml`, git-gateway backend) may therefore not be fully dead; treat with care before declaring it retired or deleting it.
- **How to apply:** when explaining how changes go live or debugging "published but not visible" issues on the public site, account for the Netlify hosting/build step, not just Replit publish.
