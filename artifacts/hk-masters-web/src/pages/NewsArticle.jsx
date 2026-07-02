import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import DOMPurify from "dompurify";
import { API_BASE } from "../utils/api";
import { useOpenGraph } from "../utils/useOpenGraph";
import ShareMenu from "../components/ShareMenu";

function proxiedImage(url) {
  if (!url) return null;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

function sanitizeHtml(html) {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      "p","br","strong","em","u","s","del","h1","h2","h3","h4","h5","h6",
      "ul","ol","li","blockquote","hr","a","img","figure","figcaption",
      "table","thead","tbody","tr","th","td","code","pre","span","div",
    ],
    ALLOWED_ATTR: ["href","src","alt","title","target","rel","class","style"],
    ALLOW_DATA_ATTR: false,
    FORCE_BODY: true,
    RETURN_DOM_FRAGMENT: false,
  });
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
  const [errorKind, setErrorKind] = useState(null); // "notFound" | "transient" | null

  useArticleOpenGraph(post);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setErrorKind(null);
    fetch(`${API_BASE}/api/news/${encodeURIComponent(slug)}`)
      .then((r) => {
        if (r.status === 404) {
          if (!cancelled) setErrorKind("notFound");
          return null;
        }
        if (!r.ok) {
          if (!cancelled) setErrorKind("transient");
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data) setPost(data);
      })
      .catch(() => {
        if (cancelled) return;
        setErrorKind("transient");
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

  if (errorKind === "transient" || (!post && errorKind !== "notFound")) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-5xl mb-6">⚠️</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">This article is temporarily unavailable</h1>
        <p className="text-gray-500 mb-8">We couldn't load this post right now. Please try again in a few minutes.</p>
        <Link href="/news" className="inline-flex items-center gap-1.5 text-[#1E3A6E] font-semibold hover:text-[#16305D] transition-colors">
          &larr; Back to News
        </Link>
      </div>
    );
  }

  if (errorKind === "notFound" || !post) {
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
        {post.bodyHtml ? (
          <div
            className="prose prose-sm sm:prose-base max-w-none prose-headings:text-gray-900 prose-a:text-[#1E3A6E] prose-img:rounded-xl"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(post.bodyHtml) }}
          />
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
