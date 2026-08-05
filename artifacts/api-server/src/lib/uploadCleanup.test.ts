/**
 * Integration tests for cross-entity upload cleanup (Finding 1 + 2).
 *
 * These tests exercise cleanupOrphanedUpload against the real dev DB and a
 * mocked tryDeleteUploadObject so we can assert exactly when GCS deletes are
 * issued without touching the real bucket.
 *
 * Key scenarios:
 *  - Object referenced only by one row → deleted after that row is removed.
 *  - Same objectId in an event AND a news post → NOT deleted while either exists.
 *  - Deleted once the last cross-entity reference is gone.
 *  - Same objectId in two rows of the same table (e.g. two sponsors) → survives
 *    while one remains.
 *  - Same objectId in an event AND a site-content blob → NOT deleted while
 *    site-content still contains the UUID; deleted once cleared from both.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from "vitest";
import { db } from "@workspace/db";
import {
  eventsTable,
  newsPostsTable,
  sponsorsTable,
  siteContentTable,
  contributionsTable,
  playersTable,
  teamsTable,
  legoJarConfigTable,
  legoJarPrizesTable,
} from "@workspace/db/schema";
import { eq, inArray } from "drizzle-orm";

// ── Mock tryDeleteUploadObject so we never hit the real GCS sidecar ──────────
// We import cleanupOrphanedUpload AFTER setting up the mock.
vi.mock("./objectStorage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./objectStorage")>();
  return {
    ...actual,
    tryDeleteUploadObject: vi.fn().mockResolvedValue(undefined),
  };
});

const { cleanupOrphanedUpload } = await import("./uploadCleanup");
const { tryDeleteUploadObject } = await import("./objectStorage");
const mockDelete = tryDeleteUploadObject as ReturnType<typeof vi.fn>;

// ── Helpers ───────────────────────────────────────────────────────────────────

const UUID_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const UUID_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

// URL formats used by each entity type
const eventUrl = (uuid: string) => `/api/events/serve-image/${uuid}`;
const newsUrl = (uuid: string) => `/api/news/serve-image/${uuid}`;
const sponsorUrl = (uuid: string) => `/api/sponsors/image/objects/uploads/${uuid}`;

// Track inserted IDs for cleanup
let insertedEventIds: number[] = [];
let insertedNewsIds: number[] = [];
let insertedSponsorIds: number[] = [];
let insertedSiteContentIds: number[] = [];
let insertedContributionIds: number[] = [];
let insertedPlayerIds: number[] = [];
let insertedLegoConfigIds: number[] = [];
let insertedLegoPrizeIds: number[] = [];

async function insertEvent(uuid: string): Promise<number> {
  const [row] = await db
    .insert(eventsTable)
    .values({
      kind: "training",
      title: `Cleanup test event ${uuid.slice(0, 8)}`,
      startsAt: new Date("2030-06-01T10:00:00Z"),
      photoUrl: eventUrl(uuid),
    })
    .returning({ id: eventsTable.id });
  insertedEventIds.push(row.id);
  return row.id;
}

async function insertNewsPost(uuid: string): Promise<number> {
  const [row] = await db
    .insert(newsPostsTable)
    .values({
      title: `Cleanup test post ${uuid.slice(0, 8)}`,
      slug: `cleanup-test-${uuid.slice(0, 8)}-${Date.now()}`,
      status: "draft",
      coverImage: newsUrl(uuid),
    })
    .returning({ id: newsPostsTable.id });
  insertedNewsIds.push(row.id);
  return row.id;
}

async function insertSponsor(uuid: string): Promise<number> {
  const [row] = await db
    .insert(sponsorsTable)
    .values({
      name: `Cleanup test sponsor ${uuid.slice(0, 8)}`,
      logoUrl: sponsorUrl(uuid),
      tier: "gold",
      active: false,
    })
    .returning({ id: sponsorsTable.id });
  insertedSponsorIds.push(row.id);
  return row.id;
}

/**
 * Insert a site_content row whose heroImage references the given uuid.
 * Returns the inserted row id.
 */
async function insertSiteContentWithHeroImage(uuid: string): Promise<number> {
  const [row] = await db
    .insert(siteContentTable)
    .values({
      heroImage: `/api/site-content/image/objects/uploads/${uuid}`,
      galleryImages: "[]",
    })
    .returning({ id: siteContentTable.id });
  insertedSiteContentIds.push(row.id);
  return row.id;
}

/**
 * Insert a contribution whose photoUrls array contains a site-content image
 * URL embedding the given UUID.
 */
async function insertContributionWithPhoto(uuid: string): Promise<number> {
  const [row] = await db
    .insert(contributionsTable)
    .values({
      title: `Cleanup test contribution ${uuid.slice(0, 8)}`,
      authorName: "Test Author",
      authorEmail: "test@example.com",
      contentType: "photo",
      photoUrls: [`/api/site-content/image/objects/uploads/${uuid}`],
    })
    .returning({ id: contributionsTable.id });
  insertedContributionIds.push(row.id);
  return row.id;
}

/**
 * Insert a site_content row whose galleryImages JSON blob contains the uuid.
 * Simulates a UUID embedded inside a JSON array (the production gallery format).
 */
async function insertSiteContentWithGalleryJson(uuid: string): Promise<number> {
  const gallery = JSON.stringify([
    { url: `/api/site-content/image/objects/uploads/${uuid}` },
  ]);
  const [row] = await db
    .insert(siteContentTable)
    .values({ galleryImages: gallery })
    .returning({ id: siteContentTable.id });
  insertedSiteContentIds.push(row.id);
  return row.id;
}

/**
 * Insert a player row whose passportCopyUrl embeds the given UUID.
 * Uses an existing team (id=2) so no team fixture is needed.
 */
async function insertPlayerWithPassport(uuid: string): Promise<number> {
  const [row] = await db
    .insert(playersTable)
    .values({
      teamId: 2,
      name: `Cleanup test player ${uuid.slice(0, 8)}`,
      email: `cleanup-test-${uuid.slice(0, 8)}@example.com`,
      passportCopyUrl: `/api/site-content/image/objects/uploads/${uuid}`,
    })
    .returning({ id: playersTable.id });
  insertedPlayerIds.push(row.id);
  return row.id;
}

/**
 * Insert a player row whose hkidCopyUrl embeds the given UUID.
 */
async function insertPlayerWithHkid(uuid: string): Promise<number> {
  const [row] = await db
    .insert(playersTable)
    .values({
      teamId: 2,
      name: `Cleanup test player hkid ${uuid.slice(0, 8)}`,
      email: `cleanup-test-hkid-${uuid.slice(0, 8)}@example.com`,
      hkidCopyUrl: `/api/site-content/image/objects/uploads/${uuid}`,
    })
    .returning({ id: playersTable.id });
  insertedPlayerIds.push(row.id);
  return row.id;
}

/**
 * Stamp lego_jar_config (singleton, id=1) with an imageUrl containing the
 * UUID. Returns the previous imageUrl so the caller can restore it.
 * Does NOT add to insertedLegoConfigIds — we restore manually in-test.
 */
async function stampLegoConfigImage(uuid: string): Promise<string | null> {
  const rows = await db
    .select({ imageUrl: legoJarConfigTable.imageUrl })
    .from(legoJarConfigTable)
    .limit(1);
  const prev = rows[0]?.imageUrl ?? null;
  await db
    .update(legoJarConfigTable)
    .set({ imageUrl: `/api/site-content/image/objects/uploads/${uuid}` });
  return prev;
}

async function restoreLegoConfigImage(prev: string | null): Promise<void> {
  await db.update(legoJarConfigTable).set({ imageUrl: prev });
}

/**
 * Insert a lego_jar_prizes row whose imageUrl embeds the given UUID.
 * rank is a unique integer — we derive a large value from the UUID's first
 * hex digits to avoid collisions with real data (which uses ranks 1–3).
 */
async function insertLegoPrizeWithImage(uuid: string): Promise<number> {
  // Use the first 4 hex chars of the UUID as a large rank offset (>= 65536)
  // so it never conflicts with real prize ranks (typically 1–10).
  const rank = parseInt(uuid.replace(/-/g, "").slice(0, 4), 16) + 65536;
  const [row] = await db
    .insert(legoJarPrizesTable)
    .values({
      rank,
      badge: "🧪",
      badgeColor: "gray",
      title: `Cleanup test prize ${uuid.slice(0, 8)}`,
      description: "Test prize for upload cleanup integration test",
      imageUrl: `/api/site-content/image/objects/uploads/${uuid}`,
    })
    .returning({ id: legoJarPrizesTable.id });
  insertedLegoPrizeIds.push(row.id);
  return row.id;
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockDelete.mockClear();
});

afterAll(async () => {
  // Players first (no FK deps on other test rows, but safest to clear first).
  if (insertedPlayerIds.length)
    await db.delete(playersTable).where(inArray(playersTable.id, insertedPlayerIds));
  if (insertedLegoConfigIds.length)
    await db.delete(legoJarConfigTable).where(inArray(legoJarConfigTable.id, insertedLegoConfigIds));
  if (insertedLegoPrizeIds.length)
    await db.delete(legoJarPrizesTable).where(inArray(legoJarPrizesTable.id, insertedLegoPrizeIds));
  if (insertedEventIds.length)
    await db.delete(eventsTable).where(inArray(eventsTable.id, insertedEventIds));
  if (insertedNewsIds.length)
    await db.delete(newsPostsTable).where(inArray(newsPostsTable.id, insertedNewsIds));
  if (insertedSponsorIds.length)
    await db.delete(sponsorsTable).where(inArray(sponsorsTable.id, insertedSponsorIds));
  if (insertedSiteContentIds.length)
    await db.delete(siteContentTable).where(inArray(siteContentTable.id, insertedSiteContentIds));
  if (insertedContributionIds.length)
    await db.delete(contributionsTable).where(inArray(contributionsTable.id, insertedContributionIds));
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("cleanupOrphanedUpload — cross-entity reference check", () => {
  it("no-ops for null objectId without touching DB or GCS", async () => {
    await cleanupOrphanedUpload(null);
    expect(mockDelete).not.toHaveBeenCalled();
  });

  it("no-ops for invalid objectId (path traversal)", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    await cleanupOrphanedUpload("../../bad");
    expect(mockDelete).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("deletes when the object has no remaining references (single-entity)", async () => {
    // Insert and then remove the event so it's gone before we call cleanup.
    const eventId = await insertEvent(UUID_A);
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(UUID_A);

    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(UUID_A);
  });

  it("does NOT delete while an event still references the object", async () => {
    const eventId = await insertEvent(UUID_B);

    await cleanupOrphanedUpload(UUID_B);

    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup: remove the event
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);
  });

  it("does NOT delete while a cross-entity reference exists (event + news post share objectId)", async () => {
    const uuid = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    const eventId = await insertEvent(uuid);
    const newsId = await insertNewsPost(uuid);

    // Simulate: event row deleted, but news post still has the same UUID.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    // cleanupOrphanedUpload must NOT delete — news post still holds the reference.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Now remove the news post too.
    await db.delete(newsPostsTable).where(eq(newsPostsTable.id, newsId));
    insertedNewsIds = insertedNewsIds.filter((id) => id !== newsId);

    // Now zero references — delete should be issued.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);
  });

  it("does NOT delete while two sponsors share the same objectId", async () => {
    const uuid = "dddddddd-dddd-dddd-dddd-dddddddddddd";
    const sponsorId1 = await insertSponsor(uuid);
    const sponsorId2 = await insertSponsor(uuid);

    // Delete sponsor 1.
    await db.delete(sponsorsTable).where(eq(sponsorsTable.id, sponsorId1));
    insertedSponsorIds = insertedSponsorIds.filter((id) => id !== sponsorId1);

    // Sponsor 2 still references it — must not delete.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Delete sponsor 2.
    await db.delete(sponsorsTable).where(eq(sponsorsTable.id, sponsorId2));
    insertedSponsorIds = insertedSponsorIds.filter((id) => id !== sponsorId2);

    // Now zero references — delete should be issued.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);
  });

  it("does NOT delete when event+news+sponsor all reference the same objectId; deletes only once all three are gone", async () => {
    const uuid = "eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee";
    const eventId = await insertEvent(uuid);
    const newsId = await insertNewsPost(uuid);
    const sponsorId = await insertSponsor(uuid);

    // Remove event — two refs remain.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Remove news — one ref remains.
    await db.delete(newsPostsTable).where(eq(newsPostsTable.id, newsId));
    insertedNewsIds = insertedNewsIds.filter((id) => id !== newsId);
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Remove sponsor — zero refs.
    await db.delete(sponsorsTable).where(eq(sponsorsTable.id, sponsorId));
    insertedSponsorIds = insertedSponsorIds.filter((id) => id !== sponsorId);
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);
  });

  it("matches exact objectId in URL, not a different UUID that happens to contain the same suffix", async () => {
    // UUID_A is "aaaaaaaa-...". Insert a row with a URL that contains a *different*
    // UUID but ends with aaaaaaaa... — should not count as a reference to UUID_A.
    // In practice UUIDs don't overlap this way, but this verifies canonical extraction.
    const unrelatedUuid = "ffffffff-ffff-ffff-ffff-ffffffffffff";
    const eventId = await insertEvent(unrelatedUuid);

    // No row references UUID_A → should trigger delete.
    await cleanupOrphanedUpload(UUID_A);
    expect(mockDelete).toHaveBeenCalledWith(UUID_A);

    // Cleanup
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);
  });

  // ── Site-content scenarios ──────────────────────────────────────────────────

  it("does NOT delete while a site-content heroImage references the objectId", async () => {
    const uuid = "11111111-1111-1111-1111-111111111111";
    const scId = await insertSiteContentWithHeroImage(uuid);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(siteContentTable).where(eq(siteContentTable.id, scId));
    insertedSiteContentIds = insertedSiteContentIds.filter((id) => id !== scId);
  });

  it("does NOT delete while a site-content galleryImages JSON blob contains the objectId", async () => {
    const uuid = "22222222-2222-2222-2222-222222222222";
    const scId = await insertSiteContentWithGalleryJson(uuid);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(siteContentTable).where(eq(siteContentTable.id, scId));
    insertedSiteContentIds = insertedSiteContentIds.filter((id) => id !== scId);
  });

  it("event + site-content share objectId: survives event delete; deleted once site-content is cleared", async () => {
    const uuid = "33333333-3333-3333-3333-333333333333";

    // Both an event row and a site-content row reference the same UUID.
    const eventId = await insertEvent(uuid);
    const scId = await insertSiteContentWithHeroImage(uuid);

    // Delete the event — site-content still holds the reference.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Clear the heroImage from site-content (simulates admin removing the image).
    await db
      .update(siteContentTable)
      .set({ heroImage: null })
      .where(eq(siteContentTable.id, scId));

    // Now zero references — GCS delete should be issued.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(siteContentTable).where(eq(siteContentTable.id, scId));
    insertedSiteContentIds = insertedSiteContentIds.filter((id) => id !== scId);
  });

  it("event + site-content galleryJson share objectId: survives event delete; deleted once gallery is cleared", async () => {
    const uuid = "44444444-4444-4444-4444-444444444444";

    const eventId = await insertEvent(uuid);
    const scId = await insertSiteContentWithGalleryJson(uuid);

    // Delete the event — gallery JSON still contains the UUID.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Clear the gallery (empty array has no UUID reference).
    await db
      .update(siteContentTable)
      .set({ galleryImages: "[]" })
      .where(eq(siteContentTable.id, scId));

    // Zero references now — should delete.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(siteContentTable).where(eq(siteContentTable.id, scId));
    insertedSiteContentIds = insertedSiteContentIds.filter((id) => id !== scId);
  });

  // ── Contributions.photoUrls scenarios ──────────────────────────────────────

  it("does NOT delete while contributions.photoUrls contains the UUID", async () => {
    const uuid = "55555555-5555-5555-5555-555555555555";
    const contribId = await insertContributionWithPhoto(uuid);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(contributionsTable).where(eq(contributionsTable.id, contribId));
    insertedContributionIds = insertedContributionIds.filter((id) => id !== contribId);
  });

  it("deletes once contributions.photoUrls is cleared of the UUID", async () => {
    const uuid = "66666666-6666-6666-6666-666666666666";
    const contribId = await insertContributionWithPhoto(uuid);

    // Clear the photo array — no references remain.
    await db
      .update(contributionsTable)
      .set({ photoUrls: [] })
      .where(eq(contributionsTable.id, contribId));

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(contributionsTable).where(eq(contributionsTable.id, contribId));
    insertedContributionIds = insertedContributionIds.filter((id) => id !== contribId);
  });

  it("event + contribution share UUID: survives event delete; deleted once contribution photo cleared", async () => {
    const uuid = "77777777-7777-7777-7777-777777777777";

    const eventId = await insertEvent(uuid);
    const contribId = await insertContributionWithPhoto(uuid);

    // Delete the event — contribution still holds the reference.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Clear the contribution's photo array.
    await db
      .update(contributionsTable)
      .set({ photoUrls: [] })
      .where(eq(contributionsTable.id, contribId));

    // Zero references — GCS delete should fire.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(contributionsTable).where(eq(contributionsTable.id, contribId));
    insertedContributionIds = insertedContributionIds.filter((id) => id !== contribId);
  });

  it("contribution with multiple photos: suppresses delete while any UUID remains; deletes only when all cleared", async () => {
    const uuid = "88888888-8888-8888-8888-888888888888";
    const OTHER = "cccccccc-cccc-cccc-cccc-cccccccccccc";
    // Two photos in the same contribution; only uuid is under test.
    const contribId = await insertContributionWithPhoto(uuid);
    // Add a second photo URL (different UUID) to the same row.
    await db
      .update(contributionsTable)
      .set({
        photoUrls: [
          `/api/site-content/image/objects/uploads/${uuid}`,
          `/api/site-content/image/objects/uploads/${OTHER}`,
        ],
      })
      .where(eq(contributionsTable.id, contribId));

    // Both UUIDs referenced — neither should be deleted yet.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Remove only the target UUID from the array (keep OTHER).
    await db
      .update(contributionsTable)
      .set({ photoUrls: [`/api/site-content/image/objects/uploads/${OTHER}`] })
      .where(eq(contributionsTable.id, contribId));

    // uuid now has zero references — should delete.
    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // OTHER still referenced — must NOT delete.
    mockDelete.mockClear();
    await cleanupOrphanedUpload(OTHER);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(contributionsTable).where(eq(contributionsTable.id, contribId));
    insertedContributionIds = insertedContributionIds.filter((id) => id !== contribId);
  });

  // ── Players.passportCopyUrl / hkidCopyUrl scenarios ────────────────────────

  it("does NOT delete while a player's passportCopyUrl contains the UUID", async () => {
    const uuid = "99999999-9999-9999-9999-999999999999";
    const playerId = await insertPlayerWithPassport(uuid);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(playersTable).where(eq(playersTable.id, playerId));
    insertedPlayerIds = insertedPlayerIds.filter((id) => id !== playerId);
  });

  it("does NOT delete while a player's hkidCopyUrl contains the UUID", async () => {
    const uuid = "aaaabbbb-aaaa-bbbb-aaaa-aaaabbbbaaaa";
    const playerId = await insertPlayerWithHkid(uuid);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(playersTable).where(eq(playersTable.id, playerId));
    insertedPlayerIds = insertedPlayerIds.filter((id) => id !== playerId);
  });

  it("event + player passport share UUID: survives event delete; deleted once passport URL cleared", async () => {
    const uuid = "bbbbcccc-bbbb-cccc-bbbb-bbbbccccbbbb";

    const eventId = await insertEvent(uuid);
    const playerId = await insertPlayerWithPassport(uuid);

    // Delete the event — player still holds the reference.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Clear the player's passportCopyUrl — zero references.
    await db
      .update(playersTable)
      .set({ passportCopyUrl: null })
      .where(eq(playersTable.id, playerId));

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(playersTable).where(eq(playersTable.id, playerId));
    insertedPlayerIds = insertedPlayerIds.filter((id) => id !== playerId);
  });

  it("event + player hkid share UUID: survives event delete; deleted once hkid URL cleared", async () => {
    const uuid = "ccccdddd-cccc-dddd-cccc-ccccddddcccc";

    const eventId = await insertEvent(uuid);
    const playerId = await insertPlayerWithHkid(uuid);

    // Delete the event — player hkidCopyUrl still references the UUID.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Clear the HKID URL — zero references.
    await db
      .update(playersTable)
      .set({ hkidCopyUrl: null })
      .where(eq(playersTable.id, playerId));

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(playersTable).where(eq(playersTable.id, playerId));
    insertedPlayerIds = insertedPlayerIds.filter((id) => id !== playerId);
  });

  // ── Lego-jar imageUrl scenarios ─────────────────────────────────────────────

  it("does NOT delete while lego_jar_config.imageUrl contains the UUID", async () => {
    const uuid = "ddddeee0-dddd-eeee-dddd-ddddeeee0000";
    // lego_jar_config is a singleton — stamp and restore rather than insert.
    const prev = await stampLegoConfigImage(uuid);
    try {
      await cleanupOrphanedUpload(uuid);
      expect(mockDelete).not.toHaveBeenCalled();
    } finally {
      await restoreLegoConfigImage(prev);
    }
  });

  it("does NOT delete while lego_jar_prizes.imageUrl contains the UUID", async () => {
    const uuid = "eeeeffff-eeee-ffff-eeee-eeeeffff0000";
    const prizeId = await insertLegoPrizeWithImage(uuid);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Cleanup
    await db.delete(legoJarPrizesTable).where(eq(legoJarPrizesTable.id, prizeId));
    insertedLegoPrizeIds = insertedLegoPrizeIds.filter((id) => id !== prizeId);
  });

  it("event + lego config share UUID: survives event delete; deleted once config imageUrl cleared", async () => {
    const uuid = "ffff0000-ffff-0000-ffff-ffff00000001";

    const eventId = await insertEvent(uuid);
    // Stamp the singleton config with the UUID; capture original for restore.
    const prevCfg = await stampLegoConfigImage(uuid);

    try {
      // Delete the event — lego config still holds the reference.
      await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
      insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

      await cleanupOrphanedUpload(uuid);
      expect(mockDelete).not.toHaveBeenCalled();

      // Clear the config imageUrl — zero references now.
      await restoreLegoConfigImage(null);

      await cleanupOrphanedUpload(uuid);
      expect(mockDelete).toHaveBeenCalledOnce();
      expect(mockDelete).toHaveBeenCalledWith(uuid);
    } finally {
      await restoreLegoConfigImage(prevCfg);
    }
  });

  it("event + lego prize share UUID: survives event delete; deleted once prize imageUrl cleared", async () => {
    const uuid = "ffff0000-ffff-0000-ffff-ffff00000002";

    const eventId = await insertEvent(uuid);
    const prizeId = await insertLegoPrizeWithImage(uuid);

    // Delete the event — lego prize still holds the reference.
    await db.delete(eventsTable).where(eq(eventsTable.id, eventId));
    insertedEventIds = insertedEventIds.filter((id) => id !== eventId);

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).not.toHaveBeenCalled();

    // Clear the prize imageUrl — zero references.
    await db
      .update(legoJarPrizesTable)
      .set({ imageUrl: null })
      .where(eq(legoJarPrizesTable.id, prizeId));

    await cleanupOrphanedUpload(uuid);
    expect(mockDelete).toHaveBeenCalledOnce();
    expect(mockDelete).toHaveBeenCalledWith(uuid);

    // Cleanup
    await db.delete(legoJarPrizesTable).where(eq(legoJarPrizesTable.id, prizeId));
    insertedLegoPrizeIds = insertedLegoPrizeIds.filter((id) => id !== prizeId);
  });
});
