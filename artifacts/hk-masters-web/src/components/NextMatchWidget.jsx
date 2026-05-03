import { useEffect, useState } from "react";
import { Link } from "wouter";
import { API_BASE } from "../utils/api";

const FALLBACK_TEAMS = [
  { id: -1, name: "Men 40+", category: "Men 40+" },
  { id: -2, name: "Men 50+", category: "Men 50+" },
];

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function getCountdown(iso) {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return null;
  const days = Math.floor(diff / 86_400_000);
  const hours = Math.floor((diff % 86_400_000) / 3_600_000);
  if (days > 1) return `In ${days} days`;
  if (days === 1) return "Tomorrow";
  if (hours >= 1) return `In ${hours}h`;
  const mins = Math.floor((diff % 3_600_000) / 60_000);
  return mins > 0 ? `In ${mins}m` : "Starting soon";
}

export default function NextMatchWidget() {
  const [matches, setMatches] = useState([]);
  const [teams, setTeams] = useState(FALLBACK_TEAMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`${API_BASE}/api/matches`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch(`${API_BASE}/api/public/teams`).then((r) => (r.ok ? r.json() : [])).catch(() => []),
    ]).then(([matchData, teamData]) => {
      if (cancelled) return;
      setMatches(Array.isArray(matchData) ? matchData : []);
      const tournamentTeams = (Array.isArray(teamData) ? teamData : [])
        .filter((t) => /(40\+|50\+|MO40|MO50)/i.test(t.category || t.name || ""));
      setTeams(tournamentTeams.length > 0 ? tournamentTeams : FALLBACK_TEAMS);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const now = Date.now();

  function nextMatchForTeam(team) {
    let best = null;
    for (const m of matches) {
      if (m.status === "cancelled") continue;
      if (m.teamId !== team.id) continue;
      const t = new Date(m.kickoffAt).getTime();
      if (t < now - 3 * 60 * 60 * 1000) continue;
      if (!best || new Date(m.kickoffAt).getTime() < new Date(best.kickoffAt).getTime()) {
        best = m;
      }
    }
    return best;
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-8 relative z-10">
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Next Match</h2>
          <Link
            href="/schedule"
            className="text-sm font-semibold text-[#006B3C] hover:text-green-800 transition-colors"
          >
            Full schedule &rarr;
          </Link>
        </div>
        <div className={`grid grid-cols-1 ${teams.length > 1 ? "md:grid-cols-2" : ""} gap-4`}>
          {teams.map((team) => {
            const m = nextMatchForTeam(team);
            return (
              <div key={team.id} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="bg-[#DE2910] text-white text-xs font-bold px-2 py-0.5 rounded">
                    {team.category || team.name}
                  </span>
                  {m && getCountdown(m.kickoffAt) && (
                    <span className="bg-green-100 text-[#006B3C] text-xs font-semibold px-2 py-0.5 rounded">
                      {getCountdown(m.kickoffAt)}
                    </span>
                  )}
                  {m && m.status === "in_progress" && (
                    <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-xs font-bold px-2 py-0.5 rounded animate-pulse">
                      <span className="w-1.5 h-1.5 bg-emerald-600 rounded-full" />
                      Live
                    </span>
                  )}
                </div>
                {m ? (
                  <>
                    <p className="font-bold text-gray-900">vs {m.opponent}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {formatDate(m.kickoffAt)} &middot; {formatTime(m.kickoffAt)}
                    </p>
                    {m.venue && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{m.venue}</p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-gray-400 italic">Schedule TBC</p>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
