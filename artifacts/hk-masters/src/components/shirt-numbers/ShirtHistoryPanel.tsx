import { useMemo, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import {
  useListShirtContexts,
  getListShirtContextsQueryKey,
  useGetPlayerShirtHistory,
  getGetPlayerShirtHistoryQueryKey,
  useCreateShirtContext,
  useChangePlayerShirtNumber,
  getListPlayersQueryKey,
} from "@workspace/api-client-react"
import type { ShirtAssignment, ShirtChangeInput, ShirtChangeInputAction, ShirtHistory } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AlertTriangle, Archive, History, Plus, RefreshCw, X } from "lucide-react"
import { formatShirtDate } from "./shirt-format"

type DraftAction = ShirtChangeInputAction

type Draft = {
  action: DraftAction
  baseRevision: number
  assignment: ShirtAssignment | null
  contextId: string
  teamId: string
  number: string
  startsOn: string
  endsOn: string
  notes: string
  reason: string
  fromLegacy: boolean
}

const ACTION_TITLE: Record<DraftAction, string> = {
  assign: "Assign current number",
  history: "Record past number",
  change: "Change number",
  end: "End assignment",
  correct: "Correct record",
  void: "Void mistaken record",
  dismiss_legacy: "Dismiss legacy number",
}

const STATUS_STYLE: Record<string, string> = {
  current: "bg-emerald-50 text-emerald-800 border-emerald-200",
  historical: "bg-muted text-muted-foreground border-border",
  void: "bg-red-50 text-red-700 border-red-200 line-through",
}

function errStatus(err: unknown): number | undefined {
  return typeof err === "object" && err && "status" in err ? Number((err as { status: unknown }).status) : undefined
}
function errMessage(err: unknown): string {
  if (typeof err === "object" && err && "data" in err) {
    const d = (err as { data: unknown }).data
    if (d && typeof d === "object" && "error" in d) return String((d as { error: unknown }).error)
  }
  return err instanceof Error ? err.message : "Request failed"
}

function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-semibold text-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function ShirtHistoryPanel({ playerId }: { playerId: number }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const historyKey = getGetPlayerShirtHistoryQueryKey(playerId)
  const { data: history, isLoading, isError, refetch, isFetching } = useGetPlayerShirtHistory(playerId, {
    query: { enabled: !!playerId, queryKey: historyKey, refetchOnWindowFocus: true },
  })
  const { data: directory } = useListShirtContexts({
    query: { queryKey: getListShirtContextsQueryKey(), refetchOnWindowFocus: true },
  })
  const createContext = useCreateShirtContext()
  const changeShirt = useChangePlayerShirtNumber()

  const [draft, setDraft] = useState<Draft | null>(null)
  const [conflict, setConflict] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [showVoid, setShowVoid] = useState(false)
  const [ctxOpen, setCtxOpen] = useState(false)
  const [ctxName, setCtxName] = useState("")
  const [ctxKind, setCtxKind] = useState<"league" | "tournament">("league")
  const [ctxSeason, setCtxSeason] = useState("")

  const contexts = directory?.contexts ?? []
  const teams = directory?.teams ?? []
  const seasons = directory?.seasons ?? []

  const groups = useMemo(() => {
    const list = history?.assignments ?? []
    const current = list.filter((a) => a.status === "current")
    const past = list.filter((a) => a.status === "historical")
    const voided = list.filter((a) => a.status === "void")
    return { current, past, voided }
  }, [history])

  const openDraft = (action: DraftAction, assignment: ShirtAssignment | null = null, extra: Partial<Draft> = {}) => {
    if (!history) return
    setConflict(false)
    setFormError(null)
    setDraft({
      action,
      baseRevision: history.revision,
      assignment,
      contextId: assignment ? String(assignment.contextId) : "",
      teamId: assignment ? String(assignment.teamId) : "",
      number: action === "correct" && assignment ? String(assignment.number) : "",
      startsOn: action === "correct" && assignment ? assignment.startsOn ?? "" : "",
      endsOn: action === "correct" && assignment ? assignment.endsOn ?? "" : "",
      notes: (action === "correct" || action === "end") && assignment ? assignment.notes ?? "" : "",
      reason: "",
      fromLegacy: false,
      ...extra,
    })
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => (d ? { ...d, ...p } : d))

  const reloadBaseline = async () => {
    const res = await refetch()
    if (res.data && draft) {
      patch({ baseRevision: res.data.revision })
      setConflict(false)
      toast({ title: "Latest history loaded", description: "Review the records above, then submit your draft again." })
    }
  }

  const invalidateRelated = () => {
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey[0]
        return typeof k === "string" && (k.startsWith("/api/players") || k.startsWith("/api/staff") || k.startsWith("/api/teams") || k === "players" || k === "teams")
      },
    })
  }

  const submit = () => {
    if (!draft) return
    setFormError(null)
    const a = draft.action
    const num = draft.number ? Number(draft.number) : undefined
    const needsNumber = a === "assign" || a === "history" || a === "change" || a === "correct"
    if (needsNumber && (!num || num < 1 || num > 99 || !Number.isInteger(num))) return setFormError("Enter a whole shirt number from 1 to 99.")
    if ((a === "assign" || a === "history") && (!draft.contextId || !draft.teamId)) return setFormError("Choose a competition context and a team.")
    if ((a === "correct" || a === "void" || a === "dismiss_legacy") && !draft.reason.trim()) return setFormError("A reason is required for the audit trail.")
    if (draft.startsOn && draft.endsOn && draft.endsOn < draft.startsOn) return setFormError("End date cannot be before start date.")

    const data: ShirtChangeInput = { revision: draft.baseRevision, action: a }
    if (draft.assignment) data.assignmentId = draft.assignment.id
    if (a === "assign" || a === "history") {
      data.contextId = Number(draft.contextId)
      data.teamId = Number(draft.teamId)
    }
    if (needsNumber) data.number = num
    if (a === "assign" || a === "history" || a === "change" || a === "correct") data.startsOn = draft.startsOn || null
    if (a === "history" || a === "end") data.endsOn = draft.endsOn || null
    if (a === "correct") data.endsOn = draft.assignment?.status === "current" ? null : draft.endsOn || null
    if (a !== "void" && a !== "dismiss_legacy") data.notes = draft.notes.trim() || null
    if (a === "correct" || a === "void" || a === "dismiss_legacy") data.reason = draft.reason.trim()
    if ((a === "assign" || a === "history") && draft.fromLegacy && history?.legacyNumber != null && num === history.legacyNumber) data.attributeLegacy = true

    changeShirt.mutate(
      { playerId, data },
      {
        onSuccess: (fresh: ShirtHistory) => {
          queryClient.setQueryData(historyKey, fresh)
          invalidateRelated()
          setDraft(null)
          setConflict(false)
          toast({ title: "Shirt record saved" })
          if (fresh.warnings.length) toast({ title: "Check for duplicates", description: fresh.warnings.join(" ") })
        },
        onError: (err) => {
          if (errStatus(err) === 409) {
            setConflict(true)
            setFormError(null)
          } else {
            setFormError(errMessage(err))
          }
        },
      },
    )
  }

  const submitContext = () => {
    if (!ctxName.trim()) return
    createContext.mutate(
      { data: { name: ctxName.trim(), kind: ctxKind, seasonId: ctxSeason ? Number(ctxSeason) : null } },
      {
        onSuccess: (ctx) => {
          queryClient.invalidateQueries({ queryKey: getListShirtContextsQueryKey() })
          invalidateRelated()
          if (draft && (draft.action === "assign" || draft.action === "history")) patch({ contextId: String(ctx.id) })
          setCtxOpen(false)
          setCtxName("")
          setCtxSeason("")
          toast({ title: `Context "${ctx.name}" created` })
        },
        onError: (err) => toast({ title: "Could not create context", description: errMessage(err), variant: "destructive" }),
      },
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-2" data-testid="shirt-history-loading">
        <div className="h-16 rounded-xl bg-muted animate-pulse" />
        <div className="h-10 rounded-xl bg-muted/70 animate-pulse" />
      </div>
    )
  }
  if (isError || !history) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 flex items-center justify-between gap-3">
        <p className="text-sm text-destructive">Could not load shirt number history.</p>
        <Button type="button" size="sm" variant="outline" onClick={() => refetch()} data-testid="button-retry-shirt-history">Retry</Button>
      </div>
    )
  }

  const renderRow = (a: ShirtAssignment) => (
    <div key={a.id} data-testid={`row-shirt-${a.id}`} className="rounded-xl border bg-white px-3 py-2.5">
      <div className="flex items-start gap-3">
        <div className={`shrink-0 w-11 h-11 rounded-lg flex items-center justify-center font-display font-extrabold text-lg tabular-nums ${a.status === "current" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          {a.number}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-sm font-semibold truncate">{a.contextName}</p>
            <span className={`text-[10px] font-bold uppercase tracking-wide border rounded px-1.5 py-0.5 ${STATUS_STYLE[a.status]}`}>{a.status}</span>
            <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{a.kind}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {a.teamName}{a.seasonName ? ` · ${a.seasonName}` : ""}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            {formatShirtDate(a.startsOn)} to {a.status === "current" ? "present" : formatShirtDate(a.endsOn)}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Recorded {new Date(a.recordedAt).toLocaleDateString("en-GB", { timeZone: "Asia/Hong_Kong", day: "numeric", month: "short", year: "numeric" })}
          </p>
          {a.notes && <p className="text-xs mt-1 text-foreground/80">{a.notes}</p>}
        </div>
      </div>
      {a.status !== "void" && (
        <div className="flex flex-wrap gap-1.5 mt-2 pl-14">
          {a.status === "current" && (
            <>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDraft("change", a)} data-testid={`button-change-shirt-${a.id}`}>Change</Button>
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={() => openDraft("end", a)} data-testid={`button-end-shirt-${a.id}`}>End</Button>
            </>
          )}
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={() => openDraft("correct", a)} data-testid={`button-correct-shirt-${a.id}`}>Correct</Button>
          <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => openDraft("void", a)} data-testid={`button-void-shirt-${a.id}`}>Void</Button>
        </div>
      )}
    </div>
  )

  const d = draft
  const showContextTeam = d && (d.action === "assign" || d.action === "history")
  const showNumber = d && ["assign", "history", "change", "correct"].includes(d.action)
  const showStart = d && ["assign", "history", "change", "correct"].includes(d.action)
  const showEnd = d && (d.action === "history" || d.action === "end" || (d.action === "correct" && d.assignment?.status !== "current"))
  const showNotes = d && d.action !== "void" && d.action !== "dismiss_legacy"
  const showReason = d && ["correct", "void", "dismiss_legacy"].includes(d.action)

  return (
    <div className="space-y-3" data-testid="panel-shirt-history">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Numbers are recorded per competition and team. Dates are optional; leave blank if unknown.</p>
        <div className="flex gap-1.5">
          <Button type="button" size="sm" variant="ghost" onClick={() => refetch()} disabled={isFetching} title="Reload history" data-testid="button-refresh-shirt-history">
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => openDraft("history")} disabled={!!draft} data-testid="button-add-past-shirt">
            <History className="w-3.5 h-3.5 mr-1.5" /> Past
          </Button>
          <Button type="button" size="sm" onClick={() => openDraft("assign")} disabled={!!draft} data-testid="button-assign-shirt">
            <Plus className="w-3.5 h-3.5 mr-1.5" /> Assign
          </Button>
        </div>
      </div>

      {history.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 space-y-1" data-testid="status-shirt-warnings">
          <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-3.5 h-3.5" /> Possible duplicates</p>
          {history.warnings.map((w, i) => <p key={i}>{w}</p>)}
        </div>
      )}

      {history.legacyNumber != null && (
        <div className="rounded-xl border border-dashed border-amber-400 bg-amber-50/60 p-3 flex flex-wrap items-center gap-3" data-testid="card-legacy-shirt">
          <div className="w-11 h-11 rounded-lg border-2 border-dashed border-amber-400 text-amber-800 font-display font-extrabold text-lg flex items-center justify-center tabular-nums">{history.legacyNumber}</div>
          <div className="flex-1 min-w-[10rem]">
            <p className="text-sm font-semibold text-amber-900">Legacy number, context unknown</p>
            <p className="text-xs text-amber-800">From the original single-number record. Attach it to a competition and team, or dismiss it.</p>
          </div>
          <div className="flex gap-1.5">
            <Button type="button" size="sm" variant="outline" disabled={!!draft} onClick={() => openDraft("assign", null, { number: String(history.legacyNumber), fromLegacy: true })} data-testid="button-attribute-legacy">Attach</Button>
            <Button type="button" size="sm" variant="ghost" disabled={!!draft} onClick={() => openDraft("dismiss_legacy")} data-testid="button-dismiss-legacy">Dismiss</Button>
          </div>
        </div>
      )}

      {d && (
        <div className="rounded-xl border-2 border-primary/30 bg-primary/[0.03] p-3 sm:p-4 space-y-3" data-testid="form-shirt-draft">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-primary">{ACTION_TITLE[d.action]}</p>
              {d.assignment && <p className="text-xs text-muted-foreground">#{d.assignment.number} {d.assignment.contextName} / {d.assignment.teamName}</p>}
              {d.action === "change" && <p className="text-[11px] text-muted-foreground mt-0.5">Creates a new current number in the same context and team, and ends the old one.</p>}
              {d.action === "correct" && <p className="text-[11px] text-muted-foreground mt-0.5">Fixes number, dates or notes only. If the context or team was wrong, void this record and add the right one.</p>}
            </div>
            <button type="button" onClick={() => { setDraft(null); setConflict(false) }} className="text-muted-foreground hover:text-foreground p-1" aria-label="Discard draft" data-testid="button-discard-shirt-draft">
              <X className="w-4 h-4" />
            </button>
          </div>

          {conflict && (
            <div className="rounded-lg border border-amber-400 bg-amber-50 p-3 text-xs text-amber-900 space-y-2" data-testid="status-shirt-conflict">
              <p className="font-semibold">Someone else changed this member's shirt records.</p>
              <p>Your draft is kept. Load the latest history, review it, then submit again.</p>
              <Button type="button" size="sm" variant="outline" onClick={reloadBaseline} disabled={isFetching} data-testid="button-reload-shirt-baseline">
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isFetching ? "animate-spin" : ""}`} /> Load latest and review
              </Button>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {d.fromLegacy && showContextTeam && (
              <Field label="Use this legacy number as">
                <Select value={d.action} onChange={(e) => patch({ action: e.target.value as "assign" | "history", endsOn: "" })} data-testid="select-legacy-shirt-status">
                  <option value="assign">A current assignment</option>
                  <option value="history">A past assignment</option>
                </Select>
              </Field>
            )}
            {showContextTeam && (
              <>
                <Field label="Competition context *">
                  <div className="flex gap-1.5">
                    <Select className="bg-white flex-1 min-w-0" value={d.contextId} onChange={(e) => patch({ contextId: e.target.value })} data-testid="select-shirt-context">
                      <option value="">Choose...</option>
                      {contexts.map((c) => (
                        <option key={c.id} value={c.id}>{c.name} ({c.kind}{c.seasonName ? `, ${c.seasonName}` : ""})</option>
                      ))}
                    </Select>
                    <Button type="button" size="sm" variant="outline" className="shrink-0 h-10" onClick={() => setCtxOpen((o) => !o)} data-testid="button-new-context">New</Button>
                  </div>
                </Field>
                <Field label="Team *">
                  <Select className="bg-white" value={d.teamId} onChange={(e) => patch({ teamId: e.target.value })} data-testid="select-shirt-team">
                    <option value="">Choose...</option>
                    {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                </Field>
                {ctxOpen && (
                  <div className="sm:col-span-2 rounded-lg border bg-white p-3 space-y-2" data-testid="form-new-context">
                    <p className="text-xs font-semibold">New competition context</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input placeholder="e.g. HKHA Masters League 2025-26" value={ctxName} maxLength={150} onChange={(e) => setCtxName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }} data-testid="input-context-name" />
                      <Select className="bg-white" value={ctxKind} onChange={(e) => setCtxKind(e.target.value as "league" | "tournament")} data-testid="select-context-kind">
                        <option value="league">League</option>
                        <option value="tournament">Tournament</option>
                      </Select>
                      <Select className="bg-white" value={ctxSeason} onChange={(e) => setCtxSeason(e.target.value)} data-testid="select-context-season">
                        <option value="">No linked season</option>
                        {seasons.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.kind})</option>)}
                      </Select>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Linking a league context to its membership season lets league rosters resolve numbers automatically.</p>
                    <div className="flex gap-1.5 justify-end">
                      <Button type="button" size="sm" variant="ghost" onClick={() => setCtxOpen(false)}>Cancel</Button>
                      <Button type="button" size="sm" onClick={submitContext} disabled={!ctxName.trim() || createContext.isPending} data-testid="button-create-context">
                        {createContext.isPending ? "Creating..." : "Create context"}
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            {showNumber && (
              <Field label={d.action === "change" ? "New number *" : "Number *"}>
                <Input type="number" inputMode="numeric" min={1} max={99} value={d.number} onChange={(e) => patch({ number: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault() }} data-testid="input-shirt-number" />
              </Field>
            )}
            {showStart && (
              <Field label={d.action === "change" ? "New number from" : "Start date"} hint="Optional">
                <Input type="date" value={d.startsOn} onChange={(e) => patch({ startsOn: e.target.value })} data-testid="input-shirt-start" />
              </Field>
            )}
            {showEnd && (
              <Field label="End date" hint="Optional">
                <Input type="date" value={d.endsOn} onChange={(e) => patch({ endsOn: e.target.value })} data-testid="input-shirt-end" />
              </Field>
            )}
            {showNotes && (
              <div className="sm:col-span-2">
                <Field label="Notes" hint="Optional">
                  <textarea className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm min-h-[60px]" maxLength={2000} value={d.notes} onChange={(e) => patch({ notes: e.target.value })} data-testid="input-shirt-notes" />
                </Field>
              </div>
            )}
            {showReason && (
              <div className="sm:col-span-2">
                <Field label="Reason *" hint="Recorded in the audit trail.">
                  <textarea className="w-full rounded-md border border-input bg-white px-3 py-2 text-sm min-h-[60px]" maxLength={2000} value={d.reason} onChange={(e) => patch({ reason: e.target.value })} data-testid="input-shirt-reason" />
                </Field>
              </div>
            )}
          </div>

          {formError && <p className="text-xs text-destructive" data-testid="text-shirt-error">{formError}</p>}

          <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => { setDraft(null); setConflict(false) }}>Cancel</Button>
            <Button type="button" onClick={submit} disabled={changeShirt.isPending || conflict} variant={d.action === "void" ? "destructive" : "default"} data-testid="button-submit-shirt-draft">
              {changeShirt.isPending ? "Saving..." : ACTION_TITLE[d.action]}
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {groups.current.length === 0 && groups.past.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center">
            <p className="text-sm font-semibold">No shirt numbers recorded</p>
            <p className="text-xs text-muted-foreground">Assign a current number or record a past one for a league or tournament.</p>
          </div>
        ) : (
          <>
            {groups.current.map(renderRow)}
            {groups.past.length > 0 && <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pt-1">Past</p>}
            {groups.past.map(renderRow)}
          </>
        )}
        {groups.voided.length > 0 && (
          <button type="button" className="text-xs text-muted-foreground underline" onClick={() => setShowVoid((s) => !s)} data-testid="button-toggle-void">
            {showVoid ? "Hide" : "Show"} {groups.voided.length} voided record{groups.voided.length === 1 ? "" : "s"}
          </button>
        )}
        {showVoid && groups.voided.map(renderRow)}
      </div>

      {history.archiveEvidence.length > 0 && (
        <div className="rounded-xl border bg-muted/30 p-3" data-testid="card-archive-evidence">
          <p className="text-xs font-semibold flex items-center gap-1.5 mb-1"><Archive className="w-3.5 h-3.5" /> Rotterdam archive (read-only)</p>
          <ul className="text-xs text-muted-foreground space-y-0.5">
            {history.archiveEvidence.map((e, i) => <li key={i}>{e}</li>)}
          </ul>
        </div>
      )}

      {history.audit.length > 0 && (
        <details className="rounded-xl border bg-white">
          <summary className="cursor-pointer px-3 py-2 text-xs font-semibold" data-testid="button-toggle-shirt-audit">Audit trail ({history.audit.length})</summary>
          <ol className="px-3 pb-3 space-y-2 max-h-64 overflow-y-auto">
            {history.audit.map((e) => (
              <li key={e.id} className="text-xs border-l-2 border-primary/30 pl-2">
                <p><span className="font-semibold">{e.action.replace(/_/g, " ")}</span> by {e.actor} <span className="text-muted-foreground">· {new Date(e.recordedAt).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span></p>
                <p className="text-muted-foreground">{e.detail}</p>
                {e.reason && <p className="italic">Reason: {e.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}
