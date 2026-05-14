import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";
import InstallTip from "../components/InstallTip";

const CATEGORIES = [
  { key: "mandatory-form", label: "Mandatory Forms", emoji: "📋", color: "red" },
  { key: "regulation", label: "Regulations", emoji: "📜", color: "blue" },
  { key: "information", label: "Information", emoji: "ℹ️", color: "green" },
];

const BADGE_CLASSES = {
  red: "bg-red-100 text-red-800",
  blue: "bg-blue-100 text-blue-800",
  green: "bg-green-100 text-green-800",
};

function formatFileSize(bytes) {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function MyDocuments() {
  const [, setLocation] = useLocation();
  const [docs, setDocs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [me, res] = await Promise.all([
          fetchMe(),
          fetch(`${API_BASE}/api/documents/player`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        if (!res.ok) throw new Error("Could not load documents.");
        setDocs(await res.json());
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load documents.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading documents…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/dashboard" className="mt-4 inline-block text-green-700 underline">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    items: (docs || []).filter((d) => d.category === cat.key),
  })).filter((cat) => cat.items.length > 0);

  const mandatoryGroup = grouped.find((g) => g.key === "mandatory-form");

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <InstallTip />
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-green-700 hover:underline">← Back to dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Documents</h1>
          <p className="mt-1 text-sm text-gray-600">Tournament forms, regulations, and information PDFs.</p>
        </div>

        {mandatoryGroup && (
          <div className="mb-8 bg-red-50 border border-red-200 rounded-2xl px-5 py-4">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-base">📋</span>
              <p className="font-semibold text-red-800">Action required — mandatory forms</p>
            </div>
            <p className="text-sm text-red-700">
              Please download and complete all {mandatoryGroup.items.length === 1 ? "form" : `${mandatoryGroup.items.length} forms`} below before the tournament. Return them to your team manager.
            </p>
          </div>
        )}

        {grouped.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-3xl mb-2">📁</p>
            <p className="text-gray-700 font-medium">No documents available yet.</p>
            <p className="mt-2 text-sm text-gray-500">Check back soon — documents will be posted here before the tournament.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {grouped.map((cat) => (
              <section key={cat.key}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">{cat.emoji}</span>
                  <h2 className="text-lg font-semibold text-gray-800">{cat.label}</h2>
                  <span className={`ml-1 text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE_CLASSES[cat.color]}`}>
                    {cat.items.length}
                  </span>
                  {cat.key === "mandatory-form" && (
                    <span className="ml-1 text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-red-500 text-white">
                      Required
                    </span>
                  )}
                </div>
                <ul className="space-y-3">
                  {cat.items.map((doc) => (
                    <li
                      key={doc.id}
                      className={`bg-white rounded-2xl shadow-sm border p-4 sm:p-5 flex items-start justify-between gap-4 ${
                        cat.key === "mandatory-form"
                          ? "border-red-200 border-l-4 border-l-red-500"
                          : "border-gray-100"
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-gray-900 truncate">{doc.title}</p>
                          {cat.key === "mandatory-form" && (
                            <span className="inline-flex items-center text-xs font-semibold px-1.5 py-0.5 rounded bg-red-100 text-red-700 shrink-0">
                              Required
                            </span>
                          )}
                        </div>
                        {doc.description && (
                          <p className="mt-0.5 text-sm text-gray-500 line-clamp-2">{doc.description}</p>
                        )}
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-400">
                          <span>{doc.fileName}</span>
                          {formatFileSize(doc.fileSize) && (
                            <span>{formatFileSize(doc.fileSize)}</span>
                          )}
                        </div>
                      </div>
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 text-white text-sm font-medium rounded-xl transition ${
                          cat.key === "mandatory-form"
                            ? "bg-red-600 hover:bg-red-700"
                            : "bg-green-700 hover:bg-green-800"
                        }`}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V4" />
                        </svg>
                        Download
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
