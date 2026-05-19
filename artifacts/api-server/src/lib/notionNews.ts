import { Client, isFullPage } from "@notionhq/client";
import { NotionToMarkdown } from "notion-to-md";

const NOTION_TOKEN = process.env.NOTION_API_TOKEN || "";
const NEWS_DB_ID = process.env.NOTION_NEWS_DATABASE_ID || "";

export function isNotionConfigured(): boolean {
  return Boolean(NOTION_TOKEN && NEWS_DB_ID);
}

let cachedClient: Client | null = null;
let cachedConverter: NotionToMarkdown | null = null;

function getClient(): Client {
  if (!cachedClient) {
    cachedClient = new Client({ auth: NOTION_TOKEN });
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
  const db: any = await client.databases.retrieve({ database_id: NEWS_DB_ID });
  const ds = Array.isArray(db.data_sources) ? db.data_sources[0] : null;
  if (!ds?.id) {
    // Older databases may still accept the database_id as the data source id.
    cachedDataSourceId = NEWS_DB_ID;
    return cachedDataSourceId;
  }
  cachedDataSourceId = ds.id;
  return cachedDataSourceId as string;
}

export async function fetchPublishedPosts(): Promise<NewsPostSummary[]> {
  if (!isNotionConfigured()) return [];
  const client = getClient();
  const dataSourceId = await resolveDataSourceId();
  const results: NewsPostSummary[] = [];
  let cursor: string | undefined = undefined;
  do {
    const res: any = await (client as any).dataSources.query({
      data_source_id: dataSourceId,
      filter: {
        property: "Status",
        select: { equals: "Published" },
      },
      sorts: [{ property: "Published date", direction: "descending" }],
      page_size: 50,
      start_cursor: cursor,
    });
    for (const page of res.results) {
      const summary = pageToSummary(page);
      if (summary) results.push(summary);
    }
    cursor = res.has_more ? res.next_cursor : undefined;
    if (results.length >= 100) break;
  } while (cursor);
  return results;
}

export async function fetchPostBySlug(slug: string): Promise<NewsPost | null> {
  if (!isNotionConfigured()) return null;
  const summaries = await fetchPublishedPosts();
  const match = summaries.find((s) => s.slug === slug);
  if (!match) return null;
  const n2m = getConverter();
  const blocks = await n2m.pageToMarkdown(match.id);
  const mdString = n2m.toMarkdownString(blocks);
  return { ...match, bodyMarkdown: mdString.parent || "" };
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
