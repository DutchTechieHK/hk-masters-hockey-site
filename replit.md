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

1. **Dashboard** - Stats overview: total players, fees paid vs outstanding, funds raised vs HK$300,000 target, clickable key deadlines panel
2. **Teams** - 3 teams with manager + assistant manager, WhatsApp link, target player count, kit notes; clickable cards open team detail with full player roster
3. **Players** - Full player list with shirt number, team, position, nationality, fee status, passport expiry (green/red color indicator). Form includes DOB, nationality, passport details, emergency contact, flight arrival/departure, accommodation preferences, kit sizes, payment tracking, dietary requirements, medical notes
4. **Kits & Clothing** - Kit orders per player linked to categories (Playing Kit, Training Kit, Travel/Leisure Kit, Accessories); tracks item name, size, quantity, unit cost, supplier, and order status (Not Ordered → Ordered → Received → Distributed); summary view shows total per category and kit budget
5. **Fundraising** - Sponsor/donor tracking: name, amounts pledged/received, date, team, status
6. **Logistics** - Kanban board with 22 pre-built tasks across 5 categories: Travel, Accommodation, Tournament, Kits & Equipment, Finance; filterable by category

## Database Schema

Tables in PostgreSQL:
- `teams` - id, name, category, manager_name, manager_email, manager_phone, assistant_manager_name, assistant_manager_contact, whatsapp_group_link, target_player_count, kit_notes, notes
- `players` - Full profile: team_id, name, shirt_number, email, phone, position, date_of_birth, nationality, passport_number, passport_expiry, emergency_contact_name, emergency_contact_phone, flight_arrival_date_time, flight_departure_date_time, arrival_city, room_sharing_preference, room_sharing_with, shirt_size, shorts_size, jacket_size, travel_dates, fee_paid, payment_amount_due, payment_amount_paid, payment_date, dietary_requirements, medical_notes, notes
- `kits` - player_id, item_type (playing_kit/training_kit/travel_leisure_kit/accessories), item_name, size, quantity, unit_cost, supplier, order_status (not_ordered/ordered/received/distributed), notes
- `fundraising` - Sponsor/donor records optionally linked to a team
- `logistics` - Task items: title, category (travel/accommodation/tournament/kits_equipment/finance/other), status (todo/in_progress/done), due_date, assigned_to, notes, team_id

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
