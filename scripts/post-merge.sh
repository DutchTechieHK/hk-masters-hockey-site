#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Run explicit SQL migrations (idempotent)
psql "$DATABASE_URL" -f lib/db/migrations/add_contributions_slug.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_fundraising_donor_email.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_contributions_deleted_at.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_players_access_token_unique_constraint.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_player_onboarding_invite_sent_at.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_player_auth_tables.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_events_table.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_event_rsvps_table.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_announcements_table.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_team_public_fields.sql

# Sync any remaining schema changes
pnpm --filter db push-force
