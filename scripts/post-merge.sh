#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Run explicit SQL migrations (idempotent)
psql "$DATABASE_URL" -f lib/db/migrations/add_contributions_slug.sql
psql "$DATABASE_URL" -f lib/db/migrations/add_fundraising_donor_email.sql

# Sync any remaining schema changes
pnpm --filter db push-force
