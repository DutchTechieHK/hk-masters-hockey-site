import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { fetchMe, logout, getPlayerToken } from "../lib/playerAuth";
import { API_BASE } from "../utils/api";

const CARDS = [
  { key: "fees", title: "My fees", desc: "Your tournament fee balance and payment history.", emoji: "💳", to: "fees" },
  { key: "travel", title: "My travel", desc: "Flights, arrival, hotel and transfers.", emoji: "✈️", to: "travel" },
  { key: "schedule", title: "My schedule", desc: "Training, meetings and team events with calendar download.", emoji: "📅", to: "schedule" },
  { key: "announcements", title: "Announcements", desc: "Latest news from the team and tournament.", emoji: "📣", to: "announcements" },
  { key: "documents", title: "Documents", desc: "Mandatory forms, regulations, and tournament information PDFs.", emoji: "📁", to: "documents" },
  { key: "profile", title: "My profile", desc: "Passport, kit sizes, dietary needs, emergency contact.", emoji: "👤", to: "profile" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mandatoryCount, setMandatoryCount] = useState(0);

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) {
      setLocation("/login");
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        if (!data) {
          setLocation("/login");
          return;
        }
        setPlayer(data);
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Could not load your dashboard.");
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [setLocation]);

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/documents/player`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : [])
      .then((docs) => {
        if (cancelled) return;
        const count = Array.isArray(docs)
          ? docs.filter((d) => d.category === "mandatory-form").length
          : 0;
        setMandatoryCount(count);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleCard = (card) => {
    if (card.key === "profile" && player?.accessToken) {
      setLocation(`/my-details/${encodeURIComponent(player.accessToken)}`);
      return;
    }
    if (card.to) {
      setLocation(`/${card.to}`);
      return;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading your dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600">{error}</p>
          <Link href="/login" className="mt-4 inline-block text-green-700 underline">Sign in again</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-start justify-between mb-8">
          <div>
            <p className="text-sm text-gray-600">Welcome back,</p>
            <h1 className="text-3xl font-bold text-gray-900">{player?.name}</h1>
            {player?.teamName && (
              <p className="mt-1 text-sm text-gray-600">{player.teamName}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="text-sm text-gray-600 hover:text-gray-900 underline"
          >
            Sign out
          </button>
        </div>

        {mandatoryCount > 0 && (
          <button
            onClick={() => setLocation("/documents")}
            className="w-full text-left mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-2xl px-5 py-4 hover:bg-red-100 transition group"
          >
            <span className="text-xl mt-0.5">📋</span>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-red-800">
                {mandatoryCount === 1
                  ? "1 mandatory form requires your attention"
                  : `${mandatoryCount} mandatory forms require your attention`}
              </p>
              <p className="text-sm text-red-700 mt-0.5">
                Please download and complete {mandatoryCount === 1 ? "this form" : "these forms"} before the tournament.
              </p>
            </div>
            <span className="text-red-400 group-hover:text-red-600 text-sm font-medium self-center shrink-0">View →</span>
          </button>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((card) => {
            const enabled = card.key === "profile" || !!card.to;
            const hasBadge = card.key === "documents" && mandatoryCount > 0;
            return (
              <button
                key={card.key}
                onClick={() => handleCard(card)}
                disabled={!enabled}
                className={`relative text-left bg-white rounded-2xl shadow-sm p-6 border transition ${
                  hasBadge
                    ? "border-red-200 hover:shadow-md hover:border-red-300 cursor-pointer"
                    : enabled
                    ? "border-gray-100 hover:shadow-md hover:border-green-200 cursor-pointer"
                    : "border-gray-100 opacity-70 cursor-not-allowed"
                }`}
              >
                {hasBadge && (
                  <span className="absolute top-4 right-4 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {mandatoryCount}
                  </span>
                )}
                <div className="text-3xl mb-3">{card.emoji}</div>
                <h2 className="text-lg font-semibold text-gray-900">{card.title}</h2>
                <p className="mt-1 text-sm text-gray-600">{card.desc}</p>
                {!enabled && (
                  <p className="mt-3 text-xs uppercase tracking-wide text-gray-400">Coming soon</p>
                )}
              </button>
            );
          })}
        </div>

      </div>
    </div>
  );
}
