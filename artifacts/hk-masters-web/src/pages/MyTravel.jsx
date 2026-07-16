import { useEffect, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDateOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
}

function formatTimeOnly(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function dayKey(iso) {
  return iso ? iso.slice(0, 10) : "";
}

function dayHeading(dateKey) {
  const d = new Date(`${dateKey}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return dateKey;
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

// Players within 60 min of each other can travel together.
function minutesDiff(isoA, isoB) {
  return Math.abs(new Date(isoA).getTime() - new Date(isoB).getTime()) / 60000;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function Card({ title, emoji, children, className = "" }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 ${className}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-2xl">{emoji}</span>
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function waPhone(raw) {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

function ContactButton({ phone, email, name }) {
  const wa = waPhone(phone);
  if (wa) {
    const msg = encodeURIComponent(`Hi ${name}, saw you on the HK Masters travel page — happy to coordinate!`);
    return (
      <a
        href={`https://wa.me/${wa}?text=${msg}`}
        target="_blank"
        rel="noopener noreferrer"
        title={`WhatsApp ${name}`}
        className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-green-700 hover:text-green-900 bg-green-50 hover:bg-green-100 border border-green-200 rounded-full px-2 py-0.5 transition-colors self-center"
      >
        <span>💬</span>
        <span className="hidden sm:inline">WhatsApp</span>
      </a>
    );
  }
  if (email) {
    return (
      <a
        href={`mailto:${email}?subject=${encodeURIComponent("HK Masters — travel coordination")}`}
        title={`Email ${name}`}
        className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-gray-600 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-full px-2 py-0.5 transition-colors self-center"
      >
        <span>✉️</span>
        <span className="hidden sm:inline">Email</span>
      </a>
    );
  }
  return null;
}

function SquadBadge({ category }) {
  if (category === "MO40")
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DE2910]/10 text-[#DE2910] shrink-0">MO40</span>;
  if (category === "MO50")
    return <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E3A6E]/10 text-[#1E3A6E] shrink-0">MO50</span>;
  return null;
}

// A single player row inside the team arrivals timeline.
function ArrivalRow({ p, isFirst, isLast, showGroupNudge, isNearSelf }) {
  const isSelf = p.isSelf;
  return (
    <li
      className={`py-2.5 flex items-start gap-3 text-sm ${
        isSelf ? "bg-green-50 -mx-4 px-4 rounded-lg" : isNearSelf ? "bg-sky-50/60 -mx-4 px-4 rounded-lg" : ""
      } ${!isLast ? "border-b border-gray-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-semibold ${isSelf ? "text-green-800" : "text-gray-900"}`}>
            {p.name}{isSelf && <span className="ml-1 text-xs font-normal text-green-600">(you)</span>}
          </span>
          <SquadBadge category={p.teamCategory} />
          {isNearSelf && !isSelf && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 shrink-0">
              Near your arrival
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">
            {formatTimeOnly(p.arrival)}
            {p.arrivalCity && <span className="text-gray-400"> · {p.arrivalCity}</span>}
          </span>
          {p.travelNote && (
            <span className="text-xs text-gray-600 italic">"{p.travelNote}"</span>
          )}
        </div>
      </div>
      {!isSelf && <ContactButton phone={p.phone} email={p.email} name={p.name} />}
      {showGroupNudge && isLast && isSelf && (
        <span className="shrink-0 text-xs text-green-700 font-medium self-center whitespace-nowrap">
          Travel together →
        </span>
      )}
    </li>
  );
}

// A single player row inside the team departures timeline.
function DepartureRow({ p, isLast, isNearSelf }) {
  const isSelf = p.isSelf;
  return (
    <li
      className={`py-2.5 flex items-start gap-3 text-sm ${
        isSelf ? "bg-blue-50 -mx-4 px-4 rounded-lg" : isNearSelf ? "bg-sky-50/60 -mx-4 px-4 rounded-lg" : ""
      } ${!isLast ? "border-b border-gray-50" : ""}`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`font-semibold ${isSelf ? "text-blue-800" : "text-gray-900"}`}>
            {p.name}{isSelf && <span className="ml-1 text-xs font-normal text-blue-600">(you)</span>}
          </span>
          <SquadBadge category={p.teamCategory} />
          {isNearSelf && !isSelf && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-sky-100 text-sky-700 shrink-0">
              Near your departure
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">
            {formatTimeOnly(p.departure)}
            {p.departureCity && <span className="text-gray-400"> · {p.departureCity}</span>}
          </span>
          {p.departureNote && (
            <span className="text-xs text-gray-600 italic">"{p.departureNote}"</span>
          )}
        </div>
      </div>
      {!isSelf && <ContactButton phone={p.phone} email={p.email} name={p.name} />}
    </li>
  );
}

// Inline departure-note editor card inside the player's own Departure card.
function DepartureNoteEditor({ initial, token, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE}/api/player-auth/my-departure-note`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ departureNote: value.trim() || null }),
      });
      if (!res.ok) throw new Error("Could not save.");
      const data = await res.json();
      onSaved(data.departureNote);
      setEditing(false);
    } catch {
      setSaveError("Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  }, [value, token, onSaved]);

  if (!editing) {
    return (
      <div className="mt-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {value ? (
            <p className="text-sm text-gray-700 italic">"{value}"</p>
          ) : (
            <p className="text-sm text-gray-400">No departure note yet (e.g. "Happy to share an Uber to Schiphol")</p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-blue-700 transition-colors shrink-0 flex items-center gap-0.5"
          title="Edit departure note"
        >
          ✏️ Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        type="text"
        maxLength={120}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='e.g. "Happy to share an Uber to Schiphol" or "Renting a car — 2 spare seats"'
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
      />
      {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-blue-700 text-white px-3 py-1.5 rounded-lg hover:bg-blue-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(initial ?? ""); }}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-400">{value.length}/120 — visible to all squadmates</p>
    </div>
  );
}

// Inline travel-note editor card inside the player's own Arrival card.
function TravelNoteEditor({ initial, playerId, token, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial ?? "");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch(`${API_BASE}/api/player-auth/my-travel-note`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ travelNote: value.trim() || null }),
      });
      if (!res.ok) throw new Error("Could not save.");
      const data = await res.json();
      onSaved(data.travelNote);
      setEditing(false);
    } catch {
      setSaveError("Could not save — please try again.");
    } finally {
      setSaving(false);
    }
  }, [value, token, onSaved]);

  if (!editing) {
    return (
      <div className="mt-3 flex items-start gap-2">
        <div className="flex-1 min-w-0">
          {value ? (
            <p className="text-sm text-gray-700 italic">"{value}"</p>
          ) : (
            <p className="text-sm text-gray-400">No travel note yet (e.g. "Happy to share a taxi")</p>
          )}
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-xs text-gray-400 hover:text-green-700 transition-colors shrink-0 flex items-center gap-0.5"
          title="Edit travel note"
        >
          ✏️ Edit
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <input
        type="text"
        maxLength={120}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder='e.g. "Happy to share a taxi" or "Renting a car — 2 spare seats"'
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
        autoFocus
        onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
      />
      {saveError && <p className="text-xs text-red-600">{saveError}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-green-700 text-white px-3 py-1.5 rounded-lg hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => { setEditing(false); setValue(initial ?? ""); }}
          className="text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-gray-400">{value.length}/120 — visible to all squadmates</p>
    </div>
  );
}

// Day-by-day team arrivals timeline.
function TeamArrivalsTimeline({ allArrivals, selfArrivalTime }) {
  if (!allArrivals || allArrivals.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No arrival times recorded yet. Once squadmates add their flight details, they'll appear here.
      </p>
    );
  }

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  // Group by calendar day.
  const days = [];
  const byDay = {};
  for (const p of allArrivals) {
    const dk = dayKey(p.arrival);
    if (!dk) continue;
    if (!byDay[dk]) { byDay[dk] = []; days.push(dk); }
    byDay[dk].push(p);
  }
  days.sort();

  return (
    <div className="space-y-6">
      {days.map((dk) => {
        const players = byDay[dk].slice().sort((a, b) => (a.arrival || "").localeCompare(b.arrival || ""));

        // Identify travel-window groups: consecutive players within 60 min of the group's first.
        const groups = [];
        let currentGroup = [];
        for (const p of players) {
          if (currentGroup.length === 0 || minutesDiff(currentGroup[0].arrival, p.arrival) <= 60) {
            currentGroup.push(p);
          } else {
            groups.push(currentGroup);
            currentGroup = [p];
          }
        }
        if (currentGroup.length) groups.push(currentGroup);

        return (
          <div key={dk}>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{dayHeading(dk)}</p>
            <div className="space-y-2">
              {groups.map((group, gi) => (
                <div
                  key={gi}
                  className={`bg-white rounded-xl border ${
                    group.length > 1 ? "border-green-100" : "border-gray-100"
                  } px-4 py-1 shadow-sm`}
                >
                  {group.length > 1 && (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-green-600 pt-2 -mb-1">
                      Arrive within an hour · coordinate travel
                    </p>
                  )}
                  <ul>
                    {group.map((p, i) => {
                      const isNearSelf = selfArrivalTime != null && !p.isSelf && p.arrival
                        ? Math.abs(new Date(p.arrival).getTime() - selfArrivalTime) <= TWO_HOURS_MS
                        : false;
                      return (
                        <ArrivalRow
                          key={p.id}
                          p={p}
                          isFirst={i === 0}
                          isLast={i === group.length - 1}
                          showGroupNudge={false}
                          isNearSelf={isNearSelf}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Day-by-day team departures timeline.
function TeamDeparturesTimeline({ allDepartures, selfDepartureTime }) {
  if (!allDepartures || allDepartures.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No departure times recorded yet. Once squadmates add their return flight details, they'll appear here.
      </p>
    );
  }

  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

  // Group by calendar day.
  const days = [];
  const byDay = {};
  for (const p of allDepartures) {
    const dk = dayKey(p.departure);
    if (!dk) continue;
    if (!byDay[dk]) { byDay[dk] = []; days.push(dk); }
    byDay[dk].push(p);
  }
  days.sort();

  return (
    <div className="space-y-6">
      {days.map((dk) => {
        const players = byDay[dk].slice().sort((a, b) => (a.departure || "").localeCompare(b.departure || ""));

        // Identify travel-window groups: consecutive players departing within 60 min of the group's first.
        const groups = [];
        let currentGroup = [];
        for (const p of players) {
          if (currentGroup.length === 0 || minutesDiff(currentGroup[0].departure, p.departure) <= 60) {
            currentGroup.push(p);
          } else {
            groups.push(currentGroup);
            currentGroup = [p];
          }
        }
        if (currentGroup.length) groups.push(currentGroup);

        return (
          <div key={dk}>
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">{dayHeading(dk)}</p>
            <div className="space-y-2">
              {groups.map((group, gi) => (
                <div
                  key={gi}
                  className={`bg-white rounded-xl border ${
                    group.length > 1 ? "border-blue-100" : "border-gray-100"
                  } px-4 py-1 shadow-sm`}
                >
                  {group.length > 1 && (
                    <p className="text-[10px] font-bold uppercase tracking-wide text-blue-600 pt-2 -mb-1">
                      Depart within an hour · coordinate travel
                    </p>
                  )}
                  <ul>
                    {group.map((p, i) => {
                      const isNearSelf = selfDepartureTime != null && !p.isSelf && p.departure
                        ? Math.abs(new Date(p.departure).getTime() - selfDepartureTime) <= TWO_HOURS_MS
                        : false;
                      return (
                        <DepartureRow
                          key={p.id}
                          p={p}
                          isLast={i === group.length - 1}
                          isNearSelf={isNearSelf}
                        />
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function MyTravel() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [myTravelNote, setMyTravelNote] = useState(null);
  const [myDepartureNote, setMyDepartureNote] = useState(null);

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
        setMyTravelNote(travel.travelNote ?? null);
        setMyDepartureNote(travel.departureNote ?? null);
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
    roomSharingPreference, roomSharingWith, roommate, allArrivals, allDepartures,
    accessToken,
  } = data;

  const token = getPlayerToken();
  const hasAnyTravel = !!(flightArrivalDateTime || flightDepartureDateTime || arrivalCity || travelDates);
  const editHref = accessToken ? `/my-details/${encodeURIComponent(accessToken)}` : null;

  // Compute squadmates departing within ±2 hours of the viewing player.
  const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
  const selfDepTime = flightDepartureDateTime ? new Date(flightDepartureDateTime).getTime() : null;
  const departureBuddies = (selfDepTime && !isNaN(selfDepTime) && Array.isArray(allDepartures))
    ? allDepartures.filter((d) => {
        if (d.isSelf || !d.departure) return false;
        const t = new Date(d.departure).getTime();
        return !isNaN(t) && Math.abs(t - selfDepTime) <= TWO_HOURS_MS;
      })
    : [];

  // Compute squadmates arriving within ±2 hours of the viewing player.
  const selfArrTime = flightArrivalDateTime ? new Date(flightArrivalDateTime).getTime() : null;
  const arrivalBuddies = (selfArrTime && !isNaN(selfArrTime) && Array.isArray(allArrivals))
    ? allArrivals.filter((a) => {
        if (a.isSelf || !a.arrival) return false;
        const t = new Date(a.arrival).getTime();
        return !isNaN(t) && Math.abs(t - selfArrTime) <= TWO_HOURS_MS;
      })
    : [];

  // Find self in allArrivals to keep the travelNote in sync after saves.
  const handleNoteSaved = useCallback((newNote) => {
    setMyTravelNote(newNote);
    if (allArrivals) {
      const selfEntry = allArrivals.find((p) => p.isSelf);
      if (selfEntry) selfEntry.travelNote = newNote;
    }
  }, [allArrivals]);

  // Keep departureNote in sync after saves.
  const handleDepartureNoteSaved = useCallback((newNote) => {
    setMyDepartureNote(newNote);
    if (allDepartures) {
      const selfEntry = allDepartures.find((p) => p.isSelf);
      if (selfEntry) selfEntry.departureNote = newNote;
    }
  }, [allDepartures]);

  return (
    <div className="min-h-[80vh] bg-gray-50 px-4 py-8 sm:py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/dashboard" className="text-sm text-green-700 hover:underline">← Back to dashboard</Link>
            <h1 className="mt-2 text-3xl font-bold text-gray-900">Travel</h1>
            {player?.teamName && <p className="mt-1 text-sm text-gray-600">{player.name} · {player.teamName}</p>}
          </div>
          {editHref && (
            <Link href={editHref} className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800">
              Edit travel details
            </Link>
          )}
        </div>

        <div className="space-y-4">
          {!hasAnyTravel ? (
            <Card title="Travel details not set yet" emoji="✈️">
              <p className="text-sm text-gray-600">
                You haven't told us your flight or arrival info yet. Add it so the team can plan transfers and room sharing.
              </p>
              {editHref && (
                <Link href={editHref} className="mt-4 inline-block text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800">
                  Add my travel details
                </Link>
              )}
            </Card>
          ) : (
            <>
              <Card title="My arrival" emoji="🛬">
                {flightArrivalDateTime ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">{formatDateOnly(flightArrivalDateTime)}</p>
                    <p className="text-gray-700">{formatTimeOnly(flightArrivalDateTime)}{arrivalCity && ` · ${arrivalCity}`}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Arrival flight not set. {arrivalCity && `Arrival airport: ${arrivalCity}.`}</p>
                )}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Travel note</p>
                  <TravelNoteEditor
                    initial={myTravelNote}
                    token={token}
                    onSaved={handleNoteSaved}
                  />
                </div>
              </Card>

              <Card title="My departure" emoji="🛫">
                {flightDepartureDateTime ? (
                  <div className="space-y-1">
                    <p className="text-2xl font-bold text-gray-900">{formatDateOnly(flightDepartureDateTime)}</p>
                    <p className="text-gray-700">{formatTimeOnly(flightDepartureDateTime)}</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Departure flight not set.</p>
                )}
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Departure note</p>
                  <DepartureNoteEditor
                    initial={myDepartureNote}
                    token={token}
                    onSaved={handleDepartureNoteSaved}
                  />
                </div>
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
            </>
          )}

          {/* Co-arriving squadmates callout */}
          {arrivalBuddies.length > 0 && (() => {
            const shown = arrivalBuddies.slice(0, 3);
            const overflow = arrivalBuddies.length - shown.length;
            const arrDate = new Date(flightArrivalDateTime).toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long",
            });
            return (
              <div className="flex items-start gap-3 bg-green-50 border border-green-200 rounded-2xl px-5 py-4">
                <span className="text-xl mt-0.5 shrink-0">🛬</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-green-900">
                    {arrivalBuddies.length === 1
                      ? "1 squadmate arrives within 2 hours of you"
                      : `${arrivalBuddies.length} squadmates arrive within 2 hours of you`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {shown.map((b) => (
                      <li key={b.id} className="text-sm text-green-800 leading-snug">
                        {b.name}{b.arrivalCity ? ` — ${b.arrivalCity}` : ""}
                        {b.arrival && (
                          <span className="ml-1.5 text-xs text-green-600 tabular-nums">{formatTimeOnly(b.arrival)}</span>
                        )}
                        {b.travelNote && (
                          <span className="block text-xs text-green-700 italic mt-0.5">{b.travelNote}</span>
                        )}
                      </li>
                    ))}
                    {overflow > 0 && (
                      <li className="text-sm text-green-600">and {overflow} more</li>
                    )}
                  </ul>
                  <p className="text-xs text-green-600 mt-1.5">Arriving on {arrDate} — great chance to share a transfer to Rotterdam!</p>
                  {!myTravelNote && editHref && (
                    <p className="mt-2 text-xs text-green-700">
                      <a href={editHref} className="underline hover:text-green-900">Add a travel note</a> so teammates can coordinate with you.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Team arrivals timeline — always shown so players can see teammates even if they haven't added their own details yet */}
          <Card title="Team arrivals" emoji="👥">
            <p className="text-xs text-gray-500 -mt-1 mb-4">
              All squadmates who have added their arrival time. Players arriving within an hour of each other are grouped — reach out to coordinate transport to Rotterdam.
            </p>
            <TeamArrivalsTimeline allArrivals={allArrivals} selfArrivalTime={selfArrTime} />
          </Card>

          {/* Co-departing squadmates callout */}
          {departureBuddies.length > 0 && (() => {
            const shown = departureBuddies.slice(0, 3);
            const overflow = departureBuddies.length - shown.length;
            const depDate = new Date(flightDepartureDateTime).toLocaleDateString("en-GB", {
              weekday: "long", day: "numeric", month: "long",
            });
            return (
              <div className="flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4">
                <span className="text-xl mt-0.5 shrink-0">✈️</span>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sky-900">
                    {departureBuddies.length === 1
                      ? "1 squadmate departs within 2 hours of you"
                      : `${departureBuddies.length} squadmates depart within 2 hours of you`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {shown.map((b) => (
                      <li key={b.id} className="text-sm text-sky-800 leading-snug">
                        {b.name}{b.departureCity ? ` — ${b.departureCity}` : ""}
                        {b.departure && (
                          <span className="ml-1.5 text-xs text-sky-600 tabular-nums">{formatTimeOnly(b.departure)}</span>
                        )}
                        {b.departureNote && (
                          <span className="block text-xs text-sky-700 italic mt-0.5">{b.departureNote}</span>
                        )}
                      </li>
                    ))}
                    {overflow > 0 && (
                      <li className="text-sm text-sky-600">and {overflow} more</li>
                    )}
                  </ul>
                  <p className="text-xs text-sky-600 mt-1.5">Departing on {depDate} — great chance to coordinate!</p>
                  {!myDepartureNote && editHref && (
                    <p className="mt-2 text-xs text-sky-700">
                      <a href={editHref} className="underline hover:text-sky-900">Add a departure note</a> so teammates can coordinate with you.
                    </p>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Team departures timeline — return journeys to Schiphol */}
          <Card title="Team departures" emoji="🛫">
            <p className="text-xs text-gray-500 -mt-1 mb-4">
              All squadmates who have added their return flight time. Players departing within an hour of each other are grouped — coordinate your trip back to Schiphol together.
            </p>
            <TeamDeparturesTimeline allDepartures={allDepartures} selfDepartureTime={selfDepTime} />
          </Card>
        </div>
      </div>
    </div>
  );
}
