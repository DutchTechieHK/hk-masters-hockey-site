import { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "wouter";
import { cloudinaryResize } from "../utils/cloudinary";
import { API_BASE } from "../utils/api";
import { format, parseISO } from "date-fns";
import ShareMenu from "../components/ShareMenu";
import SponsorStrip from "../components/SponsorStrip";

const CLOUD_NAME = "djyvdrhal";
const UPLOAD_PRESET = "hk_masters_unsigned";
const MAX_PHOTOS = 25;

function useApprovedContributions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/contributions/approved`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

function ArticleCard({ contribution }) {
  const [expanded, setExpanded] = useState(false);
  const hasPhotos = contribution.photoUrls && contribution.photoUrls.length > 0;
  const hasArticle = !!contribution.articleBody;
  const body = contribution.articleBody || "";
  const isLong = body.length > 400;
  const displayBody = isLong && !expanded ? body.slice(0, 400) + "…" : body;
  const articleUrl = `${window.location.origin}/journal/${contribution.slug || contribution.id}`;

  return (
    <article className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      {hasPhotos && (
        <div className="aspect-[16/7] overflow-hidden bg-gray-100">
          <img
            src={cloudinaryResize(contribution.photoUrls[0], 800, 350)}
            alt={contribution.title}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
      )}
      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-800 px-2.5 py-1 rounded-full">
            {contribution.contentType === "article" && "Article"}
            {contribution.contentType === "photo" && "Photos"}
            {contribution.contentType === "both" && "Article + Photos"}
          </span>
          <span className="text-xs text-gray-400">
            {format(parseISO(contribution.createdAt), "d MMM yyyy")}
          </span>
        </div>

        <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1 leading-snug">
          <Link href={`/journal/${contribution.slug || contribution.id}`} className="hover:text-[#006B3C] transition-colors">
            {contribution.title}
          </Link>
        </h2>
        <p className="text-sm text-[#006B3C] font-semibold mb-4">
          By {contribution.authorName}
        </p>

        {hasArticle && (
          <div className="text-gray-700 leading-relaxed mb-4 whitespace-pre-line text-sm sm:text-base">
            {displayBody}
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="ml-2 text-[#006B3C] font-semibold hover:text-green-800 transition-colors"
              >
                {expanded ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {hasPhotos && contribution.photoUrls.length > 1 && (
          <div className="grid grid-cols-3 gap-2 mt-4">
            {contribution.photoUrls.slice(1, 4).map((url, i) => (
              <div key={i} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                <img
                  src={cloudinaryResize(url, 300, 300)}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ))}
            {contribution.photoUrls.length > 4 && (
              <div className="aspect-square rounded-lg bg-gray-100 flex items-center justify-center text-xs text-gray-500 font-semibold">
                +{contribution.photoUrls.length - 4} more
              </div>
            )}
          </div>
        )}

        <div className="mt-5 pt-4 border-t border-gray-50 flex items-center justify-between gap-3">
          <Link
            href={`/journal/${contribution.slug || contribution.id}`}
            className="text-sm font-semibold text-[#006B3C] hover:text-green-800 transition-colors"
          >
            Read full article &rarr;
          </Link>
          <ShareMenu title={contribution.title} url={articleUrl} variant="footer" />
        </div>
      </div>
    </article>
  );
}

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

function ContributeForm() {
  const [form, setForm] = useState({
    authorName: "",
    authorEmail: "",
    contentType: "article",
    title: "",
    articleBody: "",
  });
  const [photoUrls, setPhotoUrls] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState([]);
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [widgetLoaded, setWidgetLoaded] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(null);
  const dragIndex = useRef(null);
  const [touchDrag, setTouchDrag] = useState({ from: null, over: null });
  const [dragPos, setDragPos] = useState(null);
  const touchDragRef = useRef({ active: false, fromIndex: null, toIndex: null, timer: null, lastX: 0, lastY: 0 });
  const touchDidDragRef = useRef(false);
  const canceledUploadIdsRef = useRef(new Set());

  const needsPhotos = form.contentType === "photo" || form.contentType === "both";
  const needsArticle = form.contentType === "article" || form.contentType === "both";
  const atPhotoLimit = photoUrls.length + uploadingPhotos.length >= MAX_PHOTOS;

  useEffect(() => {
    if (!UPLOAD_PRESET || !needsPhotos) return;
    if (window.cloudinary) { setWidgetLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.onload = () => setWidgetLoaded(true);
    document.head.appendChild(script);
  }, [needsPhotos]);

  useEffect(() => {
    return () => {
      setUploadingPhotos((prev) => {
        prev.forEach((p) => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl); });
        return prev;
      });
    };
  }, []);

  const openUploadWidget = useCallback((currentPhotoUrls, currentUploadingPhotos) => {
    if (!window.cloudinary) return;
    const totalQueued = currentPhotoUrls.length + currentUploadingPhotos.length;
    if (totalQueued >= MAX_PHOTOS) return;
    const remaining = MAX_PHOTOS - totalQueued;
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        multiple: true,
        maxFiles: remaining,
        resourceType: "image",
        sources: ["local", "camera", "url"],
        showUploadMoreButton: true,
        styles: {
          palette: {
            window: "#FFFFFF",
            sourceBg: "#F9FAFB",
            windowBorder: "#E5E7EB",
            tabIcon: "#006B3C",
            inactiveTabIcon: "#6B7280",
            menuIcons: "#006B3C",
            link: "#006B3C",
            action: "#DE2910",
            inProgress: "#006B3C",
            complete: "#006B3C",
            error: "#EF4444",
            textDark: "#111827",
            textLight: "#FFFFFF",
          },
        },
      },
      (err, result) => {
        if (!result) return;
        if (result.event === "upload-added") {
          const id = result.info.id;
          const previewUrl =
            result.info.file instanceof Blob
              ? URL.createObjectURL(result.info.file)
              : null;
          setUploadingPhotos((prev) => [...prev, { id, progress: 0, error: false, previewUrl }]);
        } else if (result.event === "progress") {
          const id = result.info.id;
          const raw = result.info.progress ?? 0;
          const progress = Math.round(raw <= 1 ? raw * 100 : raw);
          setUploadingPhotos((prev) =>
            prev.map((p) => (p.id === id ? { ...p, progress } : p))
          );
        } else if (result.event === "success") {
          const id = result.info.id;
          const wasCanceled = canceledUploadIdsRef.current.has(id);
          canceledUploadIdsRef.current.delete(id);
          setUploadingPhotos((prev) => {
            const match = prev.find((p) => p.id === id);
            if (match?.previewUrl) URL.revokeObjectURL(match.previewUrl);
            return prev.filter((p) => p.id !== id);
          });
          if (!wasCanceled) {
            setPhotoUrls((prev) => [...prev, result.info.secure_url]);
          }
        } else if (result.event === "error") {
          const id = result.info && result.info.id;
          if (id) {
            canceledUploadIdsRef.current.delete(id);
            setUploadingPhotos((prev) =>
              prev.map((p) => (p.id === id ? { ...p, error: true } : p))
            );
          }
        }
      }
    );
    widget.open();
  }, []);

  const removePhoto = (index) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleTileTouchStart = (i) => (e) => {
    const td = touchDragRef.current;
    clearTimeout(td.timer);
    const touch = e.touches[0];
    td.lastX = touch.clientX;
    td.lastY = touch.clientY;
    td.timer = setTimeout(() => {
      td.active = true;
      td.fromIndex = i;
      td.toIndex = i;
      if (navigator.vibrate) navigator.vibrate(30);
      setTouchDrag({ from: i, over: i });
      setDragPos({ x: td.lastX, y: td.lastY });
    }, 400);
  };

  const handleGridTouchMove = (e) => {
    const td = touchDragRef.current;
    const touch = e.touches[0];
    td.lastX = touch.clientX;
    td.lastY = touch.clientY;
    if (!td.active) return;
    e.preventDefault();
    setDragPos({ x: touch.clientX, y: touch.clientY });
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    const cell = el && el.closest("[data-drag-index]");
    if (cell) {
      const idx = parseInt(cell.dataset.dragIndex, 10);
      if (!isNaN(idx) && idx !== td.toIndex) {
        td.toIndex = idx;
        setTouchDrag((prev) => ({ ...prev, over: idx }));
      }
    }
  };

  const handleGridTouchEnd = () => {
    const td = touchDragRef.current;
    clearTimeout(td.timer);
    if (td.active) {
      touchDidDragRef.current = true;
      setTimeout(() => { touchDidDragRef.current = false; }, 300);
      if (td.fromIndex !== null && td.toIndex !== null && td.fromIndex !== td.toIndex) {
        setPhotoUrls((prev) => {
          const next = [...prev];
          const [moved] = next.splice(td.fromIndex, 1);
          next.splice(td.toIndex, 0, moved);
          return next;
        });
      }
    }
    td.active = false;
    td.fromIndex = null;
    td.toIndex = null;
    td.timer = null;
    setTouchDrag({ from: null, over: null });
    setDragPos(null);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "contentType") { setPhotoUrls([]); setUploadingPhotos([]); }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.authorName.trim() || !form.authorEmail.trim() || !form.title.trim()) {
      setError("Please fill in all required fields.");
      return;
    }
    if (needsArticle && !form.articleBody.trim()) {
      setError("Please write your article text.");
      return;
    }
    if (needsPhotos && photoUrls.length === 0) {
      setError("Please add at least one photo.");
      return;
    }
    if (needsPhotos && uploadingPhotos.some((p) => !p.error)) {
      setError("Please wait for all photos to finish uploading.");
      return;
    }

    setStatus("submitting");
    try {
      const body = {
        title: form.title.trim(),
        authorName: form.authorName.trim(),
        authorEmail: form.authorEmail.trim(),
        contentType: form.contentType,
        ...(needsArticle && { articleBody: form.articleBody.trim() }),
        ...(needsPhotos && { photoUrls }),
      };
      const res = await fetch(`${API_BASE}/api/contributions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Submission failed (${res.status})`);
      }
      setStatus("success");
    } catch (err) {
      setError(err.message || "Something went wrong. Please try again.");
      setStatus("idle");
    }
  };

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-2xl p-10 text-center max-w-xl mx-auto">
        <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-2">Thanks for sharing!</h3>
        <p className="text-gray-600 leading-relaxed">
          Your contribution has been submitted for review. Once approved by the admin team, it will appear in the Journal for all members to read.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            onClick={() => {
              setStatus("idle");
              setForm({ authorName: "", authorEmail: "", contentType: "article", title: "", articleBody: "" });
              setPhotoUrls([]);
              setUploadingPhotos([]);
            }}
            className="text-sm font-semibold text-[#006B3C] hover:text-green-800 transition-colors"
          >
            Submit another contribution →
          </button>
          <Link href="/my-submission" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
            Check your submission status →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Display name <span className="text-[#DE2910]">*</span>
          </label>
          <input
            type="text"
            name="authorName"
            value={form.authorName}
            onChange={handleChange}
            placeholder="Your name"
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Email <span className="text-[#DE2910]">*</span>
          </label>
          <input
            type="email"
            name="authorEmail"
            value={form.authorEmail}
            onChange={handleChange}
            placeholder="your@email.com"
            required
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          What are you contributing? <span className="text-[#DE2910]">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: "article", label: "Article", desc: "Write a match report or story" },
            { value: "photo", label: "Photos", desc: "Share photos from games or training" },
            { value: "both", label: "Both", desc: "Article and photos together" },
          ].map((opt) => (
            <label
              key={opt.value}
              className={`relative flex flex-col items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-150 ${
                form.contentType === opt.value
                  ? "border-[#006B3C] bg-green-50"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <input
                type="radio"
                name="contentType"
                value={opt.value}
                checked={form.contentType === opt.value}
                onChange={handleChange}
                className="sr-only"
              />
              <span className={`font-semibold text-sm ${form.contentType === opt.value ? "text-[#006B3C]" : "text-gray-800"}`}>
                {opt.label}
              </span>
              <span className="text-xs text-gray-500 text-center mt-1 leading-tight">{opt.desc}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
          Title <span className="text-[#DE2910]">*</span>
        </label>
        <input
          type="text"
          name="title"
          value={form.title}
          onChange={handleChange}
          placeholder="Give your contribution a title…"
          required
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
        />
      </div>

      {needsArticle && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            Your story <span className="text-[#DE2910]">*</span>
          </label>
          <textarea
            name="articleBody"
            value={form.articleBody}
            onChange={handleChange}
            placeholder="Write your article, match report, or story here…"
            rows={8}
            required={needsArticle}
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#006B3C]/30 focus:border-[#006B3C] transition-colors"
          />
        </div>
      )}

      {needsPhotos && (
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-2">
            Photos <span className="text-[#DE2910]">*</span>
          </label>

          {(photoUrls.length > 0 || uploadingPhotos.length > 0) && (
            <>
              {uploadingPhotos.some((p) => !p.error) && (
                <p className="text-sm text-gray-500 mb-2">
                  {(() => {
                    const total = photoUrls.length + uploadingPhotos.length;
                    const completed = photoUrls.length;
                    return `Uploading ${completed} of ${total} photo${total !== 1 ? "s" : ""}…`;
                  })()}
                </p>
              )}
              <div
                className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2"
                onTouchMove={handleGridTouchMove}
                onTouchEnd={handleGridTouchEnd}
                onTouchCancel={handleGridTouchEnd}
                style={{ touchAction: touchDrag.from !== null ? "none" : "auto" }}
              >
                {photoUrls.map((url, i) => {
                  const isBeingDragged = touchDrag.from === i;
                  const isDropTarget = touchDrag.from !== null && touchDrag.over === i && touchDrag.from !== i;
                  return (
                    <div
                      key={url}
                      data-drag-index={i}
                      draggable
                      onDragStart={() => { dragIndex.current = i; }}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => {
                        const from = dragIndex.current;
                        if (from === null || from === i) return;
                        setPhotoUrls((prev) => {
                          const next = [...prev];
                          const [moved] = next.splice(from, 1);
                          next.splice(i, 0, moved);
                          return next;
                        });
                        dragIndex.current = null;
                      }}
                      onDragEnd={() => { dragIndex.current = null; }}
                      onTouchStart={handleTileTouchStart(i)}
                      className={[
                        "relative aspect-square rounded-lg overflow-hidden bg-gray-100 group cursor-grab active:cursor-grabbing transition-all duration-150",
                        isBeingDragged ? "opacity-40 scale-95 ring-2 ring-[#006B3C]" : "",
                        isDropTarget ? "ring-2 ring-[#DE2910] scale-105" : "",
                      ].join(" ")}
                    >
                      <img
                        src={cloudinaryResize(url, 200, 200)}
                        alt={`Photo ${i + 1}`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        draggable={false}
                      />
                      <button
                        type="button"
                        onClick={() => { if (!touchDidDragRef.current && touchDrag.from === null) setLightboxIndex(i); }}
                        className="absolute inset-0 w-full h-full flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/20 transition-opacity"
                        aria-label={`Preview photo ${i + 1}`}
                      >
                        <svg className="w-6 h-6 text-white drop-shadow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => { if (!touchDidDragRef.current && touchDrag.from === null) removePhoto(i); }}
                        className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100 z-10"
                        aria-label="Remove photo"
                      >
                        ×
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded leading-none">
                          Cover
                        </span>
                      )}
                    </div>
                  );
                })}

                {uploadingPhotos.map((up) => (
                  <div
                    key={up.id}
                    className="relative aspect-square rounded-lg overflow-hidden bg-gray-100"
                  >
                    {up.previewUrl && (
                      <img
                        src={up.previewUrl}
                        alt=""
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                    )}
                    {up.error ? (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50">
                        <svg className="w-6 h-6 text-red-400 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="text-[10px] text-white font-semibold mb-1.5 px-1 text-center leading-tight">Upload failed</span>
                        <button
                          type="button"
                          onClick={() => {
                            if (up.previewUrl) URL.revokeObjectURL(up.previewUrl);
                            const remainingUploading = uploadingPhotos.filter((p) => p.id !== up.id);
                            setUploadingPhotos(remainingUploading);
                            openUploadWidget(photoUrls, remainingUploading);
                          }}
                          className="text-[10px] bg-white/20 hover:bg-white/30 text-white font-semibold px-2 py-0.5 rounded transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40">
                        <button
                          type="button"
                          onClick={() => {
                            canceledUploadIdsRef.current.add(up.id);
                            if (up.previewUrl) URL.revokeObjectURL(up.previewUrl);
                            setUploadingPhotos((prev) => prev.filter((p) => p.id !== up.id));
                          }}
                          className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white text-xs leading-none transition-colors"
                          aria-label="Cancel upload"
                        >
                          ×
                        </button>
                        <svg className="w-6 h-6 text-white animate-spin mb-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <div className="w-3/4 h-1.5 bg-white/30 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-white rounded-full transition-all duration-300"
                            style={{ width: `${up.progress}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-white/80 mt-1">{up.progress}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {photoUrls.length > 1 && (
                <p className="text-xs text-gray-400 mb-3">
                  Drag to reorder · tap &amp; hold on mobile · tap to preview
                </p>
              )}
              {dragPos && touchDrag.from !== null && photoUrls[touchDrag.from] && (
                <div
                  style={{
                    position: "fixed",
                    left: dragPos.x - 44,
                    top: dragPos.y - 80,
                    width: 72,
                    height: 72,
                    zIndex: 9999,
                    pointerEvents: "none",
                    borderRadius: 10,
                    overflow: "hidden",
                    opacity: 0.88,
                    boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
                    border: "2px solid #fff",
                  }}
                >
                  <img
                    src={cloudinaryResize(photoUrls[touchDrag.from], 150, 150)}
                    alt="Dragging"
                    style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                    draggable={false}
                  />
                </div>
              )}
            </>
          )}
          {lightboxIndex !== null && (
            <PhotoLightbox
              urls={photoUrls}
              startIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
            />
          )}

          {UPLOAD_PRESET ? (
            <div className="flex flex-col items-start gap-1">
              <button
                type="button"
                onClick={() => openUploadWidget(photoUrls, uploadingPhotos)}
                disabled={!widgetLoaded || uploadingPhotos.some((p) => !p.error) || atPhotoLimit}
                title={atPhotoLimit ? `Maximum of ${MAX_PHOTOS} photos reached` : undefined}
                className="inline-flex items-center gap-2 bg-[#006B3C] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                {uploadingPhotos.some((p) => !p.error)
                  ? `Uploading… (${photoUrls.length} done)`
                  : atPhotoLimit
                    ? `Limit reached (${MAX_PHOTOS}/${MAX_PHOTOS})`
                    : photoUrls.length > 0
                      ? `Add more photos (${photoUrls.length}/${MAX_PHOTOS})`
                      : "Upload photos"}
              </button>
              {!atPhotoLimit && photoUrls.length > 0 && (
                <p className="text-xs text-gray-500 font-medium">
                  {photoUrls.length} of {MAX_PHOTOS} photos added
                </p>
              )}
              {atPhotoLimit && (
                <p className="text-xs text-gray-500 font-medium">
                  Maximum of {MAX_PHOTOS} photos reached. Remove a photo to add more.
                </p>
              )}
              {!atPhotoLimit && uploadingPhotos.some((p) => !p.error) && (
                <p className="text-xs text-amber-600 font-medium flex items-center gap-1">
                  <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Uploads in progress — please wait before adding more
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-gray-200 py-8 text-center text-gray-400">
              <svg className="w-8 h-8 mx-auto mb-2 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm font-medium">Photo upload coming soon</p>
              <p className="text-xs mt-1">
                Choose "Article" for now to submit a text contribution, or{" "}
                <a href="/contact" className="text-[#006B3C] hover:underline">contact us</a> to share photos directly.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-[#DE2910] text-white font-semibold py-3.5 rounded-xl hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors text-sm sm:text-base"
      >
        {status === "submitting" ? "Submitting…" : "Submit Contribution"}
      </button>
      <p className="text-xs text-gray-400 text-center">
        Submissions are reviewed by the admin team before being published. We'll be in touch if we need anything.
      </p>
    </form>
  );
}

export default function Journal() {
  const { data: contributions, loading, error } = useApprovedContributions();
  const formRef = useRef(null);

  const articles = contributions;

  useEffect(() => {
    if (!articles || articles.length === 0) return;
    const origin = window.location.origin;
    const schema = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      "name": "HK Masters Hockey Community Journal",
      "url": `${origin}/journal`,
      "itemListElement": articles.map((c, index) => {
        const item = {
          "@type": "ListItem",
          "position": index + 1,
          "url": `${origin}/journal/${c.slug || c.id}`,
          "name": c.title,
        };
        if (c.photoUrls && c.photoUrls.length > 0) {
          item.image = c.photoUrls[0];
        }
        if (c.articleBody) {
          item.description = c.articleBody.slice(0, 200).trim();
        }
        return item;
      }),
    };
    const id = "journal-itemlist-schema";
    let tag = document.getElementById(id);
    if (!tag) {
      tag = document.createElement("script");
      tag.type = "application/ld+json";
      tag.id = id;
      document.head.appendChild(tag);
    }
    tag.textContent = JSON.stringify(schema);
    return () => {
      const existing = document.getElementById(id);
      if (existing) existing.remove();
    };
  }, [articles]);

  const scrollToForm = () => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div>
      {/* Hero */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-4">
              Community Journal
            </span>
            <h1 className="text-4xl sm:text-5xl font-extrabold mb-4 leading-tight">
              Stories from the Field
            </h1>
            <p className="text-green-200 text-lg leading-relaxed mb-8 max-w-xl">
              Match reports, travel diaries, and moments shared by the HK Masters Hockey community. Read what your teammates have written — and add your own story.
            </p>
            <button
              onClick={scrollToForm}
              className="inline-flex items-center gap-2 bg-[#DE2910] text-white font-semibold px-6 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
            >
              Share Your Story
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Articles */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="space-y-6">
            {[1, 2].map((n) => (
              <div key={n} className="bg-gray-100 rounded-2xl h-48 animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12 text-gray-400">
            <p>Unable to load journal articles right now. Please try again later.</p>
          </div>
        ) : articles.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-[#006B3C]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-gray-900 mb-2">No journal entries yet</h3>
            <p className="text-gray-500 max-w-sm mx-auto">
              Be the first to share your story! Use the form below to submit a match report, photo album, or travel diary.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            <h2 className="text-2xl font-bold text-gray-900">
              Latest from the Community
              <span className="ml-2 text-base font-normal text-gray-400">({articles.length} {articles.length === 1 ? "entry" : "entries"})</span>
            </h2>
            {articles.map((c) => (
              <ArticleCard key={c.id} contribution={c} />
            ))}
          </div>
        )}
      </section>

      {/* Contribute Form */}
      <section
        ref={formRef}
        id="contribute"
        className="bg-gray-50 border-t border-gray-100 py-16"
      >
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-gray-900 mb-3">Share Your Story</h2>
            <p className="text-gray-500 max-w-xl mx-auto leading-relaxed">
              Got a match report, travel diary, or photos from a recent game or tournament? We'd love to feature it in the Journal.
            </p>
            <Link href="/my-submission" className="inline-block mt-3 text-sm text-[#006B3C] hover:text-green-800 transition-colors font-medium">
              Already submitted? Check your submission status &rarr;
            </Link>
          </div>
          <ContributeForm />
        </div>
      </section>

      <SponsorStrip />
    </div>
  );
}
