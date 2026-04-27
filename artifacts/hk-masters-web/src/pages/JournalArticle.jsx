import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "wouter";
import { format, parseISO } from "date-fns";
import { cloudinaryResize } from "../utils/cloudinary";
import { API_BASE } from "../utils/api";

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
  const [copied, setCopied] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const shareRef = useRef(null);

  useEffect(() => {
    if (!shareOpen) return;
    const handleClickOutside = (e) => {
      if (shareRef.current && !shareRef.current.contains(e.target)) {
        setShareOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [shareOpen]);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {}
    setShareOpen(false);
  };

  const handleWhatsApp = () => {
    const url = window.location.href;
    const text = encodeURIComponent(`${article?.title}\n${url}`);
    window.open(`https://wa.me/?text=${text}`, "_blank", "noopener,noreferrer");
    setShareOpen(false);
  };

  const handleEmail = () => {
    const url = window.location.href;
    const subject = encodeURIComponent(article?.title ?? "");
    const body = encodeURIComponent(`I thought you'd enjoy this article from the HK Masters journal:\n\n${article?.title}\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShareOpen(false);
  };

  useEffect(() => {
    fetch(`${API_BASE}/api/contributions/approved/${id}`)
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
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="text-green-200 font-semibold text-base">
              By {article.authorName}
            </p>
            <div className="relative" ref={shareRef}>
              <button
                onClick={() => setShareOpen((o) => !o)}
                className="inline-flex items-center gap-1.5 text-sm font-semibold bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Share article"
                aria-expanded={shareOpen}
              >
                {copied ? (
                  <>
                    <svg className="w-4 h-4 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Link copied!
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share
                  </>
                )}
              </button>

              {shareOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-20">
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy link
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={handleWhatsApp}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-[#25D366] shrink-0" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                    Share via WhatsApp
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={handleEmail}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Share via Email
                  </button>
                </div>
              )}
            </div>
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
