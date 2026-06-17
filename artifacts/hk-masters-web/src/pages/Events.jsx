import { useEffect, useState } from "react";
import content from "../content/events.json";
import RichText from "../components/RichText";
import SponsorStrip from "../components/SponsorStrip";
import { API_BASE } from "../utils/api";

const HK_TZ         = "Asia/Hong_Kong";
const ROTTERDAM_TZ  = "Europe/Amsterdam";
const RTM_START_EPOCH = new Date("2026-07-21T00:00:00+08:00").getTime();

function eventTz(event) {
  return new Date(event.startsAt).getTime() >= RTM_START_EPOCH ? ROTTERDAM_TZ : HK_TZ;
}

function formatDate(iso, tz) {
  return new Date(iso).toLocaleDateString("en-GB", {
    weekday: "short", day: "numeric", month: "short", timeZone: tz,
  });
}

function formatTime(iso, tz) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
  });
}

function formatTimeRange(startIso, endIso, tz) {
  const start = formatTime(startIso, tz);
  if (!endIso) return start;
  const startKey = new Date(startIso).toLocaleDateString("en-CA", { timeZone: tz });
  const endKey   = new Date(endIso).toLocaleDateString("en-CA", { timeZone: tz });
  if (startKey === endKey) return `${start} – ${formatTime(endIso, tz)}`;
  const endLabel = new Date(endIso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", timeZone: tz,
  });
  return `${start} – ${endLabel} ${formatTime(endIso, tz)}`;
}

const TOURNAMENT_DATE = new Date("2026-07-22T09:00:00+02:00");

function isRotterdamEvent(e) {
  return new Date(e.startsAt).getTime() >= RTM_START_EPOCH;
}

const BASE = import.meta.env.BASE_URL;

const KIND_META = {
  training: {
    label: "Training",
    badge: "bg-emerald-100 text-emerald-800",
    photos: [`${BASE}images/training-session.jpeg`],
  },
  meeting: {
    label: "Programme",
    badge: "bg-blue-100 text-blue-800",
    photos: [`${BASE}images/rotterdam-hc.jpeg`],
  },
  social: {
    label: "Social",
    badge: "bg-amber-100 text-amber-800",
    photos: [`${BASE}images/social-event.jpeg`],
  },
};

function kindMeta(kind, eventId = 0) {
  const meta = KIND_META[kind] ?? {
    label: "Event",
    badge: "bg-gray-100 text-gray-700",
    photos: [`${BASE}images/rotterdam-hero.png`],
  };
  const photos = meta.photos;
  return { ...meta, photo: photos[eventId % photos.length] };
}

function useDaysUntil(target) {
  const calc = () => Math.max(0, Math.floor((target.getTime() - Date.now()) / 86400000));
  const [days, setDays] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setDays(calc()), 60000);
    return () => clearInterval(id);
  }, []);
  return days;
}

function EventCard({ event, muted = false }) {
  const meta  = kindMeta(event.kind, event.id);
  const photo = event.photoUrl || meta.photo;
  const tz    = eventTz(event);
  return (
    <div className={`reveal tilt-card bg-white rounded-2xl overflow-hidden border shadow-sm transition-all duration-200 group ${
      muted ? "border-gray-100 opacity-70 hover:opacity-90" : "border-gray-100 hover:shadow-xl hover:-translate-y-0.5"
    }`}>
      <div className="relative h-40 overflow-hidden">
        <img
          src={photo}
          alt={meta.label}
          className={`w-full h-full object-cover transition-transform duration-500 ${muted ? "grayscale" : "group-hover:scale-105"}`}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.badge}`}>
          {meta.label}
        </span>
        {muted && (
          <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-gray-200 text-gray-500">
            Past
          </span>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500">
          <span className="font-semibold">{formatDate(event.startsAt, tz)}</span>
          <span className="text-gray-200">·</span>
          <span className="font-mono">{formatTimeRange(event.startsAt, event.endsAt, tz)}</span>
        </div>
        <h3 className="font-bold text-gray-900 leading-snug mb-1.5">{event.title}</h3>
        {event.location && (
          <p className="flex items-center gap-1 text-xs text-gray-400">
            <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {event.location}
          </p>
        )}
        {event.description && (
          <p className="text-xs text-gray-500 mt-2 leading-relaxed line-clamp-2">{event.description}</p>
        )}
      </div>
    </div>
  );
}

function FunRunBanner({ data, muted = false }) {
  const handleRegister = () => {
    if (window.filloutPopupEmbed) {
      window.filloutPopupEmbed.openPopup(data.fillout_id);
    } else {
      window.open(`https://forms.fillout.com/t/${data.fillout_id}`, "_blank");
    }
  };

  if (muted) {
    return (
      <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 mb-6 opacity-70">
        <div className="flex flex-col sm:flex-row items-stretch">
          <div className="w-full sm:w-2 bg-gray-300 shrink-0" />
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 px-6 py-5 flex-1">
            <div className="hidden sm:flex w-12 h-12 rounded-2xl bg-gray-200 items-center justify-center shrink-0 text-2xl select-none grayscale">
              🏃
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="bg-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">Fundraiser</span>
                <span className="bg-gray-200 text-gray-500 text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">Past</span>
                <span className="text-gray-400 text-xs font-medium hidden sm:inline">{data.subtitle}</span>
              </div>
              <h2 className="text-lg font-extrabold text-gray-500 leading-snug mb-1">{data.title}</h2>
              <div className="flex flex-wrap gap-2 mt-2">
                {data.date && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-200 text-gray-500 text-xs font-semibold px-3 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    {data.date}
                  </span>
                )}
                {data.time && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-200 text-gray-500 text-xs font-semibold px-3 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {data.time}
                  </span>
                )}
                {data.location && (
                  <span className="inline-flex items-center gap-1.5 bg-gray-200 text-gray-500 text-xs font-semibold px-3 py-1 rounded-full">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    {data.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-[#1E3A6E] to-[#16305D] rounded-2xl overflow-hidden shadow-xl mb-8 border border-white/10">
      <div className="flex flex-col sm:flex-row items-stretch">
        {/* Accent stripe */}
        <div className="w-full sm:w-2 bg-[#DE2910] shrink-0" />

        {/* Content */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 px-6 py-7 flex-1">
          {/* Icon */}
          <div className="hidden sm:flex w-14 h-14 rounded-2xl bg-white/10 items-center justify-center shrink-0 text-3xl select-none">
            🏃
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="bg-[#DE2910] text-white text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full">
                Fundraiser
              </span>
              <span className="text-white/40 text-xs hidden sm:inline">—</span>
              <span className="text-white/60 text-xs font-medium">{data.subtitle}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-extrabold text-white leading-snug mb-2">
              {data.title}
            </h2>
            <p className="text-white/70 text-sm leading-relaxed mb-4 max-w-xl">
              {data.description}
            </p>
            <div className="flex flex-wrap gap-2">
              {data.date && (
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  {data.date}
                </span>
              )}
              {data.time && (
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {data.time}
                </span>
              )}
              {data.location && (
                <span className="inline-flex items-center gap-1.5 bg-white/10 text-white/80 text-xs font-semibold px-3 py-1 rounded-full">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {data.location}
                </span>
              )}
            </div>
          </div>

          {/* CTA */}
          <div className="shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleRegister}
              data-fillout-id={data.fillout_id}
              data-fillout-embed-type="popup"
              data-fillout-inherit-parameters
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#DE2910] hover:bg-[#c42510] text-white font-bold text-sm px-7 py-3.5 rounded-xl transition-all duration-200 shadow-lg hover:shadow-[#DE2910]/30 hover:-translate-y-0.5 active:translate-y-0"
            >
              Register Now
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const TABS = ["All", "Training", "Programme", "Social"];

export default function Events() {
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading]     = useState(true);
  const [tab, setTab]             = useState("All");
  const daysUntil    = useDaysUntil(TOURNAMENT_DATE);
  const tournamentPast = daysUntil === 0;

  useEffect(() => {
    fetch(`${API_BASE}/api/events/public`)
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => setAllEvents(Array.isArray(data) ? data : []))
      .catch(() => setAllEvents([]))
      .finally(() => setLoading(false));
  }, []);

  const now  = new Date();
  const sorted   = [...allEvents].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const upcoming = sorted.filter((e) => new Date(e.endsAt || e.startsAt) >= now);
  const past     = sorted.filter((e) => new Date(e.endsAt || e.startsAt) < now).reverse();

  function matchesTab(e) {
    if (tab === "All") return true;
    return kindMeta(e.kind).label === tab;
  }

  const visibleUpcoming = upcoming.filter(matchesTab);
  const visiblePast     = past.filter(matchesTab);
  const tabCount = (t) => t === "All" ? upcoming.length : upcoming.filter(e => kindMeta(e.kind).label === t).length;

  return (
    <div>

      {/* Hero */}
      <div className="relative overflow-hidden" style={{ minHeight: 300 }}>
        <img
          src={`${import.meta.env.BASE_URL}images/rotterdam-hero.jpg`}
          alt="Rotterdam"
          className="absolute inset-0 w-full h-full object-cover object-center"
          style={{ filter: "brightness(0.8)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0D1E3C]/80 via-[#1E3A6E]/60 to-[#16305D]/95" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-10">
          <span className="inline-block bg-[#DE2910] text-white text-[11px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            Rotterdam 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-2 leading-none">Events</h1>
          <p className="text-[#BFD9F5] text-lg max-w-xl">
            The full tournament programme, club events, and social nights — all in one place.
          </p>
        </div>
      </div>

      {/* Journey strip */}
      {!tournamentPast && (
        <div className="bg-[#16305D] border-t border-white/10">
          <div className="max-w-6xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-5 flex items-center">
            <div className="flex flex-col items-center shrink-0">
              <span className="text-xl sm:text-2xl mb-0.5">🇭🇰</span>
              <span className="text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">HK</span>
              <span className="text-[#5B9FE0] text-[9px] sm:text-[10px]">Training</span>
            </div>

            <div className="flex-1 flex items-center mx-2 sm:mx-4">
              <div className="flex-1 border-t-2 border-dashed border-white/20" />
              <div className="mx-2 sm:mx-3 bg-white/10 border border-white/20 rounded-xl px-3 sm:px-5 py-2 sm:py-2.5 flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-lg sm:text-xl leading-none">✈️</span>
                <div className="flex flex-col items-center">
                  <span className="text-xl sm:text-2xl font-black text-white tabular-nums leading-none">{daysUntil}</span>
                  <span className="text-[8px] sm:text-[9px] text-[#8FBDE8] uppercase tracking-widest leading-none mt-0.5">days to go</span>
                </div>
              </div>
              <div className="flex-1 border-t-2 border-dashed border-white/20" />
            </div>

            <div className="flex flex-col items-center shrink-0">
              <span className="text-xl sm:text-2xl mb-0.5">🇳🇱</span>
              <span className="text-white text-[10px] sm:text-[11px] font-bold uppercase tracking-wide">Rotterdam</span>
              <span className="text-[#5B9FE0] text-[9px] sm:text-[10px]">22 Jul – 1 Aug</span>
            </div>
          </div>
        </div>
      )}

      {/* Filter tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-20 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const count = tabCount(t);
            if (t !== "All" && count === 0) return null;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-semibold border-b-2 whitespace-nowrap transition-colors shrink-0 ${
                  tab === t ? "border-[#1E3A6E] text-[#1E3A6E]" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t}
                {t !== "All" && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t ? "bg-[#1E3A6E] text-white" : "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {content.fun_run?.enabled && !content.fun_run?.past && (tab === "All" || tab === "Social") && (
          <FunRunBanner data={content.fun_run} />
        )}

        {loading && (
          <div className="text-center py-20 text-gray-400">Loading events…</div>
        )}

        {!loading && visibleUpcoming.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
            {visibleUpcoming.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        )}

        {!loading && upcoming.length === 0 && (
          <div className="bg-gray-50 rounded-2xl p-12 text-center mb-16">
            <p className="text-gray-500 font-medium">No upcoming events</p>
            <p className="text-sm text-gray-400 mt-1">Events will appear here once published.</p>
          </div>
        )}

        {(!loading && visiblePast.length > 0) || (content.fun_run?.enabled && content.fun_run?.past && (tab === "All" || tab === "Social")) ? (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Past Events</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            {content.fun_run?.enabled && content.fun_run?.past && (tab === "All" || tab === "Social") && (
              <FunRunBanner data={content.fun_run} muted />
            )}
            {visiblePast.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-16">
                {visiblePast.map((e) => (
                  <EventCard key={e.id} event={e} muted />
                ))}
              </div>
            )}
          </section>
        ) : null}

        {content.tournament_archive.length > 0 && (
          <section>
            <div className="flex items-center gap-3 mb-6">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Tournament Archive</h2>
              <div className="flex-1 h-px bg-gray-200" />
            </div>
            <p className="text-sm text-gray-500 mb-6">Historical records from past tournaments.</p>
            <div className="space-y-4">
              {content.tournament_archive.map((tournament) => (
                <div
                  key={tournament.name}
                  className="reveal bg-[#1E3A6E]/5 border border-[#1E3A6E]/20 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-6 items-start sm:items-center"
                >
                  <div className="w-14 h-14 bg-[#1E3A6E] rounded-xl flex items-center justify-center shrink-0 text-white">
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
                        <a href={tournament.notion_url} target="_blank" rel="noopener noreferrer"
                          className="btn-shimmer inline-flex items-center gap-2 bg-[#1E3A6E] text-white font-semibold px-5 py-2.5 rounded-lg hover:bg-[#16305D] transition-colors text-sm">
                          View Tournament Site
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                          </svg>
                        </a>
                      )}
                      {tournament.result_url && (
                        <a href={tournament.result_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 border border-[#1E3A6E] text-[#1E3A6E] font-semibold px-5 py-2.5 rounded-lg hover:bg-[#1E3A6E]/5 transition-colors text-sm">
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
