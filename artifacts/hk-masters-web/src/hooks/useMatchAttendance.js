import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { API_BASE } from "../utils/api";
import { clearPlayerToken, getPlayerToken } from "../lib/playerAuth";

// A single snapshot supplies both counts and names on each player page.
export default function useMatchAttendance() {
  const [, setLocation] = useLocation();
  const [matches, setMatches] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const request = useRef(0);
  const controller = useRef(null);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const token = getPlayerToken();
    if (!token) {
      setMatches({});
      setLoading(false);
      setLocation("/login");
      return false;
    }
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_BASE}/api/player-auth/matches/rsvps`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
        signal: abort.signal,
      });
      if (version !== request.current || getPlayerToken() !== token) return false;
      if (response.status === 401 || response.status === 403) {
        setMatches({});
        clearPlayerToken();
        setLocation("/login");
        return false;
      }
      if (!response.ok) throw new Error("Could not load match attendance. Please retry.");
      const data = await response.json();
      if (!Array.isArray(data.matches) || data.matches.some((match) =>
        !Array.isArray(match.goingPlayers) || !match.rsvpCounts)) {
        throw new Error("Match attendance could not be loaded. Please retry.");
      }
      if (version !== request.current || getPlayerToken() !== token) return false;
      setMatches(Object.fromEntries(data.matches.map((match) => [match.matchId, match])));
      return true;
    } catch (err) {
      if (version === request.current && getPlayerToken() === token && !abort.signal.aborted) {
        setError(err.message || "Could not load match attendance. Please retry.");
      }
      return false;
    } finally {
      if (version === request.current) setLoading(false);
    }
  }, [setLocation]);

  const rememberReply = useCallback((matchId, saved) => {
    setMatches((previous) => previous[matchId] ? {
      ...previous,
      [matchId]: { ...previous[matchId], myRsvp: saved.status, myNote: saved.note },
    } : previous);
  }, []);

  useEffect(() => {
    void refresh();
    const onFocus = () => { if (!document.hidden) void refresh(); };
    const onStorage = (event) => {
      if (event.key !== null && event.key !== "hkm_player_session") return;
      // Drop the prior account's names before loading a changed session.
      setMatches({});
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("storage", onStorage);
    const timer = setInterval(onFocus, 60_000);
    return () => {
      ++request.current;
      controller.current?.abort();
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  return { matches, loading, error, refresh, rememberReply };
}
