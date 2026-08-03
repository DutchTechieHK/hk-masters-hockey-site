---
name: Hosting topology
description: Where the public site vs admin/API actually run — Netlify still hosts the public site.
---

# Hosting topology (verified Aug 2026)

- Publish flow: Replit publish deploys the API/admin (masters-world-hub.replit.app / app.hkmastershockey.com) AND pushes a "Published your App" commit to GitHub (origin DutchTechieHK/hk-masters-hockey-site); **Netlify builds from GitHub and serves the public site hkmastershockey.com** (see root `netlify.toml`: publishes hk-masters-web dist, proxies /api/* and sitemap to the replit.app API, VITE_API_BASE_URL points at replit.app).
- Legacy **Netlify CMS is still deployed at hkmastershockey.com/admin/** (build copies netlify-cms/ into dist/admin; git-gateway backend commits straight to GitHub main). CMS edits still go live via Netlify rebuild — but they bypass the Replit workspace, so the next Replit publish push can conflict with or overwrite them. Two-writer risk until CMS is retired.
- **How to apply:** for "published but not visible" issues on the public site, check GitHub push + Netlify build, not just Replit publish. Public-site prod fetches the API on the replit.app host, so request-host-derived absolute URLs resolve to the replit.app origin (fine — same API serves the images).
