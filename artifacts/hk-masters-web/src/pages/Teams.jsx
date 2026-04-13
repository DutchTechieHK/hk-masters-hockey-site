import { useState } from "react";
import { Link } from "wouter";
import content from "../content/teams.json";
import rotterdamContent from "../content/rotterdam.json";
import SquadModal from "../components/SquadModal";

const ROTTERDAM_MODE_END = new Date("2026-09-15T00:00:00");

export default function Teams() {
  const [openSquad, setOpenSquad] = useState(null);
  const rotterdamMode = new Date() < ROTTERDAM_MODE_END;

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#006B3C] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {rotterdamMode && (
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              Rotterdam 2026 · World Masters Cup
            </span>
          )}
          <h1 className="text-4xl font-extrabold mb-3">
            {rotterdamMode ? "Our Rotterdam 2026 Squads" : "Our Squads"}
          </h1>
          <p className="text-green-200 text-lg max-w-xl">
            {rotterdamMode
              ? "Three HK squads competing at the World Masters Hockey Cup — Rotterdam, Netherlands."
              : content.page_subtitle}
          </p>
        </div>
      </div>

      {/* Squads */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-16">
          {content.squads.map((squad, index) => {
            const rotterdamSquad = rotterdamMode
              ? rotterdamContent.squads.find(s => s.category === squad.short_name)
              : null;

            return (
              <div
                key={squad.id}
                className={`flex flex-col ${index % 2 === 1 ? "lg:flex-row-reverse" : "lg:flex-row"} gap-10 items-center`}
              >
                {/* Squad Photo */}
                <div className="w-full lg:w-1/2 shrink-0">
                  {squad.photo ? (
                    <img
                      src={squad.photo}
                      alt={`${squad.name} squad photo`}
                      className="rounded-2xl w-full h-72 object-cover shadow-md"
                    />
                  ) : (
                    <div className="rounded-2xl w-full h-72 bg-[#006B3C]/10 border-2 border-dashed border-[#006B3C]/30 flex flex-col items-center justify-center text-[#006B3C]">
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
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-3">{squad.name}</h2>
                  <p className="text-gray-600 leading-relaxed mb-5">{squad.description}</p>

                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-[#006B3C]">{squad.player_count}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Players</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-gray-800">{squad.manager || "TBC"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Manager</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-gray-800">{squad.coach || "TBC"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Coach</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3 text-center">
                      <p className="text-sm font-semibold text-gray-800">{squad.captain || "TBC"}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Captain</p>
                    </div>
                  </div>

                  {rotterdamMode && rotterdamSquad && (
                    <button
                      onClick={() => setOpenSquad(rotterdamSquad)}
                      className="inline-flex items-center gap-2 bg-[#006B3C] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-green-800 transition-colors duration-150 text-sm"
                    >
                      View Squad List →
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#006B3C] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {rotterdamMode ? (
            <>
              <h2 className="text-3xl font-extrabold text-white mb-4">Rotterdam 2026</h2>
              <p className="text-green-100 max-w-xl mx-auto mb-6 leading-relaxed">
                Tournament schedule, key dates, accommodation and more — everything you need for Rotterdam 2026.
              </p>
              <Link
                href="/rotterdam-2026"
                className="inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Full tournament details →
              </Link>
            </>
          ) : (
            <>
              <h2 className="text-3xl font-extrabold text-white mb-4">{content.join_heading}</h2>
              <p className="text-green-100 max-w-xl mx-auto mb-6 leading-relaxed">
                {content.join_text}
              </p>
              <Link
                href="/contact"
                className="inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Contact Us to Join
              </Link>
            </>
          )}
        </div>
      </section>

      {/* Squad Modal */}
      {openSquad && (
        <SquadModal
          squad={openSquad}
          teamInfo={content.squads.find(t => t.short_name === openSquad.category)}
          onClose={() => setOpenSquad(null)}
        />
      )}
    </div>
  );
}
