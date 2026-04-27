import { useState, useEffect, useRef, useCallback } from "react";
import { cloudinaryResize } from "../utils/cloudinary";
import { format, parseISO } from "date-fns";

const CLOUD_NAME = "djyvdrhal";
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "";

function useApprovedContributions() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/contributions/approved")
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
          {contribution.title}
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
      </div>
    </article>
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
  const [status, setStatus] = useState("idle");
  const [error, setError] = useState("");
  const [widgetLoaded, setWidgetLoaded] = useState(false);

  const needsPhotos = form.contentType === "photo" || form.contentType === "both";
  const needsArticle = form.contentType === "article" || form.contentType === "both";

  useEffect(() => {
    if (!UPLOAD_PRESET || !needsPhotos) return;
    if (window.cloudinary) { setWidgetLoaded(true); return; }
    const script = document.createElement("script");
    script.src = "https://upload-widget.cloudinary.com/global/all.js";
    script.onload = () => setWidgetLoaded(true);
    document.head.appendChild(script);
  }, [needsPhotos]);

  const openUploadWidget = useCallback(() => {
    if (!window.cloudinary) return;
    const widget = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        multiple: true,
        maxFiles: 10,
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
        if (!err && result && result.event === "success") {
          setPhotoUrls((prev) => [...prev, result.info.secure_url]);
        }
      }
    );
    widget.open();
  }, []);

  const removePhoto = (index) => {
    setPhotoUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    if (name === "contentType") setPhotoUrls([]);
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
      const res = await fetch("/api/contributions", {
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
        <button
          onClick={() => {
            setStatus("idle");
            setForm({ authorName: "", authorEmail: "", contentType: "article", title: "", articleBody: "" });
            setPhotoUrls([]);
          }}
          className="mt-6 text-sm font-semibold text-[#006B3C] hover:text-green-800 transition-colors"
        >
          Submit another contribution →
        </button>
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

          {photoUrls.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-3">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group">
                  <img
                    src={cloudinaryResize(url, 200, 200)}
                    alt=""
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <button
                    type="button"
                    onClick={() => removePhoto(i)}
                    className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs transition-colors opacity-0 group-hover:opacity-100"
                    aria-label="Remove photo"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {UPLOAD_PRESET ? (
            <button
              type="button"
              onClick={openUploadWidget}
              disabled={!widgetLoaded}
              className="inline-flex items-center gap-2 bg-[#006B3C] text-white text-sm font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              {photoUrls.length > 0 ? `Add more photos (${photoUrls.length} added)` : "Upload photos"}
            </button>
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

  const articles = contributions.filter((c) =>
    c.contentType === "article" || c.contentType === "both"
  );

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
              <span className="ml-2 text-base font-normal text-gray-400">({articles.length} {articles.length === 1 ? "story" : "stories"})</span>
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
          </div>
          <ContributeForm />
        </div>
      </section>
    </div>
  );
}
