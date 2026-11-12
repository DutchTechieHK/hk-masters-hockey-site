import { useMemo, useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStaffAccess,
  useSaveStaffGrant,
  useRevokeStaffGrant,
  getGetStaffAccessQueryKey,
  StaffGrantInputRoleLabel,
  type StaffGrant,
} from "@workspace/api-client-react";
import { ShieldCheck, RotateCcw, AlertTriangle, Pencil, Ban, RefreshCw, Users, ClipboardCheck, CalendarCog, Eye, LayoutGrid } from "lucide-react";
import { PageLayout } from "@/components/layout/PageLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorStatus, explainError, hkFull } from "@/lib/staff-utils";

type Draft = {
  playerId: string;
  teamId: string;
  roleLabel: StaffGrantInputRoleLabel;
  manageAttendance: boolean;
  manageSchedule: boolean;
  manageLineups: boolean;
};

const EMPTY: Draft = { playerId: "", teamId: "", roleLabel: "Coach", manageAttendance: false, manageSchedule: false, manageLineups: false };

export function PermissionChips({ grant, dark = false }: { grant: Pick<StaffGrant, "manageAttendance" | "manageSchedule"> & { manageLineups?: boolean }; dark?: boolean }) {
  const base = dark ? "border-white/25 text-white/85" : "border-border text-muted-foreground";
  return (
    <div className="flex flex-wrap gap-1">
      <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", base)}>
        <Eye className="w-3 h-3" /> View
      </span>
      {grant.manageAttendance && (
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", dark ? "border-amber-300/50 text-amber-200" : "border-primary/30 text-primary bg-primary/5")}>
          <ClipboardCheck className="w-3 h-3" /> Attendance
        </span>
      )}
      {grant.manageSchedule && (
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", dark ? "border-amber-300/50 text-amber-200" : "border-primary/30 text-primary bg-primary/5")}>
          <CalendarCog className="w-3 h-3" /> Schedule
        </span>
      )}
      {grant.manageLineups && (
        <span className={cn("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", dark ? "border-amber-300/50 text-amber-200" : "border-primary/30 text-primary bg-primary/5")} data-testid="badge-manage-lineups">
          <LayoutGrid className="w-3 h-3" /> Lineups
        </span>
      )}
    </div>
  );
}

export default function StaffAccess() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const access = useGetStaffAccess({ query: { queryKey: getGetStaffAccessQueryKey(), refetchOnWindowFocus: false } });
  const save = useSaveStaffGrant();
  const revoke = useRevokeStaffGrant();

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [memberFilter, setMemberFilter] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<StaffGrant | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const dir = access.data;
  const teamName = useMemo(() => new Map((dir?.teams ?? []).map((t) => [t.id, t.name])), [dir]);
  const members = useMemo(() => {
    const list = [...(dir?.members ?? [])].sort((a, b) => a.name.localeCompare(b.name));
    const q = memberFilter.trim().toLowerCase();
    return q ? list.filter((m) => m.name.toLowerCase().includes(q) || m.email.toLowerCase().includes(q)) : list;
  }, [dir, memberFilter]);

  const existing = useMemo(() => {
    if (!dir || !draft.playerId || !draft.teamId) return null;
    return dir.grants.find((g) => g.playerId === Number(draft.playerId) && g.teamId === Number(draft.teamId) && g.seasonId === dir.seasonId) ?? null;
  }, [dir, draft.playerId, draft.teamId]);

  const selectedMember = dir?.members.find((m) => m.id === Number(draft.playerId));
  const memberInactive = selectedMember ? selectedMember.memberStatus !== "active" : false;

  const grantsByTeam = useMemo(() => {
    const groups = new Map<number, StaffGrant[]>();
    for (const g of dir?.grants ?? []) {
      const arr = groups.get(g.teamId) ?? [];
      arr.push(g);
      groups.set(g.teamId, arr);
    }
    return [...groups.entries()].sort((a, b) => (teamName.get(a[0]) ?? "").localeCompare(teamName.get(b[0]) ?? ""));
  }, [dir, teamName]);

  const activeCount = dir?.grants.filter((g) => !g.revokedAt).length ?? 0;

  async function reload() {
    setConflict(false);
    setFormError(null);
    setRevokeError(null);
    await queryClient.invalidateQueries({ queryKey: getGetStaffAccessQueryKey() });
  }

  function loadGrant(g: StaffGrant) {
    setDraft({
      playerId: String(g.playerId),
      teamId: String(g.teamId),
      roleLabel: g.roleLabel === "Manager" ? "Manager" : "Coach",
      manageAttendance: g.manageAttendance,
      manageSchedule: g.manageSchedule,
      manageLineups: !!g.manageLineups,
    });
    setFormError(null);
    setConflict(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!dir) return;
    if (!draft.playerId || !draft.teamId) { setFormError("Choose a member and a team."); return; }
    if (memberInactive) { setFormError("Inactive members cannot be granted staff access."); return; }
    setFormError(null);
    save.mutate(
      {
        data: {
          playerId: Number(draft.playerId),
          teamId: Number(draft.teamId),
          seasonId: dir.seasonId,
          roleLabel: draft.roleLabel,
          manageAttendance: draft.manageAttendance,
          manageSchedule: draft.manageSchedule,
          manageLineups: draft.manageLineups,
          version: existing?.version ?? 0,
        },
      },
      {
        onSuccess: () => {
          toast({ title: existing?.revokedAt ? "Access re-enabled" : existing ? "Access updated" : "Access granted" });
          setDraft(EMPTY);
          queryClient.invalidateQueries({ queryKey: getGetStaffAccessQueryKey() });
        },
        onError: (err) => {
          if (errorStatus(err) === 409) {
            setConflict(true);
            setFormError(null);
          } else {
            setFormError(explainError(err));
          }
        },
      },
    );
  }

  function confirmRevoke() {
    if (!revokeTarget) return;
    const target = revokeTarget;
    revoke.mutate(
      { grantId: target.id, data: { version: target.version } },
      {
        onSuccess: () => {
          toast({ title: "Access revoked", description: `${target.playerName} no longer has staff access to ${target.teamName}.` });
          setRevokeTarget(null);
          queryClient.invalidateQueries({ queryKey: getGetStaffAccessQueryKey() });
        },
        onError: (err) => {
          setRevokeError(errorStatus(err) === 409 ? "This grant was changed since you loaded the page. Reload the directory and try again." : explainError(err));
        },
      },
    );
  }

  const submitLabel = existing?.revokedAt ? "Re-enable access" : existing ? "Save changes" : "Grant access";

  return (
    <PageLayout
      title="Staff Access"
      description="Give coaches and managers a restricted workspace for their own team. Team membership alone never grants access."
      action={dir && <Badge variant="outline" className="text-sm py-1 px-3" data-testid="text-access-season">{dir.seasonName}</Badge>}
    >
      {access.isLoading ? (
        <div className="grid lg:grid-cols-[380px_1fr] gap-6">
          <Skeleton className="h-96 rounded-2xl" />
          <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
        </div>
      ) : access.isError || !dir ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-8 text-center">
          <AlertTriangle className="w-6 h-6 mx-auto text-destructive mb-2" />
          <p className="font-semibold">Could not load the staff directory</p>
          <p className="text-sm text-muted-foreground mt-1">{explainError(access.error)}</p>
          <Button variant="outline" className="mt-4" onClick={() => access.refetch()} data-testid="button-retry-access">Retry</Button>
        </div>
      ) : (
        <div className="space-y-8">
          <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">
            {/* Editor */}
            <form onSubmit={submit} className="rounded-2xl border border-border bg-card p-5 space-y-4 lg:sticky lg:top-6" data-testid="form-staff-grant">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                <h2 className="font-display font-bold text-lg">{existing ? (existing.revokedAt ? "Re-enable grant" : "Edit grant") : "New grant"}</h2>
              </div>

              <div className="space-y-1.5">
                <Label>Member</Label>
                <Input placeholder="Filter by name or email" value={memberFilter} onChange={(e) => setMemberFilter(e.target.value)} data-testid="input-member-filter" />
                <Select value={draft.playerId} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, playerId: v })); }} data-testid="select-grant-member">
<option value="" disabled>Choose member</option>
                    {members.map((m) => (
                      <option key={m.id} value={String(m.id)} disabled={m.memberStatus !== "active"}>
                        {m.name}{m.memberStatus !== "active" ? ` (${m.memberStatus})` : ""}
                      </option>
                    ))}
                  
                </Select>
                {selectedMember && <p className="text-[11px] text-muted-foreground truncate">{selectedMember.email}</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Team</Label>
                  <Select value={draft.teamId} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, teamId: v })); }} data-testid="select-grant-team">
<option value="" disabled>Team</option>
                      {dir.teams.map((t) => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
                    
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={draft.roleLabel} onChange={(e) => { const v = e.target.value; setDraft((d) => ({ ...d, roleLabel: v as StaffGrantInputRoleLabel })); }} data-testid="select-grant-role">
                      <option value="Coach">Coach</option>
                      <option value="Manager">Manager</option>
                    
                  </Select>
                </div>
              </div>

              <div className="rounded-xl bg-muted/50 p-3 space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <Eye className="w-4 h-4 mt-0.5 text-muted-foreground" />
                  <div><p className="font-medium">View team</p><p className="text-xs text-muted-foreground">Always included: roster names, fixtures, events and responses.</p></div>
                </div>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <Switch checked={draft.manageAttendance} onCheckedChange={(v) => setDraft((d) => ({ ...d, manageAttendance: v }))} data-testid="switch-manage-attendance" />
                  <div><p className="font-medium">Manage attendance</p><p className="text-xs text-muted-foreground">Correct responses and send reminders.</p></div>
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <Switch checked={draft.manageSchedule} onCheckedChange={(v) => setDraft((d) => ({ ...d, manageSchedule: v }))} data-testid="switch-manage-schedule" />
                  <div><p className="font-medium">Manage schedule</p><p className="text-xs text-muted-foreground">Create and edit matches and private team events.</p></div>
                </label>
                <label className="flex items-start gap-3 text-sm cursor-pointer">
                  <Switch checked={draft.manageLineups} onCheckedChange={(v) => setDraft((d) => ({ ...d, manageLineups: v }))} data-testid="switch-manage-lineups" />
                  <div><p className="font-medium">Manage lineups</p><p className="text-xs text-muted-foreground">Edit, publish and withdraw match lineups. Without it, staff can view the private draft only.</p></div>
                </label>
              </div>

              {memberInactive && <p className="text-xs text-destructive">Inactive members cannot be granted staff access.</p>}
              {formError && <p className="text-xs text-destructive" data-testid="text-grant-error">{formError}</p>}
              {conflict && (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs space-y-2" data-testid="banner-grant-conflict">
                  <p className="font-semibold text-amber-800">Another admin changed this grant.</p>
                  <p className="text-amber-900/80">Your edits are kept. Reload to pick up the latest version, check it, then save again.</p>
                  <Button type="button" size="sm" variant="outline" onClick={reload} data-testid="button-reload-conflict"><RefreshCw className="w-3 h-3 mr-1.5" />Reload directory</Button>
                </div>
              )}

              <div className="flex gap-2">
                <Button type="submit" className="flex-1" disabled={save.isPending || memberInactive || conflict} data-testid="button-save-grant">
                  {save.isPending ? "Saving…" : submitLabel}
                </Button>
                {(draft.playerId || draft.teamId) && (
                  <Button type="button" variant="ghost" onClick={() => { setDraft(EMPTY); setFormError(null); setConflict(false); }} data-testid="button-clear-grant">Clear</Button>
                )}
              </div>
            </form>

            {/* Grants */}
            <div className="space-y-4">
              <div className="flex items-baseline justify-between">
                <h2 className="font-display font-bold text-lg">Grants by team</h2>
                <p className="text-sm text-muted-foreground"><span className="font-mono font-semibold text-foreground">{activeCount}</span> active</p>
              </div>
              {grantsByTeam.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-border p-10 text-center">
                  <Users className="w-7 h-7 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">No coaches or managers yet</p>
                  <p className="text-sm text-muted-foreground mt-1">Pick a member and team on the left to open their workspace.</p>
                </div>
              ) : grantsByTeam.map(([teamId, grants]) => (
                <section key={teamId} className="rounded-2xl border border-border bg-card overflow-hidden">
                  <header className="px-4 py-2.5 bg-primary/5 border-b border-border text-sm font-semibold">{teamName.get(teamId) ?? grants[0].teamName}</header>
                  <ul className="divide-y divide-border">
                    {grants.map((g) => (
                      <li key={g.id} className={cn("px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3", g.revokedAt && "bg-muted/40")} data-testid={`row-grant-${g.id}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className={cn("font-medium truncate", g.revokedAt && "text-muted-foreground line-through")}>{g.playerName}</p>
                            <Badge variant="secondary" className="text-[10px]">{g.roleLabel}</Badge>
                            {g.revokedAt && <Badge variant="outline" className="text-[10px] text-destructive border-destructive/40">Revoked {hkFull(g.revokedAt)}</Badge>}
                          </div>
                          <div className="mt-1.5"><PermissionChips grant={g} /></div>
                        </div>
                        <div className="flex gap-2">
                          {g.revokedAt ? (
                            <Button size="sm" variant="outline" onClick={() => loadGrant(g)} data-testid={`button-reenable-grant-${g.id}`}><RotateCcw className="w-3.5 h-3.5 mr-1.5" />Re-enable</Button>
                          ) : (
                            <>
                              <Button size="sm" variant="outline" onClick={() => loadGrant(g)} data-testid={`button-edit-grant-${g.id}`}><Pencil className="w-3.5 h-3.5 mr-1.5" />Edit</Button>
                              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => { setRevokeError(null); setRevokeTarget(g); }} data-testid={`button-revoke-grant-${g.id}`}><Ban className="w-3.5 h-3.5 mr-1.5" />Revoke</Button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          </div>

          {/* Audit */}
          <section className="rounded-2xl border border-border bg-card overflow-hidden">
            <header className="px-5 py-3 border-b border-border flex items-center justify-between">
              <h2 className="font-display font-bold">Audit trail</h2>
              <Button size="sm" variant="ghost" onClick={reload} data-testid="button-refresh-audit"><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
            </header>
            {dir.audit.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground text-center">No staff activity recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs uppercase tracking-wide text-muted-foreground bg-muted/40">
                    <tr>{["Time (HKT)", "Actor", "Team", "Action", "Target", "Status"].map((h) => <th key={h} className="text-left font-semibold px-4 py-2">{h}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {dir.audit.map((a) => (
                      <tr key={a.id} data-testid={`row-audit-${a.id}`}>
                        <td className="px-4 py-2 font-mono text-xs whitespace-nowrap">{hkFull(a.createdAt)}</td>
                        <td className="px-4 py-2">{a.actor}</td>
                        <td className="px-4 py-2 text-muted-foreground">{a.teamId != null ? teamName.get(a.teamId) ?? `Team ${a.teamId}` : "—"}</td>
                        <td className="px-4 py-2 font-mono text-xs">{a.action}</td>
                        <td className="px-4 py-2 text-muted-foreground max-w-xs truncate">{a.target}</td>
                        <td className="px-4 py-2">
                          {a.status == null ? "—" : (
                            <span className={cn("font-mono text-xs px-1.5 py-0.5 rounded", a.status < 300 ? "bg-emerald-500/10 text-emerald-700" : a.status < 500 ? "bg-amber-500/10 text-amber-800" : "bg-destructive/10 text-destructive")}>{a.status}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => { if (!o) setRevokeTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke staff access?</AlertDialogTitle>
            <AlertDialogDescription>
              {revokeTarget?.playerName} will lose their {revokeTarget?.roleLabel.toLowerCase()} workspace for {revokeTarget?.teamName} on their next request. The grant is kept in history and can be re-enabled.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {revokeError && (
            <div className="text-xs text-destructive space-y-2">
              <p>{revokeError}</p>
              <Button size="sm" variant="outline" onClick={() => { setRevokeTarget(null); reload(); }}>Reload directory</Button>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-revoke">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); confirmRevoke(); }}
              disabled={revoke.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-revoke"
            >
              {revoke.isPending ? "Revoking…" : "Revoke access"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageLayout>
  );
}
