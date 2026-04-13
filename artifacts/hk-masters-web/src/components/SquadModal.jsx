import { useEffect } from "react";

export default function SquadModal({ squad, teamInfo, onClose }) {
  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const players = squad.player_list || [];
  const squad_players = players.filter(p => !p.role || p.role.toLowerCase() !== "reserve");
  const reserves = players.filter(p => p.role && p.role.toLowerCase() === "reserve");

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-3xl max-h-[88vh] flex flex-col shadow-2xl">
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <span className="bg-[#DE2910] text-white text-sm font-bold px-3 py-1 rounded-full">
              {squad.category}
            </span>
            <h2 className="font-bold text-gray-900 text-lg">{squad.name}</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 transition-colors"
            aria-label="Close"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4">
          {players.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-10">
              Squad list coming soon — add players via CMS → Rotterdam 2026 → Squads
            </p>
          ) : (
            <>
              {squad_players.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Squad ({squad_players.length})
                  </p>
                  <div className="space-y-1">
                    {squad_players.map((player, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="w-8 h-8 bg-[#006B3C]/10 rounded-full flex items-center justify-center text-xs font-bold text-[#006B3C] shrink-0">
                          {player.shirt_number || "—"}
                        </span>
                        <span className="flex-1 font-medium text-gray-900">{player.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {reserves.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                    Reserves ({reserves.length})
                  </p>
                  <div className="space-y-1">
                    {reserves.map((player, i) => (
                      <div key={i} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                        <span className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-xs font-bold text-gray-400 shrink-0">
                          {player.shirt_number || "—"}
                        </span>
                        <span className="flex-1 font-medium text-gray-600">{player.name}</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">
                          Reserve
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {teamInfo && (
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl sm:rounded-b-2xl rounded-b-none">
            <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
              {teamInfo.coach && (
                <div>
                  <span className="font-semibold text-gray-700">Coach</span>
                  <p>{teamInfo.coach}</p>
                </div>
              )}
              {teamInfo.captain && teamInfo.captain !== "TBC" && (
                <div>
                  <span className="font-semibold text-gray-700">Captain</span>
                  <p>{teamInfo.captain}</p>
                </div>
              )}
              {teamInfo.manager && teamInfo.manager !== "TBC" && (
                <div>
                  <span className="font-semibold text-gray-700">Manager</span>
                  <p>{teamInfo.manager}</p>
                </div>
              )}
              {teamInfo.player_count && (
                <div>
                  <span className="font-semibold text-gray-700">Players</span>
                  <p>{teamInfo.player_count}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
