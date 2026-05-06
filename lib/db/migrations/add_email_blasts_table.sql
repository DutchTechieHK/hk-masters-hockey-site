-- Adds the email_blasts table to log bulk email sends from the admin panel.
-- Each row records who was targeted, the subject/body, and sent/failed counts.

CREATE TABLE IF NOT EXISTS email_blasts (
  id SERIAL PRIMARY KEY,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  audience_type TEXT NOT NULL,
  team_ids TEXT,
  player_ids TEXT,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  sent_by_email TEXT,
  sent_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS email_blasts_sent_at_idx
  ON email_blasts(sent_at DESC);
