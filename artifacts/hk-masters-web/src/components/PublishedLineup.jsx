import React, { useCallback, useEffect, useRef, useState } from "react";
import { API_BASE } from "../utils/api";
import { getPlayerToken, PLAYER_SESSION_EVENT } from "../lib/playerAuth";

const W = 55;
const H = 91.4;
const HKT = "Asia/Hong_Kong";

function shootingCircle(top) {
  const gy = top ? 0 : H;
  const s = top ? 1 : -1;
  const sw = top ? 0 : 1;
  const d = (r) => `M${25.67 - r} ${gy} A${r} ${r} 0 0 ${sw} 25.67 ${gy + s * r} L29.33 ${gy + s * r} A${r} ${r} 0 0 ${sw} ${29.33 + r} ${gy}`;
  return (
    <g key={top ? "t" : "b"}>
      <path d={d(14.63)} fill="rgba(20,70,120,0.35)" stroke="currentColor" strokeWidth="0.32" />
      <path d={d(19.63)} fill="none" stroke="currentColor" strokeWidth="0.28" strokeDasharray="1.1 1.1" />
      <circle cx="27.5" cy={top ? 6.475 : H - 6.475} r="0.32" fill="currentColor" />
      <line x1="25.67" x2="29.33" y1={gy} y2={gy} stroke="#fcd34d" strokeWidth="1.3" />
    </g>
  );
}

/** Read-only portrait field hockey pitch. Coordinates are normalized 0..100. */
export function ReadonlyHockeyPitch({ players }) {
  const onPitch = players.filter((p) => p.area === "pitch");
  return (
    <div className="mx-auto w-full max-w-[360px] rounded-2xl bg-[#173a5e] p-2">
      <div className="relative w-full select-none" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full text-white/90" aria-hidden="true">
          <rect width={W} height={H} fill="#21578d" />
          <rect x="0.16" y="0.16" width={W - 0.32} height={H - 0.32} fill="none" stroke="currentColor" strokeWidth="0.32" />
          <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" strokeWidth="0.32" />
          <line x1="0" x2={W} y1="22.9" y2="22.9" stroke="currentColor" strokeWidth="0.32" />
          <line x1="0" x2={W} y1={H - 22.9} y2={H - 22.9} stroke="currentColor" strokeWidth="0.32" />
          <circle cx={W / 2} cy={H / 2} r="0.3" fill="currentColor" />
          {shootingCircle(true)}
          {shootingCircle(false)}
        </svg>
        {onPitch.map((p) => (
          <div key={p.playerId} className="absolute -translate-x-1/2 -translate-y-[18px] flex flex-col items-center" style={{ left: `${p.x}%`, top: `${p.y}%` }}
            aria-label={`${p.name}${p.shirtNumber != null ? `, number ${p.shirtNumber}` : ""}${p.status === "maybe" ? ", Maybe, provisional" : ""}`} data-testid={`lineup-marker-${p.playerId}`}>
            <span className={`w-8 h-8 rounded-full bg-[#fbf7ef] text-[#1E3A6E] font-bold text-sm flex items-center justify-center shadow ${p.status === "maybe" ? "ring-2 ring-amber-400 ring-offset-2 border-2 border-dashed border-amber-700" : ""}`}>
              {p.shirtNumber ?? "–"}
            </span>
            <span className="mt-0.5 max-w-[5.2rem] rounded bg-[#0f2440]/80 px-1 text-[10px] leading-tight font-semibold text-white text-center break-words">{p.name}</span>
            {p.status === "maybe" && <span className="text-[9px] font-bold bg-amber-100 text-amber-900 rounded px-1">Maybe</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPublished(iso) {
  return new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: HKT });
}

/** Pure presentational body, exported for tests. state: {status, board, publishedAt, message} */
export function PublishedLineupBody({ state }) {
  if (state.status === "loading") return <div className="h-64 rounded-2xl bg-gray-100 animate-pulse" role="status" aria-label="Loading lineup" />;
  if (state.status === "error") return <p role="alert" className="text-sm text-rose-700 text-center py-6">{state.message}</p>;
  if (!state.board || !state.board.players?.length) {
    return (
      <div className="text-center py-8" data-testid="lineup-empty">
        <p className="font-semibold text-gray-900">No lineup published yet</p>
        <p className="text-sm text-gray-500 mt-1">Your coach hasn't published the lineup for this match. Check back closer to match day.</p>
      </div>
    );
  }
  const pitch = state.board.players.filter((p) => p.area === "pitch");
  const bench = state.board.players.filter((p) => p.area === "bench");
  return (
    <div data-testid="lineup-published">
      <div className="flex items-center justify-between text-xs text-gray-600 mb-2">
        <span className="font-bold text-[#1E3A6E]">{state.board.formation} · {pitch.length}/11 on pitch</span>
        {state.publishedAt && <span>Published {formatPublished(state.publishedAt)} HKT</span>}
      </div>
      {pitch.length < 11 && <p className="text-xs text-amber-700 mb-2">Incomplete eleven. Your coach may still add players.</p>}
      <ReadonlyHockeyPitch players={state.board.players} />
      <div className="mt-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">Substitutes · {bench.length}</p>
        {bench.length ? (
          <ul className="flex flex-wrap gap-1.5">
            {bench.map((p) => (
              <li key={p.playerId} className="text-sm rounded-full border border-gray-200 bg-white px-2.5 py-1">
                {p.shirtNumber != null ? `#${p.shirtNumber} ` : ""}{p.name}{p.status === "maybe" && <span className="ml-1 text-xs font-semibold text-amber-800">· Maybe</span>}
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-gray-500">None named.</p>}
      </div>
    </div>
  );
}

/** Keep only the published board fields; drafts or other data are never retained. */
export function sanitizePublication(data) {
  const pub = data && data.published;
  if (!pub) return { board: null, publishedAt: null };
  return {
    board: {
      formation: pub.formation,
      players: (pub.players || []).map((p) => ({
        playerId: p.playerId, area: p.area, x: Number(p.x), y: Number(p.y),
        name: p.name, shirtNumber: p.shirtNumber ?? null,
        status: p.status === "maybe" ? "maybe" : p.status === "yes" ? "yes" : null,
      })),
    },
    publishedAt: data.publishedAt ?? null,
  };
}

export default function PublishedLineup({ matchId, title, onClose }) {
  const [state, setState] = useState({ status: "loading", board: null, publishedAt: null, message: "" });
  const seq = useRef(0);

  const load = useCallback(async () => {
    const token = getPlayerToken();
    const mine = ++seq.current;
    if (!token) { setState({ status: "error", board: null, publishedAt: null, message: "Sign in again to view the lineup." }); return; }
    try {
      const res = await fetch(`${API_BASE}/api/player-auth/matches/${matchId}/lineup`, {
        cache: "no-store", headers: { Authorization: `Bearer ${token}` },
      });
      if (mine !== seq.current || token !== getPlayerToken()) return;
      if (!res.ok) {
        // Fail closed: drop anything previously shown.
        const message = res.status === 401 ? "Your session ended. Sign in again to view the lineup."
          : res.status === 403 || res.status === 404 ? "This lineup isn't available to your account."
          : "Could not load the lineup. Try again shortly.";
        setState({ status: "error", board: null, publishedAt: null, message });
        return;
      }
      const data = await res.json();
      if (mine !== seq.current || token !== getPlayerToken()) return;
      setState({ status: "ready", ...sanitizePublication(data), message: "" });
    } catch {
      if (mine !== seq.current) return;
      setState({ status: "error", board: null, publishedAt: null, message: "Could not load the lineup. Check your connection." });
    }
  }, [matchId]);

  useEffect(() => {
    void load();
    const onFocus = () => { if (!document.hidden) void load(); };
    const onSession = (event) => {
      if (event && event.type === "storage" && event.key !== null && event.key !== "hkm_player_session") return;
      ++seq.current;
      setState({ status: "loading", board: null, publishedAt: null, message: "" });
      void load();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("storage", onSession);
    window.addEventListener(PLAYER_SESSION_EVENT, onSession);
    const timer = setInterval(onFocus, 60_000);
    return () => {
      ++seq.current;
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("storage", onSession);
      window.removeEventListener(PLAYER_SESSION_EVENT, onSession);
    };
  }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50" role="dialog" aria-modal="true" aria-label={`Lineup ${title}`} onClick={onClose}>
      <div className="w-full sm:max-w-md max-h-[92dvh] overflow-y-auto bg-white rounded-t-3xl sm:rounded-3xl p-4 pb-[max(1rem,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#DE2910]">Match lineup</p>
            <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          </div>
          <button type="button" onClick={onClose} className="min-h-10 px-3 rounded-full bg-gray-100 text-sm font-semibold text-gray-700" data-testid="button-close-lineup">Close</button>
        </div>
        <PublishedLineupBody state={state} />
      </div>
    </div>
  );
}
