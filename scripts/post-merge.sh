#!/bin/bash
set -e
pnpm install --frozen-lockfile

# Run base explicit SQL migrations first so compatibility migrations can safely
# reference their tables on both established and newly reconciled environments.
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_contributions_slug.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_fundraising_donor_email.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_contributions_deleted_at.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_players_access_token_unique_constraint.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_player_onboarding_invite_sent_at.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_player_auth_tables.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_events_table.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_event_rsvps_table.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_announcements_table.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_team_public_fields.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_fundraising_payment_method.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_lego_jar_tables.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_sponsors_contribution_amount.sql

# Add and populate archive boundaries before the final schema sync.
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_operational_scopes_compat.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_match_event_operational_scopes.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_world_cup_player_snapshots.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" -f lib/db/migrations/add_world_cup_team_snapshots.sql
psql -v ON_ERROR_STOP=1 "$DATABASE_URL" <<'SQL'
DO $$
DECLARE
  null_matches bigint;
  null_events bigint;
  player_count bigint;
  snapshot_count bigint;
  active_rotterdam_team_count bigint;
  team_snapshot_count bigint;
BEGIN
  SELECT count(*) INTO null_matches FROM matches WHERE operational_scope IS NULL;
  SELECT count(*) INTO null_events FROM events WHERE operational_scope IS NULL;
  SELECT count(*) INTO player_count FROM players;
  SELECT count(*) INTO snapshot_count FROM world_cup_player_snapshots;
  SELECT count(DISTINCT pp.team_id) INTO active_rotterdam_team_count
    FROM player_participations pp JOIN seasons s ON s.id = pp.season_id
    WHERE s.slug = 'rotterdam-2026' AND pp.participation_status = 'active' AND pp.team_id IS NOT NULL;
  SELECT count(*) INTO team_snapshot_count FROM world_cup_team_snapshots;
  IF null_matches <> 0 OR null_events <> 0 THEN
    RAISE EXCEPTION 'Operational scope reconciliation failed: NULL matches=%, events=%', null_matches, null_events;
  END IF;
  IF snapshot_count <> player_count THEN
    RAISE EXCEPTION 'Player snapshot reconciliation failed: snapshots=%, players=%', snapshot_count, player_count;
  END IF;
  IF team_snapshot_count <> active_rotterdam_team_count THEN
    RAISE EXCEPTION 'Team snapshot reconciliation failed: snapshots=%, active Rotterdam teams=%', team_snapshot_count, active_rotterdam_team_count;
  END IF;
END $$;
SELECT 'announcements' AS table_name, operational_scope, count(*) FROM announcements GROUP BY operational_scope ORDER BY operational_scope;
SELECT 'news_posts' AS table_name, operational_scope, count(*) FROM news_posts GROUP BY operational_scope ORDER BY operational_scope;
SELECT 'polls' AS table_name, operational_scope, count(*) FROM polls GROUP BY operational_scope ORDER BY operational_scope;
SELECT 'email_blasts' AS table_name, operational_scope, count(*) FROM email_blasts GROUP BY operational_scope ORDER BY operational_scope;
SELECT 'matches' AS table_name, operational_scope, count(*) FROM matches GROUP BY operational_scope ORDER BY operational_scope;
SELECT 'events' AS table_name, operational_scope, count(*) FROM events GROUP BY operational_scope ORDER BY operational_scope;
SELECT 'player_snapshots' AS table_name, NULL AS operational_scope, count(*) AS total FROM world_cup_player_snapshots;
SELECT 'players' AS table_name, NULL AS operational_scope, count(*) AS total FROM players;
SELECT 'rotterdam_team_snapshots' AS table_name, NULL AS operational_scope, count(*) AS total FROM world_cup_team_snapshots;
SELECT 'rotterdam_active_teams' AS table_name, NULL AS operational_scope, count(DISTINCT pp.team_id) AS total
  FROM player_participations pp JOIN seasons s ON s.id = pp.season_id
  WHERE s.slug = 'rotterdam-2026' AND pp.participation_status = 'active' AND pp.team_id IS NOT NULL;
SQL

# Sync any remaining schema changes
pnpm --filter db push-force
