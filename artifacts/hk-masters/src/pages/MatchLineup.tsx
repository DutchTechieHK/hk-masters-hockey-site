import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type MouseEvent as ReactMouseEvent } from "react";
import { useLocation, useParams } from "wouter";
import { useGetStaffTeam, getGetStaffTeamQueryKey, type LineupPlacement } from "@workspace/api-client-react";
import { useLineupController, toPlacements, type Formation } from "@/hooks/use-lineup-controller";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { ArrowLeft, AlertTriangle, CheckCircle2, CircleDashed, Eye, Lock, RefreshCw, Save, Send, ShieldAlert, Sparkles, Undo2, X, Armchair, Trash2, Crosshair } from "lucide-react";
import { HockeyPitch } from "@/components/lineup/HockeyPitch";
import { LineupBoardLayout } from "@/components/lineup/LineupBoardLayout";
import { PublishedLineupDownload } from "@/components/lineup/PublishedLineupDownload";
import { Chip, Marker, PoolGroup, SaveStatus, surname, type Snap } from "@/components/lineup/BoardPieces";
import { useAuthIdentity } from "@/components/AdminAuthGate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { applyPlacement, boardKey, MAX_ON_PITCH } from "@/lib/lineup-board";
import { explainError, hkDay, hkFull, hkTime } from "@/lib/staff-utils";

type Confirm = { title: string; body: string; confirmLabel: string; onConfirm: () => void; secondaryLabel?: string; onSecondary?: () => void; danger?: boolean };


/** Visual guides only: where the shape of each formation sits. Never used to rank players. */
const SLOTS: Record<Formation, { x: number; y: number; label: string }[]> = {
  "4-3-3": [
    { x: 50, y: 93, label: "GK" },
    { x: 15, y: 74, label: "D" }, { x: 38, y: 77, label: "D" }, { x: 62, y: 77, label: "D" }, { x: 85, y: 74, label: "D" },
    { x: 24, y: 52, label: "M" }, { x: 50, y: 55, label: "M" }, { x: 76, y: 52, label: "M" },
    { x: 20, y: 27, label: "F" }, { x: 50, y: 23, label: "F" }, { x: 80, y: 27, label: "F" },
  ],
  "3-4-3": [
    { x: 50, y: 93, label: "GK" },
    { x: 24, y: 76, label: "D" }, { x: 50, y: 78, label: "D" }, { x: 76, y: 76, label: "D" },
    { x: 12, y: 52, label: "M" }, { x: 37, y: 55, label: "M" }, { x: 63, y: 55, label: "M" }, { x: 88, y: 52, label: "M" },
    { x: 20, y: 27, label: "F" }, { x: 50, y: 23, label: "F" }, { x: 80, y: 27, label: "F" },
  ],
};


export default function MatchLineup() {
  const params = useParams<{ teamId: string; matchId: string }>();
  const teamId = Number(params.teamId);
  const matchId = Number(params.matchId);
  const { identity, revalidate } = useAuthIdentity();
  if (!Number.isInteger(teamId) || !Number.isInteger(matchId) || teamId <= 0 || matchId <= 0) {
    return <Shell back={identity.kind === "staff" ? "/staff" : "/matches"}><Notice icon={<AlertTriangle className="w-6 h-6" />} title="Lineup not found" body="This link does not point to a match lineup." /></Shell>;
  }
  return <LineupEditor key={`${teamId}-${matchId}`} teamId={teamId} matchId={matchId} isStaff={identity.kind === "staff"} revalidate={revalidate} />;
}

function Shell({ back, children }: { back: string; children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-[hsl(214_35%_95%)]">
      <div className="max-w-5xl mx-auto px-4 py-4">
        <button onClick={() => setLocation(back)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary" data-testid="button-lineup-back"><ArrowLeft className="w-4 h-4" />Back</button>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function Notice({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-8 text-center max-w-md mx-auto" data-testid="notice-lineup">
      <div className="mx-auto w-fit text-muted-foreground mb-3">{icon}</div>
      <p className="font-display font-bold text-lg">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

function LineupEditor({ teamId, matchId, isStaff, revalidate }: { teamId: number; matchId: number; isStaff: boolean; revalidate: () => Promise<void> }) {
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const backHref = isStaff ? "/staff" : "/matches";
  const ctl = useLineupController(teamId, matchId, revalidate);
  const { lineup, w, revoked, formation, setFormation, placements, setPlacements, dirty, dirtyRef, remoteNewer, saveState, busy, markEdited } = ctl;
  const saveError = ctl.error;
  const team = useGetStaffTeam(teamId, { query: { queryKey: getGetStaffTeamQueryKey(teamId), enabled: isStaff && !revoked, retry: false } });

  const histState = (typeof window !== "undefined" ? window.history.state : null) as { opponent?: string; kickoffAt?: string } | null;
  const match = team.data?.matches.find((m) => m.id === matchId);
  const opponent = match?.opponent ?? histState?.opponent ?? null;
  const kickoffAt = match?.kickoffAt ?? histState?.kickoffAt ?? null;

  const [view, setView] = useState<"draft" | "published">("draft");
  const [selected, setSelected] = useState<number | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  useEffect(() => { if (revoked || busy) setSelected(null); }, [revoked, busy]);

  const releaseGuard = useUnsavedGuard(dirtyRef, dirty, (href) => {
    setConfirm({ title: "Leave without saving?", body: "Your board has unsaved changes. Leaving discards them.", confirmLabel: "Discard and leave", danger: true,
      onConfirm: () => { releaseGuard(); setLocation(href ?? backHref); } });
  });

  const canEdit = !!w?.canEdit && view === "draft" && busy == null && !lineup.isFetching;
  const canClearRef = useRef(false);
  canClearRef.current = canEdit && placements.length > 0;

  // Lookups
  const people = useMemo(() => new Map((w?.people ?? []).map((p) => [p.playerId, p])), [w]);
  const snaps = useMemo(() => {
    const m = new Map<number, Snap>();
    for (const p of [...(w?.published?.players ?? []), ...(w?.draft.players ?? [])]) m.set(p.playerId, p);
    for (const p of w?.people ?? []) m.set(p.playerId, p);
    return m;
  }, [w]);
  const issues = useMemo(() => new Map((w?.issues ?? []).map((i) => [i.playerId, i.reason])), [w]);
  const placedMap = useMemo(() => new Map(placements.map((p) => [p.playerId, p])), [placements]);
  const onPitch = placements.filter((p) => p.area === "pitch");
  const bench = placements.filter((p) => p.area === "bench");
  const addable = (id: number) => { const s = people.get(id)?.status; return s === "yes" || s === "maybe"; };

  const pool = useMemo(() => {
    const list = [...(w?.people ?? [])].sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.name.localeCompare(b.name));
    return {
      going: list.filter((p) => p.status === "yes"),
      maybe: list.filter((p) => p.status === "maybe"),
      out: list.filter((p) => p.status === "no" || p.status == null),
    };
  }, [w]);

  // ---------- Mutations of the local board ----------
  const place = useCallback((id: number, area: "pitch" | "bench", x = 0, y = 0): boolean => {
    const r = applyPlacement(placements, id, area, x, y, addable(id));
    if (!r.ok && r.reason === "unavailable") {
      toast({ title: "Not available", description: "Only Going or Maybe players can be added to the board.", variant: "destructive" });
      return false;
    }
    if (!r.ok) {
      toast({ title: "Eleven already on the pitch", description: "Move someone to the bench first, or tap a placed player to swap.", variant: "destructive" });
      return false;
    }
    setPlacements(r.placements);
    markEdited();
    return true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placements, people]);

  const unplace = (id: number) => { setPlacements((prev) => prev.filter((p) => p.playerId !== id)); markEdited(); };

  const nextSlot = () => {
    const slot = SLOTS[formation].find((s) => !onPitch.some((p) => Math.hypot(p.x - s.x, (p.y - s.y) * 1.66) < 9));
    return slot ?? { x: 50, y: 50 };
  };

  const nameOf = (id: number) => snaps.get(id)?.name ?? `Player ${id}`;

  // Tap a placed marker
  const tapMarker = (id: number) => {
    if (!canEdit) return;
    if (selected == null || selected === id) { setSelected(selected === id ? null : id); return; }
    const a = placedMap.get(selected);
    const b = placedMap.get(id);
    if (!b) return;
    if (a && a.area === "pitch" && b.area === "pitch") {
      setPlacements((prev) => prev.map((p) => p.playerId === a.playerId ? { ...p, x: b.x, y: b.y } : p.playerId === b.playerId ? { ...p, x: a.x, y: a.y } : p));
    } else if (b.area === "pitch") {
      // Incoming player takes the spot; the replaced player goes to the bench, never lost.
      if (!a && !addable(selected)) { setSelected(null); return; }
      setPlacements((prev) => [
        ...prev.filter((p) => p.playerId !== selected && p.playerId !== id),
        { playerId: selected, area: "pitch", x: b.x, y: b.y },
        { playerId: id, area: "bench", x: 0, y: 0 },
      ]);
      toast({ title: `${nameOf(id)} moved to the bench`, description: `${nameOf(selected)} takes that position.` });
    } else {
      setSelected(id);
      return;
    }
    markEdited();
    setSelected(null);
  };

  // ---------- Drag ----------
  const pitchRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; active: boolean } | null>(null);
  const suppressClick = useRef(false);
  const dragCleanup = useRef<(() => void) | null>(null);
  useEffect(() => () => dragCleanup.current?.(), []);
  const [ghost, setGhost] = useState<{ id: number; x: number; y: number } | null>(null);

  const pitchCoords = (clientX: number, clientY: number) => {
    const r = pitchRef.current?.getBoundingClientRect();
    if (!r) return null;
    const x = ((clientX - r.left) / r.width) * 100;
    const y = ((clientY - r.top) / r.height) * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return null;
    return { x, y };
  };

  const placeRef = useRef(place);
  placeRef.current = place;
  const startDrag = (e: ReactPointerEvent, id: number) => {
    if (!canEdit || e.button > 0) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, active: false };
    const move = (ev: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      if (!d.active && Math.hypot(ev.clientX - d.sx, ev.clientY - d.sy) > 7) d.active = true;
      if (d.active) setGhost({ id: d.id, x: ev.clientX, y: ev.clientY });
    };
    const end = (ev: PointerEvent) => {
      dragCleanup.current = null;
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", cancel);
      const d = drag.current;
      drag.current = null;
      setGhost(null);
      if (!d?.active) return;
      suppressClick.current = true;
      setTimeout(() => { suppressClick.current = false; }, 0);
      const target = (document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null)?.closest("[data-drop]")?.getAttribute("data-drop");
      if (target === "pitch") { const c = pitchCoords(ev.clientX, ev.clientY); if (c) placeRef.current(d.id, "pitch", c.x, c.y); }
      else if (target === "bench") placeRef.current(d.id, "bench");
      else if (target === "pool") { setPlacements((prev) => prev.filter((p) => p.playerId !== d.id)); }
      setSelected(null);
    };
    const cancel = () => { dragCleanup.current = null; drag.current = null; setGhost(null); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", cancel); };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", cancel);
    dragCleanup.current = cancel;
  };

  const onPitchClick = (e: ReactMouseEvent) => {
    if (!canEdit || selected == null || suppressClick.current) return;
    if ((e.target as HTMLElement).closest("[data-marker]")) return;
    const c = pitchCoords(e.clientX, e.clientY);
    if (c && place(selected, "pitch", c.x, c.y)) setSelected(null);
  };

  const nudge = (e: ReactKeyboardEvent, id: number) => {
    const p = placedMap.get(id);
    if (!canEdit || !p || p.area !== "pitch") return;
    const step = e.shiftKey ? 5 : 2;
    const delta: Record<string, [number, number]> = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] };
    const dv = delta[e.key];
    if (!dv) { if (e.key === "Escape") setSelected(null); return; }
    e.preventDefault();
    setSelected(id);
    place(id, "pitch", p.x + dv[0], p.y + dv[1]);
  };

  const doSave = () => void ctl.save(nameOf);
  const doPublication = async (action: "publish" | "withdraw") => {
    if (await ctl.publication(action)) {
      toast({ title: action === "publish" ? "Lineup published" : "Lineup withdrawn", description: action === "publish" ? "Players in this match can now see it in My Schedule." : "Players no longer see a lineup for this match." });
    }
  };

  const loadLatest = () => {
    const apply = () => { ctl.loadLatest(); setSelected(null); };
    if (!dirty) { apply(); return; }
    setConfirm({ title: "Load the latest saved version?", body: "Someone saved a newer version. Loading it replaces your unsaved changes on this phone. This cannot be undone.", confirmLabel: "Discard mine and load", danger: true, onConfirm: apply });
  };

  const applySuggestions = (f: Formation) => {
    if (!w) return;
    const sug = f === "4-3-3" ? w.suggestions433 : w.suggestions343;
    setFormation(f);
    setPlacements(sug.map((p) => ({ ...p })));
    setSelected(null);
    markEdited();
  };

  const askSuggest = () => {
    if (!placements.length) { applySuggestions(formation); return; }
    setConfirm({ title: `Replace the board with ${formation} suggestions?`, body: "Suggestions only use Going players with a single known position. Everyone currently placed (pitch and bench) will be cleared from the board, not from the squad.", confirmLabel: "Replace with suggestions", onConfirm: () => applySuggestions(formation) });
  };

  const askClear = () => {
    if (!canClearRef.current) return;
    setConfirm({
      title: "Clear the board?",
      body: "Remove all pitch and substitute placements from this private draft? Players return to their lists. Your formation, attendance and published lineup stay unchanged. Nothing is saved until you press Save draft.",
      confirmLabel: "Clear board", danger: true,
      onConfirm: () => {
        // Permission or request state can change while the confirmation is open.
        if (!canClearRef.current) return;
        dragCleanup.current?.();
        setPlacements([]);
        setSelected(null);
        markEdited();
      },
    });
  };

  const askFormation = (f: Formation) => {
    if (f === formation) return;
    if (!placements.length) { applySuggestions(f); return; }
    setConfirm({
      title: `Switch to ${f}?`,
      body: "Keep everyone where they are (pitch and bench) and just change the shape guide, or clear the board and use fresh suggestions for this formation.",
      confirmLabel: "Clear and use suggestions", onConfirm: () => applySuggestions(f),
      secondaryLabel: "Keep positions", onSecondary: () => { setFormation(f); markEdited(); },
    });
  };

  const goBack = () => {
    if (!dirty) { setLocation(backHref); return; }
    setConfirm({ title: "Leave without saving?", body: "Your board has unsaved changes. Leaving discards them.", confirmLabel: "Discard and leave", danger: true, onConfirm: () => { releaseGuard(); setLocation(backHref); } });
  };

  // ---------- Render ----------
  if (revoked) {
    return (
      <Shell back={backHref}>
        <Notice icon={<ShieldAlert className="w-7 h-7 text-destructive" />} title="Lineup access removed"
          body="Your access to this team or match changed. The board has been cleared from this device. Contact a club admin if this looks wrong." />
      </Shell>
    );
  }
  if (lineup.isLoading || (!w && !lineup.isError)) {
    return (
      <div className="min-h-[100dvh] bg-[hsl(214_35%_95%)] px-4 py-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-10 w-64" />
          <Skeleton className="mx-auto w-full max-w-[380px] aspect-[55/91.4] rounded-2xl" />
        </div>
      </div>
    );
  }
  if (!w) {
    return (
      <Shell back={backHref}>
        <Notice icon={<AlertTriangle className="w-6 h-6 text-destructive" />} title="Could not load the lineup" body={explainError(lineup.error)}
          action={<Button variant="outline" onClick={() => lineup.refetch()} data-testid="button-retry-lineup">Retry</Button>} />
      </Shell>
    );
  }

  const shownBoard: { formation: string; placements: LineupPlacement[] } = view === "published" && w.published
    ? { formation: w.published.formation, placements: toPlacements(w.published) }
    : { formation, placements };
  const shownPitch = shownBoard.placements.filter((p) => p.area === "pitch");
  const shownBench = shownBoard.placements.filter((p) => p.area === "bench");
  const publishedKey = w.published ? boardKey(w.published.formation, toPlacements(w.published)) : null;
  const savedDiffersFromPublished = publishedKey != null && ctl.savedKey !== publishedKey;
  const placedIssues = placements.filter((p) => issues.has(p.playerId));
  // Availability changed since the last save: allow an explicit save to acknowledge it even without moving anyone.
  const needsReview = placedIssues.length > 0;
  const unsuggested = pool.going.filter((p) => !(formation === "4-3-3" ? w.suggestions433 : w.suggestions343).some((s) => s.playerId === p.playerId));
  const pubSnaps = new Map((w.published?.players ?? []).map((p) => [p.playerId, p]));
  const shownSnap = (id: number): Snap | undefined => (view === "published" ? pubSnaps.get(id) : snaps.get(id));
  const shownStatus = (id: number) => (view === "published" ? pubSnaps.get(id)?.status ?? null : people.get(id)?.status ?? null);
  const maybePlaced = placements.filter((p) => people.get(p.playerId)?.status === "maybe");
  const goingUnplaced = pool.going.filter((p) => !placedMap.has(p.playerId));
  const selectedPlacement = selected != null ? placedMap.get(selected) : undefined;

  return (
    <div className="min-h-[100dvh] bg-[hsl(214_35%_95%)] pb-36">
      {/* Header */}
      <header className="bg-primary text-primary-foreground relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.08] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 20%)" }} />
        <div className="relative max-w-5xl mx-auto px-4 pt-4 pb-5">
          <button onClick={goBack} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white min-h-10" data-testid="button-lineup-back"><ArrowLeft className="w-4 h-4" />{isStaff ? "Workspace" : "Matches"}</button>
          <p className="text-[10px] uppercase tracking-[0.25em] text-white/60 mt-1">Match lineup</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight" data-testid="text-lineup-title">{opponent ? `vs ${opponent}` : `Match ${matchId}`}</h1>
          {kickoffAt && <p className="text-xs font-mono text-white/70 mt-0.5">{hkDay(kickoffAt)} · {hkTime(kickoffAt)} HKT</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {w.published ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/20 border border-emerald-300/40 px-2.5 py-1 text-[11px] font-semibold text-emerald-100" data-testid="status-published">
                <CheckCircle2 className="w-3.5 h-3.5" />Published {w.publishedAt ? hkFull(w.publishedAt) : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 border border-white/20 px-2.5 py-1 text-[11px] font-semibold text-white/85" data-testid="status-unpublished">
                <Lock className="w-3.5 h-3.5" />Not published · players can't see it
              </span>
            )}
            {savedDiffersFromPublished && <span className="rounded-full bg-amber-300/20 border border-amber-200/40 px-2.5 py-1 text-[11px] font-semibold text-amber-100" data-testid="status-draft-differs">Saved draft differs from published</span>}
            {!w.canEdit && <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white/80" data-testid="status-readonly"><Eye className="w-3.5 h-3.5" />View only</span>}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 pt-4">
        {remoteNewer && (
          <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-50 p-3 text-sm" role="alert" data-testid="banner-lineup-conflict">
            <p className="font-semibold text-amber-900">Someone else saved a newer version.</p>
            <p className="text-amber-900/80 text-xs mt-0.5">Your changes are still here and have not been saved. Review the latest version before continuing; nothing is overwritten automatically.</p>
            <Button size="sm" variant="outline" className="mt-2 bg-white" onClick={loadLatest} data-testid="button-load-latest"><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Review latest version</Button>
          </div>
        )}

        {/* View toggle + formation */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="inline-flex p-1 rounded-lg bg-white border border-border" role="tablist" aria-label="Board version">
            {(["draft", "published"] as const).map((v) => (
              <button key={v} role="tab" aria-selected={view === v} disabled={v === "published" && !w.published}
                onClick={() => { setView(v); setSelected(null); }}
                className={cn("px-3 py-1.5 text-sm font-semibold rounded-md transition-colors disabled:opacity-40", view === v ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
                data-testid={`tab-view-${v}`}>
                {v === "draft" ? "Private draft" : "Published"}
              </button>
            ))}
          </div>
          {view === "draft" && (
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="inline-flex p-1 rounded-lg bg-white border border-border" role="radiogroup" aria-label="Formation">
                {(["4-3-3", "3-4-3"] as const).map((f) => (
                  <button key={f} role="radio" aria-checked={formation === f} disabled={!canEdit}
                    onClick={() => askFormation(f)}
                    className={cn("px-2.5 py-1.5 text-sm font-mono font-bold rounded-md transition-colors", formation === f ? "bg-[hsl(208_62%_34%)] text-white" : "text-muted-foreground disabled:opacity-50")}
                    data-testid={`button-formation-${f}`}>{f}</button>
                ))}
              </div>
              {canEdit && <Button size="sm" variant="outline" className="bg-white" onClick={askSuggest} data-testid="button-suggest"><Sparkles className="w-3.5 h-3.5 mr-1" />Suggest</Button>}
              {canEdit && <Button size="sm" variant="outline" className="bg-white min-h-10 text-destructive" disabled={!placements.length} onClick={askClear} data-testid="button-clear-board"><Trash2 className="w-3.5 h-3.5 mr-1" />Clear board</Button>}
            </div>
          )}
        </div>

        <PublishedLineupDownload teamId={teamId} matchId={matchId} isStaff={isStaff} hasPublished={!!w.published} disabled={busy != null} />

        <LineupBoardLayout
          published={view === "published"}
          pitch={
            <HockeyPitch ref={pitchRef} data-drop="pitch" onClick={onPitchClick}
              className={cn(canEdit && selected != null && "cursor-crosshair")}
              aria-label={`Pitch, ${shownPitch.length} of ${MAX_ON_PITCH} placed`} data-testid="pitch-board">
              {view === "draft" && SLOTS[formation].map((s, i) => (
                <span key={i} aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full border border-dashed border-white/30 flex items-center justify-center text-[9px] font-bold text-white/35 pointer-events-none" style={{ left: `${s.x}%`, top: `${s.y}%` }}>{s.label}</span>
              ))}
              {canEdit && selected != null && (
                <span className="absolute inset-0 rounded-sm ring-2 ring-[hsl(75_90%_70%)]/70 pointer-events-none animate-pulse" aria-hidden />
              )}
              {shownPitch.map((p) => (
                <Marker key={p.playerId} p={p} snap={shownSnap(p.playerId)} status={shownStatus(p.playerId)}
                  issue={view === "draft" ? issues.get(p.playerId) : undefined}
                  selected={selected === p.playerId} editable={canEdit} dragging={ghost?.id === p.playerId}
                  onPointerDown={(e) => startDrag(e, p.playerId)}
                  onClick={() => { if (!suppressClick.current) tapMarker(p.playerId); }}
                  onKeyDown={(e) => nudge(e, p.playerId)} />
              ))}
            </HockeyPitch>
          }
          count={
            <p className="text-center text-xs font-mono" data-testid="text-pitch-count">
              <span className={cn("font-bold", shownPitch.length === MAX_ON_PITCH ? "text-emerald-700" : "text-amber-700")}>{shownPitch.length}/{MAX_ON_PITCH}</span>
              <span className="text-muted-foreground"> on pitch{shownPitch.length < MAX_ON_PITCH ? " · incomplete XI" : ""}</span>
            </p>
          }
          bench={
            <section data-drop="bench" onClick={() => { if (canEdit && selected != null && !suppressClick.current) { if (place(selected, "bench")) setSelected(null); } }}
              className={cn("rounded-2xl border-2 border-dashed p-3 transition-colors", canEdit && selected != null ? "border-primary/50 bg-primary/5" : "border-border bg-white")}
              data-testid="zone-bench">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground flex items-center gap-1.5"><Armchair className="w-3.5 h-3.5" />Substitutes · {shownBench.length}</h2>
              {shownBench.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1.5">{canEdit ? "Tap a player, then tap here to add them to the bench." : "No substitutes named."}</p>
              ) : (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {shownBench.map((p) => (
                    <li key={p.playerId}>
                      <Chip snap={shownSnap(p.playerId)} status={shownStatus(p.playerId)} issue={view === "draft" ? issues.get(p.playerId) : undefined}
                        selected={selected === p.playerId} editable={canEdit}
                        onPointerDown={(e) => startDrag(e, p.playerId)}
                        onClick={(e) => { e.stopPropagation(); if (!suppressClick.current) tapMarker(p.playerId); }}
                        testId={`chip-bench-${p.playerId}`} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          }
          available={view === "published" ? (
              <div className="rounded-2xl border border-emerald-600/25 bg-emerald-50 p-4 text-sm" data-testid="panel-published-info">
                <p className="font-semibold text-emerald-900">This is what players see.</p>
                <p className="text-emerald-900/75 text-xs mt-1">Published {w.publishedAt ? `${hkFull(w.publishedAt)} HKT` : ""}. Editing the private draft never changes it until you publish again.</p>
              </div>
            ) : (
              <section data-drop="pool" className="rounded-2xl border border-border bg-white p-4" data-testid="zone-pool">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-display font-bold">Available</h2>
                  <span className="text-xs text-muted-foreground font-mono">{goingUnplaced.length} unplaced</span>
                </div>
                {canEdit && <p className="text-xs text-muted-foreground mt-0.5">Tap a player, then tap the pitch. Or drag them into place.</p>}
                {(placedIssues.length > 0 || maybePlaced.length > 0) && (
                  <section className="mt-3 rounded-xl border border-border bg-muted/30 p-3 space-y-2" data-testid="panel-review">
                    {placedIssues.length > 0 && (
                      <div>
                        <h2 className="text-sm font-bold text-destructive flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" />Needs review · {placedIssues.length}</h2>
                        <ul className="mt-1.5 space-y-1">
                          {placedIssues.map((p) => (
                            <li key={p.playerId} className="text-xs flex items-center justify-between gap-2" data-testid={`row-issue-${p.playerId}`}>
                              <span><span className="font-semibold">{nameOf(p.playerId)}</span> <span className="text-muted-foreground">· {issues.get(p.playerId)}</span></span>
                              {canEdit && <button className="text-destructive font-semibold min-h-8 px-2" onClick={() => unplace(p.playerId)} data-testid={`button-remove-issue-${p.playerId}`}>Remove</button>}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[11px] text-muted-foreground mt-1">Flagged players can stay in a saved draft, but the lineup cannot be published until they are resolved.</p>
                      </div>
                    )}
                    {maybePlaced.length > 0 && (
                      <p className="text-xs text-amber-800 flex items-start gap-1.5"><CircleDashed className="w-3.5 h-3.5 mt-0.5 shrink-0" />{maybePlaced.length} provisional (Maybe) {maybePlaced.length === 1 ? "player is" : "players are"} on the board, marked with a dashed ring.</p>
                    )}
                  </section>
                )}

                  <PoolGroup title="Going" people={pool.going} placedMap={placedMap} selected={selected} canEdit={canEdit} issues={issues}
                    onSelect={(id) => { if (!suppressClick.current) setSelected(selected === id ? null : id); }} onDrag={startDrag} />
                  <PoolGroup title="Maybe · provisional" tone="maybe" people={pool.maybe} placedMap={placedMap} selected={selected} canEdit={canEdit} issues={issues}
                    onSelect={(id) => { if (!suppressClick.current) setSelected(selected === id ? null : id); }} onDrag={startDrag} />
                  {unsuggested.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-3" data-testid="text-unsuggested">
                      Not auto-placed for {formation}: {unsuggested.map((p) => `${p.name} (${p.position?.trim() ? p.position : "no position"})`).join(", ")}. Missing, unrecognised or multi-role positions are left for you to place; suggestions never rank ability.
                    </p>
                  )}
                  {pool.out.length > 0 && (
                    <details className="mt-3">
                      <summary className="text-xs font-semibold text-muted-foreground cursor-pointer min-h-8 flex items-center">Not going or no reply · {pool.out.length}</summary>
                      <ul className="mt-1.5 flex flex-wrap gap-1.5">
                        {pool.out.map((p) => (
                          <li key={p.playerId} className="text-xs rounded-full border border-border px-2 py-1 text-muted-foreground" data-testid={`chip-out-${p.playerId}`}>
                            {p.shirtNumber != null ? `#${p.shirtNumber} ` : ""}{p.name} · {p.status === "no" ? "Not going" : "No reply"}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}
                  {w.people.length === 0 && <p className="text-sm text-muted-foreground mt-3">No eligible players for this match yet.</p>}
                </section>
            )}
          publication={view === "draft" && w.canEdit ? (
                  <section className="rounded-2xl border border-border bg-white p-4 space-y-2" data-testid="panel-publication">
                    <h2 className="font-display font-bold">Publication</h2>
                    <p className="text-xs text-muted-foreground">Publishing copies the saved draft for players in this match. Later edits stay private until you publish again.</p>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" disabled={dirty || busy != null || saveState === "saving" || remoteNewer}
                        onClick={() => setConfirm({ title: w.published ? "Republish this lineup?" : "Publish this lineup?", body: `Players in this match will see the saved draft (${placements.filter((p) => p.area === "pitch").length} on pitch, ${placements.filter((p) => p.area === "bench").length} substitutes)${w.published ? ", replacing the current published version" : ""}.`, confirmLabel: w.published ? "Republish" : "Publish", onConfirm: () => void doPublication("publish") })}
                        data-testid="button-publish">
                        <Send className="w-3.5 h-3.5 mr-1.5" />{busy === "publish" ? "Publishing…" : w.published ? "Republish" : "Publish"}
                      </Button>
                      {w.published && (
                        <Button size="sm" variant="outline" disabled={busy != null || dirty || remoteNewer}
                          onClick={() => setConfirm({ title: "Withdraw the published lineup?", body: "Players will no longer see a lineup for this match. Your private draft is kept.", confirmLabel: "Withdraw", danger: true, onConfirm: () => void doPublication("withdraw") })}
                          data-testid="button-withdraw">
                          <Undo2 className="w-3.5 h-3.5 mr-1.5" />{busy === "withdraw" ? "Withdrawing…" : "Withdraw"}
                        </Button>
                      )}
                    </div>
                    {dirty && <p className="text-[11px] text-amber-800">Save your changes before publishing.</p>}
                  </section>
          ) : undefined}
        />
      </main>

      {/* Drag ghost */}
      {ghost && (
        <div className="fixed z-50 pointer-events-none -translate-x-1/2 -translate-y-1/2" style={{ left: ghost.x, top: ghost.y }} aria-hidden>
          <span className="w-11 h-11 rounded-full bg-[hsl(48_96%_70%)] text-primary font-mono font-bold flex items-center justify-center shadow-xl ring-2 ring-white scale-110">
            {snaps.get(ghost.id)?.shirtNumber ?? surname(nameOf(ghost.id)).slice(0, 2).toUpperCase()}
          </span>
        </div>
      )}

      {/* Bottom bar: selection actions + save */}
      {view === "draft" && w.canEdit && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur pb-[env(safe-area-inset-bottom)]">
          {selected != null && (
            <div className="max-w-5xl mx-auto px-4 pt-2.5 flex flex-wrap items-center gap-2" data-testid="bar-selection">
              <p className="text-sm font-semibold mr-auto min-w-0 truncate">{nameOf(selected)} <span className="font-normal text-muted-foreground">· {selectedPlacement ? (selectedPlacement.area === "pitch" ? "tap a spot or player to move/swap" : "on bench") : "tap the pitch to place"}</span></p>
              {selectedPlacement?.area !== "pitch" && (
                <Button size="sm" variant="outline" onClick={() => { const s = nextSlot(); if (place(selected, "pitch", s.x, s.y)) setSelected(null); }} data-testid="button-place-next"><Crosshair className="w-3.5 h-3.5 mr-1" />Next open spot</Button>
              )}
              {selectedPlacement?.area !== "bench" && (
                <Button size="sm" variant="outline" onClick={() => { if (place(selected, "bench")) setSelected(null); }} data-testid="button-to-bench"><Armchair className="w-3.5 h-3.5 mr-1" />Bench</Button>
              )}
              {selectedPlacement && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => { unplace(selected); setSelected(null); }} data-testid="button-remove-placement"><Trash2 className="w-3.5 h-3.5 mr-1" />Remove</Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setSelected(null)} aria-label="Clear selection" data-testid="button-clear-selection"><X className="w-4 h-4" /></Button>
            </div>
          )}
          <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center gap-3">
            <SaveStatus state={saveState} dirty={dirty} error={saveError} updatedAt={w.updatedAt} />
            <Button className="ml-auto min-w-28 h-11" disabled={!(dirty || needsReview) || busy != null || remoteNewer} onClick={() => doSave()} data-testid="button-save-lineup">
              <Save className="w-4 h-4 mr-1.5" />{saveState === "saving" ? "Saving…" : !dirty && needsReview ? "Review availability and save" : "Save draft"}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog open={!!confirm} onOpenChange={(o) => { if (!o) setConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-confirm-cancel">Cancel</AlertDialogCancel>
            {confirm?.secondaryLabel && (
              <Button variant="outline" onClick={() => { const c = confirm; setConfirm(null); c.onSecondary?.(); }} data-testid="button-confirm-secondary">{confirm.secondaryLabel}</Button>
            )}
            <AlertDialogAction
              className={cn(confirm?.danger && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
              onClick={() => { const c = confirm; setConfirm(null); c?.onConfirm(); }}
              data-testid="button-confirm-ok">{confirm?.confirmLabel}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

