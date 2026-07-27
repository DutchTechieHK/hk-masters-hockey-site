-- Adds per-section optimistic-concurrency timestamps used to reject stale
-- admin saves (media albums / homepage gallery) instead of silently
-- overwriting another admin's edits.
-- Note: in this repo, dev schema is applied via `pnpm --filter @workspace/db run push`
-- and prod via the Publish schema diff; this file documents the change and is
-- safe to run manually on any existing database.
ALTER TABLE site_content
  ADD COLUMN IF NOT EXISTS gallery_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS media_albums_updated_at timestamptz;
