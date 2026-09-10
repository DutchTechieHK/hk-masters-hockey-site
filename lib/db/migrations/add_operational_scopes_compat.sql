-- Compatibility migration for campaign scoping. Safe to apply repeatedly.
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS operational_scope text;
ALTER TABLE news_posts ADD COLUMN IF NOT EXISTS operational_scope text;
ALTER TABLE polls ADD COLUMN IF NOT EXISTS operational_scope text;
ALTER TABLE email_blasts ADD COLUMN IF NOT EXISTS operational_scope text;

UPDATE announcements SET operational_scope = 'world_cup_2026' WHERE operational_scope IS NULL;
UPDATE news_posts SET operational_scope = 'world_cup_2026' WHERE operational_scope IS NULL;
UPDATE polls SET operational_scope = 'world_cup_2026' WHERE operational_scope IS NULL;
UPDATE email_blasts SET operational_scope = 'world_cup_2026' WHERE operational_scope IS NULL;

ALTER TABLE announcements ALTER COLUMN operational_scope SET DEFAULT 'world_cup_2026';
ALTER TABLE news_posts ALTER COLUMN operational_scope SET DEFAULT 'world_cup_2026';
ALTER TABLE polls ALTER COLUMN operational_scope SET DEFAULT 'world_cup_2026';
ALTER TABLE email_blasts ALTER COLUMN operational_scope SET DEFAULT 'world_cup_2026';
ALTER TABLE announcements ALTER COLUMN operational_scope SET NOT NULL;
ALTER TABLE news_posts ALTER COLUMN operational_scope SET NOT NULL;
ALTER TABLE polls ALTER COLUMN operational_scope SET NOT NULL;
ALTER TABLE email_blasts ALTER COLUMN operational_scope SET NOT NULL;

CREATE INDEX IF NOT EXISTS announcements_operational_scope_idx ON announcements (operational_scope);
CREATE INDEX IF NOT EXISTS news_posts_operational_scope_idx ON news_posts (operational_scope);
CREATE INDEX IF NOT EXISTS polls_operational_scope_idx ON polls (operational_scope);
CREATE INDEX IF NOT EXISTS email_blasts_operational_scope_idx ON email_blasts (operational_scope);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'announcements_operational_scope_check') THEN
    ALTER TABLE announcements ADD CONSTRAINT announcements_operational_scope_check CHECK (operational_scope IN ('local_2026_27', 'world_cup_2026'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'news_posts_operational_scope_check') THEN
    ALTER TABLE news_posts ADD CONSTRAINT news_posts_operational_scope_check CHECK (operational_scope IN ('local_2026_27', 'world_cup_2026'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'polls_operational_scope_check') THEN
    ALTER TABLE polls ADD CONSTRAINT polls_operational_scope_check CHECK (operational_scope IN ('local_2026_27', 'world_cup_2026'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'email_blasts_operational_scope_check') THEN
    ALTER TABLE email_blasts ADD CONSTRAINT email_blasts_operational_scope_check CHECK (operational_scope IN ('local_2026_27', 'world_cup_2026'));
  END IF;
END $$;