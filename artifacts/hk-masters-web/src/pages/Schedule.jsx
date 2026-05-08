import { useEffect, useState } from "react";
import { API_BASE } from "../utils/api";

const ROTTERDAM_TZ = "Europe/Amsterdam";

function formatDateHeading(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
    timeZone: ROTTERDAM_TZ,
  });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: ROTTERDAM_TZ,
  });
}

function rotterdamDateKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ });
}

function getCountdown(iso) {
  const now  = Date.now();
  const t    = new Date(iso).getTime();
  const diff = t - now;
  if (diff <= 0) return null;
  const days  = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 1) return `In ${days} days`;
  if (days === 1) return "Tomorrow";
  if (hours >= 1) return `In ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return mins > 0 ? `In ${mins}m` : "Starting soon";
}

function MatchCard({ match }) {
  const isPast    = match.status === "final" || match.status === "cancelled";
  const isLive    = match.status === "in_progress";
  const countdown = match.status === "scheduled" ? getCountdown(match.kickoffAt) : null;
  const showCalendarButton = match.status !== "cancelled" && match.status !== "final";

  return (
    <div className={`bg-white rounded-xl border shadow-sm p-5 transition-all ${
      isLive ? "border-emerald-300 ring-2 ring-emerald-200" : "border-gray-100 hover:shadow-md"
    }`}>
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="bg-[#DE2910] text-white text-xs font-bold px-2 py-0.5 rounded">
            {match.teamCategory || "HK"}
          </span>
          {isLive && (
            <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded animate-pulse">
              <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
              Live
            </span>
          )}
          {match.status === "cancelled" && (
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded">Cancelled</span>
          )}
          {match.status === "final" && (
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-0.5 rounded">Final</span>
          )}
          {countdown && (
            <span className="bg-[#EEF4FB] text-[#1E3A6E] text-xs font-semibold px-2 py-0.5 rounded">
              {countdown}
            </span>
          )}
        </div>
        <span className="text-xs font-medium text-gray-500">{formatTime(match.kickoffAt)}</span>
      </div>

      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-1">{match.teamName || "HK Masters"}</p>
          <p className="font-bold text-gray-900 text-lg truncate">vs {match.opponent}</p>
          {match.venue && (
            <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="truncate">{match.venue}</span>
            </p>
          )}
        </div>
        {isPast && match.ourScore !== null && match.theirScore !== null && (
          <div className="shrink-0 text-right">
            <div className={`text-2xl font-extrabold tabular-nums ${
              match.ourScore > match.theirScore ? "text-[#1E3A6E]" :
              match.ourScore < match.theirScore ? "text-rose-600" : "text-gray-700"
            }`}>
              {match.ourScore} – {match.theirScore}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {match.ourScore > match.theirScore ? "Win" : match.ourScore < match.theirScore ? "Loss" : "Draw"}
            </p>
          </div>
        )}
        {isLive && match.ourScore !== null && match.theirScore !== null && (
          <div className="shrink-0 text-right">
            <div className="text-2xl font-extrabold tabular-nums text-emerald-700">
              {match.ourScore} – {match.theirScore}
            </div>
          </div>
        )}
      </div>

      {showCalendarButton && (
        <div className="mt-4 pt-3 border-t border-gray-100">
          <a
            href={`${API_BASE}/api/matches/${match.id}/calendar.ics`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1E3A6E] hover:text-[#16305D] transition-colors"
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

function SubscribeButton() {
  const [copied, setCopied] = useState(false);
  const url = `${API_BASE || (typeof window !== "undefined" ? window.location.origin : "")}/api/matches/calendar.ics`;
  const webcalUrl = url.replace(/^https?:/, "webcal:");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (_) {
      // ignore — webcal link still works
    }
  };

  return (
    <div className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
      <a
        href={webcalUrl}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-[#1E3A6E] hover:bg-[#EEF4FB] transition-colors"
        title="Open in your default calendar app"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        Subscribe to schedule
      </a>
      <button
        type="button"
        onClick={handleCopy}
        className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-50 border-l border-gray-200 transition-colors"
        title="Copy subscription URL"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

export default function Schedule() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/matches`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load");
        return r.json();
      })
      .then((data) => {
        setMatches(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  const sorted   = [...matches].sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime());
  const now      = Date.now();
  const upcoming = sorted.filter((m) => new Date(m.kickoffAt).getTime() >= now - 3 * 60 * 60 * 1000 && m.status !== "cancelled");
  const past     = sorted.filter((m) => !upcoming.includes(m)).reverse();

  function groupByDateAndTeam(list) {
    const groups = new Map();
    for (const m of list) {
      const dateKey = rotterdamDateKey(m.kickoffAt);
      if (!groups.has(dateKey)) groups.set(dateKey, { date: m.kickoffAt, teams: new Map() });
      const dateGroup = groups.get(dateKey);
      const teamKey = m.teamCategory || m.teamName || "HK Masters";
      if (!dateGroup.teams.has(teamKey)) dateGroup.teams.set(teamKey, []);
      dateGroup.teams.get(teamKey).push(m);
    }
    return Array.from(groups.values()).map((g) => ({
      date: g.date,
      teams: Array.from(g.teams.entries()).map(([name, items]) => ({ name, items })),
    }));
  }

  const upcomingGroups = groupByDateAndTeam(upcoming);
  const pastGroups     = groupByDateAndTeam(past);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Rotterdam 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Match Schedule</h1>
          <p className="text-[#BFD9F5] text-lg max-w-2xl">
            Fixtures and results for Hong Kong Masters MO40 and MO50 at the World Masters Hockey Cup.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading schedule…</div>
        ) : error ? (
          <div className="rounded-xl bg-red-50 border border-red-200 px-5 py-4 text-sm text-red-700">
            Could not load match schedule. Please try again later.
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-[#D9C9A8]">
            <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-500 font-medium">Match fixtures coming soon</p>
            <p className="text-sm text-gray-400 mt-1">Individual match fixtures will be published once Rotterdam releases the tournament draw.</p>
          </div>
        ) : (
          <>
            {upcomingGroups.length > 0 && (
              <section className="mb-16">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
                  <div className="flex items-center gap-3">
                    <h2 className="text-2xl font-bold text-[#1E3A6E]">Upcoming Fixtures</h2>
                    <span className="bg-[#1E3A6E] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                      {upcoming.length}
                    </span>
                  </div>
                  <SubscribeButton />
                </div>
                <p className="text-sm text-gray-500 mb-6 -mt-3">
                  Subscribe once and your calendar updates automatically when fixtures change. Or use "Add to calendar" on any match below for a one-off download.
                </p>
                <div className="space-y-10">
                  {upcomingGroups.map((g) => (
                    <div key={g.date}>
                      <h3 className="text-sm font-bold text-[#1E3A6E] uppercase tracking-wide mb-4">
                        {formatDateHeading(g.date)}
                      </h3>
                      <div className="space-y-6">
                        {g.teams.map((teamGroup) => (
                          <div key={teamGroup.name}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="bg-[#DE2910] text-white px-2 py-0.5 rounded text-[10px]">
                                {teamGroup.name}
                              </span>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {teamGroup.items.map((m) => (
                                <MatchCard key={m.id} match={m} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {pastGroups.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold text-[#1E3A6E] mb-6">Results</h2>
                <div className="space-y-10">
                  {pastGroups.map((g) => (
                    <div key={g.date}>
                      <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">
                        {formatDateHeading(g.date)}
                      </h3>
                      <div className="space-y-6">
                        {g.teams.map((teamGroup) => (
                          <div key={teamGroup.name}>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded text-[10px]">
                                {teamGroup.name}
                              </span>
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {teamGroup.items.map((m) => (
                                <MatchCard key={m.id} match={m} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
