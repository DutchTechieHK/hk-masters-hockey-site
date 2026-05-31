-- Migration: Add is_website flag to lego_jar_rounds
-- Marks the permanent "Website" designation that online submissions are
-- attributed to (kept separate from physical jar holders).
-- Safe to run multiple times (idempotent)

ALTER TABLE lego_jar_rounds ADD COLUMN IF NOT EXISTS is_website BOOLEAN NOT NULL DEFAULT false;
