import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import content from "../content/rotterdam.json";
import teamsContent from "../content/teams.json";
import AutoLink from "../components/AutoLink";
import RichText from "../components/RichText";
import SquadModal from "../components/SquadModal";
import SponsorStrip from "../components/SponsorStrip";
import { API_BASE } from "../utils/api";
import { cloudinaryResize } from "../utils/cloudinary";
import { usePageTexts } from "../utils/pageTexts";
import { themeFor } from "../utils/teamTheme";
import { newsDisplayDate } from "../utils/dates";

const ROTTERDAM_TZ = "Europe/Amsterdam";
const RTM_START = "2026-07-22";
const RTM_END   = "2026-08-01";

function rtmDateKey(iso) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ });
}
function rtmTime(iso) {
  return new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ROTTERDAM_TZ });
}
function rtmDayHeading(dateKey) {
  return new Date(`${dateKey}T12:00:00Z`).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

const KIND_EMOJI = { training: "🏑", meeting: "💬", social: "🥂", physio: "💆", team_dinner: "🍽️", dinner: "🍴", free_time: "☀️" };
const KIND_LABEL = { training: "Training", meeting: "Meeting", social: "Social", physio: "Physio", team_dinner: "Team Dinner", dinner: "Dinner", free_time: "Free Time" };

function escapeIcs(str) { return (str || "").replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n"); }
function toIcsDate(iso) { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""); }
function downloadEventIcs(ev) {
  const kindLabel = KIND_LABEL[ev.kind] ?? ev.kind;
  const summary = `${kindLabel}: ${ev.title}`;
  const start = toIcsDate(ev.startsAt);
  const end = toIcsDate(ev.endsAt || new Date(new Date(ev.startsAt).getTime() + 60 * 60 * 1000).toISOString());
  const now = toIcsDate(new Date().toISOString());
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0",
    "PRODID:-//HK Masters Hockey//Rotterdam 2026//EN",
    "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:hkm-event-${ev.id}@hkmastershockey.com`,
    `DTSTAMP:${now}`, `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${escapeIcs(summary)}`,
  ];
  if (ev.location) lines.push(`LOCATION:${escapeIcs(ev.location)}`);
  if (ev.description) lines.push(`DESCRIPTION:${escapeIcs(ev.description)}`);
  lines.push("END:VEVENT", "END:VCALENDAR");
  const blob = new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url;
  a.download = `hk-${ev.kind}-${ev.id}.ics`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function useSiteContent() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/site-content`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setData(d); })
      .catch(() => {});
  }, []);
  return data;
}

function useTeams() {
  const [teams, setTeams] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/teams`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (Array.isArray(data)) setTeams(data); })
      .catch(() => {});
  }, []);
  return teams;
}

// Merge live API data (by index — API returns teams ordered by id) into static squad entry.
// Static JSON provides photo, short_name, and fallback text; DB provides live counts + staff names.
function mergeSquad(staticSquad, liveTeam) {
  if (!liveTeam) return staticSquad;
  return {
    ...staticSquad,
    manager: liveTeam.managerName || staticSquad.manager,
    coach: liveTeam.coachName || staticSquad.coach,
    captain: liveTeam.captainName || staticSquad.captain,
    description: liveTeam.description || staticSquad.description,
    player_count: liveTeam.playerCount ?? staticSquad.player_count,
  };
}

function useLatestNews() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/api/news`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => setPosts((data.posts || []).slice(0, 3)))
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return { posts, loading };
}

function proxyNotionImage(url) {
  if (!url) return null;
  // Relative paths (e.g. /api/news/serve-image/...) must be prefixed with
  // API_BASE so they resolve to the API server in production.
  if (url.startsWith("/")) return `${API_BASE}${url}`;
  if (
    url.includes("amazonaws.com") ||
    url.includes("notion.so") ||
    url.includes("file.notion")
  ) {
    return `${API_BASE}/api/news/image?url=${encodeURIComponent(url)}`;
  }
  return url;
}

function LatestNewsSection() {
  const { posts, loading } = useLatestNews();
  if (loading || posts.length === 0) return null;

  return (
    <section className="bg-white border-t border-gray-100 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="reveal flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#1E3A6E]">Latest from the team</h2>
          <Link
            href="/news"
            className="text-[#2A5298] font-medium hover:text-[#1E3A6E] transition-colors duration-150 text-sm"
          >
            See all news &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {posts.map((post) => {
            const cover = proxyNotionImage(post.coverImage);
            const dateStr = newsDisplayDate(post.reportDate, post.publishedAt);
            return (
              <Link
                key={post.id}
                href={`/news/${post.slug}`}
                className="reveal bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col"
              >
                {cover ? (
                  <div className="aspect-[16/9] overflow-hidden bg-gray-100">
                    <img
                      src={cover}
                      alt={post.title}
                      loading="lazy"
                      className="w-full h-full object-cover hover:scale-[1.02] transition-transform duration-300"
                    />
                  </div>
                ) : (
                  <div className="aspect-[16/9] bg-[#16305D] flex items-center justify-center">
                    <span className="text-[#5B9FE0] text-xs font-semibold uppercase tracking-widest opacity-60">
                      HK Masters
                    </span>
                  </div>
                )}
                <div className="p-5 flex flex-col flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    {post.category && (
                      <span className="text-xs font-semibold bg-[#EEF4FB] text-[#1E3A6E] px-2 py-0.5 rounded-full">
                        {post.category}
                      </span>
                    )}
                    {dateStr && <span className="text-xs text-gray-400">{dateStr}</span>}
                  </div>
                  <h3 className="text-base font-bold text-gray-900 leading-snug mb-1">
                    {post.title}
                  </h3>
                  {post.excerpt && (
                    <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default function Rotterdam2026() {
  const t = usePageTexts("rotterdam", content);
  const teamManagementUrl = "https://app.hkmastershockey.com";
  const [openSquad, setOpenSquad] = useState(null);
  const liveTeams = useTeams();
  const siteContent = useSiteContent();
  const [progTab, setProgTab] = useState("All");
  const [publicEvents, setPublicEvents] = useState([]);
  const [publicMatches, setPublicMatches] = useState([]);

  // liveTeams is sorted by DB id; static squads are in the same order (MO40 first, MO50 second)
  // Override squad photos from the API site-content (admin-managed) if available
  const squads = teamsContent.squads.map((s, i) => {
    const merged = { ...mergeSquad(s, liveTeams ? liveTeams[i] : null) };
    if (siteContent) {
      const apiPhoto = s.short_name === "MO40" ? siteContent.mo40Photo : siteContent.mo50Photo;
      if (apiPhoto) merged.photo = apiPhoto;
    }
    return merged;
  });

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/events/public`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${API_BASE}/api/matches`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([evts, mtchs]) => {
      setPublicEvents(Array.isArray(evts) ? evts : []);
      setPublicMatches(Array.isArray(mtchs) ? mtchs : []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    } else {
      window.scrollTo(0, 0);
    }
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            {t.header_badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Rotterdam 2026</h1>
          <p className="text-[#BFD9F5] text-lg max-w-2xl">
            World Masters Hockey Cup &mdash; Rotterdam, Netherlands
          </p>
          <div className="mt-8 grid grid-cols-3 divide-x divide-[#5B9FE0]/20 max-w-sm">
            {(t.stats || content.stats).map((item, i) => (
              <div key={item.label} className="reveal text-center py-3" style={{ animationDelay: `${i * 0.12}s` }}>
                <p className="text-3xl font-extrabold text-white">{item.stat}</p>
                <p className="text-[#8FBDE8] text-xs font-medium mt-0.5">{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tournament Overview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-[#1E3A6E] mb-4">About the Tournament</h2>
            <RichText content={t.overview_p1} className="text-gray-600 leading-relaxed mb-4" />
            <RichText content={t.overview_p2} className="text-gray-600 leading-relaxed mb-4" />
            <RichText content={t.overview_p3} className="text-gray-600 leading-relaxed" />
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#D9C9A8] shadow-sm">
            <h3 className="font-bold text-[#1E3A6E] mb-4">Quick Facts</h3>
            <dl className="space-y-3">
              {(t.quick_facts || content.quick_facts).map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right"><AutoLink text={value} /></dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* Rotterdam Squads */}
      <section aria-labelledby="rotterdam-squads-heading">
        <div className="bg-[#1E3A6E] text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 id="rotterdam-squads-heading" className="text-4xl font-extrabold mb-3">
              Our Rotterdam 2026 Squads
            </h2>
            <p className="text-[#BFD9F5] text-lg max-w-2xl">
              Two HK squads that competed at the World Masters Hockey Cup — Rotterdam, Netherlands.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="space-y-16">
            {squads.map((squad, index) => (
              <div
                key={squad.id}
                className={`reveal flex flex-col ${index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-10 items-center`}
              >
                {/* Squad Photo */}
                <div className="w-full lg:w-1/2 shrink-0">
                  {squad.photo ? (
                    <img
                      src={cloudinaryResize(squad.photo, 900, 500)}
                      alt={`${squad.name} squad photo`}
                      className="rounded-2xl w-full h-72 object-cover shadow-md"
                    />
                  ) : (
                    <div className="rounded-2xl w-full h-72 bg-[#1E3A6E]/10 border-2 border-dashed border-[#1E3A6E]/30 flex flex-col items-center justify-center text-[#1E3A6E]">
                      <div className="text-4xl font-extrabold opacity-30">{squad.short_name}</div>
                      <p className="text-sm opacity-40 mt-1">Squad photo coming soon</p>
                    </div>
                  )}
                </div>

                {/* Squad Info */}
                <div className="w-full lg:w-1/2">
                  <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                    {squad.short_name}
                  </span>
                  <h3 className="text-3xl font-extrabold text-[#1E3A6E] mb-3">{squad.name}</h3>
                  <RichText
                    content={index === 0 ? t.mo40_description : t.mo50_description}
                    className="text-[#5A4F45] leading-relaxed mb-5"
                  />

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-[#F2E8D5] rounded-lg p-3 text-center border border-[#E5D5BC]">
                      <p className="text-2xl font-bold text-[#1E3A6E]">{squad.player_count}</p>
                      <p className="text-xs text-[#8A7A6A] mt-0.5">Players</p>
                    </div>
                    <div className="bg-[#F2E8D5] rounded-lg p-3 text-center border border-[#E5D5BC]">
                      <p className="text-sm font-semibold text-[#4A3F35]">{squad.manager || "TBC"}</p>
                      <p className="text-xs text-[#8A7A6A] mt-0.5">Manager</p>
                    </div>
                    <div className="bg-[#F2E8D5] rounded-lg p-3 text-center border border-[#E5D5BC]">
                      <p className="text-sm font-semibold text-[#4A3F35]">{squad.coach || "TBC"}</p>
                      <p className="text-xs text-[#8A7A6A] mt-0.5">Coach</p>
                    </div>
                    <div className="bg-[#F2E8D5] rounded-lg p-3 text-center border border-[#E5D5BC]">
                      <p className="text-sm font-semibold text-[#4A3F35]">{squad.captain || "TBC"}</p>
                      <p className="text-xs text-[#8A7A6A] mt-0.5">Captain</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setOpenSquad({ category: squad.short_name, teamInfo: squad })}
                    className="btn-shimmer inline-flex items-center gap-2 bg-[#1E3A6E] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#16305D] transition-colors duration-150 text-sm"
                  >
                    View Squad List →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Latest News (from Notion) */}
      <LatestNewsSection />

      {/* Tournament Programme */}
      <section id="programme" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h2 className="text-2xl font-bold text-[#1E3A6E]">Tournament Programme</h2>
            <p className="text-sm text-gray-500 mt-1">22 Jul – 1 Aug 2026 · Times in Rotterdam (CEST)</p>
          </div>
          <div className="flex items-center rounded-lg border border-[#1E3A6E]/25 overflow-hidden text-sm font-bold">
            {["All", "MO40", "MO50"].map((tab) => (
              <button
                key={tab}
                onClick={() => setProgTab(tab)}
                className={`px-4 py-2 transition-colors ${progTab === tab ? "bg-[#1E3A6E] text-white" : "text-[#1E3A6E] hover:bg-[#1E3A6E]/8"}`}
              >
                {tab === "MO40" ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#DE2910] inline-block" />MO40</span>
                 : tab === "MO50" ? <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#1E3A6E] inline-block" />MO50</span>
                 : "All squads"}
              </button>
            ))}
          </div>
        </div>

        <ProgrammeSection
          progTab={progTab}
          publicEvents={publicEvents}
          publicMatches={publicMatches}
        />
      </section>

      {/* Fundraising CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="reveal scale-in bg-gradient-to-br from-[#1E3A6E] to-[#16305D] rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 text-white">
          <div className="flex-1">
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
              Support the Team
            </span>
            <h2 className="text-2xl font-bold mb-2">{t.fundraising_heading}</h2>
            <p className="text-[#D6E8F7] leading-relaxed max-w-lg">
              {t.fundraising_text}
            </p>
          </div>
          <div className="shrink-0">
            <Link
              href="/support"
              className="btn-shimmer inline-block bg-white text-[#1E3A6E] font-bold px-8 py-3 rounded-lg hover:bg-[#F2E8D5] transition-colors duration-150 whitespace-nowrap"
            >
              View Fundraising &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Team Management App CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="reveal bg-[#1E3A6E] rounded-2xl p-8 sm:p-10 text-white text-center">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Rotterdam 2026 Squad
          </span>
          <h2 className="text-2xl font-bold mb-3">Access Your Team Portal</h2>
          <p className="text-[#D6E8F7] max-w-lg mx-auto mb-8 leading-relaxed">
            Registered players can view their personal schedule, fees, and travel details. Team managers have full access to the management portal.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <div className="flex flex-col items-center gap-1">
              <Link
                href="/my-schedule"
                className="btn-shimmer inline-block bg-white text-[#1E3A6E] font-bold px-8 py-3 rounded-lg hover:bg-[#F2E8D5] transition-colors duration-150 whitespace-nowrap"
              >
                I'm a Player &rarr;
              </Link>
              <span className="text-[#8FBDE8] text-xs">My schedule, fees &amp; travel</span>
            </div>
            <div className="flex flex-col items-center gap-1">
              <a
                href={teamManagementUrl}
                className="inline-block border-2 border-white/40 text-white font-bold px-8 py-3 rounded-lg hover:bg-white/10 transition-colors duration-150 whitespace-nowrap"
              >
                Team Management &rarr;
              </a>
              <span className="text-[#8FBDE8] text-xs">Managers &amp; coaches only</span>
            </div>
          </div>
        </div>
      </section>

      <SponsorStrip />

      {openSquad && (
        <SquadModal
          category={openSquad.category}
          teamInfo={openSquad.teamInfo}
          fallback={content.squads.find(s => s.category === openSquad.category)?.player_list || []}
          onClose={() => setOpenSquad(null)}
        />
      )}
    </div>
  );
}

function ProgrammeSection({ progTab, publicEvents, publicMatches }) {
  const TOURNAMENT_DAYS = useMemo(() => {
    const days = [];
    const d = new Date("2026-07-22T00:00:00Z");
    const end = new Date("2026-08-02T00:00:00Z");
    while (d < end) {
      days.push(new Date(d).toLocaleDateString("en-CA", { timeZone: "Europe/Amsterdam" }));
      d.setUTCDate(d.getUTCDate() + 1);
    }
    return days;
  }, []);

  const filteredEvents = useMemo(() => {
    if (progTab === "All") return publicEvents;
    return publicEvents.filter(ev => ev.teamCategory === progTab || ev.teamCategory == null);
  }, [publicEvents, progTab]);

  const filteredMatches = useMemo(() => {
    if (progTab === "All") return publicMatches;
    return publicMatches.filter(m => m.teamCategory === progTab);
  }, [publicMatches, progTab]);

  const hasAnyData = publicEvents.length > 0 || publicMatches.length > 0;

  const days = useMemo(() => {
    return TOURNAMENT_DAYS.map(dateKey => {
      const events = filteredEvents.filter(ev => rtmDateKey(ev.startsAt) === dateKey);
      const matches = filteredMatches.filter(m => rtmDateKey(m.kickoffAt) === dateKey);
      const items = [
        ...events.map(ev => ({ type: "event", ev, time: ev.startsAt })),
        ...matches.map(m  => ({ type: "match", m,  time: m.kickoffAt })),
      ].sort((a, b) => a.time.localeCompare(b.time));
      return { dateKey, items };
    }).filter(d => d.items.length > 0);
  }, [TOURNAMENT_DAYS, filteredEvents, filteredMatches]);

  if (!hasAnyData) {
    return (
      <div className="rounded-xl border border-[#1E3A6E]/15 bg-[#EEF4FB] px-6 py-10 text-center">
        <p className="text-[#1E3A6E] font-semibold mb-1">Programme coming soon</p>
        <p className="text-sm text-gray-500">Events and match fixtures will appear here once confirmed.</p>
      </div>
    );
  }

  if (days.length === 0) {
    return (
      <div className="rounded-xl border border-gray-100 bg-gray-50 px-6 py-10 text-center">
        <p className="text-sm text-gray-500">No programme items for {progTab} yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {days.map(({ dateKey, items }) => (
        <div key={dateKey}>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1E3A6E] mb-3">
            {rtmDayHeading(dateKey)}
          </h3>
          <ul className="space-y-2">
            {items.map((item, i) => {
              if (item.type === "event") {
                const ev = item.ev;
                const emoji = KIND_EMOJI[ev.kind] ?? "📌";
                const label = KIND_LABEL[ev.kind] ?? ev.kind;
                const teamBadge = ev.teamCategory
                  ? ev.teamCategory === "MO40"
                    ? <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#DE2910]/10 text-[#DE2910]">MO40</span>
                    : <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#1E3A6E]/10 text-[#1E3A6E]">MO50</span>
                  : null;
                return (
                  <li key={`e-${ev.id}`} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500">{rtmTime(ev.startsAt)} CEST</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">{label}</span>
                        {progTab === "All" && teamBadge}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">{ev.title}</p>
                      {ev.location && <p className="text-xs text-gray-500 mt-0.5">📍 {ev.location}</p>}
                      {ev.description && <p className="text-xs text-gray-600 mt-1">{ev.description}</p>}
                    </div>
                    <button
                      onClick={() => downloadEventIcs(ev)}
                      title="Add to calendar"
                      className="shrink-0 mt-0.5 text-gray-400 hover:text-[#1E3A6E] transition-colors p-1 rounded"
                    >
                      📅
                    </button>
                  </li>
                );
              } else {
                const m = item.m;
                const isResult = m.status === "final" && m.ourScore !== null;
                const isLive = m.status === "in_progress";
                const catColor = m.teamCategory === "MO40" ? "bg-[#DE2910]/10 text-[#DE2910]" : "bg-[#1E3A6E]/10 text-[#1E3A6E]";
                return (
                  <li key={`m-${m.id}`} className="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-start gap-3">
                    <span className="text-xl shrink-0 mt-0.5">🏒</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500">{rtmTime(m.kickoffAt)} CEST</span>
                        <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400">Match</span>
                        {progTab === "All" && m.teamCategory && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${catColor}`}>{m.teamCategory}</span>
                        )}
                        {isLive && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700 animate-pulse">LIVE</span>}
                      </div>
                      <p className="font-semibold text-gray-900 text-sm mt-0.5">
                        vs {m.opponent}
                        {isResult && <span className="ml-2 text-gray-500 font-normal">{m.ourScore}–{m.theirScore}</span>}
                      </p>
                      {m.venue && (
                        <a
                          href={`https://maps.google.com/?q=${encodeURIComponent(m.venue)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 mt-0.5 hover:text-[#006B3C] transition-colors block"
                        >📍 {m.venue}</a>
                      )}
                    </div>
                  </li>
                );
              }
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}
