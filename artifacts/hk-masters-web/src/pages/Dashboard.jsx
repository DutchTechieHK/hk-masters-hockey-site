import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { fetchMe, logout, getPlayerToken } from "../lib/playerAuth";
import { API_BASE } from "../utils/api";
import { themeFor } from "../utils/teamTheme";

const ROTTERDAM_TZ = "Europe/Amsterdam";

function formatMatchDate(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short",
    timeZone: ROTTERDAM_TZ,
  });
}

function formatMatchTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
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

const CARDS = [
  { key: "profile", title: "My profile", desc: "Passport, HKID card, insurance, kit sizes, dietary needs, emergency contact.", emoji: "👤", to: "profile" },
  { key: "schedule", title: "My schedule", desc: "Training, meetings and team events with calendar download.", emoji: "📅", to: "schedule" },
  { key: "announcements", title: "Announcements", desc: "Latest news from the team and tournament.", emoji: "📣", to: "announcements" },
  { key: "supporters", title: "My supporters", desc: "Everyone who has pledged to support your Rotterdam 2026 campaign.", emoji: "🤝", to: "supporters" },
  { key: "travel", title: "My travel", desc: "Flights, arrival, hotel and transfers.", emoji: "✈️", to: "travel" },
  { key: "documents", title: "Documents", desc: "Mandatory forms, regulations, and tournament information PDFs.", emoji: "📁", to: "documents" },
  { key: "fees", title: "My fees", desc: "Your tournament fee balance and payment history.", emoji: "💳", to: "fees" },
];

const KIND_EMOJI = { training: "🏑", meeting: "💬", social: "🍻" };

function formatNextSession(ev) {
  const d = new Date(ev.startsAt);
  const date = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const start = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!ev.endsAt) return `${date} · ${start}`;
  const end = new Date(ev.endsAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${date} · ${start}–${end}`;
}

function toIcsDate(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    d.getUTCFullYear() + pad(d.getUTCMonth() + 1) + pad(d.getUTCDate()) +
    "T" + pad(d.getUTCHours()) + pad(d.getUTCMinutes()) + pad(d.getUTCSeconds()) + "Z"
  );
}

function downloadSingleIcs(ev) {
  const end = ev.endsAt || new Date(new Date(ev.startsAt).getTime() + 3600000).toISOString();
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//HK Masters Hockey//Schedule//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:hkm-event-${ev.id}@hkmastershockey.com`,
    `DTSTAMP:${toIcsDate(new Date().toISOString())}`,
    `DTSTART:${toIcsDate(ev.startsAt)}`,
    `DTEND:${toIcsDate(end)}`,
    `SUMMARY:${ev.title}`,
    ev.location ? `LOCATION:${ev.location}` : "",
    "END:VEVENT", "END:VCALENDAR",
  ].filter(Boolean);
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `hkm-session-${ev.id}.ics`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const [player, setPlayer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mandatoryCount, setMandatoryCount] = useState(0);
  const [nextSession, setNextSession] = useState(null);
  const [myRsvp, setMyRsvp] = useState(null);
  const [rsvpCounts, setRsvpCounts] = useState({ yes: 0, no: 0, maybe: 0 });
  const [rsvpSaving, setRsvpSaving] = useState(false);
  const [rsvpError, setRsvpError] = useState(false);
  const [showMaybeNote, setShowMaybeNote] = useState(false);
  const [maybeNoteText, setMaybeNoteText] = useState("");
  const [activePolls, setActivePolls] = useState([]);
  const [upcomingMatches, setUpcomingMatches] = useState(null);
  const [departureBuddies, setDepartureBuddies] = useState(null);
  const [depNudgeDismissed, setDepNudgeDismissed] = useState(
    () => localStorage.getItem("depNudgeDismissed") === "1"
  );

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    let cancelled = false;
    fetchMe()
      .then((data) => {
        if (cancelled) return;
        if (!data) { setLocation("/login"); return; }
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

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/player-auth/my-schedule`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : { events: [] })
      .then(({ events }) => {
        if (cancelled || !Array.isArray(events)) return;
        const now = Date.now();
        const next = events.find((ev) => new Date(ev.startsAt).getTime() > now);
        setNextSession(next ?? null);
        if (next) {
          setMyRsvp(next.myRsvp ?? null);
          setRsvpCounts(next.rsvpCounts ?? { yes: 0, no: 0, maybe: 0 });
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!player) return;
    let cancelled = false;

    const fetchMatches = () => {
      fetch(`${API_BASE}/api/matches`)
        .then((r) => r.ok ? r.json() : [])
        .then((allMatches) => {
          if (cancelled || !Array.isArray(allMatches)) return;
          const now = Date.now() - 3 * 60 * 60 * 1000;
          const filtered = (player.teamId
            ? allMatches.filter((m) => m.teamId === player.teamId)
            : allMatches
          ).filter((m) => m.status !== "cancelled" && new Date(m.kickoffAt).getTime() >= now)
            .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
          setUpcomingMatches(filtered);
        })
        .catch(() => { if (!cancelled) setUpcomingMatches([]); });
    };

    fetchMatches();

    const handleFocus = () => { if (!cancelled) fetchMatches(); };
    const handleVisibility = () => { if (!document.hidden && !cancelled) fetchMatches(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);

    const interval = setInterval(() => { if (!cancelled) fetchMatches(); }, 60_000);

    return () => {
      cancelled = true;
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      clearInterval(interval);
    };
  }, [player]);

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/player-auth/my-travel`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        const { allDepartures, flightDepartureDateTime } = data;
        if (!flightDepartureDateTime || !Array.isArray(allDepartures)) return;
        const ISO_RE = /^\d{4}-\d{2}-\d{2}/;
        if (!ISO_RE.test(flightDepartureDateTime)) return;
        const selfDep = new Date(flightDepartureDateTime).getTime();
        if (isNaN(selfDep)) return;
        const TWO_HOURS = 2 * 60 * 60 * 1000;
        const buddies = allDepartures.filter((d) => {
          if (d.isSelf) return false;
          if (!d.departure || !ISO_RE.test(d.departure)) return false;
          const t = new Date(d.departure).getTime();
          return !isNaN(t) && Math.abs(t - selfDep) <= TWO_HOURS;
        });
        setDepartureBuddies(buddies.length > 0 ? { buddies, count: buddies.length, date: flightDepartureDateTime } : null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const token = getPlayerToken();
    if (!token) return;
    let cancelled = false;
    fetch(`${API_BASE}/api/player-auth/polls`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok ? r.json() : { polls: [] })
      .then(({ polls }) => {
        if (cancelled) return;
        setActivePolls(Array.isArray(polls) ? polls : []);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const submitRsvp = async (status, note = null) => {
    if (!nextSession) return;
    const token = getPlayerToken();
    if (!token) { setLocation("/login"); return; }
    setRsvpSaving(true);
    setRsvpError(false);
    const prev = myRsvp;
    const prevCounts = { ...rsvpCounts };
    const newCounts = { ...rsvpCounts };
    if (prev && newCounts[prev] > 0) newCounts[prev]--;
    newCounts[status] = (newCounts[status] || 0) + 1;
    setMyRsvp(status);
    setRsvpCounts(newCounts);
    try {
      const res = await fetch(`${API_BASE}/api/player-auth/events/${nextSession.id}/rsvp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status, ...(note ? { note } : {}) }),
      });
      if (res.status === 401) { setLocation("/login"); return; }
      if (!res.ok) throw new Error("Could not save");
    } catch {
      setMyRsvp(prev);
      setRsvpCounts(prevCounts);
      setRsvpError(true);
    } finally {
      setRsvpSaving(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/login");
  };

  const handleCard = (card) => {
    if (card.key === "profile" && player?.accessToken) {
      setLocation(`/my-details/${encodeURIComponent(player.accessToken)}`);
      return;
    }
    if (card.to) { setLocation(`/${card.to}`); return; }
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

        {/* Welcome header */}
        <div className="flex items-start justify-between mb-6">
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

        {/* Next session widget */}
        {nextSession && (
          <div className="mb-4 bg-[#1E3A6E] text-white rounded-2xl px-5 py-4">
            {/* Info row */}
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl shrink-0 mt-0.5">{KIND_EMOJI[nextSession.kind] ?? "📌"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold uppercase tracking-wider text-blue-200 mb-0.5">Next session</p>
                <p className="font-semibold text-white leading-snug">{nextSession.title}</p>
                <p className="text-sm text-blue-100 mt-0.5">{formatNextSession(nextSession)}</p>
                {nextSession.location && (
                  <p className="text-xs text-blue-200 mt-0.5">📍 {nextSession.location}</p>
                )}
              </div>
            </div>
            {/* Button row */}
            <div className="flex items-center gap-2 pl-9">
              <button
                onClick={() => downloadSingleIcs(nextSession)}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white/15 hover:bg-white/25 transition text-white whitespace-nowrap"
              >
                + Calendar
              </button>
              <button
                onClick={() => setLocation("/schedule")}
                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white text-[#1E3A6E] hover:bg-blue-50 transition whitespace-nowrap"
              >
                Full schedule →
              </button>
            </div>
            {/* Attendance RSVP row */}
            <div className="mt-3 pt-3 border-t border-white/15 pl-9">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-blue-200 shrink-0">Will you attend?</span>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { key: "yes",   label: "Going",     on: "bg-emerald-500 text-white border-emerald-500", off: "bg-white/10 text-white border-white/25 hover:bg-white/20" },
                    { key: "maybe", label: "Maybe",     on: "bg-amber-400 text-white border-amber-400",     off: "bg-white/10 text-white border-white/25 hover:bg-white/20" },
                    { key: "no",    label: "Not going", on: "bg-rose-500 text-white border-rose-500",       off: "bg-white/10 text-white border-white/25 hover:bg-white/20" },
                  ].map((opt) => {
                    const selected = myRsvp === opt.key;
                    return (
                      <button
                        key={opt.key}
                        type="button"
                        disabled={rsvpSaving}
                        onClick={() => {
                          if (opt.key === "maybe") { setMaybeNoteText(""); setShowMaybeNote(true); }
                          else { setShowMaybeNote(false); submitRsvp(opt.key); }
                        }}
                        className={`text-xs font-medium px-3 py-1.5 rounded-full border transition disabled:opacity-50 ${selected ? opt.on : opt.off}`}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
                {(rsvpCounts.yes > 0 || rsvpCounts.no > 0 || rsvpCounts.maybe > 0) && (
                  <span className="text-xs text-blue-200 whitespace-nowrap">
                    {rsvpCounts.yes} going · {rsvpCounts.maybe > 0 ? `${rsvpCounts.maybe} maybe · ` : ""}{rsvpCounts.no} not going
                  </span>
                )}
              </div>
              {showMaybeNote && (
                <div className="mt-2">
                  <textarea
                    value={maybeNoteText}
                    onChange={(e) => setMaybeNoteText(e.target.value)}
                    placeholder="What's your situation? (optional)"
                    rows={2}
                    autoFocus
                    className="w-full text-xs text-gray-900 border border-amber-300 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-amber-300 bg-white/90"
                  />
                  <div className="flex items-center gap-3 mt-1.5">
                    <button
                      type="button"
                      disabled={rsvpSaving}
                      onClick={() => { submitRsvp("maybe", maybeNoteText.trim() || null); setShowMaybeNote(false); }}
                      className="text-xs font-medium px-3 py-1.5 rounded-full bg-amber-400 text-white hover:bg-amber-500 transition disabled:opacity-50"
                    >
                      🤔 Confirm Maybe
                    </button>
                    <button type="button" onClick={() => setShowMaybeNote(false)} className="text-xs text-blue-200 hover:text-white">Cancel</button>
                  </div>
                </div>
              )}
              {rsvpError && (
                <p className="mt-1.5 text-xs text-red-300">Couldn't save — please try again.</p>
              )}
            </div>
          </div>
        )}

        {/* Fixture preview */}
        {upcomingMatches !== null && (upcomingMatches.length > 0 ? (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Next matches</p>
              <button
                onClick={() => setLocation("/schedule")}
                className="text-xs font-medium text-green-700 hover:text-green-900 underline"
              >
                See all fixtures →
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {upcomingMatches.slice(0, 2).map((match) => {
                const countdown = match.status === "scheduled" ? getMatchCountdown(match.kickoffAt) : null;
                const isLive = match.status === "in_progress";
                return (
                  <div
                    key={match.id}
                    className={`bg-white rounded-2xl border shadow-sm px-5 py-4 ${isLive ? "border-emerald-300 ring-2 ring-emerald-200" : "border-gray-100"}`}
                  >
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {match.teamCategory && (
                        <span className={`${themeFor(match.teamCategory).chip} text-white text-[10px] font-bold px-2 py-0.5 rounded`}>
                          {match.teamCategory}
                        </span>
                      )}
                      {isLive && (
                        <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded animate-pulse">
                          <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full inline-block" />
                          Live
                        </span>
                      )}
                      {match.status === "final" && (
                        <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded">Final</span>
                      )}
                      {countdown && (
                        <span className="bg-[#EEF4FB] text-[#1E3A6E] text-[10px] font-semibold px-2 py-0.5 rounded">
                          {countdown}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-gray-500 tabular-nums">
                        {formatMatchDate(match.kickoffAt)} · {formatMatchTime(match.kickoffAt)} <span className="text-[10px] text-gray-400">CEST</span>
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate">vs {match.opponent}</p>
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
                      {(isLive || match.status === "final") && match.ourScore !== null && match.theirScore !== null && (
                        <div className="shrink-0 text-right">
                          <div className={`text-xl font-extrabold tabular-nums ${
                            isLive ? "text-emerald-700"
                            : match.ourScore > match.theirScore ? "text-[#1E3A6E]"
                            : match.ourScore < match.theirScore ? "text-rose-600"
                            : "text-gray-700"
                          }`}>
                            {match.ourScore} – {match.theirScore}
                          </div>
                          {match.status === "final" && (
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              {match.ourScore > match.theirScore ? "Win" : match.ourScore < match.theirScore ? "Loss" : "Draw"}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : upcomingMatches.length === 0 && null)}

        {/* Insurance summary card */}
        {player && (() => {
          const hasInsurance = player.insuranceProvider || player.insurancePolicyNumber || player.insuranceExpiry;
          const isMissing = !hasInsurance;
          const expiryStr = player.insuranceExpiry
            ? new Date(player.insuranceExpiry).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
            : null;
          const expirySoon = player.insuranceExpiry && (() => {
            const diff = new Date(player.insuranceExpiry) - new Date();
            return diff > 0 && diff < 60 * 24 * 60 * 60 * 1000;
          })();
          const expired = player.insuranceExpiry && new Date(player.insuranceExpiry) < new Date();
          return (
            <button
              onClick={() => player.accessToken && setLocation(`/my-details/${encodeURIComponent(player.accessToken)}`)}
              className={`w-full text-left mb-4 flex items-start gap-3 rounded-2xl px-5 py-4 border transition group ${
                isMissing
                  ? "bg-amber-50 border-amber-200 hover:bg-amber-100"
                  : expired
                  ? "bg-red-50 border-red-200 hover:bg-red-100"
                  : expirySoon
                  ? "bg-yellow-50 border-yellow-200 hover:bg-yellow-100"
                  : "bg-white border-gray-100 hover:shadow-md hover:border-green-200"
              }`}
            >
              <span className="text-xl mt-0.5">🛡️</span>
              <div className="flex-1 min-w-0">
                <p className={`font-semibold ${isMissing ? "text-amber-800" : expired ? "text-red-800" : "text-gray-900"}`}>
                  Travel &amp; medical insurance
                </p>
                {isMissing ? (
                  <p className="text-sm text-amber-700 mt-0.5">No insurance details on file — please add your policy information.</p>
                ) : (
                  <div className="mt-1 space-y-0.5">
                    {player.insuranceProvider && (
                      <p className="text-sm text-gray-700">{player.insuranceProvider}</p>
                    )}
                    {player.insurancePolicyNumber && (
                      <p className="text-sm text-gray-500">Policy: {player.insurancePolicyNumber}</p>
                    )}
                    {expiryStr && (
                      <p className={`text-sm ${expired ? "text-red-600 font-medium" : "text-gray-500"}`}>
                        {expired ? "Expired" : "Expires"}: {expiryStr}
                        {expired && " — please update your policy"}
                      </p>
                    )}
                  </div>
                )}
              </div>
              <span className={`text-sm font-medium self-center shrink-0 ${
                isMissing ? "text-amber-500 group-hover:text-amber-700"
                : expired ? "text-red-400 group-hover:text-red-600"
                : "text-gray-400 group-hover:text-gray-600"
              }`}>
                {isMissing ? "Add →" : "Edit →"}
              </span>
            </button>
          );
        })()}

        {/* Departure buddies nudge */}
        {departureBuddies && !depNudgeDismissed && (() => {
          const depDate = new Date(departureBuddies.date).toLocaleDateString("en-GB", {
            weekday: "long", day: "numeric", month: "long",
          });
          const { buddies, count } = departureBuddies;
          const shown = buddies.slice(0, 3);
          const overflow = count - shown.length;
          const nameList = shown.map((b) => b.departureCity ? `${b.name} — ${b.departureCity}` : b.name);
          if (overflow > 0) nameList.push(`and ${overflow} more`);
          return (
            <div className="relative mb-4 flex items-start gap-3 bg-sky-50 border border-sky-200 rounded-2xl px-5 py-4">
              <span className="text-xl mt-0.5 shrink-0">✈️</span>
              <button
                onClick={() => setLocation("/travel")}
                className="flex-1 min-w-0 text-left"
              >
                <p className="font-semibold text-sky-900">
                  {count === 1
                    ? "1 squadmate departs within 2 hours of you"
                    : `${count} squadmates depart within 2 hours of you`}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {nameList.map((label, i) => (
                    <li key={i} className="text-sm text-sky-800 leading-snug">{label}</li>
                  ))}
                </ul>
                <p className="text-sm text-sky-600 mt-1.5">Departing on {depDate} — great chance to coordinate!</p>
                <span className="text-xs font-medium text-sky-600 mt-1 inline-block">View travel details →</span>
              </button>
              <button
                onClick={() => {
                  localStorage.setItem("depNudgeDismissed", "1");
                  setDepNudgeDismissed(true);
                }}
                aria-label="Dismiss"
                className="shrink-0 text-sky-400 hover:text-sky-700 transition text-lg leading-none mt-0.5"
              >
                ×
              </button>
            </div>
          );
        })()}

        {/* Mandatory forms alert */}
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

        {/* Active polls */}
        {activePolls.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">Open polls</h2>
            <div className="flex flex-col gap-3">
              {activePolls.map((poll) => {
                const href = `/polls/${poll.id}${player?.accessToken ? `?t=${player.accessToken}` : ""}`;
                return (
                  <a
                    key={poll.id}
                    href={href}
                    className="flex items-center gap-4 bg-white rounded-2xl shadow-sm px-5 py-4 border border-gray-100 hover:shadow-md hover:border-green-200 transition group"
                  >
                    <span className="text-2xl shrink-0">{poll.hasVoted ? "✅" : "🗳️"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 leading-snug">{poll.title}</p>
                      {poll.description && (
                        <p className="text-sm text-gray-500 mt-0.5 truncate">{poll.description}</p>
                      )}
                      {poll.deadline && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Closes {new Date(poll.deadline).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      {poll.hasVoted ? (
                        <span className="text-xs font-medium text-emerald-600">Voted</span>
                      ) : (
                        <span className="text-xs font-medium text-green-700 group-hover:text-green-900">Vote →</span>
                      )}
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Card grid */}
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
