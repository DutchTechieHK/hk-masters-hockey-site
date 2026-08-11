-- Winner announcement fields for the LEGO Jar challenge.
ALTER TABLE lego_jar_config ADD COLUMN IF NOT EXISTS winner_announced boolean NOT NULL DEFAULT false;
ALTER TABLE lego_jar_config ADD COLUMN IF NOT EXISTS winner_name text;
ALTER TABLE lego_jar_config ADD COLUMN IF NOT EXISTS winner_guess integer;
ALTER TABLE lego_jar_config ADD COLUMN IF NOT EXISTS winner_message text;
