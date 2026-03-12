# HK 2026 Masters World Cup

## Overview

Full-stack web application for managing 3 Hong Kong field hockey teams travelling to the Masters World Cup in Rotterdam, Netherlands, July/August 2026. The three teams are: Women 35+, Men 40+, Men 50+.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite (artifacts/hk-masters)
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **UI**: TailwindCSS, Shadcn-style components, Recharts, React Hook Form, Framer Motion

## Structure

```text
artifacts-monorepo/
├── artifacts/
│   ├── api-server/         # Express API server
│   └── hk-masters/         # React + Vite frontend (served at /)
├── lib/
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts
└── pnpm-workspace.yaml     # pnpm workspace config
```

## Pages / Sections

1. **Dashboard** - Stats overview: total players per team, fees paid vs outstanding, funds raised vs target, upcoming deadlines
2. **Teams** - List of 3 teams with name, category, manager name, email, phone
3. **Players** - Full player list with name, team, email, phone, position, sizes, travel dates, fee paid, passport expiry, dietary requirements, notes
4. **Kits & Clothing** - Kit orders per player: item type, size, quantity, unit cost, total cost, order status
5. **Fundraising** - Sponsor/donor tracking: name, amounts pledged/received, date, team, status
6. **Logistics** - Task/checklist board for travel, accommodation, flights, visas, insurance, tournament registration

## Database Schema

Tables in PostgreSQL:
- `teams` - Team details (id, name, category, manager_name, manager_email, manager_phone, notes)
- `players` - Player records linked to teams
- `kits` - Kit orders linked to players
- `fundraising` - Sponsor/donor records optionally linked to a team
- `logistics` - Task checklist items optionally linked to a team

## API Routes

All routes under `/api`:
- GET/POST `/teams`, PUT/DELETE `/teams/:id`
- GET/POST `/players` (filterable by teamId), PUT/DELETE `/players/:id`
- GET/POST `/kits` (filterable by playerId), PUT/DELETE `/kits/:id`
- GET/POST `/fundraising`, PUT/DELETE `/fundraising/:id`
- GET/POST `/logistics` (filterable by teamId), PUT/DELETE `/logistics/:id`
- GET `/dashboard` - Aggregated stats

## Design

- Dark green (#1a5c35 range) and white colour scheme
- Responsive and mobile-friendly with hamburger menu on mobile
- Clean top navigation bar

## Seeded Data

- 3 teams: Women 35+, Men 40+, Men 50+
- 7 initial logistics tasks covering flights, accommodation, tournament registration, insurance, visas
