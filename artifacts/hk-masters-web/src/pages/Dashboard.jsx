import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { fetchMe, logout, getPlayerToken } from "../lib/playerAuth";

const CARDS = [
  { key: "fees", title: "My fees", desc: "Your tournament fee balance and payment history.", emoji: "💳", to: "fees" },
  { key: "travel", title: "My travel", desc: "Flights, arrival, hotel and transfers.", emoji: "✈️", to: "travel" },
  { key: "schedule", title: "My schedule", desc: "Training, meetings and team events with calendar download.", emoji: "📅", to: "schedule" },
  { key: "announcements", title: "Announcements", desc: "Latest news from the team and tournament.", emoji: "📣", to: null },
  { key: "profile", title: "My profile", desc: "Passport, kit sizes, dietary needs, emergency contact.", emoji: "👤", to: "profile" },
];

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!getPlayerToken()) {
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
    // other cards: no-op for now (coming soon)
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CARDS.map((card) => {
            const enabled = card.key === "profile" || !!card.to;
            return (
              <button
                key={card.key}
                onClick={() => handleCard(card)}
                disabled={!enabled}
                className={`text-left bg-white rounded-2xl shadow-sm p-6 border border-gray-100 transition ${
                  enabled
                    ? "hover:shadow-md hover:border-green-200 cursor-pointer"
                    : "opacity-70 cursor-not-allowed"
                }`}
              >
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

        <p className="mt-10 text-center text-xs text-gray-400">
          More features (announcements) are on the way.
        </p>
      </div>
    </div>
  );
}
