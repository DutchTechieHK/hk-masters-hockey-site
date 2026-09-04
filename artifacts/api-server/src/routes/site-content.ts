import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import { db } from "@workspace/db";
import { siteContentTable } from "@workspace/db/schema";
import { and, eq, sql, type SQL } from "drizzle-orm";
import { requireAdminAccess } from "../middleware/adminAuth";
import sharp from "sharp";
import { ObjectStorageService } from "../lib/objectStorage";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });
// Media album uploads may be videos — allow much larger files.
const mediaUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });
const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const ALLOWED_MEDIA_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-msvideo",
];

// Default values matching what was previously in the static JSON files
const STATIC_DEFAULTS = {
  heroImage: "/images/hero-squad.jpg",
  mo40Photo: "/images/mo40-squad.jpg",
  mo50Photo: "/images/mo50-squad.jpg",
  // Self-hosted in object storage (migrated from Cloudinary, recompressed to
  // max 2000px / q80 like regular uploads).
  galleryImages: [
    { url: "/api/site-content/image/objects/uploads/bc8ae3bc-6adf-42ab-9832-b369623b2dd9" },
    { url: "/api/site-content/image/objects/uploads/a33269a0-9c67-4452-926b-ca9256e24cfc" },
    { url: "/api/site-content/image/objects/uploads/1c87afd8-10b5-4895-ad75-b2a1a29131a1" },
    { url: "/api/site-content/image/objects/uploads/0e6e6c31-1ba0-4d0d-8fcf-60d27e07e70e" },
    { url: "/api/site-content/image/objects/uploads/a73f02d5-78c7-4b5e-b166-d9e5f36f7504" },
    { url: "/api/site-content/image/objects/uploads/457f5e09-9bd4-4005-9a14-c069a922447b" },
    { url: "/api/site-content/image/objects/uploads/ea849591-8217-4d21-8ffa-73beec1f5830" },
    { url: "/api/site-content/image/objects/uploads/6aa0fe25-17e9-4c5a-bf7a-16563c6bea50" },
    { url: "/api/site-content/image/objects/uploads/ea4a5259-5bff-4dea-a414-5a10f8763713" },
    { url: "/api/site-content/image/objects/uploads/5f2dadc6-733b-4740-ab16-839a90ec6cb2" },
    { url: "/api/site-content/image/objects/uploads/988594b5-06b6-40d4-93c1-09111fdf6f9e" },
  ],
};

// Default media albums matching the previously static media.json (existing
// Cloudinary URLs are kept as-is — no re-upload needed).
const MEDIA_ALBUM_DEFAULTS: { name: string; photos: string[] }[] = [
  {
    name: "24.04 Training Session | HK Masters MO40 & MO50 Squads",
    photos: [
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777129011/IMG20260424213721_jczt7j.jpg",
      "https://res.cloudinary.com/djyvdrhal/video/upload/v1777129751/VID20260424214246_jofvq3.mp4",
      "https://res.cloudinary.com/djyvdrhal/video/upload/v1777129730/VID20260424214033_g7b0zl.mp4",
      "https://res.cloudinary.com/djyvdrhal/video/upload/v1777129476/VID20260424213619_-_Trim_d5wvtv.mp4",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777129193/IMG20260424220801_j1gkfb.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777129086/IMG20260424214330_bdvjyr.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777129063/IMG20260424213913_kvd6te.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777129044/IMG20260424213907_djwyzq.jpg",
    ],
  },
  {
    name: "WMH | Asian Championship 2025 | Trials & Training",
    photos: [
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866924/IMG_20251003_192621_ktmv2p.jpg",
      "https://res.cloudinary.com/djyvdrhal/video/upload/v1774866931/IMG_20250912_193210_qqe48y.mp4",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866922/IMG_20250919_191018_lickar.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866919/IMG_20250912_192221_advdoz.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866916/IMG_20250919_191038_jlexa4.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866912/IMG_20250905_204628_gkjotx.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866910/IMG_20250919_191117_d91ubn.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866908/IMG_20251003_192935_yrcws0.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866900/IMG_20250919_191551_wqtka9.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866905/IMG_20250912_192213_tjspxc.jpg",
      "https://res.cloudinary.com/djyvdrhal/video/upload/v1774866677/IMG_20250905_204052_p6jcve.mp4",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866666/IMG_20250817_112914_trnlvp.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866655/IMG_20250905_204240_crito2.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866659/IMG_20250905_203924_oqmldy.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866654/IMG_20250905_204235_ghgnqb.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774866655/IMG_20250817_112922_rt9pcc.jpg",
    ],
  },
  {
    name: "WMH | MO50 | World Cup 2024 | Auckland, New Zealand",
    photos: [
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-1425_1_gexlx7.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0981_tccenq.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0855_lj4mgz.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853919/A32I6153_pwqfwv.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853921/HK_M50_d4-0536_veln0s.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853587/HK_M50_d4-0350_hl2po2.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853920/HK_M50_d4-0212_ynxitw.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853919/A32I6512_weclys.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853919/A32I6117_otw8qt.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853920/HK_M50_d4-0542_qmfwka.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094734/HK_M50_d4-0441_uh1qea.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094726/HK_M50_d4-0452_btvyrw.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094672/HK_M50_d4-0649_i5mvhy.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094603/HK_M50_d4-0755_zkq9vd.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094593/HK_M50_d4-0823_ioaicp.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094535/HK_M50_d4-0981_i7up9h.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094563/HK_M50_d4-0848_xxdbsv.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094510/HK_M50_d4-1286_f8vmfz.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094237/A32I6456_rf2gy7.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094500/HK_M50_d4-1263_twg02d.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094449/HK_M50_d4-1365_wjohbp.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094467/HK_M50_d4-1250_ytemxi.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094386/HK_M50_d4-1396_hjyhds.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094364/HK_M50_d4-0403_m3yj4r.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094251/HK_M50_d4-0136_sfpcmk.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094216/A32I6081_k0t3mr.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094286/A32I6487_fq95fg.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094205/A32I6047_wmgje0.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1776094242/A32I6469_mqpdc4.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1774853919/A32I6031_ohrelm.jpg",
    ],
  },
  {
    name: "WMH | MO40 | 2023 Asian Continental Cup",
    photos: [
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777018703/2023_-_Asian_Continental_Cup_clmyab.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777018703/Wajid_rleygk.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777018703/2023_-_Asian_Continental_Cup_3_mkctu0.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777018703/2023_-_Asian_Continental_Cup_5_croit3.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777018703/2023_-_Asian_Continental_Cup_4_ujfp7w.jpg",
      "https://res.cloudinary.com/djyvdrhal/image/upload/v1777018703/2023_-_Asian_Continental_Cup_2_a9bbsr.jpg",
    ],
  },
];

// Default YouTube videos matching the previously static media.json
const MEDIA_VIDEO_DEFAULTS: { youtube_id: string; title: string; description?: string }[] = [
  {
    youtube_id: "https://www.youtube.com/watch?v=_JVBkjoumW8",
    title: "HK Masters Hockey — MO50 vs South Korea MO50 | Pool Match | Asia Championship 2025",
  },
  {
    youtube_id: "https://youtu.be/52ZTz6MCbGk",
    title: "HK Masters Hockey — HKG O60 Men vs  SGP | WMH Asia Championship 2025",
    description: "Hong Kong over 60's in a very determined match against the Singapore Team.",
  },
];

import { PAGE_TEXT_DEFAULTS, PAGE_TEXT_PAGES } from "../data/pageTextDefaults";

function parseJsonArray(raw: string | null): unknown[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

function parseMediaAlbums(raw: string | null): { name: string; photos: string[] }[] | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

// Public origin of this API for the current request (works in dev and prod,
// behind the proxy). Used to turn stored relative "/api/..." image paths into
// absolute URLs — relative paths break on the public site, which lives on a
// different domain than the API.
function requestBase(req: Request): string {
  const forwarded = req.headers["x-forwarded-proto"];
  const proto =
    (typeof forwarded === "string" ? forwarded.split(",")[0].trim() : "") ||
    req.protocol ||
    "https";
  return `${proto}://${req.get("host")}`;
}

function absolutizeUrl(url: string, base: string): string {
  // Only API-served images belong on the API origin; other relative paths
  // (e.g. the static "/images/..." fallback) are site assets and must stay relative.
  return url.startsWith("/api/") ? `${base}${url}` : url;
}

function formatRow(row: typeof siteContentTable.$inferSelect, base: string) {
  // Parse gallery — return exactly what's stored (may be []).
  // Null/parse-error falls back to static defaults (first-boot case only).
  let galleryImages: { url: string; caption?: string }[] | null = null;
  try {
    const parsed = JSON.parse(row.galleryImages);
    if (Array.isArray(parsed)) galleryImages = parsed;
  } catch {
    // keep null → will use defaults below
  }

  return {
    heroImage: absolutizeUrl(row.heroImage || STATIC_DEFAULTS.heroImage, base),
    mo40Photo: absolutizeUrl(row.mo40Photo || STATIC_DEFAULTS.mo40Photo, base),
    mo50Photo: absolutizeUrl(row.mo50Photo || STATIC_DEFAULTS.mo50Photo, base),
    // Use static defaults only when gallery has never been set (null/parse error),
    // not when admin explicitly cleared it to [].
    galleryImages: (galleryImages ?? STATIC_DEFAULTS.galleryImages).map((img) => ({
      ...img,
      url: absolutizeUrl(img.url, base),
    })),
    updatedAt: row.updatedAt?.toISOString(),
    galleryUpdatedAt: row.galleryUpdatedAt?.toISOString() ?? null,
  };
}

async function getOrCreateRow() {
  const rows = await db.select().from(siteContentTable).orderBy(siteContentTable.id).limit(1);
  if (rows.length > 0) return rows[0];
  // Seed the first row with the static gallery so the public site has
  // real content before an admin touches anything.
  const [row] = await db.insert(siteContentTable).values({
    galleryImages: JSON.stringify(STATIC_DEFAULTS.galleryImages),
  }).returning();
  return row;
}

// GET /api/site-content — public, returns current photo config
router.get("/", async (req, res) => {
  const row = await getOrCreateRow();
  res.json(formatRow(row, requestBase(req)));
});

// PUT /api/site-content — admin only, updates photo config
router.put("/", requireAdminAccess, async (req, res) => {
  const body = req.body as {
    heroImage?: string;
    mo40Photo?: string;
    mo50Photo?: string;
    galleryImages?: { url: string; caption?: string }[];
    galleryUpdatedAt?: string | null;
  };

  // Sanitize gallery entries: keep only url + optional caption strings
  const sanitizedGallery = Array.isArray(body.galleryImages)
    ? body.galleryImages
        .filter((img) => img && typeof img.url === "string" && img.url)
        .map((img) => {
          const caption = typeof img.caption === "string" ? img.caption.trim() : "";
          return caption ? { url: img.url, caption } : { url: img.url };
        })
    : null;

  const row = await getOrCreateRow();

  // Conflict guard: when the client is replacing the gallery and tells us which
  // version it based its edit on, enforce that version *in the UPDATE itself*
  // so concurrent saves can't both slip past a pre-check — only one writer
  // succeeds per version, the other gets a 409.
  const guardGallery = Boolean(sanitizedGallery) && body.galleryUpdatedAt !== undefined;
  const conditions: SQL[] = [eq(siteContentTable.id, row.id)];
  if (guardGallery) {
    const expected = body.galleryUpdatedAt ? new Date(body.galleryUpdatedAt) : null;
    conditions.push(
      sql`${siteContentTable.galleryUpdatedAt} IS NOT DISTINCT FROM ${expected}`
    );
  }

  const [updated] = await db
    .update(siteContentTable)
    .set({
      heroImage: typeof body.heroImage === "string" ? body.heroImage : row.heroImage,
      mo40Photo: typeof body.mo40Photo === "string" ? body.mo40Photo : row.mo40Photo,
      mo50Photo: typeof body.mo50Photo === "string" ? body.mo50Photo : row.mo50Photo,
      galleryImages: sanitizedGallery
        ? JSON.stringify(sanitizedGallery)
        : row.galleryImages,
      ...(sanitizedGallery ? { galleryUpdatedAt: new Date() } : {}),
    })
    .where(and(...conditions))
    .returning();

  if (!updated) {
    res.status(409).json({
      error:
        "Someone else changed the gallery since you loaded this page — please reload to see the latest version before saving.",
    });
    return;
  }

  res.json(formatRow(updated, requestBase(req)));
});

// GET /api/site-content/media-albums — public, returns Media page albums
router.get("/media-albums", async (_req, res) => {
  const row = await getOrCreateRow();
  const albums = parseMediaAlbums(row.mediaAlbums) ?? MEDIA_ALBUM_DEFAULTS;
  res.json({ albums, updatedAt: row.mediaAlbumsUpdatedAt?.toISOString() ?? null });
});

// PUT /api/site-content/media-albums — admin only, replaces the album list
router.put("/media-albums", requireAdminAccess, async (req, res) => {
  const body = req.body as {
    albums?: { name?: string; photos?: unknown }[];
    updatedAt?: string | null;
  };
  if (!Array.isArray(body.albums)) {
    res.status(400).json({ error: "albums must be an array" });
    return;
  }
  const sanitized = body.albums
    .filter((a) => a && typeof a.name === "string" && a.name.trim())
    .map((a) => ({
      name: (a.name as string).trim(),
      photos: Array.isArray(a.photos)
        ? a.photos.filter((p): p is string => typeof p === "string" && p.length > 0)
        : [],
    }));

  const row = await getOrCreateRow();

  // Conflict guard: enforce the expected version in the UPDATE's WHERE clause
  // (atomic compare-and-set) so two concurrent saves from the same baseline
  // can't both succeed — the loser gets a 409 instead of silently overwriting.
  const conditions: SQL[] = [eq(siteContentTable.id, row.id)];
  if (body.updatedAt !== undefined) {
    const expected = body.updatedAt ? new Date(body.updatedAt) : null;
    conditions.push(
      sql`${siteContentTable.mediaAlbumsUpdatedAt} IS NOT DISTINCT FROM ${expected}`
    );
  }

  const mediaAlbumsUpdatedAt = new Date();
  const updatedRows = await db
    .update(siteContentTable)
    .set({ mediaAlbums: JSON.stringify(sanitized), mediaAlbumsUpdatedAt })
    .where(and(...conditions))
    .returning({ id: siteContentTable.id });

  if (updatedRows.length === 0) {
    res.status(409).json({
      error:
        "Someone else changed the albums since you loaded this page — please reload to see the latest version before saving.",
    });
    return;
  }

  res.json({ albums: sanitized, updatedAt: mediaAlbumsUpdatedAt.toISOString() });
});

// ─── Page texts (Home, About, Teams, Rotterdam, Contact + Events/Media intros) ───

function parsePageTexts(raw: string | null): Record<string, Record<string, unknown>> | null {
  if (raw == null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
  } catch {
    // fall through
  }
  return null;
}

// Merge stored page texts over the defaults, page by page and field by field,
// so newly added fields always have a value even for rows saved earlier.
function mergedPageTexts(raw: string | null): Record<string, Record<string, unknown>> {
  const stored = parsePageTexts(raw) ?? {};
  const out: Record<string, Record<string, unknown>> = {};
  for (const page of PAGE_TEXT_PAGES) {
    out[page] = mergePageOverDefaults(page, stored[page] ?? {});
  }
  return out;
}

// Field-by-field merge of a stored page over its defaults; nested objects
// (e.g. contact.social) are deep-merged so a partial save never wipes the
// other keys.
function mergePageOverDefaults(
  page: string,
  stored: Record<string, unknown>
): Record<string, unknown> {
  const defaults = PAGE_TEXT_DEFAULTS[page] ?? {};
  const out: Record<string, unknown> = { ...defaults, ...stored };
  for (const [key, defVal] of Object.entries(defaults)) {
    const sVal = stored[key];
    if (
      defVal && typeof defVal === "object" && !Array.isArray(defVal) &&
      sVal && typeof sVal === "object" && !Array.isArray(sVal)
    ) {
      out[key] = { ...(defVal as Record<string, unknown>), ...(sVal as Record<string, unknown>) };
    }
  }
  return out;
}

// The public site renders these fields through a Markdown component that
// allows raw HTML, so submitted text must be scrubbed of anything that could
// execute script. Only a small formatting allowlist of tags survives; all
// other tags, event-handler attributes, and javascript:/data: URLs are
// stripped.
const ALLOWED_TAGS = new Set(["b", "i", "u", "em", "strong", "br", "p", "ul", "ol", "li"]);
function sanitizeText(input: string): string {
  let out = input.replace(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*?)>/g, (match, tag) => {
    if (!ALLOWED_TAGS.has(String(tag).toLowerCase())) return "";
    // keep the tag but drop all attributes (removes on* handlers, style, etc.)
    const closing = /^<\s*\//.test(match);
    return closing ? `</${String(tag).toLowerCase()}>` : `<${String(tag).toLowerCase()}>`;
  });
  // Neutralize javascript:/data:/vbscript: markdown links
  out = out.replace(/\]\(\s*(javascript|data|vbscript):[^)]*\)/gi, "](#)");
  return out;
}

// Fields that must be a URL (or empty). Applies to top-level string fields
// and to every value of the named nested object.
const URL_FIELDS = new Set(["maps_embed_src", "social", "join_url"]);
function sanitizeUrl(value: string): string {
  // Strip all control characters and whitespace — browsers normalize ASCII
  // tabs/newlines inside schemes, so "java\nscript:" would otherwise slip
  // through any scheme check.
  const v = value.replace(/[\u0000-\u0020\u007f]/g, "");
  if (!v) return "";
  if (/^\/(?!\/)/.test(v)) return v;
  // Bare domain ("fb.com/x") — normalize to https so it can't be scheme-relative
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(v) ? v : `https://${v}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed.href;
  } catch {
    // fall through
  }
  return "";
}

// Sanitize a submitted page-text object against the default shape for that
// page: only known fields are kept, and each must match the default's type
// (string, array of flat string-record objects, or flat string-record object).
function sanitizePageTexts(page: string, input: unknown): Record<string, unknown> | null {
  const defaults = PAGE_TEXT_DEFAULTS[page];
  if (!defaults || !input || typeof input !== "object" || Array.isArray(input)) return null;
  const body = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, defVal] of Object.entries(defaults)) {
    const val = body[key];
    if (val === undefined) continue;
    if (typeof defVal === "string") {
      if (typeof val === "string") {
        out[key] = URL_FIELDS.has(key) ? sanitizeUrl(val) : sanitizeText(val);
      }
    } else if (Array.isArray(defVal)) {
      if (Array.isArray(val)) {
        const template = (defVal[0] ?? {}) as Record<string, unknown>;
        out[key] = val
          .filter((item) => item && typeof item === "object" && !Array.isArray(item))
          .map((item) => {
            const row: Record<string, unknown> = {};
            for (const field of Object.keys(template)) {
              const v = (item as Record<string, unknown>)[field];
              if (typeof v === "string") row[field] = sanitizeText(v);
            }
            return row;
          })
          .filter((row) => Object.values(row).some((v) => typeof v === "string" && v.trim()));
      }
    } else if (defVal && typeof defVal === "object") {
      if (val && typeof val === "object" && !Array.isArray(val)) {
        const nested: Record<string, unknown> = {};
        for (const field of Object.keys(defVal as Record<string, unknown>)) {
          const v = (val as Record<string, unknown>)[field];
          if (typeof v === "string") {
            nested[field] = URL_FIELDS.has(key) ? sanitizeUrl(v) : sanitizeText(v);
          }
        }
        out[key] = nested;
      }
    }
  }
  return out;
}

// GET /api/site-content/page-texts — public, returns editable page text for all pages
router.get("/page-texts", async (_req, res) => {
  const row = await getOrCreateRow();
  res.json({
    pages: mergedPageTexts(row.pageTexts),
    updatedAt: row.pageTextsUpdatedAt?.toISOString() ?? null,
  });
});

// PUT /api/site-content/page-texts — admin only, replaces one page's text
router.put("/page-texts", requireAdminAccess, async (req, res) => {
  const body = req.body as {
    page?: string;
    texts?: unknown;
    updatedAt?: string | null;
  };
  const page = typeof body.page === "string" ? body.page : "";
  if (!PAGE_TEXT_PAGES.includes(page)) {
    res.status(400).json({ error: `page must be one of: ${PAGE_TEXT_PAGES.join(", ")}` });
    return;
  }
  const sanitized = sanitizePageTexts(page, body.texts);
  if (!sanitized) {
    res.status(400).json({ error: "texts must be an object of editable fields" });
    return;
  }

  // The conflict guard is mandatory: the client must echo back the version it
  // loaded (null for a never-saved row) so a stale save can never silently win.
  if (body.updatedAt === undefined) {
    res.status(400).json({ error: "updatedAt is required (use null for the first save)" });
    return;
  }
  const expected = body.updatedAt ? new Date(body.updatedAt) : null;
  if (expected && isNaN(expected.getTime())) {
    res.status(400).json({ error: "updatedAt must be a valid ISO timestamp or null" });
    return;
  }

  const row = await getOrCreateRow();
  const stored = parsePageTexts(row.pageTexts) ?? {};
  // Deep-merge nested objects so a partial save (e.g. only one social link)
  // never drops the sibling keys.
  const prevPage = (stored[page] ?? {}) as Record<string, unknown>;
  const mergedPage: Record<string, unknown> = { ...prevPage, ...sanitized };
  for (const [key, val] of Object.entries(sanitized)) {
    const prevVal = prevPage[key] ?? (PAGE_TEXT_DEFAULTS[page] ?? {})[key];
    if (
      val && typeof val === "object" && !Array.isArray(val) &&
      prevVal && typeof prevVal === "object" && !Array.isArray(prevVal)
    ) {
      mergedPage[key] = { ...(prevVal as Record<string, unknown>), ...(val as Record<string, unknown>) };
    }
  }
  const next = { ...stored, [page]: mergedPage };

  // Conflict guard: atomic compare-and-set on the page-texts timestamp so two
  // concurrent saves from the same baseline can't both succeed.
  const conditions: SQL[] = [
    eq(siteContentTable.id, row.id),
    sql`${siteContentTable.pageTextsUpdatedAt} IS NOT DISTINCT FROM ${expected}`,
  ];

  const pageTextsUpdatedAt = new Date();
  const updatedRows = await db
    .update(siteContentTable)
    .set({ pageTexts: JSON.stringify(next), pageTextsUpdatedAt })
    .where(and(...conditions))
    .returning({ id: siteContentTable.id });

  if (updatedRows.length === 0) {
    res.status(409).json({
      error:
        "Someone else changed the page text since you loaded this page — please reload to see the latest version before saving.",
    });
    return;
  }

  res.json({
    pages: mergedPageTexts(JSON.stringify(next)),
    updatedAt: pageTextsUpdatedAt.toISOString(),
  });
});

// GET /api/site-content/media-videos — public, returns Media page YouTube videos
router.get("/media-videos", async (_req, res) => {
  const row = await getOrCreateRow();
  const videos = parseJsonArray(row.mediaVideos) ?? MEDIA_VIDEO_DEFAULTS;
  res.json({ videos });
});

// PUT /api/site-content/media-videos — admin only, replaces the video list
router.put("/media-videos", requireAdminAccess, async (req, res) => {
  const body = req.body as { videos?: { youtube_id?: unknown; title?: unknown; description?: unknown }[] };
  if (!Array.isArray(body.videos)) {
    res.status(400).json({ error: "videos must be an array" });
    return;
  }
  const sanitized = body.videos
    .filter(
      (v) =>
        v &&
        typeof v.youtube_id === "string" && (v.youtube_id as string).trim() &&
        typeof v.title === "string" && (v.title as string).trim()
    )
    .map((v) => {
      const description = typeof v.description === "string" ? (v.description as string).trim() : "";
      return {
        youtube_id: (v.youtube_id as string).trim(),
        title: (v.title as string).trim(),
        ...(description ? { description } : {}),
      };
    });

  const row = await getOrCreateRow();
  await db
    .update(siteContentTable)
    .set({ mediaVideos: JSON.stringify(sanitized) })
    .where(eq(siteContentTable.id, row.id));
  res.json({ videos: sanitized });
});

// POST /api/site-content/upload-media — admin only. Uploads a photo or video
// to Cloudinary (server-side signed upload; credentials never reach the browser).
router.post(
  "/upload-media",
  requireAdminAccess,
  (req: Request, res: Response, next: NextFunction) => {
    mediaUpload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "File too large — max 100 MB" });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) { next(err); return; }
      next();
    });
  },
  async (req: Request, res: Response) => {
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (!cloudName || !apiKey || !apiSecret) {
      res.status(503).json({
        error: "Cloudinary is not configured yet — media uploads are unavailable. Ask your site maintainer to add the Cloudinary credentials.",
      });
      return;
    }
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!ALLOWED_MEDIA_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Only photos (JPEG, PNG, WebP, GIF) and videos (MP4, MOV, WebM) are allowed" });
      return;
    }

    try {
      const timestamp = Math.floor(Date.now() / 1000);
      const paramsToSign = `folder=hk-masters-media&timestamp=${timestamp}`;
      const { createHash } = await import("node:crypto");
      const signature = createHash("sha1").update(paramsToSign + apiSecret).digest("hex");

      const form = new FormData();
      form.append("file", new Blob([new Uint8Array(req.file.buffer)], { type: req.file.mimetype }), req.file.originalname || "upload");
      form.append("api_key", apiKey);
      form.append("timestamp", String(timestamp));
      form.append("folder", "hk-masters-media");
      form.append("signature", signature);

      const uploadRes = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: "POST",
        body: form,
      });
      const result = (await uploadRes.json()) as { secure_url?: string; error?: { message?: string } };
      if (!uploadRes.ok || !result.secure_url) {
        console.error("Cloudinary upload failed:", result);
        res.status(502).json({ error: result.error?.message || "Cloudinary upload failed" });
        return;
      }
      res.json({ url: result.secure_url });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      res.status(502).json({ error: "Upload to Cloudinary failed — please try again" });
    }
  }
);

// POST /api/site-content/upload-image — admin only, uploads an image
router.post(
  "/upload-image",
  requireAdminAccess,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          res.status(413).json({ error: "Image too large — max 20 MB" });
          return;
        }
        res.status(400).json({ error: err.message });
        return;
      }
      if (err) { next(err); return; }
      next();
    });
  },
  async (req: Request, res: Response) => {
    if (!req.file) { res.status(400).json({ error: "No file provided" }); return; }
    if (!ALLOWED_IMAGE_TYPES.includes(req.file.mimetype)) {
      res.status(400).json({ error: "Only image files are allowed (JPEG, PNG, WebP, GIF)" });
      return;
    }
    // Resize/compress server-side so pages load fast. Animated GIFs are kept
    // as-is (resizing would drop animation); everything else is capped at
    // 2000px wide and re-encoded as JPEG (or WebP if the source had alpha).
    let buffer = req.file.buffer;
    let contentType = req.file.mimetype;
    if (contentType !== "image/gif") {
      try {
        const meta = await sharp(buffer).metadata();
        const pipeline = sharp(buffer)
          .rotate() // apply EXIF orientation before stripping metadata
          .resize({ width: 2000, height: 2000, fit: "inside", withoutEnlargement: true });
        if (meta.hasAlpha) {
          buffer = await pipeline.webp({ quality: 80 }).toBuffer();
          contentType = "image/webp";
        } else {
          buffer = await pipeline.jpeg({ quality: 80, mozjpeg: true }).toBuffer();
          contentType = "image/jpeg";
        }
      } catch (err) {
        console.error("Image processing failed:", err);
        res.status(400).json({ error: "Could not process image — is the file a valid image?" });
        return;
      }
    }
    const storage = new ObjectStorageService();
    const objectPath = await storage.uploadObjectEntity(buffer, contentType);
    const imageUrl = `${requestBase(req)}/api/site-content/image${objectPath}`;
    res.json({ imageUrl });
  }
);

// Serve uploaded site-content images
router.use("/image/objects", async (req: Request, res: Response) => {
  const objectPath = `/objects${req.path}`;
  const storage = new ObjectStorageService();
  try {
    const signedUrl = await storage.getObjectEntityDownloadURL(objectPath);
    const gcsRes = await fetch(signedUrl);
    if (!gcsRes.ok) { res.status(502).json({ error: "Failed to fetch image" }); return; }
    const buffer = Buffer.from(await gcsRes.arrayBuffer());
    const contentType = gcsRes.headers.get("content-type") || "image/jpeg";
    res.set("Content-Type", contentType);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.set("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch {
    res.status(404).json({ error: "Image not found" });
  }
});

export default router;
