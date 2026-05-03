import { useEffect, useState } from "react";
import content from "../content/events.json";
import RichText from "../components/RichText";
import SponsorStrip from "../components/SponsorStrip";
import { API_BASE } from "../utils/api";

const ROTTERDAM_TZ = "Europe/Amsterdam";

function formatDayHeading(iso) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "long", day: "numeric", month: "long",
    timeZone: ROTTERDAM_TZ,
  });
}

function rotterdamDateKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ });
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
  social: "bg-amber-100 text-amber-800",
  training: "bg-emerald-100 text-emerald-800",
};

const KIND_LABEL = {
  meeting: "Tournament",
  social: "Social",
  training: "Training",
};

function ProgrammeEventCard({ event }) {
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

function StaticEventCard({ event, type }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 hover:shadow-md transition-shadow duration-150">
      <div className="flex flex-wrap gap-2 items-center mb-3">
        <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
          type === "upcoming" ? "bg-green-100 text-[#006B3C]" : "bg-gray-100 text-gray-500"
        }`}>
          {event.date}
        </span>
        {event.result && (
          <span className="text-xs bg-[#DE2910]/10 text-[#DE2910] font-semibold px-2.5 py-0.5 rounded-full">
            Results: {event.result}
          </span>
        )}
      </div>
      <h3 className="font-bold text-gray-900 text-lg mb-1">{event.name}</h3>
      <p className="text-sm text-gray-500 flex items-center gap-1 mb-3">
        <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        {event.location}
      </p>
      <RichText content={event.description} className="text-sm text-gray-600 leading-relaxed" />
    </div>
  );
}

export default function Events() {
  const [programmeEvents, setProgrammeEvents] = useState([]);
  const [loadingProgramme, setLoadingProgramme] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/events/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setProgrammeEvents(Array.isArray(data) ? data : []))
      .catch(() => setProgrammeEvents([]))
      .finally(() => setLoadingProgramme(false));
  }, []);

  // Group programme events by Rotterdam-local date
  const programmeGroups = (() => {
    const groups = new Map();
    for (const e of programmeEvents) {
      const key = rotterdamDateKey(e.startsAt);
      if (!groups.has(key)) groups.set(key, { date: e.startsAt, items: [] });
      groups.get(key).items.push(e);
    }
    return Array.from(groups.values());
  })();

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
            The full Rotterdam 2026 tournament programme, plus club events, social nights, and past results.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 space-y-20">

        {/* Rotterdam 2026 Tournament Programme (live from admin) */}
        <section>
          <div className="flex items-center gap-3 mb-2">
            <h2 className="text-2xl font-bold text-gray-900">Rotterdam 2026 Programme</h2>
            {!loadingProgramme && programmeEvents.length > 0 && (
              <span className="bg-[#006B3C] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {programmeEvents.length}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mb-6">
            Team checks, ceremonies, match days, social events and the wrap party.{" "}
            <span className="text-gray-400">All times shown in Rotterdam local time (CEST).</span>
          </p>

          {loadingProgramme ? (
            <div className="text-center py-10 text-gray-400">Loading programme…</div>
          ) : programmeGroups.length === 0 ? (
            <div className="bg-gray-50 rounded-2xl p-10 text-center">
              <p className="text-gray-500 font-medium">Programme coming soon</p>
              <p className="text-sm text-gray-400 mt-1">The full tournament programme will be published here shortly.</p>
            </div>
          ) : (
            <div className="space-y-10">
              {programmeGroups.map((g) => (
                <div key={g.date}>
                  <h3 className="text-sm font-bold text-[#006B3C] uppercase tracking-wide mb-4">
                    {formatDayHeading(g.date)}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {g.items.map((e) => (
                      <ProgrammeEventCard key={e.id} event={e} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Upcoming Club Events (static) */}
        {content.upcoming_events.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Upcoming Club Events</h2>
              <span className="bg-[#006B3C] text-white text-xs font-bold px-2.5 py-1 rounded-full">
                {content.upcoming_events.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.upcoming_events.map((event) => (
                <StaticEventCard key={event.name} event={event} type="upcoming" />
              ))}
            </div>
          </section>
        )}

        {/* Past Events (static) */}
        {content.past_events.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Past Events</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {content.past_events.map((event) => (
                <StaticEventCard key={event.name} event={event} type="past" />
              ))}
            </div>
          </section>
        )}

        {/* Tournament Archive (static) */}
        {content.tournament_archive.length > 0 && (
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Tournament Archive</h2>
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
                    {tournament.notion_url && (
                      <a
                        href={tournament.notion_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-[#006B3C] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-green-800 transition-colors duration-150 text-sm"
                      >
                        View Full Tournament Site
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    )}
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
