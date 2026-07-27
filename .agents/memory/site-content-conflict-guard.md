---
name: Optimistic-concurrency convention for whole-list saves
description: How stale-save conflict guards are implemented in this repo (site-content albums/gallery pattern).
---
Whole-list PUT endpoints that replace JSON blobs use per-section `*_updated_at` timestamptz columns as versions.

**Rule:** enforce the expected version *inside the UPDATE* (`WHERE ... AND col IS NOT DISTINCT FROM $expected`, then 409 on zero rows), never a read-then-compare pre-check — code review rejects non-atomic guards. Clients send the baseline timestamp, get the new one back, and on 409 show a "reload" toast and refetch. Omitting the timestamp keeps legacy saves working.

**Also:** even though prod schema migrates via the Publish diff (see db-migration-convention.md), completion review expects an idempotent `ADD COLUMN IF NOT EXISTS` file in `lib/db/migrations/` for new columns — add one to pass review.
