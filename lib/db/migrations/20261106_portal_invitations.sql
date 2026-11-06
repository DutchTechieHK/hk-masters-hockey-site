-- Additive delivery metadata for idempotent selected portal invitations.
ALTER TABLE email_blasts ADD COLUMN IF NOT EXISTS delivery_summary jsonb;
