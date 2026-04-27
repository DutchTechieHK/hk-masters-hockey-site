import { useState, useEffect } from "react";
import { Link, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { cloudinaryResize } from "../utils/cloudinary";

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

export default function JournalArticle() {
  const { id } = useParams();
  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);

  useEffect(() => {
    fetch(`/api/contributions/approved/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); return null; }
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => { if (data) setArticle(data); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

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
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Article not found</h1>
        <p className="text-gray-500 mb-8">This article may have been removed or the link is incorrect.</p>
        <Link href="/journal" className="text-[#006B3C] font-semibold hover:text-green-800 transition-colors">
          &larr; Back to Journal
        </Link>
      </div>
    );
  }

  const hasPhotos = article.photoUrls && article.photoUrls.length > 0;
  const hasArticle = !!article.articleBody;

  return (
    <div>
      {/* Hero */}
      <div className="bg-[#006B3C] text-white py-10 sm:py-14">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link
            href="/journal"
            className="inline-flex items-center gap-1.5 text-green-300 hover:text-white text-sm font-medium mb-6 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Journal
          </Link>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-xs font-semibold bg-green-700 text-green-100 px-2.5 py-1 rounded-full">
              {article.contentType === "article" && "Article"}
              {article.contentType === "photo" && "Photos"}
              {article.contentType === "both" && "Article + Photos"}
            </span>
            <span className="text-xs text-green-300">
              {format(parseISO(article.createdAt), "d MMM yyyy")}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-2">
            {article.title}
          </h1>
          <p className="text-green-200 font-semibold text-base">
            By {article.authorName}
          </p>
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
          <div className="prose prose-sm sm:prose-base prose-green max-w-none text-gray-700 leading-relaxed whitespace-pre-line mb-10">
            {article.articleBody}
          </div>
        )}

        {/* Photo grid */}
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
                  className="aspect-square rounded-xl overflow-hidden bg-gray-100 group focus:outline-none focus:ring-2 focus:ring-[#006B3C]"
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

        <div className="mt-12 pt-8 border-t border-gray-100 flex items-center justify-between">
          <Link
            href="/journal"
            className="text-sm font-semibold text-[#006B3C] hover:text-green-800 transition-colors"
          >
            &larr; Back to Journal
          </Link>
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
