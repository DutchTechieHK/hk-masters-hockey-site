import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import { useGetStaffTeam, getGetStaffTeamQueryKey, type Match, type ClubEvent } from "@workspace/api-client-react";
import { CalendarPlus, Plus, Pencil, MapPin, Users, ShieldAlert, RefreshCw, ChevronRight, ShieldCheck, Swords, CalendarClock, LayoutGrid } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { useAuthIdentity } from "@/components/AdminAuthGate";
import { PermissionChips } from "@/pages/StaffAccess";
import { AttendanceSheet, type AttendanceTarget } from "@/components/staff/AttendanceSheet";
import { MatchDialog, EventDialog } from "@/components/staff/ScheduleDialogs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { notifySessionExpired, type StaffIdentityPayload } from "@/lib/admin-auth";
import { cn } from "@/lib/utils";
import { errorStatus, explainError, hkDay, hkTime } from "@/lib/staff-utils";

type Grant = StaffIdentityPayload["grants"][number];

/** Shown to full admins who land on /staff. Never mounts staff data fetches. */
export function StaffWorkspaceAdminNotice() {
  return (
    <PageLayout title="Team Workspace" description="This is the restricted view coaches and managers see after signing in with their member email.">
      <div className="rounded-2xl border border-border bg-card p-8 max-w-xl">
        <ShieldCheck className="w-6 h-6 text-primary mb-3" />
        <p className="font-semibold">You are signed in as a club admin.</p>
        <p className="text-sm text-muted-foreground mt-1">Manage who can open a team workspace from Staff Access.</p>
        <Link href="/access" className="inline-flex items-center gap-1 mt-4 text-sm font-semibold text-primary hover:underline" data-testid="link-staff-access">
          Open Staff Access <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </PageLayout>
  );
}

export default function StaffWorkspace() {
  const { identity, revalidate } = useAuthIdentity();
  if (identity.kind !== "staff") return <StaffWorkspaceAdminNotice />;
  return <StaffWorkspaceInner staff={identity.staff} revalidate={revalidate} />;
}

function StaffWorkspaceInner({ staff, revalidate }: { staff: StaffIdentityPayload; revalidate: () => Promise<void> }) {
  const grants = useMemo(() => staff.grants.filter((g) => !g.revokedAt).sort((a, b) => a.teamName.localeCompare(b.teamName)), [staff.grants]);
  const [teamId, setTeamId] = useState<number | null>(grants[0]?.teamId ?? null);
  const [accessMessage, setAccessMessage] = useState<string | null>(null);

  // If the selected team is no longer assigned, fall back to the first remaining one.
  useEffect(() => {
    if (teamId == null || !grants.some((g) => g.teamId === teamId)) setTeamId(grants[0]?.teamId ?? null);
  }, [grants, teamId]);

  const revalidateRef = useRef(revalidate);
  revalidateRef.current = revalidate;
  const onAccessError = useCallback((err: unknown) => {
    const s = errorStatus(err);
    if (s === 401) { notifySessionExpired(); return; }
    if (s === 403) {
      setAccessMessage("A club admin changed or revoked your access to this team. Your workspace has been refreshed with your current permissions.");
      revalidateRef.current();
    }
  }, []);

  const grant = grants.find((g) => g.teamId === teamId) ?? null;

  return (
    <PageLayout>
      <div className="-mt-8 -mx-4 sm:-mx-6 lg:-mx-8 mb-6 bg-primary text-primary-foreground px-4 sm:px-6 lg:px-8 pt-8 pb-6 relative overflow-hidden">
        <div aria-hidden className="absolute inset-0 opacity-[0.07] pointer-events-none" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 25%)" }} />
        <div className="relative">
          <p className="text-[10px] uppercase tracking-[0.25em] text-primary-foreground/60">{staff.seasonName} · Team workspace</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-white mt-1" data-testid="text-workspace-title">
            {grant ? grant.teamName : "No team assigned"}
          </h1>
          {grant && (
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <span className="text-sm text-primary-foreground/80" data-testid="text-staff-role">{staff.name} · {grant.roleLabel}</span>
              <PermissionChips grant={grant} dark />
            </div>
          )}
          {grants.length > 1 && (
            <div className="mt-5 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Your teams">
              {grants.map((g) => (
                <button
                  key={g.id}
                  role="tab"
                  aria-selected={g.teamId === teamId}
                  onClick={() => { setAccessMessage(null); setTeamId(g.teamId); }}
                  className={cn("whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                    g.teamId === teamId ? "bg-white text-primary" : "bg-white/10 text-white/80 hover:bg-white/20")}
                  data-testid={`tab-team-${g.teamId}`}
                >
                  {g.teamName}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {accessMessage && (
        <div className="mb-5 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm flex gap-3" data-testid="banner-access-changed">
          <ShieldAlert className="w-4 h-4 mt-0.5 text-amber-700 shrink-0" />
          <p className="text-amber-900">{accessMessage}</p>
        </div>
      )}

      {!grant ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center max-w-lg mx-auto">
          <ShieldAlert className="w-7 h-7 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">You have no active team access</p>
          <p className="text-sm text-muted-foreground mt-1">Your coach or manager access may have been revoked. Contact a club admin if this looks wrong.</p>
        </div>
      ) : (
        <TeamWorkspace key={`${grant.id}-${grant.version}`} grant={grant} onAccessError={onAccessError} />
      )}
    </PageLayout>
  );
}

type Item =
  | { type: "match"; at: number; match: Match }
  | { type: "event"; at: number; event: ClubEvent };

function TeamWorkspace({ grant, onAccessError }: { grant: Grant; onAccessError: (err: unknown) => void }) {
  const teamId = grant.teamId;
  const team = useGetStaffTeam(teamId, {
    query: { queryKey: getGetStaffTeamQueryKey(teamId), refetchInterval: 60_000, refetchOnWindowFocus: true, retry: false },
  });
  const [tab, setTab] = useState<"upcoming" | "past" | "roster">("upcoming");
  const [attendance, setAttendance] = useState<AttendanceTarget | null>(null);
  const [matchDialog, setMatchDialog] = useState<{ open: boolean; match: Match | null }>({ open: false, match: null });
  const [eventDialog, setEventDialog] = useState<{ open: boolean; event: ClubEvent | null }>({ open: false, event: null });

  const accessRef = useRef(onAccessError);
  accessRef.current = onAccessError;
  useEffect(() => {
    const s = errorStatus(team.error);
    if (s === 401 || s === 403) accessRef.current(team.error);
  }, [team.error]);

  const { upcoming, past } = useMemo(() => {
    const items: Item[] = [
      ...(team.data?.matches ?? []).map((m) => ({ type: "match" as const, at: Date.parse(m.kickoffAt), match: m })),
      ...(team.data?.events ?? []).map((e) => ({ type: "event" as const, at: Date.parse(e.startsAt), event: e })),
    ];
    const cutoff = Date.now() - 3 * 60 * 60 * 1000;
    return {
      upcoming: items.filter((i) => i.at >= cutoff).sort((a, b) => a.at - b.at),
      past: items.filter((i) => i.at < cutoff).sort((a, b) => b.at - a.at),
    };
  }, [team.data]);

  const roster = useMemo(() => [...(team.data?.roster ?? [])].sort((a, b) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.name.localeCompare(b.name)), [team.data]);

  if (team.isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-72 rounded-lg" />
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
      </div>
    );
  }

  if (team.isError || !team.data) {
    const s = errorStatus(team.error);
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center max-w-lg mx-auto">
        <ShieldAlert className="w-6 h-6 mx-auto text-destructive mb-2" />
        <p className="font-semibold">{s === 403 ? "Access to this team was removed" : "Could not load your team"}</p>
        <p className="text-sm text-muted-foreground mt-1">{explainError(team.error)}</p>
        {s !== 403 && <Button variant="outline" className="mt-4" onClick={() => team.refetch()} data-testid="button-retry-team">Retry</Button>}
      </div>
    );
  }

  const list = tab === "upcoming" ? upcoming : past;
  const nextMatch = upcoming.find((i) => i.type === "match");

  return (
    <div className="space-y-6">
      {/* Next up strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 min-w-0">
        <div className="sm:col-span-2 min-w-0 rounded-2xl border border-border bg-card p-4 flex flex-wrap sm:flex-nowrap items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Swords className="w-5 h-5 text-primary" /></div>
          {nextMatch && nextMatch.type === "match" ? (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Next match</p>
              <p className="font-display font-bold text-lg truncate">vs {nextMatch.match.opponent}</p>
              <p className="text-xs text-muted-foreground font-mono">{hkDay(nextMatch.match.kickoffAt)} · {hkTime(nextMatch.match.kickoffAt)} HKT{nextMatch.match.venue ? ` · ${nextMatch.match.venue}` : ""}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No upcoming match on the books.</p>
          )}
          {nextMatch && nextMatch.type === "match" && (
            <Button size="sm" variant="outline" onClick={() => setAttendance({ resource: "matches", id: nextMatch.match.id, title: `vs ${nextMatch.match.opponent}`, when: `${hkDay(nextMatch.match.kickoffAt)} ${hkTime(nextMatch.match.kickoffAt)}` })} data-testid="button-next-match-attendance">
              Who's in
            </Button>
          )}
        </div>
        <div className="min-w-0 rounded-2xl border border-border bg-card p-4 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Users className="w-5 h-5 text-primary" /></div>
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Squad</p>
            <p className="font-mono text-2xl font-bold" data-testid="text-roster-count">{roster.length}</p>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex p-1 rounded-lg bg-muted" role="tablist">
          {([["upcoming", `Upcoming (${upcoming.length})`], ["past", `Past (${past.length})`], ["roster", "Roster"]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={cn("px-3 py-1.5 text-sm font-semibold rounded-md transition-colors", tab === k ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
              data-testid={`tab-${k}`}>{label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => team.refetch()} disabled={team.isFetching} data-testid="button-refresh-team">
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", team.isFetching && "animate-spin")} />Refresh
          </Button>
          {grant.manageSchedule && (
            <>
              <Button size="sm" variant="outline" onClick={() => setEventDialog({ open: true, event: null })} data-testid="button-add-event"><CalendarPlus className="w-3.5 h-3.5 mr-1.5" />Event</Button>
              <Button size="sm" onClick={() => setMatchDialog({ open: true, match: null })} data-testid="button-add-match"><Plus className="w-3.5 h-3.5 mr-1.5" />Match</Button>
            </>
          )}
        </div>
      </div>

      {tab === "roster" ? (
        roster.length === 0 ? (
          <EmptyState title="No players on this roster" body="Squad selection is handled by club admins." />
        ) : (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {roster.map((p) => (
              <li key={p.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-2.5" data-testid={`row-roster-${p.id}`}>
                <span className="w-9 h-9 rounded-lg bg-primary text-primary-foreground font-mono font-bold text-sm flex items-center justify-center">{p.shirtNumber ?? "–"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.position || "Position not set"}</p>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : list.length === 0 ? (
        <EmptyState
          title={tab === "upcoming" ? "Nothing scheduled" : "No past fixtures"}
          body={tab === "upcoming" ? (grant.manageSchedule ? "Add a match or a private team event to get started." : "Fixtures added by club admins will appear here.") : "Completed matches and events will show here."}
        />
      ) : (
        <ol className="space-y-2">
          {list.map((item) => item.type === "match"
            ? <MatchRow key={`m-${item.match.id}`} match={item.match} canEdit={grant.manageSchedule}
                onOpen={() => setAttendance({ resource: "matches", id: item.match.id, title: `vs ${item.match.opponent}`, when: `${hkDay(item.match.kickoffAt)} ${hkTime(item.match.kickoffAt)}` })}
                onEdit={() => setMatchDialog({ open: true, match: item.match })} />
            : <EventRow key={`e-${item.event.id}`} event={item.event} canEdit={grant.manageSchedule}
                onOpen={() => setAttendance({ resource: "events", id: item.event.id, title: item.event.title, when: `${hkDay(item.event.startsAt)} ${hkTime(item.event.startsAt)}` })}
                onEdit={() => setEventDialog({ open: true, event: item.event })} />)}
        </ol>
      )}

      <AttendanceSheet teamId={teamId} target={attendance} canManage={grant.manageAttendance} onClose={() => setAttendance(null)} onAccessError={onAccessError} />
      {grant.manageSchedule && (
        <>
          <MatchDialog teamId={teamId} teamName={grant.teamName} open={matchDialog.open} match={matchDialog.match} onClose={() => setMatchDialog({ open: false, match: null })} onAccessError={onAccessError} />
          <EventDialog teamId={teamId} teamName={grant.teamName} open={eventDialog.open} event={eventDialog.event} onClose={() => setEventDialog({ open: false, event: null })} onAccessError={onAccessError} />
        </>
      )}
    </div>
  );
}

function DateBlock({ iso }: { iso: string }) {
  const [wd, d, m] = hkDay(iso).replace(",", "").split(" ");
  return (
    <div className="w-14 shrink-0 text-center rounded-lg border border-border bg-muted/40 py-1.5">
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{wd}</p>
      <p className="font-mono font-bold text-lg leading-none">{d}</p>
      <p className="text-[9px] uppercase tracking-widest text-muted-foreground">{m}</p>
    </div>
  );
}

const MATCH_STATUS: Record<string, string> = { scheduled: "", in_progress: "Live", final: "FT", cancelled: "Cancelled" };

function MatchRow({ match, canEdit, onOpen, onEdit }: { match: Match; canEdit: boolean; onOpen: () => void; onEdit: () => void }) {
  const scored = match.ourScore != null && match.theirScore != null;
  return (
    <li className={cn("group rounded-xl border border-border bg-card flex items-stretch overflow-hidden", match.status === "cancelled" && "opacity-60")} data-testid={`row-match-${match.id}`}>
      <span className="w-1 bg-primary shrink-0" />
      <button onClick={onOpen} className="flex-1 flex items-center gap-4 px-3 py-3 text-left hover:bg-muted/40 transition-colors min-w-0" data-testid={`button-open-match-${match.id}`}>
        <DateBlock iso={match.kickoffAt} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-semibold">Match {MATCH_STATUS[match.status] && <span className="ml-1 text-muted-foreground">· {MATCH_STATUS[match.status]}</span>}</p>
          <p className="font-semibold truncate">vs {match.opponent}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <span className="font-mono">{hkTime(match.kickoffAt)}</span>
            {match.venue && <><MapPin className="w-3 h-3 ml-1" />{match.venue}</>}
          </p>
        </div>
        {scored && <span className="font-mono font-bold text-lg tabular-nums">{match.ourScore}–{match.theirScore}</span>}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
      {match.status !== "cancelled" && (
        <Link href={`/staff/teams/${match.teamId}/matches/${match.id}/lineup`} state={{ opponent: match.opponent, kickoffAt: match.kickoffAt }}
          className="px-3 border-l border-border flex flex-col items-center justify-center gap-0.5 text-primary hover:bg-primary/5 min-w-14"
          aria-label={`Lineup vs ${match.opponent}`} data-testid={`link-lineup-${match.id}`}>
          <LayoutGrid className="w-4 h-4" /><span className="text-[10px] font-semibold uppercase tracking-wide">Lineup</span>
        </Link>
      )}
      {canEdit && (
        <button onClick={onEdit} className="px-3 border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted/40" aria-label="Edit match" data-testid={`button-edit-match-${match.id}`}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

function EventRow({ event, canEdit, onOpen, onEdit }: { event: ClubEvent; canEdit: boolean; onOpen: () => void; onEdit: () => void }) {
  const c = event.rsvpCounts;
  return (
    <li className="rounded-xl border border-border bg-card flex items-stretch overflow-hidden" data-testid={`row-event-${event.id}`}>
      <span className="w-1 bg-amber-500 shrink-0" />
      <button onClick={onOpen} className="flex-1 flex items-center gap-4 px-3 py-3 text-left hover:bg-muted/40 transition-colors min-w-0" data-testid={`button-open-event-${event.id}`}>
        <DateBlock iso={event.startsAt} />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-semibold flex items-center gap-1"><CalendarClock className="w-3 h-3" />{event.kind.replace(/_/g, " ")}</p>
          <p className="font-semibold truncate">{event.title}</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
            <span className="font-mono">{hkTime(event.startsAt)}{event.endsAt ? `–${hkTime(event.endsAt)}` : ""}</span>
            {event.location && <><MapPin className="w-3 h-3 ml-1" />{event.location}</>}
          </p>
        </div>
        {c && <span className="hidden sm:inline font-mono text-xs text-muted-foreground">{c.yes} in · {c.maybe} ? · {c.no} out</span>}
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </button>
      {canEdit && (
        <button onClick={onEdit} className="px-3 border-l border-border text-muted-foreground hover:text-foreground hover:bg-muted/40" aria-label="Edit event" data-testid={`button-edit-event-${event.id}`}>
          <Pencil className="w-4 h-4" />
        </button>
      )}
    </li>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border p-12 text-center">
      <CalendarClock className="w-7 h-7 mx-auto text-muted-foreground mb-3" />
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground mt-1">{body}</p>
    </div>
  );
}
