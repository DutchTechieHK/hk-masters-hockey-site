-- Migration: Add deleted_at column to contributions table for soft-delete support
-- Safe to run multiple times (idempotent)

ALTER TABLE contributions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP;
