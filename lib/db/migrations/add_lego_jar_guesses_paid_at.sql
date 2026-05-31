-- Migration: Add paid_at column to lego_jar_guesses
-- Stamped when an admin confirms a guess's payment was received.
-- Safe to run multiple times (idempotent)

ALTER TABLE lego_jar_guesses ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
