import { useEffect, useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { getPlayerToken, fetchMe } from "../lib/playerAuth";

const TOURNAMENT_START_ISO = "2026-07-22T07:00:00Z"; // 09:00 Rotterdam / 15:00 HKT

const KIND_META = {
  training: { label: "Training", emoji: "🏑", chip: "bg-emerald-100 text-emerald-800" },
  meeting:  { label: "Meeting",  emoji: "💬", chip: "bg-blue-100 text-blue-800" },
  social:   { label: "Social",   emoji: "🍻", chip: "bg-amber-100 text-amber-800" },
};

const ROTTERDAM_TZ = "Europe/Amsterdam";

// Rotterdam tournament window — 21 Jul to 1 Aug 2026 inclusive
const RTM_START = "2026-07-21";
const RTM_END   = "2026-08-01";

function rtmDateKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ });
}

function isRotterdamEvent(ev) {
  const key = rtmDateKey(ev.startsAt);
  return key >= RTM_START && key <= RTM_END;
}

function pad(n) { return String(n).padStart(2, "0"); }

function formatDateTime(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
  });
}

function formatTimeRange(startsAt, endsAt) {
  const s = new Date(startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!endsAt) return s;
  const e = new Date(endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${s} – ${e}`;
}

function formatDateTimeRtm(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    timeZone: ROTTERDAM_TZ,
  });
}

function formatTimeRangeRtm(startsAt, endsAt) {
  const s = new Date(startsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ROTTERDAM_TZ });
  if (!endsAt) return s;
  const e = new Date(endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ROTTERDAM_TZ });
  return `${s} – ${e}`;
}

function formatTimeRtm(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: ROTTERDAM_TZ,
  });
}

function monthKey(iso) {
  return new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function dayHeadingRtm(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: ROTTERDAM_TZ,
  });
}

function getMatchCountdown(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 1) return `In ${days} days`;
  if (days === 1) return "Tomorrow";
  if (hours >= 1) return `In ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return mins > 0 ? `In ${mins}m` : "Starting soon";
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

// Match fixture card ---------------------------------------------------------
function MatchFixtureCard({ match }) {
  const isPast    = match.status === "final" || match.status === "cancelled";
  const isLive    = match.status === "in_progress";
  const countdown = match.status === "scheduled" ? getMatchCountdown(match.kickoffAt) : null;
  const showCalendar = match.status !== "cancelled" && match.status !== "final";

  const resultColour =
    match.ourScore > match.theirScore ? "text-[#1E3A6E]" :
    match.ourScore < match.theirScore ? "text-rose-600" : "text-gray-700";

  return (
    <div className={`bg-white rounded-2xl border shadow-sm p-4 ${
      isLive ? "border-emerald-300 ring-2 ring-emerald-200" : "border-gray-100"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="bg-[#DE2910] text-white text-[10px] font-bold px-2 py-0.5 rounded">
            {match.teamCategory || "HK"}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full inline-block" />
              Live
            </span>
          )}
          {match.status === "cancelled" && (
            <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded">Cancelled</span>
          )}
          {match.status === "final" && (
            <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">Final</span>
          )}
          {countdown && (
            <span className="bg-[#EEF4FB] text-[#1E3A6E] text-[10px] font-semibold px-2 py-0.5 rounded">
              {countdown}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-500 tabular-nums">
          {formatTimeRtm(match.kickoffAt)} <span className="text-[10px] text-gray-400">CEST</span>
        </span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-bold text-gray-900 text-base truncate">vs {match.opponent}</p>
          {match.venue && (
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
              <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{match.venue}</span>
            </p>
          )}
        </div>

        {(isPast || isLive) && match.ourScore !== null && match.theirScore !== null && (
          <div className="shrink-0 text-right">
            <div className={`text-2xl font-extrabold tabular-nums ${isLive ? "text-emerald-700" : resultColour}`}>
              {match.ourScore} – {match.theirScore}
            </div>
            {isPast && !isLive && (
              <p className="text-[10px] text-gray-400 mt-0.5">
                {match.ourScore > match.theirScore ? "Win" : match.ourScore < match.theirScore ? "Loss" : "Draw"}
              </p>
            )}
          </div>
        )}
      </div>

      {showCalendar && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <a
            href={`${API_BASE}/api/matches/${match.id}/calendar.ics`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#006B3C] hover:text-[#004d2b] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Add to calendar
          </a>
        </div>
      )}
    </div>
  );
}

// Shared event card ----------------------------------------------------------
function EventCard({ ev, isRtm, rsvpSaving, submitRsvp }) {
  const meta = KIND_META[ev.kind] || { label: ev.kind, emoji: "📌", chip: "bg-gray-100 text-gray-700" };
  const dateStr = isRtm ? formatDateTimeRtm(ev.startsAt) : formatDateTime(ev.startsAt);
  const timeRange = isRtm
    ? ` · ${formatTimeRangeRtm(ev.startsAt, ev.endsAt)}`
    : ` · ${formatTimeRange(ev.startsAt, ev.endsAt)}`;

  const [showNoteForm, setShowNoteForm] = useState(false);
  const [noteText, setNoteText] = useState(ev.myNote ?? "");

  const handleOption = (key) => {
    if (key === "maybe") {
      setNoteText(ev.myNote ?? "");
      setShowNoteForm(true);
    } else {
      setShowNoteForm(false);
      submitRsvp(ev.id, key, null);
    }
  };

  const confirmMaybe = () => {
    submitRsvp(ev.id, "maybe", noteText.trim() || null);
    setShowNoteForm(false);
  };

  return (
    <li className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${meta.chip}`}>
              {meta.emoji} {meta.label}
            </span>
            {!ev.teamId && (
              <span className="text-xs text-gray-500 px-2 py-0.5 rounded-full bg-gray-100">All squads</span>
            )}
            {isRtm && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-[#006B3C] px-1.5 py-0.5 rounded bg-green-50">CEST</span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{ev.title}</h3>
          <p className="text-sm text-gray-700 mt-1">{dateStr}{timeRange}</p>
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
              { key: "yes",   label: "Going",     emoji: "✅", on: "bg-emerald-600 text-white border-emerald-600", off: "bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50" },
              { key: "maybe", label: "Maybe",     emoji: "🤔", on: "bg-amber-500 text-white border-amber-500",   off: "bg-white text-amber-700 border-amber-300 hover:bg-amber-50" },
              { key: "no",    label: "Not going", emoji: "❌", on: "bg-rose-600 text-white border-rose-600",     off: "bg-white text-rose-700 border-rose-300 hover:bg-rose-50" },
            ].map((opt) => {
              const selected = ev.myRsvp === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  disabled={!!rsvpSaving[ev.id]}
                  onClick={() => handleOption(opt.key)}
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

        {showNoteForm && (
          <div className="mt-3">
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="What's your situation? (optional)"
              rows={2}
              autoFocus
              className="w-full text-sm border border-amber-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 bg-amber-50"
            />
            <div className="flex items-center gap-3 mt-2">
              <button
                type="button"
                onClick={confirmMaybe}
                disabled={!!rsvpSaving[ev.id]}
                className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-50"
              >
                🤔 Confirm Maybe
              </button>
              <button type="button" onClick={() => setShowNoteForm(false)} className="text-xs text-gray-500 hover:text-gray-700">
                Cancel
              </button>
            </div>
          </div>
        )}

        {!showNoteForm && ev.myRsvp === "maybe" && ev.myNote && (
          <div className="mt-2 flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            <span className="flex-1">🤔 {ev.myNote}</span>
            <button type="button" onClick={() => { setNoteText(ev.myNote ?? ""); setShowNoteForm(true); }} className="underline shrink-0">Edit</button>
          </div>
        )}
      </div>
    </li>
  );
}

// Component ------------------------------------------------------------------
export default function MySchedule() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [events, setEvents] = useState([]);
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showPast, setShowPast] = useState(false);
  const [rsvpSaving, setRsvpSaving] = useState({});
  const [rsvpError, setRsvpError] = useState("");

  const countdown = useCountdown(TOURNAMENT_START_ISO);

  const submitRsvp = async (eventId, status, note = null) => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    setRsvpSaving((s) => ({ ...s, [eventId]: true }));
    setRsvpError("");
    setEvents((prev) => prev.map((ev) => {
      if (ev.id !== eventId) return ev;
      const counts = { yes: 0, no: 0, maybe: 0, ...(ev.rsvpCounts || {}) };
      if (ev.myRsvp && counts[ev.myRsvp] > 0) counts[ev.myRsvp]--;
      counts[status] = (counts[status] || 0) + 1;
      return { ...ev, myRsvp: status, myNote: note, rsvpCounts: counts };
    }));
    try {
      const res = await fetch(`${API_BASE}/api/player-auth/events/${eventId}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      });
      if (res.status === 401) { setLocation("/login"); return; }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Could not save your RSVP");
      }
    } catch (err) {
      setRsvpError(err.message || "Could not save your RSVP");
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
        const [me, scheduleRes, matchesRes] = await Promise.all([
          fetchMe(),
          fetch(`${API_BASE}/api/player-auth/my-schedule`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/matches`),
        ]);
        if (cancelled) return;
        if (!me) { setLocation("/login"); return; }
        setPlayer(me);
        if (scheduleRes.status === 401) { setLocation("/login"); return; }
        if (!scheduleRes.ok) throw new Error("Could not load your schedule");
        const data = await scheduleRes.json();
        setEvents(data.events || []);
        if (matchesRes.ok) {
          const allMatches = await matchesRes.json();
          const filtered = Array.isArray(allMatches)
            ? (me.teamId
                ? allMatches.filter((m) => m.teamId === me.teamId)
                : allMatches)
            : [];
          setMatches(filtered.sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()));
        }
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
      const endMs = new Date(ev.endsAt || ev.startsAt).getTime();
      if (endMs >= now) u.push(ev); else p.push(ev);
    }
    p.reverse();
    return { upcoming: u, past: p };
  }, [events]);

  // Split upcoming into HK club events and Rotterdam tournament programme
  const { hkEvents, rtmEvents } = useMemo(() => ({
    hkEvents:  upcoming.filter((ev) => !isRotterdamEvent(ev)),
    rtmEvents: upcoming.filter((ev) =>  isRotterdamEvent(ev)),
  }), [upcoming]);

  // Split matches into upcoming and past
  const { upcomingMatches, pastMatches } = useMemo(() => {
    const now = Date.now() - 3 * 60 * 60 * 1000; // 3h grace
    const u = matches.filter((m) => new Date(m.kickoffAt).getTime() >= now && m.status !== "cancelled");
    const p = matches.filter((m) => !u.includes(m)).reverse();
    return { upcomingMatches: u, pastMatches: p };
  }, [matches]);

  // HK events grouped by month
  const groupedHk = useMemo(() => {
    const groups = {};
    for (const ev of hkEvents) {
      const k = monthKey(ev.startsAt);
      (groups[k] ||= []).push(ev);
    }
    return groups;
  }, [hkEvents]);

  // Build merged Rotterdam day groups: union of match days and event days
  const groupedRtm = useMemo(() => {
    const days = new Map(); // dateKey → { date, matches, events }

    for (const m of upcomingMatches) {
      const key = rtmDateKey(m.kickoffAt);
      if (!days.has(key)) days.set(key, { date: m.kickoffAt, matches: [], events: [] });
      days.get(key).matches.push(m);
    }
    for (const ev of rtmEvents) {
      const key = rtmDateKey(ev.startsAt);
      if (!days.has(key)) days.set(key, { date: ev.startsAt, matches: [], events: [] });
      days.get(key).events.push(ev);
    }

    return Array.from(days.entries())
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([, g]) => g);
  }, [upcomingMatches, rtmEvents]);

  const showRotterdamSection = groupedRtm.length > 0 || matches.length > 0;
  const totalRtmCount = rtmEvents.length + upcomingMatches.length;

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

        {/* Empty state */}
        {upcoming.length === 0 && matches.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center">
            <p className="text-gray-500">No upcoming events scheduled yet. Check back soon.</p>
          </div>
        )}

        {/* Hong Kong Events */}
        {hkEvents.length > 0 && (
          <div className="space-y-2 mb-10">
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-bold text-gray-900">Hong Kong Events</h2>
              <span className="bg-[#DE2910] text-white text-xs font-bold px-2 py-0.5 rounded-full">{hkEvents.length}</span>
            </div>
            {Object.entries(groupedHk).map(([month, items]) => (
              <section key={month}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#DE2910] mb-3">{month}</h3>
                <ul className="space-y-3">
                  {items.map((ev) => <EventCard key={ev.id} ev={ev} isRtm={false} rsvpSaving={rsvpSaving} submitRsvp={submitRsvp} />)}
                </ul>
              </section>
            ))}
          </div>
        )}

        {/* Rotterdam 2026 Section */}
        {showRotterdamSection && (
          <div>
            {/* Banner */}
            <div className="rounded-2xl bg-[#006B3C] text-white px-5 py-4 mb-6 flex items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-green-300 mb-0.5">22 Jul – 1 Aug 2026 · Times in Rotterdam (CEST)</p>
                <p className="text-lg font-extrabold leading-tight">Rotterdam 2026 Programme</p>
                <p className="text-green-200 text-xs mt-0.5">HC Rotterdam, Netherlands</p>
              </div>
              {totalRtmCount > 0 && (
                <span className="shrink-0 bg-white/15 text-white text-sm font-bold px-3 py-1.5 rounded-lg">
                  {totalRtmCount} item{totalRtmCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>

            {/* No fixtures yet notice */}
            {matches.length === 0 && (
              <div className="mb-6 rounded-xl bg-[#EEF4FB] border border-[#C2D8F0] px-4 py-3 flex items-center gap-3">
                <svg className="w-4 h-4 text-[#1E3A6E] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <p className="text-sm text-[#1E3A6E]">
                  Match fixtures will appear here once the tournament draw is published.
                </p>
              </div>
            )}

            {groupedRtm.length > 0 && (
              <div className="space-y-8">
                {groupedRtm.map((g) => (
                  <section key={rtmDateKey(g.date)}>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-[#006B3C] mb-3">
                      {dayHeadingRtm(g.date)}
                    </h3>

                    {/* Fixtures for this day */}
                    {g.matches.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#1E3A6E] mb-2 flex items-center gap-1.5">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                          </svg>
                          Match{g.matches.length !== 1 ? "es" : ""}
                        </p>
                        <div className="space-y-3">
                          {g.matches.map((m) => <MatchFixtureCard key={m.id} match={m} />)}
                        </div>
                      </div>
                    )}

                    {/* Programme events for this day */}
                    {g.events.length > 0 && (
                      <div>
                        {g.matches.length > 0 && (
                          <p className="text-[10px] font-bold uppercase tracking-wider text-[#006B3C] mb-2 flex items-center gap-1.5 mt-4">
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Programme
                          </p>
                        )}
                        <ul className="space-y-3">
                          {g.events.map((ev) => <EventCard key={ev.id} ev={ev} isRtm={true} rsvpSaving={rsvpSaving} submitRsvp={submitRsvp} />)}
                        </ul>
                      </div>
                    )}
                  </section>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Past events & results */}
        {(past.length > 0 || pastMatches.length > 0) && (
          <div className="mt-10">
            <button
              onClick={() => setShowPast((v) => !v)}
              className="text-sm text-gray-600 hover:text-gray-900 underline"
            >
              {showPast ? "Hide" : "Show"} past events{pastMatches.length > 0 ? " & results" : ""} ({past.length + pastMatches.length})
            </button>
            {showPast && (
              <ul className="mt-4 space-y-2">
                {pastMatches.map((m) => (
                  <li key={`match-${m.id}`} className="bg-white/60 rounded-xl border border-gray-100 px-4 py-3 text-sm text-gray-600">
                    <span className="font-medium text-gray-700">🏒 vs {m.opponent}</span>
                    <span className="text-gray-500"> · {formatDateTimeRtm(m.kickoffAt)} {formatTimeRtm(m.kickoffAt)} CEST</span>
                    {m.ourScore !== null && m.theirScore !== null && (
                      <span className="ml-2 font-bold text-gray-700">{m.ourScore}–{m.theirScore}</span>
                    )}
                  </li>
                ))}
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
