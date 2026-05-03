import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

function formatDateTime(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatDateOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTimeOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function Card({ title, emoji, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function MyTravel() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [me, travelRes] = await Promise.all([
          fetchMe(),
          fetch(`${API_BASE}/api/player-auth/my-travel`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        if (!travelRes.ok) throw new Error("Could not load your travel info.");
        const travel = await travelRes.json();
        setPlayer(me);
        setData(travel);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load your travel info.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocation]);

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <p className="text-gray-500">Loading your travel info…</p>
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

  const {
    flightArrivalDateTime, flightDepartureDateTime, arrivalCity, travelDates,
    roomSharingPreference, roomSharingWith, roommate, sameDayArrivals,
    accessToken,
  } = data;

  const hasAnyTravel = !!(flightArrivalDateTime || flightDepartureDateTime || arrivalCity || travelDates);
  const editHref = accessToken ? `/my-details/${encodeURIComponent(accessToken)}` : null;

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/dashboard" className="text-sm text-green-700 hover:underline">← Back to dashboard</Link>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">My travel</h1>
            {player?.teamName && <p className="mt-1 text-sm text-gray-600">{player.name} · {player.teamName}</p>}
          </div>
          {editHref && (
            <Link href={editHref} className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800">
              Edit travel details
            </Link>
          )}
        </div>

        {!hasAnyTravel ? (
          <Card title="Travel details not set yet" emoji="✈️">
            <p className="text-sm text-gray-600">
              You haven't told us your flight or arrival info yet. Add it from your profile so the team can plan transfers and room sharing.
            </p>
            {editHref && (
              <Link href={editHref} className="mt-4 inline-block text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800">
                Add my travel details
              </Link>
            )}
          </Card>
        ) : (
          <div className="space-y-4">
            <Card title="Arrival" emoji="🛬">
              {flightArrivalDateTime ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-900">{formatDateOnly(flightArrivalDateTime)}</p>
                  <p className="text-gray-700">{formatTimeOnly(flightArrivalDateTime)}{arrivalCity && ` · ${arrivalCity}`}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Arrival flight not set. {arrivalCity && `Arrival airport: ${arrivalCity}.`}</p>
              )}
            </Card>

            <Card title="Departure" emoji="🛫">
              {flightDepartureDateTime ? (
                <div className="space-y-1">
                  <p className="text-2xl font-bold text-gray-900">{formatDateOnly(flightDepartureDateTime)}</p>
                  <p className="text-gray-700">{formatTimeOnly(flightDepartureDateTime)}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-600">Departure flight not set.</p>
              )}
            </Card>

            {travelDates && (
              <Card title="Trip dates" emoji="📅">
                <p className="text-gray-800">{travelDates}</p>
              </Card>
            )}

            <Card title="Room sharing" emoji="🛏️">
              <p className="text-sm text-gray-700">
                Preference: <span className="font-semibold capitalize">{roomSharingPreference || "Not set"}</span>
              </p>
              {roomSharingWith ? (
                <p className="mt-2 text-sm text-gray-700">
                  Sharing with: <span className="font-semibold">{roomSharingWith}</span>
                  {roommate && roommate.name.toLowerCase() === roomSharingWith.toLowerCase() && (
                    <span className="ml-2 text-xs text-emerald-700">✓ matched in squad</span>
                  )}
                </p>
              ) : roomSharingPreference === "shared" ? (
                <p className="mt-2 text-sm text-gray-500">No roommate noted yet.</p>
              ) : null}
            </Card>

            {sameDayArrivals.length > 0 && (
              <Card title="Players arriving the same day" emoji="👥">
                <ul className="divide-y divide-gray-100">
                  {sameDayArrivals
                    .slice()
                    .sort((a, b) => (a.arrival || "").localeCompare(b.arrival || ""))
                    .map((p) => (
                      <li key={p.id} className="py-2 flex justify-between text-sm">
                        <span className="font-medium text-gray-800">{p.name}</span>
                        <span className="text-gray-600">
                          {formatTimeOnly(p.arrival)}{p.arrivalCity && ` · ${p.arrivalCity}`}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="mt-3 text-xs text-gray-500">Coordinate transfers from the airport with these players.</p>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
