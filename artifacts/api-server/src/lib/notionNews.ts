import { Client, isFullPage, isFullDatabase } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";

const NOTION_TOKEN = process.env.NOTION_API_TOKEN || "";
const NEWS_DB_ID = process.env.NOTION_NEWS_DATABASE_ID || "";
// Pin Notion API version so a future server-side default change can't silently
// alter response shapes our parsers depend on.
const NOTION_API_VERSION = "2025-09-03";

// Hosts whose images we are willing to proxy (mirrors news.ts allowlist).
const NOTION_IMAGE_HOSTS = new Set([
  "prod-files-secure.s3.us-west-2.amazonaws.com",
  "file.notion.so",
  "s3.us-west-2.amazonaws.com",
]);

export function isNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && NEWS_DB_ID);
}

let cachedClient: Client | null = null;
let cachedConverter: NotionToMarkdown | null = null;

function getClient(): Client {
  if (!cachedClient) {
    cachedClient = new Client({
      auth: NOTION_TOKEN,
      notionVersion: NOTION_API_VERSION,
    });
  }
  return cachedClient;
}

function getConverter(): NotionToMarkdown {
  if (!cachedConverter) {
    cachedConverter = new NotionToMarkdown({ notionClient: getClient() });
  }
  return cachedConverter;
}

export type NewsPostSummary = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  author: string | null;
  category: string | null;
  teamTags: string[];
  publishedAt: string | null;
  coverImage: string | null;
  updatedAt: string;
};

export type NewsPost = NewsPostSummary & {
  bodyMarkdown: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Property readers — tolerant of schema variations
// ─────────────────────────────────────────────────────────────────────────────

type AnyProp = Record<string, any>;
type Props = Record<string, AnyProp>;

function readTitle(props: Props, name = "Title"): string {
  const p = props[name];
  if (!p) return "";
  if (p.type === "title" && Array.isArray(p.title)) {
    return p.title.map((t: any) => t.plain_text ?? "").join("").trim();
  }
  return "";
}

function readRichText(props: Props, name: string): string {
  const p = props[name];
  if (!p) return "";
  if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
    return p.rich_text.map((t: any) => t.plain_text ?? "").join("").trim();
  }
  if (p.type === "title" && Array.isArray(p.title)) {
    return p.title.map((t: any) => t.plain_text ?? "").join("").trim();
  }
  return "";
}

function readSelect(props: Props, name: string): string | null {
  const p = props[name];
  if (!p) return null;
  if (p.type === "select") return p.select?.name ?? null;
  if (p.type === "status") return p.status?.name ?? null;
  return null;
}

function readMultiSelect(props: Props, name: string): string[] {
  const p = props[name];
  if (!p || p.type !== "multi_select") return [];
  return (p.multi_select ?? []).map((o: any) => o.name).filter(Boolean);
}

function readDate(props: Props, name: string): string | null {
  const p = props[name];
  if (!p || p.type !== "date") return null;
  return p.date?.start ?? null;
}

function readFirstFileUrl(props: Props, name: string): string | null {
  const p = props[name];
  if (!p || p.type !== "files" || !Array.isArray(p.files) || p.files.length === 0) return null;
  const f = p.files[0];
  if (f.type === "external") return f.external?.url ?? null;
  if (f.type === "file") return f.file?.url ?? null;
  return null;
}

function readAuthor(props: Props): string | null {
  const author = readRichText(props, "Author");
  if (author) return author;
  const peopleProp = props["Author"];
  if (peopleProp?.type === "people" && Array.isArray(peopleProp.people) && peopleProp.people.length > 0) {
    return peopleProp.people[0]?.name ?? null;
  }
  return null;
}

function pageToSummary(page: any): NewsPostSummary | null {
  if (!isFullPage(page)) return null;
  const props = (page.properties ?? {}) as Props;
  const title = readTitle(props, "Title") || readTitle(props, "Name");
  if (!title) return null;
  const slugRaw = readRichText(props, "Slug");
  const slug = slugRaw ? slugRaw.toLowerCase().trim() : page.id.replace(/-/g, "");
  return {
    id: page.id,
    slug,
    title,
    excerpt: readRichText(props, "Excerpt") || null,
    author: readAuthor(props),
    category: readSelect(props, "Category"),
    teamTags: readMultiSelect(props, "Team tag"),
    publishedAt: readDate(props, "Published date") || (page.last_edited_time ?? null),
    coverImage:
      readFirstFileUrl(props, "Cover image") ||
      (page.cover?.type === "external" ? page.cover.external?.url
        : page.cover?.type === "file" ? page.cover.file?.url
        : null),
    updatedAt: page.last_edited_time ?? new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Notion API calls
// ─────────────────────────────────────────────────────────────────────────────

let cachedDataSourceId: string | null = null;

async function resolveDataSourceId(): Promise<string> {
  if (cachedDataSourceId) return cachedDataSourceId;
  const client = getClient();
  const db = await client.databases.retrieve({ database_id: NEWS_DB_ID });
  if (!isFullDatabase(db)) {
    throw new Error(`Notion database ${NEWS_DB_ID} returned a partial response`);
  }
  // In Notion API 2025-09-03 every database has a `data_sources` array.
  // Use a defensive read so older API versions (single-source databases that
  // accept the database_id directly) still work.
  const sources = (db as unknown as { data_sources?: Array<{ id: string }> })
    .data_sources;
  const first = Array.isArray(sources) && sources.length > 0 ? sources[0] : null;
  cachedDataSourceId = first?.id ?? NEWS_DB_ID;
  return cachedDataSourceId;
}

type QueryResponse = {
  results: unknown[];
  has_more: boolean;
  next_cursor: string | null;
};

async function queryDataSource(
  client: Client,
  dataSourceId: string,
  cursor: string | undefined,
): Promise<QueryResponse> {
  const ds = (client as unknown as {
    dataSources: {
      query: (args: Record<string, unknown>) => Promise<QueryResponse>;
    };
  }).dataSources;
  if (!ds || typeof ds.query !== "function") {
    throw new Error("Notion client is missing dataSources.query — SDK version mismatch");
  }
  return ds.query({
    data_source_id: dataSourceId,
    filter: { property: "Status", select: { equals: "Published" } },
    sorts: [{ property: "Published date", direction: "descending" }],
    page_size: 50,
    start_cursor: cursor,
  });
}

export async function fetchPublishedPosts(): Promise<NewsPostSummary[]> {
  if (!isNotionConfigured()) return [];
  const client = getClient();
  const dataSourceId = await resolveDataSourceId();
  const results: NewsPostSummary[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res = await queryDataSource(client, dataSourceId, cursor);
    if (!Array.isArray(res.results)) {
      throw new Error("Notion query returned unexpected shape (no results array)");
    }
    for (const page of res.results) {
      const summary = pageToSummary(page);
      if (summary) results.push(summary);
    }
    cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
    if (results.length >= 100) break;
  } while (cursor);
  return results;
}

// Public path on the api-server router where the image proxy lives.
const IMAGE_PROXY_PATH = "/api/news/image?url=";

// Rewrite Notion-hosted image URLs in a markdown body so they always go through
// our proxy (Notion's S3 URLs are signed and expire). Doing this server-side
// gives deterministic behavior independent of client-side string heuristics.
export function rewriteNotionImageUrlsInMarkdown(md: string): string {
  if (!md) return md;
  // Match ![alt](url "optional title")
  return md.replace(
    /(!\[[^\]]*\]\()([^)\s]+)((?:\s+"[^"]*")?\))/g,
    (full, prefix, rawUrl: string, suffix) => {
      const cleanUrl = rawUrl.replace(/^<|>$/g, "");
      try {
        const u = new URL(cleanUrl);
        if (u.protocol !== "https:") return full;
        if (!NOTION_IMAGE_HOSTS.has(u.hostname)) return full;
        return `${prefix}${IMAGE_PROXY_PATH}${encodeURIComponent(cleanUrl)}${suffix}`;
      } catch {
        return full;
      }
    },
  );
}

export async function fetchPostBySlug(slug: string): Promise<NewsPost | null> {
  if (!isNotionConfigured()) return null;
  const summaries = await fetchPublishedPosts();
  const match = summaries.find((s) => s.slug === slug);
  if (!match) return null;
  const n2m = getConverter();
  const blocks = await n2m.pageToMarkdown(match.id);
  const mdString = n2m.toMarkdownString(blocks);
  const body = rewriteNotionImageUrlsInMarkdown(mdString.parent || "");
  return { ...match, bodyMarkdown: body };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cache (in-memory, stale-while-revalidate)
// ─────────────────────────────────────────────────────────────────────────────

const TTL_MS = 5 * 60 * 1000;

type CacheEntry<T> = { value: T; fetchedAt: number };

const listCache = { current: null as CacheEntry<NewsPostSummary[]> | null };
const postCache = new Map<string, CacheEntry<NewsPost>>();
let listInFlight: Promise<NewsPostSummary[]> | null = null;
const postInFlight = new Map<string, Promise<NewsPost | null>>();

export function clearNewsCache(): void {
  listCache.current = null;
  postCache.clear();
}

async function refreshList(): Promise<NewsPostSummary[]> {
  if (listInFlight) return listInFlight;
  listInFlight = (async () => {
    try {
      const fresh = await fetchPublishedPosts();
      listCache.current = { value: fresh, fetchedAt: Date.now() };
      return fresh;
    } catch (err) {
      console.error("[notion-news] list refresh failed:", err);
      if (listCache.current) return listCache.current.value;
      throw err;
    } finally {
      listInFlight = null;
    }
  })();
  return listInFlight;
}

export async function getCachedList(): Promise<NewsPostSummary[]> {
  const entry = listCache.current;
  const now = Date.now();
  if (!entry) {
    return refreshList();
  }
  if (now - entry.fetchedAt > TTL_MS) {
    refreshList().catch(() => {}); // background revalidate; return stale
  }
  return entry.value;
}

async function refreshPost(slug: string): Promise<NewsPost | null> {
  const existing = postInFlight.get(slug);
  if (existing) return existing;
  const p = (async () => {
    try {
      const fresh = await fetchPostBySlug(slug);
      if (fresh) postCache.set(slug, { value: fresh, fetchedAt: Date.now() });
      return fresh;
    } catch (err) {
      console.error(`[notion-news] post refresh failed for "${slug}":`, err);
      const cached = postCache.get(slug);
      if (cached) return cached.value;
      throw err;
    } finally {
      postInFlight.delete(slug);
    }
  })();
  postInFlight.set(slug, p);
  return p;
}

export async function getCachedPost(slug: string): Promise<NewsPost | null> {
  const entry = postCache.get(slug);
  const now = Date.now();
  if (!entry) return refreshPost(slug);
  if (now - entry.fetchedAt > TTL_MS) {
    refreshPost(slug).catch(() => {});
  }
  return entry.value;
}
