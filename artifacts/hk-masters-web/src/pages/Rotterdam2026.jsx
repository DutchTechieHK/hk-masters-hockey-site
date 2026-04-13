import { useState, useEffect } from "react";
import { Link } from "wouter";
import content from "../content/rotterdam.json";
import teamsContent from "../content/teams.json";

export default function Rotterdam2026() {
  const teamManagementUrl = "/";
  const [expandedSquad, setExpandedSquad] = useState(null);

  useEffect(() => {
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            {content.header_badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">Rotterdam 2026</h1>
          <p className="text-green-200 text-lg max-w-2xl">
            World Masters Hockey Cup &mdash; Rotterdam, Netherlands
          </p>
        </div>
      </div>

      {/* Tournament Overview */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">About the Tournament</h2>
            <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-line">{content.overview_p1}</p>
            <p className="text-gray-600 leading-relaxed mb-4 whitespace-pre-line">{content.overview_p2}</p>
            <p className="text-gray-600 leading-relaxed whitespace-pre-line">{content.overview_p3}</p>
          </div>

          {/* Quick Facts */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="font-bold text-gray-900 mb-4">Quick Facts</h3>
            <dl className="space-y-3">
              {content.quick_facts.map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-sm text-gray-500">{label}</dt>
                  <dd className="text-sm font-medium text-gray-900 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* HK Squads */}
      <section id="squads" className="bg-gray-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-8">Hong Kong Squads</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {content.squads.map((squad) => {
              const teamData = teamsContent.squads.find(t => t.short_name === squad.category);
              const players = squad.player_list || [];
              const squadPlayers = players.filter(p => !p.role || p.role.toLowerCase() !== "reserve");
              const reserves = players.filter(p => p.role && p.role.toLowerCase() === "reserve");
              const isExpanded = expandedSquad === squad.category;
              return (
              <div key={squad.category} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
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
                  className="w-full flex items-center justify-between text-xs font-semibold text-[#006B3C] border-t border-gray-100 pt-3 hover:text-green-800 transition-colors"
                >
                  <span>{isExpanded ? "Hide squad list" : "View squad list"}</span>
                  <svg className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-50">
                    {players.length === 0 ? (
                      <p className="text-xs text-gray-400 text-center py-2">Squad list coming soon</p>
                    ) : (
                      <>
                        {squadPlayers.length > 0 && (
                          <div className="mb-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Squad</p>
                            {squadPlayers.map((player, i) => (
                              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                                <span className="w-6 h-6 bg-[#006B3C]/10 rounded-full flex items-center justify-center text-xs font-bold text-[#006B3C] shrink-0">
                                  {player.shirt_number || "—"}
                                </span>
                                <span className="flex-1 text-sm font-medium text-gray-800">{player.name}</span>
                                {player.role && (
                                  <span className="text-xs bg-[#006B3C]/10 text-[#006B3C] px-2 py-0.5 rounded-full font-medium shrink-0">
                                    {player.role}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {reserves.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Reserves</p>
                            {reserves.map((player, i) => (
                              <div key={i} className="flex items-center gap-2 py-1.5 border-b border-gray-50 last:border-0">
                                <span className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                                  {player.shirt_number || "—"}
                                </span>
                                <span className="text-sm font-medium text-gray-500 flex-1">{player.name}</span>
                                <span className="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">Reserve</span>
                              </div>
                            ))}
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
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Key Dates</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {content.key_dates.map((item, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                  <td className="py-3 px-4 font-medium text-[#006B3C] whitespace-nowrap rounded-l-lg w-48">
                    {item.date}
                  </td>
                  <td className="py-3 px-4 text-gray-700 rounded-r-lg">{item.event}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Travel & Logistics */}
      <section className="bg-[#006B3C]/5 border-y border-[#006B3C]/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Travel &amp; Logistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {content.travel.map((item) => (
              <div key={item.title} className="bg-white rounded-xl p-6 shadow-sm border border-[#006B3C]/10">
                <div className="text-3xl mb-3">{item.icon}</div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team Management App CTA */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-[#006B3C] rounded-2xl p-8 text-white text-center">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Team Members Only
          </span>
          <h2 className="text-2xl font-bold mb-3">Team Management Portal</h2>
          <p className="text-green-100 max-w-lg mx-auto mb-6 leading-relaxed">
            If you are a registered player travelling to Rotterdam, access the team management
            app for squad lists, schedules, fundraising updates, kit assignments, and logistics details.
          </p>
          <a
            href={teamManagementUrl}
            className="inline-block bg-white text-[#006B3C] font-bold px-8 py-3 rounded-lg hover:bg-green-50 transition-colors duration-150"
          >
            Go to Team App &rarr;
          </a>
          <p className="text-green-300 text-xs mt-3">
            You will need your club login credentials to access this portal.
          </p>
        </div>
      </section>
    </div>
  );
}
