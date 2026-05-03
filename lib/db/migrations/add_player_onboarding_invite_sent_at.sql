ALTER TABLE players
  ADD COLUMN IF NOT EXISTS onboarding_invite_sent_at TIMESTAMP;
