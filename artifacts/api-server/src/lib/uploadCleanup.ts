/**
 * Cross-entity upload cleanup.
 *
 * After a row mutation removes or replaces an upload URL, call
 * cleanupOrphanedUpload(objectId) to delete the GCS object — but only when
 * no other row in any tracked table still references it.
 *
 * Reference-count design:
 * ─────────────────────────────────────────────────────────────────────────────
 * • Structured columns (events.photoUrl, news.coverImage, sponsors.logoUrl,
 *   auction.imageUrl, documents.fileUrl):
 *     DB-side `LIKE '%<uuid>'` (ends-with) narrows candidates; each hit is
 *     then verified with extractUploadObjectId() for exact canonical matching.
 *     Consequence of a false positive: impossible in practice (UUID uniqueness).
 *
 * • Site-content columns (heroImage, mo40Photo, mo50Photo, galleryImages,
 *   mediaAlbums) and contributions.photoUrls:
 *     Some store direct URLs; others store JSON blobs or PostgreSQL arrays
 *     embedding URLs. We cannot extract individual objectIds from arbitrary
 *     JSON/arrays cheaply, so we use a broader `LIKE '%<uuid>%'` across all
 *     columns. A false positive here only suppresses a delete (leaves a safe
 *     orphan) — never deletes wrongly. UUIDs are globally unique so false
 *     positives are essentially impossible in practice, but we accept them by
 *     design for safety.
 *
 * • The reference count is always queried AFTER the caller's DB mutation
 *   commits, so the mutated row no longer counts.
 *
 * Race / concurrent-edit note:
 * ─────────────────────────────────────────────────────────────────────────────
 * Between the caller's DELETE/UPDATE committing and the reference-count query
 * running, another request could INSERT a new row referencing the same
 * objectId. In that window the count would be zero and we'd delete an object
 * that the new row expects to exist, leaving a dangling reference.
 *
 * This race is accepted as best-effort: the window is tiny (milliseconds in
 * practice), the cleanup is fire-and-forget, and the cost of a false positive
 * (a 404 on a freshly uploaded photo) is recoverable (re-upload). Hardening
 * with a DB-level lock or a soft-delete tombstone pattern is left for a future
 * task if it proves necessary in production.
 *
 * Documents:
 *   Included in the scan (same bucket/UUID space) even though document cleanup
 *   is out of scope — excluding them could cause a false positive that deletes
 *   a live PDF.
 *
 * Site-content:
 *   Included in the scan with a broad LIKE so that images embedded in gallery
 *   JSON or hero image fields suppress deletion. Site-content cleanup itself
 *   (removing stale uploads on edit) is tracked in task #517.
 *
 * Contributions.photoUrls:
 *   Admin photo uploads for journal contributions go through the
 *   /api/site-content/upload-image endpoint and store the resulting
 *   /api/site-content/image/objects/uploads/<uuid> URL in the photoUrls
 *   text array. We cast the whole array to text and use a broad LIKE so any
 *   element containing the UUID suppresses deletion.
 *
 * Players.passportCopyUrl / players.hkidCopyUrl:
 *   These fields currently store Cloudinary URLs, but they accept arbitrary
 *   user-provided strings and could in principle be set to any URL format.
 *   Including them is harmless — a UUID substring match against a Cloudinary
 *   URL is essentially impossible in practice, and a false positive only
 *   suppresses a delete (safe orphan) — never causes a wrong one.
 *
 * Lego-jar imageUrl fields (legoJarConfigTable, legoJarPrizesTable):
 *   Currently store static asset paths or arbitrary strings set by admins.
 *   Included for completeness: a UUID substring hit is impossible in practice
 *   against static paths, and inclusion is always safe (suppression only).
 *
 * Site-content mediaVideos / pageTexts:
 *   JSON blobs on the site_content row. mediaVideos stores YouTube video
 *   metadata; pageTexts stores CMS text including social/maps URLs. Neither
 *   currently holds GCS upload URLs, but including them in the scan costs
 *   nothing and prevents a future false-negative if the data ever changes.
 */

import { db } from "@workspace/db";
import {
  eventsTable,
  newsPostsTable,
  sponsorsTable,
  auctionItemsTable,
  documentsTable,
  siteContentTable,
  contributionsTable,
  playersTable,
  legoJarConfigTable,
  legoJarPrizesTable,
} from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { extractUploadObjectId, tryDeleteUploadObject } from "./objectStorage";

// Each entry: the column value to check against extractUploadObjectId.
type CandidateRow = { url: string | null };

/**
 * Count how many rows across all tracked tables currently reference objectId.
 * Call AFTER your row mutation has committed so the changed row no longer counts.
 */
async function countRemainingReferences(objectId: string): Promise<number> {
  // Ends-with pattern: structured columns always end with "/<uuid>".
  const endsWithPattern = `%${objectId}`;
  // Contains pattern: used for site-content JSON blobs where the URL may be
  // embedded inside a larger JSON string.
  const containsPattern = `%${objectId}%`;

  const [
    eventRows,
    newsRows,
    sponsorRows,
    auctionRows,
    docRows,
    siteContentHit,
    contributionHit,
    playerHit,
    legoConfigHit,
    legoPrizesHit,
  ] = await Promise.all([
    // ── Structured URL columns — exact-match after extraction ─────────────
    db
      .select({ url: eventsTable.photoUrl })
      .from(eventsTable)
      .where(sql`${eventsTable.photoUrl} LIKE ${endsWithPattern}`),
    db
      .select({ url: newsPostsTable.coverImage })
      .from(newsPostsTable)
      .where(sql`${newsPostsTable.coverImage} LIKE ${endsWithPattern}`),
    db
      .select({ url: sponsorsTable.logoUrl })
      .from(sponsorsTable)
      .where(sql`${sponsorsTable.logoUrl} LIKE ${endsWithPattern}`),
    db
      .select({ url: auctionItemsTable.imageUrl })
      .from(auctionItemsTable)
      .where(sql`${auctionItemsTable.imageUrl} LIKE ${endsWithPattern}`),
    db
      .select({ url: documentsTable.fileUrl })
      .from(documentsTable)
      .where(sql`${documentsTable.fileUrl} LIKE ${endsWithPattern}`),

    // ── Site-content — broad substring LIKE across ALL text columns ──────────
    // heroImage/mo40Photo/mo50Photo are direct URL fields.
    // galleryImages/mediaAlbums/mediaVideos/pageTexts are JSON blobs that may
    // embed upload URLs. All are scanned with the safe contains-LIKE: a UUID
    // substring hit means a real reference; a false positive (impossible with
    // UUIDs) would only suppress a delete, never cause a wrong one.
    db
      .select({ id: siteContentTable.id })
      .from(siteContentTable)
      .where(
        sql`
          ${siteContentTable.heroImage}       LIKE ${containsPattern}
          OR ${siteContentTable.mo40Photo}    LIKE ${containsPattern}
          OR ${siteContentTable.mo50Photo}    LIKE ${containsPattern}
          OR ${siteContentTable.galleryImages} LIKE ${containsPattern}
          OR ${siteContentTable.mediaAlbums}  LIKE ${containsPattern}
          OR ${siteContentTable.mediaVideos}  LIKE ${containsPattern}
          OR ${siteContentTable.pageTexts}    LIKE ${containsPattern}
        `,
      )
      .limit(1),

    // ── Contributions.photoUrls — PostgreSQL text array ────────────────────
    // Journal admin photos are uploaded via /api/site-content/upload-image and
    // stored as /api/site-content/image/objects/uploads/<uuid> entries in the
    // photoUrls array. Casting the whole array to text and substring-matching
    // the UUID is safe: UUIDs cannot appear in other text content.
    db
      .select({ id: contributionsTable.id })
      .from(contributionsTable)
      .where(sql`${contributionsTable.photoUrls}::text LIKE ${containsPattern}`)
      .limit(1),

    // ── Players — passport and HKID document URL columns ──────────────────
    // Currently store Cloudinary URLs, but accepted as arbitrary strings and
    // could theoretically be set to any URL format in the future. Including
    // them is harmless: a UUID substring match against a Cloudinary URL is
    // effectively impossible, and a false positive only suppresses a delete.
    db
      .select({ id: playersTable.id })
      .from(playersTable)
      .where(
        sql`
          ${playersTable.passportCopyUrl} LIKE ${containsPattern}
          OR ${playersTable.hkidCopyUrl}  LIKE ${containsPattern}
        `,
      )
      .limit(1),

    // ── Lego-jar — config and prizes imageUrl columns ─────────────────────
    // Currently hold static asset paths or arbitrary admin-entered strings.
    // Included for completeness: a UUID hit suppresses deletion safely.
    db
      .select({ id: legoJarConfigTable.id })
      .from(legoJarConfigTable)
      .where(sql`${legoJarConfigTable.imageUrl} LIKE ${containsPattern}`)
      .limit(1),
    db
      .select({ id: legoJarPrizesTable.id })
      .from(legoJarPrizesTable)
      .where(sql`${legoJarPrizesTable.imageUrl} LIKE ${containsPattern}`)
      .limit(1),
  ]);

  // Exact canonical verification for structured columns.
  let count = 0;
  for (const rows of [eventRows, newsRows, sponsorRows, auctionRows, docRows]) {
    for (const row of rows as CandidateRow[]) {
      if (extractUploadObjectId(row.url) === objectId) count++;
    }
  }

  // Site-content: any hit counts as one reference (we don't need an exact
  // count, just "referenced or not").
  if (siteContentHit.length > 0) count++;

  // Contributions: any element in the photoUrls array containing the UUID
  // suppresses deletion (safe: a false positive is impossible with UUIDs).
  if (contributionHit.length > 0) count++;

  // Players: passport or HKID URL contains the UUID → suppress deletion.
  if (playerHit.length > 0) count++;

  // Lego-jar: config or prize imageUrl contains the UUID → suppress deletion.
  if (legoConfigHit.length > 0) count++;
  if (legoPrizesHit.length > 0) count++;

  return count;
}

/**
 * Best-effort cleanup: delete the GCS object for objectId only when no tracked
 * table row still references it.
 *
 * - Call AFTER the row mutation that removed/replaced the URL has committed.
 * - Never throws; logs all failures.
 * - Safe to call fire-and-forget: `cleanupOrphanedUpload(id).catch(() => {})`.
 */
export async function cleanupOrphanedUpload(
  objectId: string | null | undefined,
): Promise<void> {
  if (!objectId) return;
  if (!/^[\w-]+$/.test(objectId)) {
    console.warn(
      `[uploadCleanup] invalid objectId "${objectId}" — skipping cleanup`,
    );
    return;
  }

  try {
    const refs = await countRemainingReferences(objectId);
    if (refs > 0) {
      // Still referenced — leave in storage.
      return;
    }
  } catch (err) {
    console.error(
      `[uploadCleanup] reference count failed for ${objectId} — skipping delete:`,
      err,
    );
    return;
  }

  await tryDeleteUploadObject(objectId);
}
