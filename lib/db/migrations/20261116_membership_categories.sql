BEGIN;
CREATE TABLE IF NOT EXISTS membership_categories (
  key text PRIMARY KEY,
  name text NOT NULL,
  default_fee numeric(10,2),
  retired boolean NOT NULL DEFAULT false,
  protected boolean NOT NULL DEFAULT false,
  version integer NOT NULL DEFAULT 1,
  CONSTRAINT membership_categories_name CHECK (length(trim(name)) BETWEEN 1 AND 100),
  CONSTRAINT membership_categories_fee CHECK (default_fee IS NULL OR (default_fee >= 0 AND default_fee <= 99999999.99)),
  CONSTRAINT membership_categories_protected CHECK (NOT protected OR NOT retired)
);
CREATE UNIQUE INDEX IF NOT EXISTS membership_categories_normalized_name
  ON membership_categories (lower(regexp_replace(trim(name), '\s+', ' ', 'g')));
INSERT INTO membership_categories (key, name, default_fee, protected) VALUES
 ('awaiting_selection', 'Awaiting Selection', NULL, true),
 ('trials', 'Trials', NULL, true),
 ('community_member', 'Community Member', 100, false),
 ('social_player', 'Social Player', 300, false),
 ('masters_division_one', 'League Player', 500, false)
ON CONFLICT (key) DO NOTHING;
DO $$
BEGIN
  IF to_regclass('member_bulk_edits') IS NOT NULL THEN
    ALTER TABLE member_bulk_edits DROP CONSTRAINT IF EXISTS member_bulk_edits_field_value;
    ALTER TABLE member_bulk_edits ADD CONSTRAINT member_bulk_edits_field_value CHECK (
      (field = 'section' AND value IN ('not_set','men','women')) OR
      (field = 'category' AND length(trim(value)) > 0)
    );
  END IF;
END $$;
COMMIT;
