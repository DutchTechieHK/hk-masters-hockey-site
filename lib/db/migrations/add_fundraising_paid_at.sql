-- Migration: Add paid_at column to fundraising table
-- Safe to run multiple times (idempotent)

ALTER TABLE fundraising ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;
