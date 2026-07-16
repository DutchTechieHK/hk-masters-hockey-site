import { useState, useEffect, useMemo } from "react";
import { Link } from "wouter";
import content from "../content/rotterdam.json";
import teamsContent from "../content/teams.json";
import AutoLink from "../components/AutoLink";
import RichText from "../components/RichText";
import SponsorStrip from "../components/SponsorStrip";
import NextMatchWidget from "../components/NextMatchWidget";
import { API_BASE } from "../utils/api";
import { themeFor } from "../utils/teamTheme";

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

export default function Rotterdam2026() {
  const teamManagementUrl = "https://app.hkmastershockey.com";
  const [expandedSquad, setExpandedSquad] = useState(null);
  const [liveSquads, setLiveSquads] = useState(new Map());
  const [progTab, setProgTab] = useState("All");
  const [publicEvents, setPublicEvents] = useState([]);
  const [publicMatches, setPublicMatches] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/public/squad`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        if (!Array.isArray(rows)) return;
        const map = new Map();
        const staffRoles = /coach|manager|physio|medic|official/i;
        rows.forEach(p => {
          if (!p.teamCategory) return;
          // Exclude non-playing staff
          if (p.position && staffRoles.test(p.position)) return;
          if (!map.has(p.teamCategory)) map.set(p.teamCategory, []);
          map.get(p.teamCategory).push(p);
        });
        // Sort each category by shirt number (nulls last), then name
        map.forEach((players, cat) => {
          players.sort((a, b) => {
            const an = a.shirtNumber ?? 999;
            const bn = b.shirtNumber ?? 999;
            if (an !== bn) return an - bn;
            return a.name.localeCompare(b.name);
          });
          map.set(cat, players);
        });
        setLiveSquads(map);
      })
      .catch(() => {});
  }, []);

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
            {content.header_badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Rotterdam 2026</h1>
          <p className="text-[#BFD9F5] text-lg max-w-2xl">
            World Masters Hockey Cup &mdash; Rotterdam, Netherlands
          </p>
        </div>
      </div>

      {/* Next Match Widget */}
      <NextMatchWidget />

      {/* Tournament Overview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-[#1E3A6E] mb-4">About the Tournament</h2>
            <RichText content={content.overview_p1} className="text-gray-600 leading-relaxed mb-4" />
            <RichText content={content.overview_p2} className="text-gray-600 leading-relaxed mb-4" />
            <RichText content={content.overview_p3} className="text-gray-600 leading-relaxed" />
          </div>

          <div className="bg-white rounded-2xl p-6 border border-[#D9C9A8] shadow-sm">
            <h3 className="font-bold text-[#1E3A6E] mb-4">Quick Facts</h3>
            <dl className="space-y-3">
              {content.quick_facts.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right"><AutoLink text={value} /></dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* HK Squads */}
      <section id="squads" className="bg-[#EDE0C4] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-[#1E3A6E] mb-8">Hong Kong Squads</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.squads.map((squad) => {
              const teamData = teamsContent.squads.find(t => t.short_name === squad.category);
              // Use live API players if available, otherwise fall back to static JSON
              const livePlayers = liveSquads.get(squad.category);
              const players = livePlayers
                ? livePlayers.map(p => ({
                    name: p.name,
                    shirt_number: p.shirtNumber ?? null,
                    role: p.position ?? "",
                  }))
                : (squad.player_list || []);
              const squadPlayers = players.filter(p => !p.role || p.role.toLowerCase() !== "reserve");
              const reserves = players.filter(p => p.role && p.role.toLowerCase() === "reserve");
              const isExpanded = expandedSquad === squad.category;
              return (
                <div key={squad.category} className="tilt-card bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className={`${themeFor(squad.category).chip} text-white text-xs font-bold px-2 py-0.5 rounded`}>
                      {squad.category}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-3">{squad.name}</h3>
                  <dl className="space-y-1.5 mb-4">
                    {teamData?.player_count && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-gray-500">Players</dt>
                        <dd className="font-medium text-gray-800">{teamData.player_count}</dd>
                      </div>
                    )}
                    {squad.pool_group && (
                      <div className="flex justify-between text-sm">
                        <dt className="text-gray-500">Pool</dt>
                        <dd className="font-medium text-gray-800">{squad.pool_group}</dd>
                      </div>
                    )}
                    {squad.first_match && (
                      <div className="flex flex-col gap-0.5 text-sm mt-2">
                        <dt className="text-gray-500">First match</dt>
                        <dd className="font-medium text-gray-800">{squad.first_match}</dd>
                      </div>
                    )}
                    {!squad.pool_group && !squad.first_match && (
                      <p className="text-xs text-gray-400 mt-1">Pool & match schedule TBC</p>
                    )}
                  </dl>

                  <button
                    onClick={() => setExpandedSquad(isExpanded ? null : squad.category)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-[#1E3A6E] border-t border-gray-100 pt-3 hover:text-[#16305D] transition-colors"
                  >
                    <span>{isExpanded ? "Hide squad list" : "View squad list"}</span>
                    <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-gray-100">
                      {players.length === 0 ? (
                        <p className="text-xs text-gray-400 text-center py-3">Squad list coming soon</p>
                      ) : (
                        <>
                          {squadPlayers.length > 0 && (
                            <div className={reserves.length > 0 ? "mb-4" : ""}>
                              {reserves.length > 0 && (
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Squad</p>
                              )}
                              <div className="space-y-0.5">
                                {squadPlayers.map((player, i) => (
                                  <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-[#1E3A6E]/4 transition-colors group">
                                    <span className="w-8 h-8 bg-[#1E3A6E] text-white rounded-lg flex items-center justify-center text-xs font-bold shrink-0 shadow-sm">
                                      {player.shirt_number ?? "—"}
                                    </span>
                                    <span className="flex-1 text-sm font-semibold text-gray-900">{player.name}</span>
                                    {player.role && player.role.toLowerCase() !== "reserve" && (
                                      <span className="text-xs bg-[#1E3A6E]/10 text-[#1E3A6E] px-2 py-0.5 rounded-full font-semibold shrink-0">
                                        {player.role}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          {reserves.length > 0 && (
                            <div>
                              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Reserves</p>
                              <div className="space-y-0.5">
                                {reserves.map((player, i) => (
                                  <div key={i} className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-amber-50 transition-colors">
                                    <span className="w-8 h-8 bg-gray-100 text-gray-500 rounded-lg flex items-center justify-center text-xs font-bold shrink-0">
                                      {player.shirt_number ?? "—"}
                                    </span>
                                    <span className="text-sm font-semibold text-gray-600 flex-1">{player.name}</span>
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold shrink-0">Reserve</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

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

      {/* Key Dates */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <h2 className="text-2xl font-bold text-[#1E3A6E] mb-8">Key Dates</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {content.key_dates.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-[#EDE0C4]" : "bg-white"}>
                  <td className="py-3 px-4 font-medium text-[#1E3A6E] whitespace-nowrap rounded-l-lg w-48">
                    {item.date}
                  </td>
                  <td className="py-3 px-4 text-gray-700 rounded-r-lg">{item.event}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Fundraising CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="reveal scale-in bg-gradient-to-br from-[#1E3A6E] to-[#16305D] rounded-2xl p-8 sm:p-10 flex flex-col sm:flex-row items-center gap-6 text-white">
          <div className="flex-1">
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
              Support the Team
            </span>
            <h2 className="text-2xl font-bold mb-2">Help Us Get to Rotterdam</h2>
            <p className="text-[#D6E8F7] leading-relaxed max-w-lg">
              We're raising funds to send two HK squads to the World Masters Hockey Cup. Every pledge — big or small — makes a difference. See our progress and add your support.
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
                      {m.venue && <p className="text-xs text-gray-500 mt-0.5">📍 {m.venue}</p>}
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
