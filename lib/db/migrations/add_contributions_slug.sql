-- Migration: Add slug column to contributions table for memorable article URLs
-- Safe to run multiple times (idempotent)

-- Step 1: Add the column if it doesn't exist yet (nullable, no constraint yet)
ALTER TABLE contributions ADD COLUMN IF NOT EXISTS slug TEXT;

-- Step 2: Drop the unique constraint if it exists so we can safely backfill
-- (Re-added after backfill at step 3)
ALTER TABLE contributions DROP CONSTRAINT IF EXISTS contributions_slug_unique;

-- Step 3: Backfill slugs for all contributions that do not have one yet
-- Uses a PL/pgSQL block to generate unique, collision-safe slugs from titles
DO $$
DECLARE
  contrib RECORD;
  base_slug TEXT;
  candidate_slug TEXT;
  counter INT;
BEGIN
  FOR contrib IN
    SELECT id, title FROM contributions WHERE slug IS NULL ORDER BY id
  LOOP
    -- Build slug: lowercase, strip non-alphanumeric except spaces/hyphens,
    -- collapse runs of whitespace/hyphens into a single hyphen, trim ends, max 80 chars
    base_slug := left(
      regexp_replace(
        regexp_replace(
          regexp_replace(lower(contrib.title), '[^a-z0-9 -]', '', 'g'),
          '[ -]+', '-', 'g'
        ),
        '^-+|-+$', '', 'g'
      ),
      80
    );

    IF base_slug = '' THEN
      base_slug := 'article';
    END IF;

    -- Resolve collisions by appending a counter
    candidate_slug := base_slug;
    counter := 2;
    WHILE EXISTS (SELECT 1 FROM contributions WHERE slug = candidate_slug) LOOP
      candidate_slug := base_slug || '-' || counter;
      counter := counter + 1;
    END LOOP;

    UPDATE contributions SET slug = candidate_slug WHERE id = contrib.id;
  END LOOP;
END $$;

-- Step 4: Re-add the unique constraint (all rows now have non-null, unique slugs)
ALTER TABLE contributions ADD CONSTRAINT contributions_slug_unique UNIQUE (slug);
