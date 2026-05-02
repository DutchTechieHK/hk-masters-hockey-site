-- Migration: Add access_token column to players table for self-service portal
-- Safe to run multiple times (idempotent)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE players ADD COLUMN IF NOT EXISTS access_token TEXT;

-- Backfill tokens for any existing players that don't have one
UPDATE players SET access_token = gen_random_uuid()::text WHERE access_token IS NULL;

-- Enforce uniqueness (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'players_access_token_unique'
  ) THEN
    CREATE UNIQUE INDEX players_access_token_unique ON players(access_token);
  END IF;
END$$;
