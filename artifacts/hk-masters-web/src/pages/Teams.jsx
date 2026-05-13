import { useState, useEffect } from "react";
import { Link } from "wouter";
import content from "../content/teams.json";
import { cloudinaryResize } from "../utils/cloudinary";
import rotterdamContent from "../content/rotterdam.json";
import SquadModal from "../components/SquadModal";
import RichText from "../components/RichText";
import { API_BASE } from "../utils/api";

const ROTTERDAM_MODE_END = new Date("2026-09-15T00:00:00");

function categoryMatches(rowCategory, shortName) {
  if (!rowCategory) return false;
  const r = rowCategory.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const s = shortName.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (r === s) return true;
  const rNum = (rowCategory.match(/\d+/) || [])[0];
  const sNum = (shortName.match(/\d+/) || [])[0];
  return Boolean(rNum && sNum && rNum === sNum);
}

function buildLiveSquad(category, name, squadRows, staticPlayers = []) {
  const matching = squadRows
    .filter((p) => categoryMatches(p.teamCategory, category))
    .sort((a, b) => {
      const an = a.shirtNumber ?? 999;
      const bn = b.shirtNumber ?? 999;
      if (an !== bn) return an - bn;
      return a.name.localeCompare(b.name);
    })
    .map((p) => {
      const staticMatch = staticPlayers.find((s) => s.name === p.name);
      return {
        name: p.name,
        shirt_number: p.shirtNumber ?? staticMatch?.shirt_number ?? null,
        role: p.position || staticMatch?.role || null,
      };
    });
  return { name, category, player_list: matching };
}

export default function Teams() {
  const [openSquad, setOpenSquad] = useState(null);
  const [squadRows, setSquadRows] = useState(null);
  const rotterdamMode = new Date() < ROTTERDAM_MODE_END;

  useEffect(() => {
    if (!rotterdamMode) return;
    fetch(`${API_BASE}/api/public/squad`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => setSquadRows(Array.isArray(rows) ? rows : []))
      .catch(() => setSquadRows([]));
  }, [rotterdamMode]);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {rotterdamMode && (
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              Rotterdam 2026 Masters World Cup
            </span>
          )}
          <h1 className="text-4xl font-extrabold mb-3">
            {rotterdamMode ? "Our Rotterdam 2026 Squads" : "Our Squads"}
          </h1>
          <p className="text-[#BFD9F5] text-lg max-w-xl">
            {rotterdamMode
              ? "Two HK squads competing at the World Masters Hockey Cup — Rotterdam, Netherlands."
              : content.page_subtitle}
          </p>
        </div>
      </div>

      {/* Squads */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-16">
          {content.squads.map((squad, index) => {
            const fallbackSquad = rotterdamMode
              ? rotterdamContent.squads.find((s) => s.category === squad.short_name)
              : null;
            const liveSquad =
              rotterdamMode && squadRows
                ? buildLiveSquad(squad.short_name, squad.name, squadRows, fallbackSquad?.player_list)
                : null;
            const rotterdamSquad =
              liveSquad && liveSquad.player_list.length > 0 ? liveSquad : fallbackSquad;

            return (
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
                  <h2 className="text-3xl font-extrabold text-[#1E3A6E] mb-3">{squad.name}</h2>
                  <RichText content={squad.description} className="text-[#5A4F45] leading-relaxed mb-5" />

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

                  {rotterdamMode && rotterdamSquad && (
                    <button
                      onClick={() => setOpenSquad(rotterdamSquad)}
                      className="btn-shimmer inline-flex items-center gap-2 bg-[#1E3A6E] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#16305D] transition-colors duration-150 text-sm"
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
      <section className="bg-[#1E3A6E] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {rotterdamMode ? (
            <>
              <h2 className="reveal text-3xl font-extrabold text-white mb-4">Rotterdam 2026</h2>
              <p className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed">
                Tournament schedule, key dates, accommodation and more — everything you need for Rotterdam 2026.
              </p>
              <Link
                href="/rotterdam-2026"
                className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Full tournament details →
              </Link>
            </>
          ) : (
            <>
              <h2 className="reveal text-3xl font-extrabold text-white mb-4">{content.join_heading}</h2>
              <RichText content={content.join_text} className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed" />
              <Link
                href="/contact"
                className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Contact Us to Join
              </Link>
            </>
          )}
        </div>
      </section>

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
