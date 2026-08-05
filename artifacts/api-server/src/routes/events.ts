import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db, eventsTable, teamsTable, eventRsvpsTable, playersTable, RSVP_STATUSES, type RsvpStatus } from "@workspace/db";
import { eq, asc, sql, or, isNull, and, inArray } from "drizzle-orm";
import { requireAdminAccess, hasAdminAccess } from "../middleware/adminAuth";
import { sendRsvpReminderEmail, sendNewEventEmail } from "../utils/email";
import { sendPushToAll, sendPushToTeam } from "../utils/push";
import { requirePlayerSession } from "../middleware/playerSession";
import { ObjectStorageService, ObjectNotFoundError, extractUploadObjectId } from "../lib/objectStorage";
import { cleanupOrphanedUpload } from "../lib/uploadCleanup";

const router: IRouter = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

// Derive the absolute origin of this API from the incoming request (works in
// dev behind the Replit proxy and in prod with x-forwarded-proto headers).
export function requestBase(req: Request): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") ||
    req.protocol ||
    "https";
  return `${proto}://${req.get("host")}`;
}

/**
 * Convention: all event photoUrl values returned to clients are ABSOLUTE URLs.
 * Relative /api/... paths stored in the DB are prefixed with the request origin
 * so they resolve correctly across domains (public site on Netlify, player app,
 * admin portal). Already-absolute values (e.g. migrated legacy URLs) pass through
 * unchanged so there is never a risk of double-prefixing.
 */
export function resolvePhotoUrl(base: string, photoUrl: string | null | undefined): string | null {
  if (!photoUrl) return null;
  if (photoUrl.startsWith("http")) return photoUrl;
  return `${base}${photoUrl}`;
}

// GET /api/events accepts either an admin session OR a player session.
// - Admin callers see every event (used by the admin Events page).
// - Player callers see only events visible to them (team-scoped or all-squad).
async function requireAdminOrPlayer(req: Request, res: Response, next: NextFunction) {
  if (await hasAdminAccess(req)) {
    (req as Request & { isAdmin?: boolean }).isAdmin = true;
    return next();
  }
  return requirePlayerSession(req, res, next);
}

const ALLOWED_KINDS = ["training", "meeting", "social", "physio", "team_dinner", "dinner", "free_time", "warmup", "game"] as const;
type EventKind = typeof ALLOWED_KINDS[number];

type RsvpCounts = { yes: number; no: number; maybe: number };

function emptyCounts(): RsvpCounts {
  return { yes: 0, no: 0, maybe: 0 };
}

function serialize(
  row: typeof eventsTable.$inferSelect,
  teamName?: string | null,
  extras?: { rsvpCounts?: RsvpCounts; myRsvp?: RsvpStatus | null; myNote?: string | null },
  base?: string,
) {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title,
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt ? row.endsAt.toISOString() : null,
    location: row.location,
    description: row.description,
    teamId: row.teamId,
    teamName: teamName ?? null,
    isPublic: row.isPublic,
    photoUrl: base ? resolvePhotoUrl(base, row.photoUrl) : (row.photoUrl ?? null),
    createdAt: row.createdAt.toISOString(),
    rsvpCounts: extras?.rsvpCounts ?? emptyCounts(),
    myRsvp: extras?.myRsvp ?? null,
    myNote: extras?.myNote ?? null,
  };
}

function parseBody(body: unknown): {
  kind: EventKind;
  title: string;
  startsAt: Date;
  endsAt: Date | null;
  location: string | null;
  description: string | null;
  teamId: number | null;
  isPublic: boolean;
  sendNotify: boolean;
  // undefined = not provided by caller (PATCH: leave existing value unchanged)
  // null      = explicitly cleared
  // string    = new URL to store
  photoUrl: string | null | undefined;
} | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const kind = String(b.kind ?? "");
  if (!ALLOWED_KINDS.includes(kind as EventKind)) {
    return { error: "kind must be training, meeting, social, physio, team_dinner, dinner, free_time, warmup or game" };
  }
  const title = typeof b.title === "string" ? b.title.trim() : "";
  if (!title) return { error: "title required" };
  const startsAtRaw = typeof b.startsAt === "string" ? b.startsAt : "";
  const startsAt = new Date(startsAtRaw);
  if (Number.isNaN(startsAt.getTime())) return { error: "Valid startsAt required" };
  let endsAt: Date | null = null;
  if (b.endsAt) {
    const d = new Date(String(b.endsAt));
    if (Number.isNaN(d.getTime())) return { error: "Invalid endsAt" };
    if (d.getTime() <= startsAt.getTime()) return { error: "endsAt must be after startsAt" };
    endsAt = d;
  }
  const teamIdRaw = b.teamId;
  let teamId: number | null = null;
  if (teamIdRaw !== null && teamIdRaw !== undefined && teamIdRaw !== "") {
    const n = Number(teamIdRaw);
    if (!Number.isInteger(n) || n <= 0) return { error: "Invalid teamId" };
    teamId = n;
  }
  // photoUrl: absent key → undefined (PATCH preserves existing); null or "" → null (clear); string → store
  let photoUrl: string | null | undefined = undefined;
  if ("photoUrl" in b) {
    const raw = b.photoUrl;
    photoUrl = typeof raw === "string" && raw.trim() ? raw.trim() : null;
  }
  return {
    kind: kind as EventKind,
    title,
    startsAt,
    endsAt,
    location: typeof b.location === "string" && b.location.trim() ? b.location.trim() : null,
    description: typeof b.description === "string" && b.description.trim() ? b.description.trim() : null,
    teamId,
    isPublic: b.isPublic === true,
    sendNotify: b.sendNotify !== false && b.sendNotify !== "false",
    photoUrl,
  };
}

// Aggregate RSVP counts grouped by event id for the supplied set of events.
async function loadRsvpCounts(eventIds: number[]): Promise<Map<number, RsvpCounts>> {
  const map = new Map<number, RsvpCounts>();
  if (eventIds.length === 0) return map;
  const rows = await db
    .select({
      eventId: eventRsvpsTable.eventId,
      status: eventRsvpsTable.status,
      count: sql<number>`count(*)::int`,
    })
    .from(eventRsvpsTable)
    .where(inArray(eventRsvpsTable.eventId, eventIds))
    .groupBy(eventRsvpsTable.eventId, eventRsvpsTable.status);
  for (const r of rows) {
    const bucket = map.get(r.eventId) ?? emptyCounts();
    const s = r.status as RsvpStatus;
    if (s === "yes" || s === "no" || s === "maybe") {
      bucket[s] = Number(r.count);
    }
    map.set(r.eventId, bucket);
  }
  return map;
}

async function loadMyRsvps(playerId: number, eventIds: number[]): Promise<Map<number, { status: RsvpStatus; note: string | null }>> {
  const map = new Map<number, { status: RsvpStatus; note: string | null }>();
  if (eventIds.length === 0) return map;
  const rows = await db
    .select({ eventId: eventRsvpsTable.eventId, status: eventRsvpsTable.status, note: eventRsvpsTable.note })
    .from(eventRsvpsTable)
    .where(and(eq(eventRsvpsTable.playerId, playerId), inArray(eventRsvpsTable.eventId, eventIds)));
  for (const r of rows) {
    if (r.status === "yes" || r.status === "no" || r.status === "maybe") {
      map.set(r.eventId, { status: r.status, note: r.note ?? null });
    }
  }
  return map;
}

// Public, unauthenticated: events explicitly marked as public, for the public website.
// photoUrl is resolved to an absolute URL via resolvePhotoUrl (see convention comment above).
router.get("/public", (async (req, res) => {
  const rows = await db
    .select({ event: eventsTable, teamCategory: teamsTable.category })
    .from(eventsTable)
    .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
    .where(eq(eventsTable.isPublic, true))
    .orderBy(asc(eventsTable.startsAt));
  const base = requestBase(req);
  res.json(rows.map(({ event: r, teamCategory }) => ({
    id: r.id,
    kind: r.kind,
    title: r.title,
    startsAt: r.startsAt.toISOString(),
    endsAt: r.endsAt ? r.endsAt.toISOString() : null,
    location: r.location,
    description: r.description,
    teamId: r.teamId,
    teamCategory: teamCategory ?? null,
    photoUrl: resolvePhotoUrl(base, r.photoUrl),
  })));
}) as (req: Request, res: Response) => Promise<void>);

router.get("/", requireAdminOrPlayer, (async (req, res) => {
  const isAdmin = (req as Request & { isAdmin?: boolean }).isAdmin === true;
  const base = requestBase(req);
  if (isAdmin) {
    const rows = await db
      .select({ event: eventsTable, teamName: teamsTable.name })
      .from(eventsTable)
      .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
      .orderBy(asc(eventsTable.startsAt));
    const counts = await loadRsvpCounts(rows.map((r) => r.event.id));
    res.json(rows.map(({ event, teamName }) =>
      serialize(event, teamName, { rsvpCounts: counts.get(event.id) ?? emptyCounts() }, base)));
    return;
  }
  const filtered = await listEventsForPlayer(req.player?.teamId ?? null, req.player?.id ?? null, base);
  res.json(filtered);
}) as (req: Request, res: Response) => Promise<void>);

router.post("/", requireAdminAccess, async (req, res) => {
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const { sendNotify, photoUrl, ...coreValues } = parsed;
  // For POST, undefined photoUrl means no photo (store null); explicit value stored as-is.
  const [row] = await db.insert(eventsTable).values({ ...coreValues, photoUrl: photoUrl ?? null }).returning();
  const team = parsed.teamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, parsed.teamId)))[0]
    : null;
  res.status(201).json(serialize(row, team?.name));

  if (sendNotify) {
    // Fire-and-forget notifications after responding to the admin.
    const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.hkmastershockey.com";
    const scheduleUrl = `${PUBLIC_URL}/schedule`;

    const startsAt = new Date(row.startsAt);
    const RTM_START_EPOCH = new Date("2026-07-21T00:00:00+08:00").getTime();
    const tz = startsAt.getTime() >= RTM_START_EPOCH ? "Europe/Amsterdam" : "Asia/Hong_Kong";
    const tzLabel = tz === "Europe/Amsterdam" ? " CEST" : " HKT";
    const eventDate = startsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz });
    const eventTime = startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) + tzLabel;

    const kindLabel =
      row.kind === "training" ? "Training" :
      row.kind === "social" ? "Social event" :
      row.kind === "physio" ? "Physio session" :
      row.kind === "team_dinner" ? "Team dinner" :
      row.kind === "dinner" ? "Dinner" :
      row.kind === "free_time" ? "Free time" :
      "Meeting";
    const pushPayload = {
      title: `New ${kindLabel.toLowerCase()}: ${row.title}`,
      body: `${eventDate} at ${eventTime}${row.location ? ` · ${row.location}` : ""}`,
      url: "/schedule",
    };

    (async () => {
      try {
        if (parsed.teamId != null) {
          await sendPushToTeam(parsed.teamId, pushPayload);
        } else {
          await sendPushToAll(pushPayload);
        }
      } catch (err) {
        console.error("[events] Push notification error:", err);
      }
    })();

    (async () => {
      try {
        const players = parsed.teamId != null
          ? await db.select({ id: playersTable.id, name: playersTable.name, email: playersTable.email })
              .from(playersTable)
              .where(eq(playersTable.teamId, parsed.teamId!))
              .orderBy(asc(playersTable.name))
          : await db.select({ id: playersTable.id, name: playersTable.name, email: playersTable.email })
              .from(playersTable)
              .orderBy(asc(playersTable.name));

        const withEmail = players.filter((p) => !!p.email);
        let sent = 0;
        for (const player of withEmail) {
          const ok = await sendNewEventEmail({
            playerName: player.name,
            playerEmail: player.email!,
            eventKind: row.kind,
            eventTitle: row.title,
            eventDate,
            eventTime,
            location: row.location,
            scheduleUrl,
          });
          if (ok) sent++;
        }
        console.log(`[events] New-event emails: ${sent}/${withEmail.length} sent for event #${row.id} "${row.title}"`);
      } catch (err) {
        console.error("[events] Email notification error:", err);
      }
    })();
  }
});

router.patch("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  const parsed = parseBody(req.body);
  if ("error" in parsed) return res.status(400).json({ error: parsed.error });
  const { sendNotify: _sendNotify, photoUrl, ...coreValues } = parsed;
  // Only update photoUrl in DB if the caller explicitly sent the key.
  // This makes bulk PATCH (e.g. toggle isPublic) safe — omitting photoUrl preserves the existing value.
  const updateValues: Record<string, unknown> = { ...coreValues };

  // Read the old row before mutating so we can clean up an orphaned photo.
  let oldPhotoUrl: string | null = null;
  if (photoUrl !== undefined) {
    const [existing] = await db.select({ photoUrl: eventsTable.photoUrl }).from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
    if (existing) oldPhotoUrl = existing.photoUrl ?? null;
    updateValues.photoUrl = photoUrl;
  }

  const [row] = await db.update(eventsTable).set(updateValues).where(eq(eventsTable.id, id)).returning();
  if (!row) return res.status(404).json({ error: "Event not found" });
  const team = parsed.teamId
    ? (await db.select().from(teamsTable).where(eq(teamsTable.id, parsed.teamId)))[0]
    : null;
  res.json(serialize(row, team?.name));

  // Fire-and-forget: clean up the old photo if it changed (cross-entity ref check inside).
  const oldId = extractUploadObjectId(oldPhotoUrl);
  const newId = extractUploadObjectId(photoUrl ?? null);
  if (oldId && oldId !== newId) {
    cleanupOrphanedUpload(oldId).catch(() => {});
  }
});

router.delete("/:id", requireAdminAccess, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "Invalid id" });
  // Read the photo URL before deleting so we can clean up the storage object.
  const [existing] = await db.select({ photoUrl: eventsTable.photoUrl }).from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  await db.delete(eventsTable).where(eq(eventsTable.id, id));
  res.status(204).send();

  // Fire-and-forget: clean up the orphaned photo (cross-entity ref check inside).
  const oldId = extractUploadObjectId(existing?.photoUrl);
  if (oldId) cleanupOrphanedUpload(oldId).catch(() => {});
});

// ── Image upload / serve ────────────────────────────────────────────────────

// Admin: upload a photo for an event. Returns the relative serve path to store.
router.post(
  "/image-upload",
  requireAdminAccess,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "Image too large — max 10 MB" }); return;
        }
        res.status(400).json({ error: err.message }); return;
      }
      if (err) { next(err); return; }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!ALLOWED_IMAGE_TYPES.has(req.file.mimetype)) {
      res.status(400).json({ error: "Only image files are allowed (JPEG, PNG, GIF, WebP)" }); return;
    }
    try {
      const storage = new ObjectStorageService();
      const objectPath = await storage.uploadObjectEntity(req.file.buffer, req.file.mimetype);
      const objectId = objectPath.replace("/objects/uploads/", "");
      // Return the relative serve path — callers store this in the DB and the
      // /public serialiser absolutises it at response time.
      const serveUrl = `/api/events/serve-image/${objectId}`;
      res.json({ url: serveUrl });
    } catch (err) {
      console.error("[events] image upload failed:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  },
);

// Public: stream event photo from object storage.
router.get("/serve-image/:objectId", async (req: Request, res: Response) => {
  const { objectId } = req.params;
  if (!objectId || !/^[\w-]+$/.test(objectId)) {
    res.status(400).json({ error: "Invalid objectId" }); return;
  }
  try {
    const storage = new ObjectStorageService();
    const signedUrl = await storage.getObjectEntityDownloadURL(`/objects/uploads/${objectId}`);
    res.redirect(302, signedUrl);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) {
      res.status(404).json({ error: "Image not found" }); return;
    }
    console.error("[events] serve-image failed:", err);
    res.status(502).json({ error: "Could not retrieve image" });
  }
});

// Admin-only: roster of who RSVP'd what for a single event.
router.get("/:id/rsvps", requireAdminAccess, (async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  const rows = await db
    .select({
      playerId: playersTable.id,
      playerName: playersTable.name,
      shirtNumber: playersTable.shirtNumber,
      teamId: playersTable.teamId,
      teamName: teamsTable.name,
      status: eventRsvpsTable.status,
      note: eventRsvpsTable.note,
      respondedAt: eventRsvpsTable.respondedAt,
    })
    .from(eventRsvpsTable)
    .innerJoin(playersTable, eq(playersTable.id, eventRsvpsTable.playerId))
    .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
    .where(eq(eventRsvpsTable.eventId, id))
    .orderBy(asc(playersTable.name));

  // Players invited to this event = team-scoped players (or all if event is all-squads).
  const invitedQuery = event.teamId == null
    ? db.select({ id: playersTable.id, name: playersTable.name, teamId: playersTable.teamId, teamName: teamsTable.name, shirtNumber: playersTable.shirtNumber })
        .from(playersTable)
        .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
        .orderBy(asc(playersTable.name))
    : db.select({ id: playersTable.id, name: playersTable.name, teamId: playersTable.teamId, teamName: teamsTable.name, shirtNumber: playersTable.shirtNumber })
        .from(playersTable)
        .leftJoin(teamsTable, eq(teamsTable.id, playersTable.teamId))
        .where(eq(playersTable.teamId, event.teamId))
        .orderBy(asc(playersTable.name));
  const invited = await invitedQuery;

  const responses = rows.map((r) => ({
    playerId: r.playerId,
    playerName: r.playerName,
    shirtNumber: r.shirtNumber,
    teamId: r.teamId,
    teamName: r.teamName ?? null,
    status: r.status,
    note: r.note ?? null,
    respondedAt: r.respondedAt.toISOString(),
  }));

  const respondedIds = new Set(responses.map((r) => r.playerId));
  const noResponse = invited
    .filter((p) => !respondedIds.has(p.id))
    .map((p) => ({
      playerId: p.id,
      playerName: p.name,
      shirtNumber: p.shirtNumber,
      teamId: p.teamId,
      teamName: p.teamName ?? null,
    }));

  const counts = emptyCounts();
  for (const r of responses) {
    if (r.status === "yes" || r.status === "no" || r.status === "maybe") counts[r.status]++;
  }

  res.json({
    event: serialize(event, null, { rsvpCounts: counts }),
    counts: { ...counts, noResponse: noResponse.length, invited: invited.length },
    responses,
    noResponse,
  });
}) as (req: Request, res: Response) => Promise<void>);

// Admin-only: send reminder emails to all non-responders for a single event.
router.post("/:id/rsvps/remind", requireAdminAccess, (async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }

  // Determine invited players.
  const invitedQuery = event.teamId == null
    ? db.select({ id: playersTable.id, name: playersTable.name, email: playersTable.email })
        .from(playersTable)
        .orderBy(asc(playersTable.name))
    : db.select({ id: playersTable.id, name: playersTable.name, email: playersTable.email })
        .from(playersTable)
        .where(eq(playersTable.teamId, event.teamId))
        .orderBy(asc(playersTable.name));
  const invited = await invitedQuery;

  // Find who has already responded.
  const responded = await db
    .select({ playerId: eventRsvpsTable.playerId })
    .from(eventRsvpsTable)
    .where(eq(eventRsvpsTable.eventId, id));
  const respondedIds = new Set(responded.map((r) => r.playerId));

  const allNonResponders = invited.filter((p) => !respondedIds.has(p.id));
  const nonResponders = allNonResponders.filter((p) => !!p.email);
  const skippedNoEmail = allNonResponders.length - nonResponders.length;

  // Format date and time for the email — use Rotterdam timezone for tournament events,
  // Hong Kong timezone for pre-tournament training (same threshold as the frontend).
  const PUBLIC_URL = process.env.PUBLIC_URL || "https://www.hkmastershockey.com";
  const scheduleUrl = `${PUBLIC_URL}/schedule`;

  const startsAt = new Date(event.startsAt);
  const RTM_START_EPOCH = new Date("2026-07-21T00:00:00+08:00").getTime();
  const tz = startsAt.getTime() >= RTM_START_EPOCH ? "Europe/Amsterdam" : "Asia/Hong_Kong";
  const tzLabel = tz === "Europe/Amsterdam" ? " CEST" : " HKT";

  const eventDate = startsAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: tz });
  const eventTime = startsAt.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: tz }) + tzLabel;

  let sent = 0;
  for (let i = 0; i < nonResponders.length; i++) {
    const player = nonResponders[i];
    const ok = await sendRsvpReminderEmail({
      playerName: player.name,
      playerEmail: player.email!,
      eventTitle: event.title,
      eventDate,
      eventTime,
      scheduleUrl,
    });
    if (ok) sent++;
    // Throttle to stay under the email provider's rate limit (~2/sec).
    // Without this, a burst of sends gets rate-limited (429) and silently fails.
    if (i < nonResponders.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  const failed = nonResponders.length - sent;
  console.log(`[events] Sent ${sent} RSVP reminders for event #${id} (${nonResponders.length} eligible, ${skippedNoEmail} skipped no-email, ${failed} failed)`);
  res.json({ sent, total: allNonResponders.length, skippedNoEmail, failed });
}) as (req: Request, res: Response) => Promise<void>);

// Player upserts their own RSVP for an event.
async function upsertOwnRsvp(req: Request, res: Response): Promise<void> {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) { res.status(400).json({ error: "Invalid id" }); return; }
  const status = String((req.body as { status?: unknown })?.status ?? "");
  if (!RSVP_STATUSES.includes(status as RsvpStatus)) {
    res.status(400).json({ error: "status must be yes, no or maybe" }); return;
  }
  const rawNote = (req.body as { note?: unknown })?.note;
  const note: string | null = typeof rawNote === "string" ? (rawNote.trim() || null) : null;
  const player = req.player!;

  const [event] = await db.select().from(eventsTable).where(eq(eventsTable.id, id)).limit(1);
  if (!event) { res.status(404).json({ error: "Event not found" }); return; }
  if (event.teamId != null && event.teamId !== player.teamId) {
    res.status(403).json({ error: "Event not available to your team" }); return;
  }

  const now = new Date();
  await db.insert(eventRsvpsTable)
    .values({ eventId: id, playerId: player.id, status, note, respondedAt: now })
    .onConflictDoUpdate({
      target: [eventRsvpsTable.eventId, eventRsvpsTable.playerId],
      set: { status, note, respondedAt: now },
    });

  res.json({ eventId: id, status, note, respondedAt: now.toISOString() });
}

export const playerRsvpHandler = upsertOwnRsvp;

export async function listEventsForPlayer(playerTeamId: number | null, playerId: number | null, base?: string) {
  const rows = await db
    .select({ event: eventsTable, teamName: teamsTable.name })
    .from(eventsTable)
    .leftJoin(teamsTable, eq(eventsTable.teamId, teamsTable.id))
    .where(
      playerTeamId == null
        ? isNull(eventsTable.teamId)
        : or(isNull(eventsTable.teamId), eq(eventsTable.teamId, playerTeamId)),
    )
    .orderBy(asc(eventsTable.startsAt));

  const ids = rows.map((r) => r.event.id);
  const counts = await loadRsvpCounts(ids);
  const mine = playerId != null ? await loadMyRsvps(playerId, ids) : new Map<number, { status: RsvpStatus; note: string | null }>();

  return rows.map(({ event, teamName }) =>
    serialize(event, teamName, {
      rsvpCounts: counts.get(event.id) ?? emptyCounts(),
      myRsvp: mine.get(event.id)?.status ?? null,
      myNote: mine.get(event.id)?.note ?? null,
    }, base),
  );
}

export default router;
