# HK Masters Hockey — Architecture Map

One-page reference for how the four products tie together. Read this before changing anything that touches deployment, routing, or `/admin/`.

## The 4 URLs

| # | URL | Purpose | Hosted by | Source folder |
|---|-----|---------|-----------|---------------|
| 1 | `hkmastershockey.com/` | Public website (everyone) | **Netlify** (auto-builds from GitHub `main`) | `artifacts/hk-masters-web/` |
| 2 | `hkmastershockey.com/admin/` | **Decap / Netlify CMS** — edit website content (text, photos, events) | **Netlify** (injected into the build) | `artifacts/hk-masters-web/netlify-cms/` |
| 3 | `app.hkmastershockey.com/` | **Player PWA** — mobile portal for players | **Replit** | `artifacts/hk-masters-web/` (same source as #1) |
| 4 | `app.hkmastershockey.com/admin/` | **Coach / Manager / Admin portal** | **Replit** | `artifacts/hk-masters/` |

Plus the backend everyone shares:

- **API server** — `app.hkmastershockey.com/api/` (Replit, source `artifacts/api-server/`).
  Netlify forwards `hkmastershockey.com/api/*` to this same server, so the public website and the player PWA hit the same database.

## Diagram

```
                        ┌─────────────────────────────┐
                        │  artifacts/api-server/      │
                        │  (Express + Postgres)       │
                        │  Replit: /api/              │
                        └──────────────┬──────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
            ▼                          ▼                          ▼
   ┌──────────────────┐   ┌────────────────────────┐   ┌────────────────────┐
   │ NETLIFY          │   │ REPLIT                 │   │ REPLIT             │
   │ hkmastershockey  │   │ app.hkmastershockey    │   │ app.hkmastershockey│
   │     .com/        │   │     .com/              │   │     .com/admin/    │
   │                  │   │                        │   │                    │
   │ Public website   │   │ Player PWA             │   │ Coach / Manager    │
   │ (#1)             │   │ (#3)                   │   │ portal (#4)        │
   │                  │   │                        │   │                    │
   │ + /admin/ →      │   │  same code as #1       │   │  artifacts/        │
   │   Decap CMS (#2) │   │  artifacts/            │   │   hk-masters/      │
   │                  │   │   hk-masters-web/      │   │                    │
   └──────────────────┘   └────────────────────────┘   └────────────────────┘
```

## Where the `/admin/` URLs come from (and why they don't collide anymore)

There are **two different `/admin/` URLs** — they look identical but live on different hosts and are completely different products:

- `hkmastershockey.com/admin/` → **Decap CMS** (for editing website content). The CMS files live in `artifacts/hk-masters-web/netlify-cms/` and are copied into `dist/public/admin/` **only by the Netlify build** (see `netlify.toml`'s build command).
- `app.hkmastershockey.com/admin/` → **Coach portal**. Built from `artifacts/hk-masters/` and registered with Replit at the `/admin/` path (see `artifacts/hk-masters/.replit-artifact/artifact.toml`).

Because the CMS files are no longer in `artifacts/hk-masters-web/public/`, the Replit build of the public PWA never ships them, so there is no path collision and `app.hkmastershockey.com/admin/` reliably loads the coach portal.

A `/admin → /admin/ 301` redirect in `netlify.toml` ensures the CMS works whether or not you type the trailing slash.

## "When you change X, this gets rebuilt" cheat-sheet

| You edit… | Rebuilds & redeploys… | Triggered by |
|-----------|----------------------|--------------|
| `artifacts/hk-masters-web/src/**` | Public website (#1) **and** Player PWA (#3) — same code, two deployments | Push to GitHub `main` (Netlify) + Replit Republish |
| `artifacts/hk-masters-web/netlify-cms/**` | Netlify CMS (#2) only | Push to GitHub `main` (Netlify) |
| `artifacts/hk-masters-web/src/content/*.json` | Public website content (#1) — what coaches edit through the CMS | Push to GitHub `main` (Netlify only — content isn't shown in the PWA) |
| `artifacts/hk-masters/src/**` | Coach portal (#4) only | Replit Republish |
| `artifacts/api-server/src/**` | API server — affects #1, #3, #4 | Replit Republish |
| `netlify.toml` | Netlify build + redirects | Push to GitHub `main` |
| `artifacts/*/.replit-artifact/artifact.toml` | Replit deployment routing | Replit Republish |

## Daily workflow for the club

- **Coaches & managers** log in at `app.hkmastershockey.com/admin/` to manage teams, players, events, fees, fundraising, etc.
- **Players** open `app.hkmastershockey.com/` (or install it as a PWA) to see the dashboard, RSVP to events, etc.
- **Anyone** can browse `hkmastershockey.com/` for public info.
- **Content editors** (website content only — text, photos, events page, etc.) log in at `hkmastershockey.com/admin/` (Decap CMS, GitHub-backed).

## Two republishes for one change

If you change anything in `artifacts/hk-masters-web/src/` you must **publish twice**:
1. Push to GitHub → Netlify rebuilds the public website.
2. Click **Republish** in Replit → updates the player PWA at `app.hkmastershockey.com/`.

The coach portal (`artifacts/hk-masters/`) and the API server only need a Replit Republish.
