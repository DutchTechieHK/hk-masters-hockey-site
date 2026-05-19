import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { API_BASE } from "../utils/api";
import { useOpenGraph } from "../utils/useOpenGraph";
import ShareMenu from "../components/ShareMenu";

function proxiedImage(url) {
  if (!url) return null;
  if (
    url.includes("amazonaws.com") ||
    url.includes("notion.so") ||
    url.includes("file.notion")
  ) {
    return `${API_BASE}/api/news/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

// Strict URL sanitizer for ReactMarkdown — drops javascript:, vbscript:, file:,
// and other non-web schemes so rendered links/images can never execute script.
// Allows http(s), mailto, tel, and inline image data: URIs.
const SAFE_PROTOCOLS = /^(?:https?|mailto|tel):/i;
function sanitizeUrl(url, key) {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/") || trimmed.startsWith("#") || trimmed.startsWith("?")) return trimmed;
  if (key === "src" && /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i.test(trimmed)) {
    return trimmed;
  }
  if (SAFE_PROTOCOLS.test(trimmed)) return trimmed;
  return "";
}

function useArticleOpenGraph(post) {
  const ogTitle = post ? `${post.title} — HK Masters Hockey` : null;
  const ogDescription = post?.excerpt
    ? post.excerpt.trim().slice(0, 160).replace(/\s+/g, " ")
    : null;
  const ogImage = post?.coverImage ? proxiedImage(post.coverImage) : null;
  const ogUrl = post?.slug ? `${window.location.origin}/news/${post.slug}` : null;
  useOpenGraph({
    title: ogTitle,
    description: ogDescription,
    image: ogImage,
    url: ogUrl,
    type: "article",
  });
}

export default function NewsArticle() {
  const { slug } = useParams();
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useArticleOpenGraph(post);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setNotFound(false);
    fetch(`${API_BASE}/api/news/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true);
          return null;
        }
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data) setPost(data);
      })
      .catch(() => {
        if (cancelled) return;
        setNotFound(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
        <div className="space-y-4 animate-pulse">
          <div className="h-8 bg-gray-100 rounded w-2/3" />
          <div className="h-4 bg-gray-100 rounded w-1/3" />
          <div className="h-64 bg-gray-100 rounded-2xl" />
          <div className="h-4 bg-gray-100 rounded" />
          <div className="h-4 bg-gray-100 rounded w-4/5" />
        </div>
      </div>
    );
  }

  if (notFound || !post) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-5xl mb-6">📰</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">This article is no longer available</h1>
        <p className="text-gray-500 mb-8">It may have been removed. Head back to News to browse other posts.</p>
        <Link href="/news" className="inline-flex items-center gap-1.5 text-[#1E3A6E] font-semibold hover:text-[#16305D] transition-colors">
          &larr; Back to News
        </Link>
      </div>
    );
  }

  const dateStr = post.publishedAt ? format(parseISO(post.publishedAt), "d MMM yyyy") : null;
  const cover = proxiedImage(post.coverImage);

  return (
    <div>
      {/* Hero */}
      <div className="bg-[#1E3A6E] text-white py-10 sm:py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 text-[#8FBDE8] hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to News
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            {post.category && (
              <span className="text-xs font-semibold bg-[#16305D] text-[#BFD9F5] px-2.5 py-1 rounded-full">
                {post.category}
              </span>
            )}
            {dateStr && <span className="text-xs text-[#8FBDE8]">{dateStr}</span>}
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-2">{post.title}</h1>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            {post.author && (
              <p className="text-[#BFD9F5] font-semibold text-base">By {post.author}</p>
            )}
            <ShareMenu title={post.title} variant="hero" />
          </div>
        </div>
      </div>

      {/* Cover */}
      {cover && (
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mb-6 mt-8">
          <div className="aspect-[16/7] rounded-2xl overflow-hidden shadow-lg bg-gray-100">
            <img src={cover} alt={post.title} className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {post.bodyMarkdown ? (
          <div className="prose prose-sm sm:prose-base max-w-none prose-headings:text-gray-900 prose-a:text-[#1E3A6E] prose-img:rounded-xl">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              urlTransform={sanitizeUrl}
              components={{
                img: ({ src, alt }) => (
                  <img src={src} alt={alt || ""} loading="lazy" />
                ),
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer">
                    {children}
                  </a>
                ),
              }}
            >
              {post.bodyMarkdown}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-gray-500 italic">This post has no body content.</p>
        )}

        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between gap-3">
          <Link
            href="/news"
            className="text-sm font-semibold text-[#1E3A6E] hover:text-[#16305D] transition-colors"
          >
            &larr; Back to News
          </Link>
          <ShareMenu title={post.title} variant="footer" />
        </div>
      </div>
    </div>
  );
}
