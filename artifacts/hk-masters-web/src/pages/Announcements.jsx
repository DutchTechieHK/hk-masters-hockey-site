import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function linkify(text) {
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) =>
    URL_REGEX.test(part)
      ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="text-green-700 underline break-all">{part}</a>
      : part
  );
}

function formatRelative(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function Announcements() {
  const [, setLocation] = useLocation();
  const [items, setItems] = useState(null);
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
          fetch(`${API_BASE}/api/announcements`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        if (!res.ok) throw new Error("Could not load announcements.");
        setItems(await res.json());
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load announcements.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading announcements…</p>
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

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link href="/dashboard" className="text-sm text-green-700 hover:underline">← Back to dashboard</Link>
          <h1 className="mt-2 text-3xl font-bold text-gray-900">Announcements</h1>
          <p className="mt-1 text-sm text-gray-600">Latest news and updates from the team and tournament.</p>
        </div>

        {items.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
            <p className="text-3xl mb-2">📣</p>
            <p className="text-gray-700 font-medium">No announcements yet.</p>
            <p className="mt-2 text-sm text-gray-500">When the coaching staff posts something, you'll see it here.</p>
          </div>
        ) : (
          <ul className="space-y-4">
            {items.map((a) => (
              <li
                key={a.id}
                className={`bg-white rounded-2xl shadow-sm border p-5 sm:p-6 ${
                  a.pinned ? "border-amber-300 ring-1 ring-amber-200" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    {a.pinned && (
                      <span className="inline-block text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full mb-2">
                        📌 Pinned
                      </span>
                    )}
                    <h2 className="text-lg font-semibold text-gray-900">{a.title}</h2>
                  </div>
                  <span className="text-xs text-gray-500 whitespace-nowrap">{formatRelative(a.createdAt)}</span>
                </div>
                <p className="mt-3 text-sm text-gray-700 whitespace-pre-line leading-relaxed">{linkify(a.body)}</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <span>{a.teamName ? `For ${a.teamName}` : "All squads"}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
