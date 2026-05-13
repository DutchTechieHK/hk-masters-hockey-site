import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE } from "../utils/api";

export default function SquadModal({ squad, teamInfo, onClose }) {
  const [liveShirtNumbers, setLiveShirtNumbers] = useState(new Map());

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleEsc);
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
      document.body.style.paddingRight = "";
    };
  }, [onClose]);

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

  const players = squad.player_list || [];
  const squad_players = players.filter(p => !p.role || p.role.toLowerCase() !== "reserve");
  const reserves = players.filter(p => p.role && p.role.toLowerCase() === "reserve");

  return createPortal(
    <>
      {/* Backdrop — portalled to body so CSS transforms on <main> don't clip fixed positioning */}
      <div className="fixed inset-0 z-[299] bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal panel */}
      <div className="fixed inset-0 z-[300] flex items-end sm:items-start sm:pt-[130px] justify-center pointer-events-none">
      <div className="pointer-events-auto relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-3xl max-h-[90vh] sm:max-h-[calc(100vh-150px)] flex flex-col shadow-2xl overflow-hidden">

        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-white/40 rounded-full mx-auto mt-3 mb-0 sm:hidden absolute top-0 left-1/2 -translate-x-1/2 z-10" />

        {/* Header */}
        <div className="bg-[#1E3A6E] px-6 pt-6 pb-5 shrink-0">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-2 uppercase tracking-wide">
                {squad.category}
              </span>
              <h2 className="text-xl font-extrabold text-white leading-tight">{squad.name}</h2>
              {players.length > 0 && (
                <p className="text-[#9BB5D8] text-sm mt-1">{squad_players.length} players{reserves.length > 0 ? ` · ${reserves.length} reserves` : ""}</p>
              )}
            </div>
            <button
              onClick={onClose}
              className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors mt-1"
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Player list */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <div className="w-14 h-14 rounded-full bg-[#1E3A6E]/8 flex items-center justify-center mb-3">
                <svg className="w-7 h-7 text-[#1E3A6E]/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm text-gray-400 font-medium">Squad list coming soon</p>
            </div>
          ) : (
            <div className="px-5 py-4">
              {squad_players.length > 0 && (
                <div className={reserves.length > 0 ? "mb-6" : ""}>
                  {reserves.length > 0 && (
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Squad</p>
                  )}
                  <div className="space-y-1">
                    {squad_players.map((player, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[#1E3A6E]/4 transition-colors group"
                      >
                        <span className="w-9 h-9 bg-[#1E3A6E] text-white rounded-xl flex items-center justify-center text-xs font-bold shrink-0 shadow-sm group-hover:bg-[#16305D] transition-colors">
                          {player.shirt_number ?? liveShirtNumbers.get(player.name) ?? "—"}
                        </span>
                        <span className="flex-1 font-semibold text-gray-900 text-sm">{player.name}</span>
                        {player.role && player.role.toLowerCase() !== "reserve" && (
                          <span className="text-xs bg-[#1E3A6E]/10 text-[#1E3A6E] px-2.5 py-1 rounded-full font-semibold shrink-0">
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
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 px-1">Reserves</p>
                  <div className="space-y-1">
                    {reserves.map((player, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-amber-50 transition-colors"
                      >
                        <span className="w-9 h-9 bg-gray-100 text-gray-500 rounded-xl flex items-center justify-center text-xs font-bold shrink-0">
                          {player.shirt_number ?? liveShirtNumbers.get(player.name) ?? "—"}
                        </span>
                        <span className="flex-1 font-semibold text-gray-600 text-sm">{player.name}</span>
                        <span className="text-xs bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full font-semibold shrink-0">
                          Reserve
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer metadata */}
        {teamInfo && (teamInfo.coach || teamInfo.captain || teamInfo.manager) && (
          <div className="px-6 py-4 border-t border-gray-100 bg-[#F7F4EF] shrink-0">
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {teamInfo.coach && (
                <div className="text-sm">
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide block">Coach</span>
                  <span className="font-semibold text-gray-800">{teamInfo.coach}</span>
                </div>
              )}
              {teamInfo.captain && teamInfo.captain !== "TBC" && (
                <div className="text-sm">
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide block">Captain</span>
                  <span className="font-semibold text-gray-800">{teamInfo.captain}</span>
                </div>
              )}
              {teamInfo.manager && teamInfo.manager !== "TBC" && (
                <div className="text-sm">
                  <span className="text-gray-400 text-xs font-semibold uppercase tracking-wide block">Manager</span>
                  <span className="font-semibold text-gray-800">{teamInfo.manager}</span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      </div>
    </>,
    document.body
  );
}
