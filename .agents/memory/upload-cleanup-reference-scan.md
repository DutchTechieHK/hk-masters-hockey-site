---
name: Upload cleanup reference scan
description: Deleting shared-bucket uploads requires a zero-reference scan across EVERY persisted URL field
---

Before deleting any `/objects/uploads/<uuid>` object, `cleanupOrphanedUpload` (lib/uploadCleanup.ts) must find zero references across the FULL schema inventory of URL-bearing fields — structured columns, arrays (contributions.photoUrls), JSON blobs (site_content), and even fields that "shouldn't" hold GCS URLs (player passport/HKID, lego jar images).

**Why:** dev and prod share one bucket, and completion code review repeatedly rejects any omission — reviewers grep the schema for URL columns. Suppression false-positives are harmless (leaves an orphan); a missed field deletes live content.

**How to apply:** when adding a new table/column that can store an upload URL, add it to countRemainingReferences too (contains-LIKE on the uuid is the safe pattern). Deletes are fire-and-forget after response, never throw, 404 = success.
