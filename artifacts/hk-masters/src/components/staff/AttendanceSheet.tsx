import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetStaffAttendance,
  useCorrectStaffAttendance,
  useRemindStaffAttendance,
  getGetStaffAttendanceQueryKey,
  getGetStaffTeamQueryKey,
  type StaffAttendancePerson,
  type StaffAttendanceInputStatus,
} from "@workspace/api-client-react";
import { BellRing, Check, HelpCircle, X, Pencil, RefreshCw, AlertTriangle, Eraser } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { errorStatus, explainError } from "@/lib/staff-utils";

export type AttendanceTarget = { resource: "matches" | "events"; id: number; title: string; when: string };

const STATUS_META = {
  yes: { label: "In", icon: Check, cls: "bg-emerald-600 text-white", soft: "bg-emerald-500/10 text-emerald-800 border-emerald-500/30" },
  maybe: { label: "Maybe", icon: HelpCircle, cls: "bg-amber-500 text-white", soft: "bg-amber-500/10 text-amber-900 border-amber-500/30" },
  no: { label: "Out", icon: X, cls: "bg-rose-600 text-white", soft: "bg-rose-500/10 text-rose-800 border-rose-500/30" },
} as const;

type Props = {
  teamId: number;
  target: AttendanceTarget | null;
  canManage: boolean;
  onClose: () => void;
  onAccessError: (err: unknown) => void;
};

export function AttendanceSheet({ teamId, target, canManage, onClose, onAccessError }: Props) {
  return (
    <Sheet open={!!target} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {target && (
          <AttendanceBody key={`${teamId}-${target.resource}-${target.id}`} teamId={teamId} target={target} canManage={canManage} onAccessError={onAccessError} />
        )}
      </SheetContent>
    </Sheet>
  );
}

function AttendanceBody({ teamId, target, canManage, onAccessError }: { teamId: number; target: AttendanceTarget; canManage: boolean; onAccessError: (err: unknown) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const queryKey = getGetStaffAttendanceQueryKey(teamId, target.resource, target.id);
  const att = useGetStaffAttendance(teamId, target.resource, target.id, {
    query: { queryKey, refetchInterval: 60_000, refetchOnWindowFocus: true, retry: false },
  });
  const remind = useRemindStaffAttendance();
  const [editing, setEditing] = useState<number | null>(null);
  const [confirmRemind, setConfirmRemind] = useState(false);
  const [remindSummary, setRemindSummary] = useState<string | null>(null);
  const [remindError, setRemindError] = useState<string | null>(null);

  const accessRef = useRef(onAccessError);
  accessRef.current = onAccessError;
  useEffect(() => {
    const s = errorStatus(att.error);
    if (s === 401 || s === 403) accessRef.current(att.error);
  }, [att.error]);

  const groups = useMemo(() => {
    const people = att.data?.people ?? [];
    const sort = (a: StaffAttendancePerson, b: StaffAttendancePerson) => (a.shirtNumber ?? 999) - (b.shirtNumber ?? 999) || a.playerName.localeCompare(b.playerName);
    return {
      yes: people.filter((p) => p.status === "yes").sort(sort),
      maybe: people.filter((p) => p.status === "maybe").sort(sort),
      no: people.filter((p) => p.status === "no").sort(sort),
      none: people.filter((p) => p.status == null).sort(sort),
    };
  }, [att.data]);

  function sendReminder() {
    setRemindError(null);
    remind.mutate(
      { teamId, resource: target.resource, id: target.id },
      {
        onSuccess: (res) => {
          const parts = Object.entries(res ?? {})
            .filter(([, v]) => typeof v === "number")
            .map(([k, v]) => `${k}: ${v}`);
          const result = res as Record<string, unknown>;
          const warning = result.historyRecorded === false
            ? " Delivery history is incomplete. Do not resend; ask a club admin to check delivery."
            : Number(result.skippedUncertain ?? 0) > 0
              ? " Uncertain deliveries were not resent. Ask a club admin to check them."
              : "";
          const summary = (parts.length ? parts.join("  ·  ") : "Reminder request completed.") + warning;
          setRemindSummary(summary);
          setConfirmRemind(false);
          toast({ title: "Reminder results", description: summary });
        },
        onError: (err) => {
          setRemindError(explainError(err));
          const s = errorStatus(err);
          if (s === 401 || s === 403) onAccessError(err);
        },
      },
    );
  }

  const counts = att.data?.counts;
  const total = att.data?.people.length ?? 0;

  return (
    <div className="flex flex-col min-h-full">
      <SheetHeader className="p-5 border-b border-border bg-primary text-primary-foreground text-left space-y-1">
        <p className="text-[10px] uppercase tracking-[0.2em] text-primary-foreground/60">{target.resource === "matches" ? "Match" : "Event"} attendance</p>
        <SheetTitle className="text-white font-display text-xl leading-tight">{target.title}</SheetTitle>
        <SheetDescription className="text-primary-foreground/70 font-mono text-xs">{target.when} HKT</SheetDescription>
        {counts && (
          <div className="pt-3 grid grid-cols-4 gap-2" data-testid="attendance-counts">
            {(["yes", "maybe", "no"] as const).map((k) => (
              <div key={k} className="rounded-lg bg-white/10 px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-primary-foreground/60">{STATUS_META[k].label}</p>
                <p className="font-mono text-xl font-bold text-white" data-testid={`count-${k}`}>{counts[k]}</p>
              </div>
            ))}
            <div className="rounded-lg bg-white/5 px-2 py-1.5">
              <p className="text-[10px] uppercase tracking-wide text-primary-foreground/60">No reply</p>
              <p className="font-mono text-xl font-bold text-white/70">{Math.max(0, total - counts.yes - counts.maybe - counts.no)}</p>
            </div>
          </div>
        )}
      </SheetHeader>

      <div className="p-5 space-y-5 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => att.refetch()} disabled={att.isFetching} data-testid="button-refresh-attendance">
            <RefreshCw className={cn("w-3.5 h-3.5 mr-1.5", att.isFetching && "animate-spin")} />Refresh
          </Button>
          {canManage ? (
            <Button size="sm" onClick={() => { setRemindError(null); setConfirmRemind(true); }} data-testid="button-open-remind">
              <BellRing className="w-3.5 h-3.5 mr-1.5" />Remind non-responders
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground">View only. Ask a club admin for attendance permission to correct replies.</p>
          )}
        </div>
        {remindSummary && <p className="text-xs rounded-lg border border-border bg-muted/50 px-3 py-2 font-mono" data-testid="text-remind-summary">Last reminder: {remindSummary}</p>}

        {att.isLoading ? (
          <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-11 rounded-lg" />)}</div>
        ) : att.isError ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm">
            <p className="flex items-center gap-2 font-semibold text-destructive"><AlertTriangle className="w-4 h-4" />Attendance unavailable</p>
            <p className="text-muted-foreground mt-1">{explainError(att.error)}</p>
            <Button size="sm" variant="outline" className="mt-3" onClick={() => att.refetch()}>Retry</Button>
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-10">Nobody is on the invite list for this one yet.</p>
        ) : (
          (["yes", "maybe", "no", "none"] as const).map((k) => groups[k].length > 0 && (
            <section key={k}>
              <h3 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground mb-2">
                {k === "none" ? "No reply" : STATUS_META[k].label} <span className="font-mono">({groups[k].length})</span>
              </h3>
              <ul className="space-y-1.5">
                {groups[k].map((p) => (
                  <li key={p.playerId} className="rounded-lg border border-border bg-card" data-testid={`row-attendance-${p.playerId}`}>
                    <div className="flex items-center gap-3 px-3 py-2">
                      <span className="w-8 text-center font-mono text-xs text-muted-foreground">{p.shirtNumber ?? "–"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p.playerName}</p>
                        {p.note && <p className="text-xs text-muted-foreground truncate">{p.note}</p>}
                      </div>
                      {p.status && (
                        <span className={cn("text-[10px] font-bold uppercase tracking-wide border rounded px-1.5 py-0.5", STATUS_META[p.status].soft)}>{STATUS_META[p.status].label}</span>
                      )}
                      {canManage && editing !== p.playerId && (
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p.playerId)} aria-label={`Correct ${p.playerName}`} data-testid={`button-correct-${p.playerId}`}>
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                    {canManage && editing === p.playerId && (
                      <CorrectionEditor
                        key={p.playerId}
                        teamId={teamId}
                        target={target}
                        person={p}
                        onDone={() => setEditing(null)}
                        onConflict={async () => {
                          await queryClient.invalidateQueries({ queryKey });
                        }}
                        onSaved={() => {
                          queryClient.invalidateQueries({ queryKey });
                          queryClient.invalidateQueries({ queryKey: getGetStaffTeamQueryKey(teamId) });
                        }}
                        onAccessError={onAccessError}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <AlertDialog open={confirmRemind} onOpenChange={setConfirmRemind}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send a reminder?</AlertDialogTitle>
            <AlertDialogDescription>
              Players invited to "{target.title}" who have not replied will get one reminder. This is sent once — it will not retry automatically.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {remindError && <p className="text-xs text-destructive">{remindError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); sendReminder(); }} disabled={remind.isPending} data-testid="button-confirm-remind">
              {remind.isPending ? "Sending…" : "Send reminder"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CorrectionEditor({
  teamId, target, person, onDone, onConflict, onSaved, onAccessError,
}: {
  teamId: number;
  target: AttendanceTarget;
  person: StaffAttendancePerson;
  onDone: () => void;
  onConflict: () => Promise<void>;
  onSaved: () => void;
  onAccessError: (err: unknown) => void;
}) {
  const correct = useCorrectStaffAttendance();
  const [status, setStatus] = useState<StaffAttendanceInputStatus>(person.status);
  const [note, setNote] = useState(person.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const [expected, setExpected] = useState(person.expected);
  const [conflict, setConflict] = useState(false);

  const needsReason = status === "maybe" || status === "no";
  const canClear = person.status != null;
  const unchanged = status === person.status && (note.trim() || null) === (person.note || null);

  function save() {
    if (needsReason && !note.trim()) { setError("A reason is required for Maybe or Out."); return; }
    if (status == null && !canClear) { setError("There is no reply to clear."); return; }
    setError(null);
    correct.mutate(
      {
        teamId, resource: target.resource, id: target.id, playerId: person.playerId,
        data: { status, note: status == null ? null : note.trim() || null, expected },
      },
      {
        onSuccess: () => { onSaved(); onDone(); },
        onError: async (err) => {
          const s = errorStatus(err);
          if (s === 409) {
            await onConflict();
            setConflict(true);
            setError("This reply changed while you were editing. Load the latest reply before making another correction.");
          } else {
            setError(explainError(err));
            if (s === 401 || s === 403) onAccessError(err);
          }
        },
      },
    );
  }

  return (
    <div className="border-t border-border px-3 py-3 space-y-3 bg-muted/30">
      <div className="flex flex-wrap gap-1.5">
        {(["yes", "maybe", "no"] as const).map((k) => {
          const Icon = STATUS_META[k].icon;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setStatus(k)}
              className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-colors",
                status === k ? STATUS_META[k].cls + " border-transparent" : "bg-card border-border hover:bg-muted")}
              data-testid={`button-set-${k}-${person.playerId}`}
            >
              <Icon className="w-3.5 h-3.5" />{STATUS_META[k].label}
            </button>
          );
        })}
        {canClear && (
          <button
            type="button"
            onClick={() => setStatus(null)}
            className={cn("inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-semibold border transition-colors",
              status === null ? "bg-foreground text-background border-transparent" : "bg-card border-border hover:bg-muted")}
            data-testid={`button-set-clear-${person.playerId}`}
          >
            <Eraser className="w-3.5 h-3.5" />Clear reply
          </button>
        )}
      </div>
      {status !== null && (
        <Textarea
          rows={2}
          maxLength={2000}
          placeholder={needsReason ? "Reason (required)" : "Note (optional)"}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          data-testid={`input-note-${person.playerId}`}
        />
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {conflict && (
        <Button size="sm" variant="outline" onClick={() => {
          setExpected(person.expected);
          setStatus(person.status);
          setNote(person.note ?? "");
          setConflict(false);
          setError(null);
        }}>Load latest reply</Button>
      )}
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={onDone}>Cancel</Button>
        <Button size="sm" onClick={save} disabled={correct.isPending || unchanged || conflict} data-testid={`button-save-correction-${person.playerId}`}>
          {correct.isPending ? "Saving…" : "Save correction"}
        </Button>
      </div>
    </div>
  );
}
