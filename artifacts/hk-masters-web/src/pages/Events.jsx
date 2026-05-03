import { useEffect, useState } from "react";
import content from "../content/events.json";
import RichText from "../components/RichText";
import SponsorStrip from "../components/SponsorStrip";
import { API_BASE } from "../utils/api";

const ROTTERDAM_TZ = "Europe/Amsterdam";

function rotterdamDateKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ });
}

function formatDayHeading(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: ROTTERDAM_TZ,
  });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: ROTTERDAM_TZ,
  });
}

function formatTimeRange(startIso, endIso) {
  const start = formatTime(startIso);
  if (!endIso) return start;
  if (rotterdamDateKey(startIso) === rotterdamDateKey(endIso)) {
    return `${start} – ${formatTime(endIso)}`;
  }
  const endLabel = new Date(endIso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: ROTTERDAM_TZ,
  });
  return `${start} – ${endLabel} ${formatTime(endIso)}`;
}

const KIND_BADGE = {
  meeting: "bg-blue-100 text-blue-800",
  social:  "bg-amber-100 text-amber-800",
  training:"bg-emerald-100 text-emerald-800",
};
const KIND_LABEL = {
  meeting:  "Programme",
  social:   "Social",
  training: "Training",
};

function EventCard({ event }) {
  const badgeColour = KIND_BADGE[event.kind] || "bg-gray-100 text-gray-700";
  const label = KIND_LABEL[event.kind] || "Event";
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 hover:shadow-md transition-shadow">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded ${badgeColour}`}>
          {label}
        </span>
        <span className="text-xs font-medium text-gray-500">
          {formatTimeRange(event.startsAt, event.endsAt)}
        </span>
      </div>
      <h4 className="font-bold text-gray-900 text-lg leading-snug">{event.title}</h4>
      {event.location && (
        <p className="text-sm text-gray-500 mt-1.5 flex items-center gap-1">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{event.location}</span>
        </p>
      )}
      {event.description && (
        <p className="text-sm text-gray-600 mt-2 leading-relaxed">{event.description}</p>
      )}
    </div>
  );
}

function groupByDay(list) {
  const groups = new Map();
  for (const e of list) {
    const key = rotterdamDateKey(e.startsAt);
    if (!groups.has(key)) groups.set(key, { date: e.startsAt, items: [] });
    groups.get(key).items.push(e);
  }
  return Array.from(groups.values());
}

export default function Events() {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/events/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllEvents(Array.isArray(data) ? data : []))
      .catch(() => setAllEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const now = new Date();
  const sorted = [...allEvents].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const upcoming = sorted.filter((e) => new Date(e.endsAt || e.startsAt) >= now);
  const past = sorted.filter((e) => new Date(e.endsAt || e.startsAt) < now).reverse();

  const upcomingGroups = groupByDay(upcoming);
  const pastGroups = groupByDay(past);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Rotterdam 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Events</h1>
          <p className="text-green-200 text-lg max-w-2xl">
            The full tournament programme, club events, and social nights — all in one place.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* Upcoming Events (live from admin) */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Upcoming Events</h2>
            {!loading && upcoming.length > 0 && (
              <span className="bg-[#006B3C] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {upcoming.length}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-6">
            All times shown in Rotterdam local time (CEST).
          </p>

          {loading ? (
            <div className="text-center py-10 text-gray-400">Loading events…</div>
          ) : upcomingGroups.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-10 text-center">
              <p className="text-gray-500 font-medium">No upcoming events yet</p>
              <p className="text-sm text-gray-400 mt-1">Check back soon — events will appear here as they are published.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {upcomingGroups.map((g) => (
                <div key={g.date}>
                  <h3 className="text-sm font-bold text-[#006B3C] uppercase tracking-wide mb-4">
                    {formatDayHeading(g.date)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {g.items.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Past Events (live from admin) */}
        {!loading && pastGroups.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Events</h2>
            <div className="space-y-10">
              {pastGroups.map((g) => (
                <div key={g.date}>
                  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wide mb-4">
                    {formatDayHeading(g.date)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {g.items.map((e) => (
                      <EventCard key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Tournament Archive (static — historical records) */}
        {content.tournament_archive.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Tournament Archive</h2>
            <p className="text-sm text-gray-500 mb-6">Historical records from past tournaments.</p>
            <div className="space-y-4">
              {content.tournament_archive.map((tournament) => (
                <div
                  key={tournament.name}
                  className="bg-[#006B3C]/5 border border-[#006B3C]/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
                >
                  <div className="w-14 h-14 bg-[#006B3C] rounded-xl flex items-center justify-center shrink-0 text-white">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap gap-2 items-center mb-2">
                      <span className="bg-[#DE2910] text-white text-xs font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wide">
                        {tournament.date}
                      </span>
                      <span className="bg-gray-100 text-gray-500 text-xs font-semibold px-2.5 py-0.5 rounded-full">
                        {tournament.location}
                      </span>
                    </div>
                    <h3 className="text-xl font-extrabold text-gray-900 mb-2">{tournament.name}</h3>
                    <RichText content={tournament.description} className="text-gray-600 text-sm leading-relaxed mb-4" />
                    <div className="flex flex-wrap gap-3">
                      {tournament.notion_url && (
                        <a
                          href={tournament.notion_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 bg-[#006B3C] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors duration-150 text-sm"
                        >
                          View Tournament Site
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                      {tournament.result_url && (
                        <a
                          href={tournament.result_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 border border-[#006B3C] text-[#006B3C] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#006B3C]/5 transition-colors duration-150 text-sm"
                        >
                          View Results
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

      </div>

      <SponsorStrip />
    </div>
  );
}
