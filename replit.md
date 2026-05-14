# HK Masters Hockey — Project Overview

## Architecture

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for a one-page view of the 4 URLs (public site, Decap CMS, player PWA, coach portal), what hosts each one, and what gets rebuilt when you change a folder. Read it first before changing deployment, routing, or anything under `/admin/`.

## What This Is

Two separate web applications managed in a pnpm monorepo:

1. **Public website** (`hk-masters-web`) — the club's public-facing site promoting the MO40 and MO50 teams at the Rotterdam 2026 World Masters Hockey Cup. Live at **hkmastershockey.com**.
2. **Management app** (`hk-masters`) — internal admin tool for managing players, kits, fees, travel, fundraising, sponsors, schedule, logistics, and the Journal moderation queue.
3. **API server** (`api-server`) — shared Express backend used by both apps.

## Deployment Architecture

**IMPORTANT**: There are two separate deployments:

### 1. Public website → Netlify (hkmastershockey.com)
- Code lives here in Replit
- Push to GitHub triggers Netlify build automatically: `git pull -X ours origin main && git push origin main`
- GitHub repo: `https://github.com/DutchTechieHK/hk-masters-hockey-site.git`
- Netlify builds with: `pnpm --filter @workspace/hk-masters-web run build && cp -r artifacts/hk-masters-web/netlify-cms artifacts/hk-masters-web/dist/public/admin` (the second step injects the Decap CMS into `/admin/` on Netlify only)
- Publishes from: `artifacts/hk-masters-web/dist/public`
- Config: `netlify.toml` at project root
- API calls from the public website are **proxied by Netlify** to the Replit deployment (see netlify.toml `[[redirects]]`)

### 2. Management app + API server → Replit deployment
- Replit deployment URL: `https://masters-world-hub.replit.app`
- Contains: management app (hk-masters) and the Express API server
- Deploy via: Replit "Republish" button
- The API at `https://masters-world-hub.replit.app/api/...` is used by the Netlify proxy

### How the proxy works
The `netlify.toml` has a redirect rule: any `/api/*` request to hkmastershockey.com is forwarded server-to-server by Netlify to `https://masters-world-hub.replit.app/api/:splat`. The browser never makes a cross-origin request, so no CORS needed. **Both deployments must be live for the public website to fully function.**

## Stack

- **Monorepo**: pnpm workspaces, Node.js 24
- **Frontend**: React + Vite (both apps), TailwindCSS, Shadcn-style components
- **API**: Express 5, PostgreSQL + Drizzle ORM, Zod validation
- **Public CMS**: Decap CMS — source files in `artifacts/hk-masters-web/netlify-cms/`, copied into `dist/public/admin/` **only by the Netlify build** (so the Replit-hosted PWA never ships the CMS). Content stored in `artifacts/hk-masters-web/src/content/*.json`.
- **Media**: Cloudinary (cloud: `djyvdrhal`, API key: `467487618148569`)
- **Email**: Resend (`RESEND_API_KEY` secret set). Domain hkmastershockey.com not yet verified in Resend — emails fall back to `onboarding@resend.dev`

## Secrets / Environment Variables

- `ADMIN_API_KEY` — protects admin API routes and Journal admin login
- `RESEND_API_KEY` — for sending email notifications on new Journal submissions
- `VITE_CLOUDINARY_UPLOAD_PRESET` — unsigned Cloudinary upload preset for public photo uploads in the Journal contribution form

## Teams

Only **MO40** (Men's Over-40) and **MO50** (Men's Over-50). W35 was fully removed.

## Monorepo Structure

```
artifacts/
├── hk-masters-web/     # Public website (React + Vite, static) — also re-deployed as the Player PWA on Replit
│   ├── src/pages/      # Home, About, Teams, Events, Rotterdam2026, Journal, JournalArticle, Media, Sponsors, Contact
│   ├── src/content/    # CMS-managed JSON content files
│   └── netlify-cms/    # Decap CMS (Netlify-only — copied into dist/public/admin/ by netlify.toml; never shipped on Replit)
├── hk-masters/         # Management app (React + Vite, static)
│   └── src/pages/      # Dashboard, Teams, Players, Kits, Travel, Fees, Fundraising, Sponsors, Schedule, Logistics, Journal (admin moderation)
└── api-server/         # Express API (serves /api/...)
    └── src/
        ├── routes/     # contributions, teams, players, kits, fundraising, logistics, health, adminAuth
        └── middleware/ # adminAuth (requireAdminAccess), adminSession (session tokens)
lib/
├── db/                 # Drizzle ORM schema + migrations
├── api-spec/           # OpenAPI spec
├── api-zod/            # Generated Zod schemas
└── api-client-react/   # Generated React Query hooks (Orval)
```

## Routing (dev)

| Path | Artifact |
|------|----------|
| `/` | Management app (hk-masters) |
| `/hk-masters-web/` | Public website |
| `/api/...` | API server |

## Public Website Pages

1. Home — hero, photo strip, Rotterdam countdown, squad cards, events, sponsors
2. About
3. Teams
4. Events
5. Rotterdam 2026 — squad details, "Next match" widget per team
6. Schedule — fixtures grouped by date, upcoming + results sections (data from `/api/matches`)
7. Journal — community articles/photos feed + contribution form + individual article pages (`/journal/:id`)
8. Media — photo albums (CMS) + "Community Contributions" album auto-populated from approved photo submissions
9. Sponsors
10. Contact
11. My Details (`/my-details/:token`) — player self-service portal: tokenised link from admin opens a pre-filled form to edit travel, passport, emergency contact, kit sizes, dietary and medical info. Admin-locked fields (name, team, shirt#, email, fee) display read-only.

## Journal Feature

Community members can submit articles and photos via the public Journal page. Submissions are reviewed in the Management app's Journal section before appearing publicly.

**Auth model**: Browser login POSTs the `ADMIN_API_KEY` as a password to `POST /api/admin/auth`, receives a session token (stored in localStorage), used as `x-session-token` header. Server-to-server calls use `x-admin-key` header directly.

**API endpoints**:
- `GET /api/contributions/approved` — public; returns approved submissions
- `GET /api/contributions/approved/:id` — public; single approved article
- `GET /api/contributions` — admin only; all submissions with status filter
- `POST /api/contributions` — public; submit a contribution (triggers Resend email)
- `PUT /api/contributions/:id` — admin only; approve/decline
- `POST /api/admin/auth` — exchange password for session token
- `DELETE /api/admin/auth` — logout
- `GET /api/admin/auth` — check session validity

**Player self-service endpoints** (no auth, token in URL):
- `GET /api/players/self/:token` — returns the SelfPlayer view (no fee data) plus locked context (name/team/shirt/email)
- `PATCH /api/players/self/:token` — updates only the whitelisted editable fields; ignores name/teamId/shirtNumber/email/feePaid attempts
- `players.access_token` (text, unique, nullable) backfilled with `gen_random_uuid()`; new players get one at creation time

## Management App Pages

1. Dashboard — stats, deadlines
2. Teams — MO40 & MO50 with roster
3. Players — full player profiles with kit sizes, passport, fees, flights; "Copy self-service link" button per row generates `${VITE_PUBLIC_SITE_URL}/my-details/<token>`
4. Kits — per-player kit orders with status tracking
5. Fundraising — sponsor/donor records
6. Logistics — Kanban board
7. Journal — admin moderation (login required, session-based)
8. Schedule — match fixtures CRUD (login required); per-team grouping; conditional score inputs based on status
9. Announcements — two tabs: "In-app feed" (pinnable CRUD board for players), "Email players" (bulk email composer with audience selector, recipient preview, confirmation modal, send history table)

## Database Tables

- `teams`, `players`, `kits`, `fundraising`, `logistics`
- `contributions` — id, title, author_name, author_email, content_type (article|photo|both), article_body, photo_urls (text[]), status (pending|approved|declined), admin_note, created_at, reviewed_at
- `matches` — id, team_id (FK), opponent, kickoff_at, venue, our_score (nullable), their_score (nullable), status (scheduled|in_progress|final|cancelled), notes, created_at
- `email_blasts` — id, subject, body, audience_type, team_ids (JSON), player_ids (JSON), recipient_count, sent_count, failed_count, sent_by_email, sent_at

## Bulk Email

Admin can send emails to all players, by squad, or selected individuals from Announcements → "Email players" tab.
- Endpoint: `POST /api/players/send-bulk-email` (requireAdminAccess) — body: `{audienceType, teamIds?, playerIds?, subject, body}`
- History: `GET /api/players/email-blasts` — returns last 50 blasts with sent/failed counts
- Email function: `sendBulkAnnouncementEmail()` in `artifacts/api-server/src/utils/email.ts`
- Schema: `lib/db/src/schema/email-blasts.ts`, Zod: `lib/api-zod/src/email-blasts.ts`

## Rotterdam 2026

- Dates: 22 July – 1 August 2026
- "Rotterdam mode" on homepage active until 15 Sep 2026
- Rotterdam content managed via `src/content/rotterdam.json`
