import { useState, useEffect } from "react";
import { Link } from "wouter";
import { API_BASE } from "../utils/api";
import content from "../content/teams.json";
import { usePageTexts } from "../utils/pageTexts";
import { cloudinaryResize } from "../utils/cloudinary";
import rotterdamContent from "../content/rotterdam.json";
import SquadModal from "../components/SquadModal";
import RichText from "../components/RichText";

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

const ROTTERDAM_MODE_END = new Date("2026-08-02T00:00:00");
// Development preview: append ?preview=standard to see the post-tournament teams page.
const isStandardPreview = import.meta.env.DEV && (
  new URLSearchParams(window.location.search).get("preview") === "standard" ||
  window.location.pathname === "/preview/standard/teams"
);

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

export default function Teams() {
  const [openSquad, setOpenSquad] = useState(null);
  const liveTeams = useTeams();
  const siteContent = useSiteContent();
  const t = usePageTexts("teams", content);
  const rotterdamMode = !isStandardPreview && new Date() < ROTTERDAM_MODE_END;

  // liveTeams is sorted by DB id; static squads are in the same order (MO40 first, MO50 second)
  // Override squad photos from the API site-content (admin-managed) if available
  const squads = content.squads.map((s, i) => {
    const merged = { ...mergeSquad(s, liveTeams ? liveTeams[i] : null) };
    if (siteContent) {
      const apiPhoto = s.short_name === "MO40" ? siteContent.mo40Photo : siteContent.mo50Photo;
      if (apiPhoto) merged.photo = apiPhoto;
    }
    return merged;
  });

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
              : t.page_subtitle}
          </p>
        </div>
      </div>

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
              <h2 className="reveal text-3xl font-extrabold text-white mb-4">{t.join_heading}</h2>
              <RichText content={t.join_text} className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed" />
              <a
                href="https://caramel-havarti-6da.notion.site/79a429c0d2cc4ccb96417607a58775f9?pvs=105"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Sign Up to Join →
              </a>
            </>
          )}
        </div>
      </section>

      {/* Squads */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="space-y-16">
          {squads.map((squad, index) => {
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

                  <button
                    onClick={() => setOpenSquad({ category: squad.short_name, teamInfo: squad })}
                    className="btn-shimmer inline-flex items-center gap-2 bg-[#1E3A6E] text-white font-semibold px-6 py-2.5 rounded-lg hover:bg-[#16305D] transition-colors duration-150 text-sm"
                  >
                    View Squad List →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {openSquad && (
        <SquadModal
          category={openSquad.category}
          teamInfo={openSquad.teamInfo}
          fallback={rotterdamContent.squads.find(s => s.category === openSquad.category)?.player_list || []}
          onClose={() => setOpenSquad(null)}
        />
      )}
    </div>
  );
}
