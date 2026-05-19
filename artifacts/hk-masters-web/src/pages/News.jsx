import { useEffect, useState } from "react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { API_BASE } from "../utils/api";

function proxiedImage(url) {
  if (!url) return null;
  // Notion's signed S3 URLs expire — proxy through the API server.
  if (
    url.includes("amazonaws.com") ||
    url.includes("notion.so") ||
    url.includes("file.notion")
  ) {
    return `${API_BASE}/api/news/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function NewsCard({ post }) {
  const dateStr = post.publishedAt
    ? format(parseISO(post.publishedAt), "d MMM yyyy")
    : null;
  const cover = proxiedImage(post.coverImage);

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      <Link href={`/news/${post.slug}`} className="block">
        {cover ? (
          <div className="aspect-[16/9] overflow-hidden bg-gray-100">
            <img
              src={cover}
              alt={post.title}
              className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] bg-[#16305D] flex items-center justify-center">
            <span className="text-[#5B9FE0] text-xs font-semibold uppercase tracking-widest opacity-60">
              HK Masters News
            </span>
          </div>
        )}
      </Link>
      <div className="p-6 flex flex-col flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {post.category && (
            <span className="text-xs font-semibold bg-[#EEF4FB] text-[#1E3A6E] px-2.5 py-1 rounded-full">
              {post.category}
            </span>
          )}
          {dateStr && <span className="text-xs text-gray-400">{dateStr}</span>}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1 leading-snug">
          <Link
            href={`/news/${post.slug}`}
            className="hover:text-[#1E3A6E] transition-colors"
          >
            {post.title}
          </Link>
        </h2>
        {post.author && (
          <p className="text-sm text-[#1E3A6E] font-semibold mb-3">
            By {post.author}
          </p>
        )}
        {post.excerpt && (
          <p className="text-sm text-gray-600 leading-relaxed mb-4 flex-1">
            {post.excerpt}
          </p>
        )}
        <Link
          href={`/news/${post.slug}`}
          className="mt-auto self-start text-sm font-semibold text-[#1E3A6E] hover:text-[#16305D] transition-colors"
        >
          Read more &rarr;
        </Link>
      </div>
    </article>
  );
}

export default function News() {
  const [state, setState] = useState({ loading: true, posts: [], configured: true, error: null });

  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/news`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Failed to load news"))))
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, posts: data.posts || [], configured: data.configured !== false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        setState({ loading: false, posts: [], configured: true, error: err.message });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div>
      {/* Hero */}
      <div className="bg-[#1E3A6E] text-white py-12 sm:py-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <p className="text-[#DE2910] text-sm font-bold uppercase tracking-widest mb-2">
            HK Masters News
          </p>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
            Latest updates from the team
          </h1>
          <p className="text-[#BFD9F5] max-w-2xl leading-relaxed">
            Announcements, tournament news and match reports from Hong Kong Masters Hockey.
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {state.loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 overflow-hidden animate-pulse">
                <div className="aspect-[16/9] bg-gray-100" />
                <div className="p-6 space-y-3">
                  <div className="h-3 bg-gray-100 rounded w-20" />
                  <div className="h-5 bg-gray-100 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-full" />
                  <div className="h-3 bg-gray-100 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!state.loading && state.error && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-8 text-center">
            <p className="text-amber-900 font-semibold mb-2">News is temporarily unavailable</p>
            <p className="text-sm text-amber-800">Please try again in a few minutes.</p>
          </div>
        )}

        {!state.loading && !state.error && state.posts.length === 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-12 text-center">
            <div className="text-4xl mb-3">📰</div>
            <p className="text-gray-700 font-semibold mb-1">No news posts yet</p>
            <p className="text-sm text-gray-500">Check back soon for tournament updates and announcements.</p>
          </div>
        )}

        {!state.loading && state.posts.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {state.posts.map((post) => (
              <NewsCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
