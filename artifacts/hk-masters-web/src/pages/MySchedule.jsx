import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

const TOURNAMENT_START_ISO = "2026-06-22T09:00:00+02:00";

const KIND_META = {
  training: { label: "Training", emoji: "🏑", chip: "bg-emerald-100 text-emerald-800" },
  meeting: { label: "Meeting", emoji: "💬", chip: "bg-blue-100 text-blue-800" },
  social: { label: "Social", emoji: "🍻", chip: "bg-amber-100 text-amber-800" },
};

function pad(n) { return String(n).padStart(2, "0"); }

function formatDateTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

function formatTimeRange(startsAt, endsAt) {
  const s = new Date(startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!endsAt) return s;
  const e = new Date(endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${s} – ${e}`;
}

function monthKey(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function useCountdown(targetIso) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);
  const target = new Date(targetIso).getTime();
  const diff = target - now;
  if (diff <= 0) return { past: true };
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);
  return { past: false, days, hours, minutes };
}

// ICS generation -------------------------------------------------------------
function toIcsDate(iso) {
  const d = new Date(iso);
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

function escapeIcsText(s) {
  return String(s ?? "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function buildIcs(events, calendarName) {
  const now = toIcsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//HK Masters Hockey//My Schedule//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];
  for (const ev of events) {
    const start = toIcsDate(ev.startsAt);
    const end = toIcsDate(ev.endsAt || new Date(new Date(ev.startsAt).getTime() + 60 * 60 * 1000).toISOString());
    const meta = KIND_META[ev.kind];
    const summary = `${meta ? meta.label + ": " : ""}${ev.title}`;
    lines.push(
      "BEGIN:VEVENT",
      `UID:hkm-event-${ev.id}@hkmastershockey.com`,
      `DTSTAMP:${now}`,
      `DTSTART:${start}`,
      `DTEND:${end}`,
      `SUMMARY:${escapeIcsText(summary)}`,
    );
    if (ev.location) lines.push(`LOCATION:${escapeIcsText(ev.location)}`);
    if (ev.description) lines.push(`DESCRIPTION:${escapeIcsText(ev.description)}`);
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function downloadIcs(events, filename, calendarName) {
  const ics = buildIcs(events, calendarName);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Component ------------------------------------------------------------------
export default function MySchedule() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState({});
  const [rsvpError, setRsvpError] = useState("");

  const countdown = useCountdown(TOURNAMENT_START_ISO);

  const submitRsvp = async (eventId, status) => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    setRsvpSaving((s) => ({ ...s, [eventId]: true }));
    setRsvpError("");
    // Optimistic update — adjust counts and selection in place.
    setEvents((prev) => prev.map((ev) => {
      if (ev.id !== eventId) return ev;
      const counts = { yes: 0, no: 0, maybe: 0, ...(ev.rsvpCounts || {}) };
      if (ev.myRsvp && counts[ev.myRsvp] > 0) counts[ev.myRsvp]--;
      counts[status] = (counts[status] || 0) + 1;
      return { ...ev, myRsvp: status, rsvpCounts: counts };
    }));
    try {
      const res = await fetch(`${API_BASE}/api/player-auth/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      if (res.status === 401) { setLocation("/login"); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save your RSVP");
      }
    } catch (err) {
      setRsvpError(err.message || "Could not save your RSVP");
      // Reload to get authoritative state if optimistic update was wrong.
      try {
        const r = await fetch(`${API_BASE}/api/player-auth/my-schedule`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (r.ok) {
          const data = await r.json();
          setEvents(data.events || []);
        }
      } catch { /* ignore */ }
    } finally {
      setRsvpSaving((s) => { const n = { ...s }; delete n[eventId]; return n; });
    }
  };

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    let cancelled = false;
    (async () => {
      try {
        const [me, scheduleRes] = await Promise.all([
          fetchMe(),
          fetch(`${API_BASE}/api/player-auth/my-schedule`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        setPlayer(me);
        if (scheduleRes.status === 401) { setLocation("/login"); return; }
        if (!scheduleRes.ok) throw new Error("Could not load your schedule");
        const data = await scheduleRes.json();
        setEvents(data.events || []);
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not load your schedule");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setLocation]);

  const { upcoming, past } = useMemo(() => {
    const now = Date.now();
    const u = []; const p = [];
    for (const ev of events) {
      // An event is still "upcoming/current" until its end time (or start
      // time, if no end is set) is in the past. This stops a session that's
      // already started from disappearing mid-training.
      const endMs = new Date(ev.endsAt || ev.startsAt).getTime();
      if (endMs >= now) u.push(ev); else p.push(ev);
    }
    p.reverse();
    return { upcoming: u, past: p };
  }, [events]);

  const groupedUpcoming = useMemo(() => {
    const groups = {};
    for (const ev of upcoming) {
      const k = monthKey(ev.startsAt);
      (groups[k] ||= []).push(ev);
    }
    return groups;
  }, [upcoming]);

  if (loading) {
    return <div className="min-h-[60vh] flex items-center justify-center"><p className="text-gray-500">Loading your schedule…</p></div>;
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
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="text-sm text-green-700 hover:text-green-900 underline">
            ← Back to dashboard
          </Link>
          {events.length > 0 && (
            <button
              onClick={() => downloadIcs(events, "hk-masters-my-schedule.ics", "HK Masters – My Schedule")}
              className="text-sm bg-green-700 text-white px-4 py-2 rounded-lg hover:bg-green-800 transition"
            >
              📅 Add all to calendar
            </button>
          )}
        </div>

        {/* Countdown */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 text-white rounded-2xl p-6 mb-8 shadow">
          <p className="text-xs uppercase tracking-wider text-green-100">Rotterdam 2026 World Masters Cup</p>
          {countdown.past ? (
            <p className="mt-2 text-2xl font-bold">The tournament has begun. Good luck! 🏑</p>
          ) : (
            <div className="mt-2 flex items-baseline gap-3 flex-wrap">
              <span className="text-4xl sm:text-5xl font-bold">{countdown.days}</span>
              <span className="text-lg">days</span>
              <span className="text-3xl sm:text-4xl font-bold ml-2">{countdown.hours}</span>
              <span className="text-lg">hours</span>
              <span className="text-3xl sm:text-4xl font-bold ml-2">{countdown.minutes}</span>
              <span className="text-lg">min</span>
              <span className="text-sm text-green-100 ml-1">until kick-off</span>
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">My schedule</h1>
        <p className="text-sm text-gray-600 mb-6">
          {player?.teamName ? `Events for ${player.teamName} and the whole squad.` : "Events for the whole squad."}
        </p>

        {rsvpError && (
          <div className="mb-4 p-3 rounded-lg bg-rose-50 border border-rose-200 text-sm text-rose-800">
            {rsvpError}
          </div>
        )}

        {/* Upcoming */}
        {upcoming.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-gray-500">No upcoming events scheduled yet. Check back soon.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedUpcoming).map(([month, items]) => (
              <section key={month}>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-3">{month}</h2>
                <ul className="space-y-3">
                  {items.map((ev) => {
                    const meta = KIND_META[ev.kind] || { label: ev.kind, emoji: "📌", chip: "bg-gray-100 text-gray-700" };
                    return (
                      <li key={ev.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.chip}`}>
                                {meta.emoji} {meta.label}
                              </span>
                              {!ev.teamId && (
                                <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-100">All squads</span>
                              )}
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900">{ev.title}</h3>
                            <p className="text-sm text-gray-700 mt-1">
                              {formatDateTime(ev.startsAt)}
                              {ev.endsAt && ` · ${formatTimeRange(ev.startsAt, ev.endsAt)}`}
                            </p>
                            {ev.location && <p className="text-sm text-gray-600 mt-0.5">📍 {ev.location}</p>}
                            {ev.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{ev.description}</p>}
                          </div>
                          <button
                            onClick={() => downloadIcs([ev], `hk-${ev.kind}-${ev.id}.ics`, ev.title)}
                            title="Add this event to my calendar"
                            className="text-xs text-green-700 hover:text-green-900 hover:underline whitespace-nowrap shrink-0"
                          >
                            + Calendar
                          </button>
                        </div>
                        {/* RSVP */}
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div className="flex gap-2 flex-wrap">
                              {[
                                { key: "yes", label: "Going", emoji: "✅", on: "bg-emerald-600 text-white border-emerald-600", off: "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50" },
                                { key: "maybe", label: "Maybe", emoji: "🤔", on: "bg-amber-500 text-white border-amber-500", off: "bg-white text-amber-700 border-amber-300 hover:bg-amber-50" },
                                { key: "no", label: "Not going", emoji: "❌", on: "bg-rose-600 text-white border-rose-600", off: "bg-white text-rose-700 border-rose-300 hover:bg-rose-50" },
                              ].map((opt) => {
                                const selected = ev.myRsvp === opt.key;
                                return (
                                  <button
                                    key={opt.key}
                                    type="button"
                                    disabled={!!rsvpSaving[ev.id]}
                                    onClick={() => submitRsvp(ev.id, opt.key)}
                                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${selected ? opt.on : opt.off}`}
                                  >
                                    {opt.emoji} {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                            <div className="text-xs text-gray-500 whitespace-nowrap">
                              {ev.rsvpCounts?.yes ?? 0} going · {ev.rsvpCounts?.maybe ?? 0} maybe · {ev.rsvpCounts?.no ?? 0} no
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Past */}
        {past.length > 0 && (
          <div className="mt-10">
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              {showPast ? "Hide" : "Show"} past events ({past.length})
            </button>
            {showPast && (
              <ul className="mt-4 space-y-2">
                {past.map((ev) => {
                  const meta = KIND_META[ev.kind] || { label: ev.kind, emoji: "📌" };
                  return (
                    <li key={ev.id} className="bg-white/60 rounded-xl border border-gray-100 px-4 py-3 text-sm text-gray-600">
                      <span className="font-medium text-gray-700">{meta.emoji} {ev.title}</span>
                      <span className="text-gray-500"> · {formatDateTime(ev.startsAt)}</span>
                      {ev.location && <span className="text-gray-500"> · {ev.location}</span>}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
