import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "./api";
import { LADIES_TEAMS } from "../content/leagueTeams";

// Only fixture source identities live in code. Public names, divisions,
// descriptions and squad membership are owned by the app's CMS.
export function useCmsLadiesTeams(includePlayers = false) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [playersError, setPlayersError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    const controller = new AbortController();
    const get = async (path) => {
      const response = await fetch(`${API_BASE}${path}`, { signal: controller.signal, credentials: "omit" });
      if (!response.ok) throw new Error("The app's team information could not be loaded.");
      const data = await response.json();
      if (!Array.isArray(data)) throw new Error("The app returned invalid team information.");
      return data;
    };
    setLoading(true);
    setError("");
    setPlayersError("");
    (async () => {
      try {
        const records = await get("/api/teams");
        let players = [];
        if (includePlayers) {
          try { players = await get("/api/public/squad"); }
          catch (err) {
            if (controller.signal.aborted) return;
            setPlayersError("Squad names could not be loaded. Please retry.");
          }
        }
        if (controller.signal.aborted) return;
        setTeams(LADIES_TEAMS.flatMap((identity) => {
          const record = records.find((team) => team.leagueKey === identity.slug && team.membershipSection === "women");
          return record ? [{
            ...identity, id: record.id, label: record.name,
            division: record.category, description: record.description,
            players: players.filter((player) => player.teamId === record.id),
          }] : [];
        }));
      } catch (err) {
        if (!controller.signal.aborted) { setError(err.message); setTeams([]); }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    })();
    return () => controller.abort();
  }, [includePlayers, attempt]);
  return { teams, loading, error, playersError, retry };
}
