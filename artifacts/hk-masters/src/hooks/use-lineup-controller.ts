import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMatchLineup, getGetMatchLineupQueryKey, getMatchLineup, useSaveMatchLineup, useSetLineupPublication,
  type LineupPlacement, type LineupWorkspace, type LineupBoard,
} from "@workspace/api-client-react";
import { notifySessionExpired } from "@/lib/admin-auth";
import { boardKey } from "@/lib/lineup-board";
import { errorStatus, explainError } from "@/lib/staff-utils";

export type Formation = "4-3-3" | "3-4-3";
export type SaveState = "idle" | "saving" | "saved" | "error" | "conflict";
export type Busy = null | "save" | "publish" | "withdraw";

export const toPlacements = (b: LineupBoard): LineupPlacement[] => b.players.map((p) => ({ playerId: p.playerId, area: p.area, x: p.x, y: p.y }));

/**
 * Server state for one match lineup: local draft vs. the revision it was based on,
 * save/publication with captured expected revisions, background refresh that never
 * clobbers unsaved edits, and fail-closed access loss.
 */
export function useLineupController(teamId: number, matchId: number, revalidate: () => Promise<void>) {
  const queryClient = useQueryClient();
  const queryKey = getGetMatchLineupQueryKey(teamId, matchId);
  const [revoked, setRevoked] = useState(false);
  const lineup = useGetMatchLineup(teamId, matchId, {
    query: { queryKey, refetchOnWindowFocus: true, retry: false, refetchInterval: 60_000, enabled: !revoked },
  });
  const saveM = useSaveMatchLineup();
  const pubM = useSetLineupPublication();

  const [formation, setFormation] = useState<Formation>("4-3-3");
  const [placements, setPlacements] = useState<LineupPlacement[]>([]);
  const [base, setBase] = useState<{ revision: number; key: string } | null>(null);
  const baseRef = useRef(base);
  baseRef.current = base;
  const [remoteNewer, setRemoteNewer] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const dirty = base != null && base.key !== boardKey(formation, placements);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  const adopt = useCallback((w: LineupWorkspace) => {
    const f = w.draft.formation as Formation;
    const p = toPlacements(w.draft);
    setFormation(f);
    setPlacements(p);
    setBase({ revision: w.revision, key: boardKey(f, p) });
    dirtyRef.current = false;
    setRemoteNewer(false);
  }, []);

  useEffect(() => {
    const w = lineup.data;
    if (!w) return;
    if (!baseRef.current || !dirtyRef.current) { adopt(w); return; }
    if (w.revision !== baseRef.current.revision) setRemoteNewer(true);
  }, [lineup.data, adopt]);

  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;
  const handleAccess = useCallback((err: unknown) => {
    const s = errorStatus(err);
    if (s === 401) { notifySessionExpired(); return true; }
    if (s === 403 || s === 404) {
      setRevoked(true);
      setPlacements([]);
      setBase(null);
      dirtyRef.current = false;
      queryClient.removeQueries({ queryKey: getGetMatchLineupQueryKey(teamId, matchId) });
      if (s === 403) void revalidateRef.current();
      return true;
    }
    return false;
  }, [queryClient, teamId, matchId]);
  useEffect(() => { if (lineup.error) handleAccess(lineup.error); }, [lineup.error, handleAccess]);

  useEffect(() => () => { queryClient.removeQueries({ queryKey: getGetMatchLineupQueryKey(teamId, matchId) }); }, [queryClient, teamId, matchId]);

  const refreshLatest = async (): Promise<LineupWorkspace | null> => {
    try {
      const fresh = await getMatchLineup(teamId, matchId, { cache: "no-store" });
      queryClient.setQueryData(queryKey, fresh);
      return fresh;
    } catch (err) {
      if (!handleAccess(err)) setError(explainError(err));
      return null;
    }
  };

  const conflict = () => { setSaveState("conflict"); setRemoteNewer(true); };

  const save = async (nameOf: (id: number) => string) => {
    const expected = baseRef.current?.revision;
    if (expected == null || busy) return;
    // Snapshot exactly what is being sent; editing is disabled while in flight.
    const sendFormation = formation;
    const sendPlacements = placements;
    setBusy("save");
    setSaveState("saving");
    setError(null);
    try {
      const fresh = await refreshLatest();
      if (!fresh) { setSaveState("error"); return; }
      if (fresh.revision !== expected) { conflict(); return; }
      const ok = new Map(fresh.people.map((p) => [p.playerId, p.status === "yes" || p.status === "maybe"]));
      const saved = new Set(fresh.draft.players.map((p) => p.playerId));
      const blocked = sendPlacements.filter((p) => !saved.has(p.playerId) && !ok.get(p.playerId));
      if (blocked.length) {
        setSaveState("error");
        setError(`${blocked.map((b) => nameOf(b.playerId)).join(", ")} ${blocked.length > 1 ? "are" : "is"} no longer available. Remove them, then save.`);
        return;
      }
      const result = await saveM.mutateAsync({ teamId, id: matchId, data: { revision: expected, formation: sendFormation, placements: sendPlacements } });
      queryClient.setQueryData(queryKey, result);
      adopt(result);
      setSaveState("saved");
    } catch (err) {
      if (handleAccess(err)) return;
      if (errorStatus(err) === 409) { conflict(); void refreshLatest(); return; }
      setSaveState("error");
      setError(explainError(err, "Could not save the lineup"));
    } finally {
      setBusy(null);
    }
  };

  /** Publishes/withdraws only the revision this device has seen; returns true on success. */
  const publication = async (action: "publish" | "withdraw"): Promise<boolean> => {
    const expected = baseRef.current?.revision;
    if (expected == null || busy || dirtyRef.current) return false;
    setBusy(action);
    setError(null);
    try {
      const fresh = await refreshLatest();
      if (!fresh) return false;
      if (fresh.revision !== expected) { conflict(); return false; }
      if (action === "publish") {
        const flagged = fresh.draft.players.filter((p) => fresh.issues.some((i) => i.playerId === p.playerId));
        if (flagged.length) { setError(`Resolve ${flagged.length} flagged player${flagged.length > 1 ? "s" : ""} before publishing.`); return false; }
        if (!fresh.draft.players.length) { setError("Place at least one player before publishing."); return false; }
      }
      const result = await pubM.mutateAsync({ teamId, id: matchId, data: { revision: expected, action } });
      queryClient.setQueryData(queryKey, result);
      adopt(result);
      return true;
    } catch (err) {
      if (handleAccess(err)) return false;
      if (errorStatus(err) === 409) { conflict(); void refreshLatest(); return false; }
      setError(explainError(err, action === "publish" ? "Could not publish" : "Could not withdraw"));
      return false;
    } finally {
      setBusy(null);
    }
  };

  const loadLatest = () => {
    const latest = queryClient.getQueryData<LineupWorkspace>(queryKey);
    if (latest) adopt(latest);
    setSaveState("idle");
    setError(null);
  };

  const markEdited = () => setSaveState((s) => (s === "saved" ? "idle" : s));

  return {
    lineup, w: lineup.data, revoked, formation, setFormation, placements, setPlacements, savedKey: base?.key ?? null,
    dirty, dirtyRef, remoteNewer, saveState, error, busy, save, publication, loadLatest, markEdited,
  };
}
