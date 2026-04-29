-- Migration: Add donor_email column to fundraising table
-- Safe to run multiple times (idempotent)

ALTER TABLE fundraising ADD COLUMN IF NOT EXISTS donor_email TEXT;

-- Backfill: extract emails that were previously embedded in notes as "Email: user@example.com"
UPDATE fundraising
SET donor_email = (
  regexp_match(notes, 'Email:\s*([^\s\n]+)')
)[1]
WHERE donor_email IS NULL
  AND notes IS NOT NULL
  AND notes ~ 'Email:\s*[^\s\n]+';
