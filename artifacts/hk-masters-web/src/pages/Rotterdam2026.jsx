import { useState, useEffect } from "react";
import { Link } from "wouter";
import content from "../content/rotterdam.json";
import teamsContent from "../content/teams.json";
import AutoLink from "../components/AutoLink";
import RichText from "../components/RichText";
import SponsorStrip from "../components/SponsorStrip";
import NextMatchWidget from "../components/NextMatchWidget";
import { API_BASE } from "../utils/api";

export default function Rotterdam2026() {
  const teamManagementUrl = "https://app.hkmastershockey.com";
  const [expandedSquad, setExpandedSquad] = useState(null);
  const [liveShirtNumbers, setLiveShirtNumbers] = useState(new Map());

  useEffect(() => {
    fetch(`${API_BASE}/api/public/squad`)
      .then(r => r.ok ? r.json() : [])
      .then(rows => {
        const map = new Map();
        if (Array.isArray(rows)) rows.forEach(p => { if (p.name && p.shirtNumber != null) map.set(p.name, p.shirtNumber); });
        setLiveShirtNumbers(map);
      })
      .catch(() => {});
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
              const players = squad.player_list || [];
              const squadPlayers = players.filter(p => !p.role || p.role.toLowerCase() !== "reserve");
              const reserves = players.filter(p => p.role && p.role.toLowerCase() === "reserve");
              const isExpanded = expandedSquad === squad.category;
              return (
                <div key={squad.category} className="tilt-card bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="bg-[#DE2910] text-white text-xs font-bold px-2 py-0.5 rounded">
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
                                      {player.shirt_number ?? liveShirtNumbers.get(player.name) ?? "—"}
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
                                      {player.shirt_number ?? liveShirtNumbers.get(player.name) ?? "—"}
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
