import { useState, useEffect } from "react";
import { Link, useParams, useLocation } from "wouter";
import { format, parseISO } from "date-fns";
import { cloudinaryResize } from "../utils/cloudinary";
import { API_BASE } from "../utils/api";
import { useOpenGraph } from "../utils/useOpenGraph";
import ShareMenu from "../components/ShareMenu";

function PhotoLightbox({ urls, startIndex, onClose }) {
  const [current, setCurrent] = useState(startIndex);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") setCurrent((c) => (c + 1) % urls.length);
      if (e.key === "ArrowLeft") setCurrent((c) => (c - 1 + urls.length) % urls.length);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [urls.length, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl w-full mx-4 flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={cloudinaryResize(urls[current], 1200, 900)}
          alt={`Photo ${current + 1}`}
          className="max-h-[80vh] max-w-full rounded-xl object-contain shadow-2xl"
        />
        <p className="text-white/60 text-sm mt-3">{current + 1} / {urls.length}</p>

        {urls.length > 1 && (
          <>
            <button
              onClick={() => setCurrent((c) => (c - 1 + urls.length) % urls.length)}
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-8 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
              aria-label="Previous photo"
            >
              ‹
            </button>
            <button
              onClick={() => setCurrent((c) => (c + 1) % urls.length)}
              className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-8 bg-white/10 hover:bg-white/20 text-white rounded-full w-10 h-10 flex items-center justify-center transition-colors"
              aria-label="Next photo"
            >
              ›
            </button>
          </>
        )}

        <button
          onClick={onClose}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full w-8 h-8 flex items-center justify-center text-lg transition-colors"
          aria-label="Close preview"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function useArticleOpenGraph(article) {
  const ogTitle = article ? `${article.title} — HK Masters Hockey` : null;
  const rawDescription = article?.articleBody || "";
  const ogDescription = rawDescription.trim().slice(0, 160).replace(/\s+/g, " ") || null;
  const hasPhoto = article?.photoUrls?.length > 0;
  const ogImage = hasPhoto ? cloudinaryResize(article.photoUrls[0], 1200, 630) : null;
  const identifier = article?.slug || article?.id;
  const ogUrl = identifier ? `${window.location.origin}/journal/${identifier}` : null;

  useOpenGraph({
    title: ogTitle,
    description: ogDescription,
    image: ogImage,
    url: ogUrl,
    type: "article",
  });
}

export default function JournalArticle() {
  const { slug } = useParams();
  const [, navigate] = useLocation();
  const [article, setArticle]           = useState(null);
  const [loading, setLoading]           = useState(true);
  const [notFound, setNotFound]         = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useArticleOpenGraph(article);

  useEffect(() => {
    fetch(`${API_BASE}/api/contributions/approved/${slug}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        if (data) {
          setArticle(data);
          if (data.slug && data.slug !== slug) {
            navigate(`/journal/${data.slug}`, { replace: true });
          }
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
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

  if (notFound || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="text-5xl mb-6">📄</div>
        <h1 className="text-3xl font-bold text-gray-900 mb-4">This article is no longer available</h1>
        <p className="text-gray-500 mb-8">It may have been removed. Head back to the Journal to browse other stories.</p>
        <Link href="/journal" className="inline-flex items-center gap-1.5 text-[#1E3A6E] font-semibold hover:text-[#16305D] transition-colors">
          &larr; Back to Journal
        </Link>
      </div>
    );
  }

  const hasPhotos  = article.photoUrls && article.photoUrls.length > 0;
  const hasArticle = !!article.articleBody;

  return (
    <div>
      {/* Hero */}
      <div className="bg-[#1E3A6E] text-white py-10 sm:py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 text-[#8FBDE8] hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Journal
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-semibold bg-[#16305D] text-[#BFD9F5] px-2.5 py-1 rounded-full">
              {article.contentType === "article" && "Article"}
              {article.contentType === "photo" && "Photos"}
              {article.contentType === "both" && "Article + Photos"}
            </span>
            <span className="text-xs text-[#8FBDE8]">
              {format(parseISO(article.createdAt), "d MMM yyyy")}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-2">
            {article.title}
          </h1>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-[#BFD9F5] font-semibold text-base">
              By {article.authorName}
            </p>
            <ShareMenu title={article.title} variant="hero" />
          </div>
        </div>
      </div>

      {/* Cover photo */}
      {hasPhotos && (
        <div
          className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 -mb-6 mt-8 cursor-pointer"
          onClick={() => setLightboxIndex(0)}
        >
          <div className="aspect-[16/7] rounded-2xl overflow-hidden shadow-lg bg-gray-100">
            <img
              src={cloudinaryResize(article.photoUrls[0], 1200, 525)}
              alt={article.title}
              className="w-full h-full object-cover hover:scale-[1.01] transition-transform duration-300"
            />
          </div>
        </div>
      )}

      {/* Body */}
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {hasArticle && (
          <div className="prose prose-sm sm:prose-base max-w-none text-gray-700 leading-relaxed whitespace-pre-line mb-10">
            {article.articleBody}
          </div>
        )}

        {hasPhotos && article.photoUrls.length > 1 && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              Photos ({article.photoUrls.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {article.photoUrls.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setLightboxIndex(i)}
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 group focus:outline-none focus:ring-2 focus:ring-[#1E3A6E]"
                >
                  <img
                    src={cloudinaryResize(url, 400, 400)}
                    alt={`Photo ${i + 1}`}
                    className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-200"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between gap-3">
          <Link
            href="/journal"
            className="text-sm font-semibold text-[#1E3A6E] hover:text-[#16305D] transition-colors"
          >
            &larr; Back to Journal
          </Link>
          <ShareMenu title={article.title} variant="footer" />
        </div>
      </div>

      {lightboxIndex !== null && hasPhotos && (
        <PhotoLightbox
          urls={article.photoUrls}
          startIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
