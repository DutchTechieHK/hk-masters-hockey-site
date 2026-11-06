import { useEffect, useMemo, useRef, useState } from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import {
  usePreviewMemberBulkEdit,
  useApplyMemberBulkEdit,
  useListMemberBulkEditHistory,
  getListMemberBulkEditHistoryQueryKey,
} from "@workspace/api-client-react"
import type { Player, MemberBulkEditPreview, MemberBulkEditResult, MemberBulkEditRow } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { formatCurrency } from "@/lib/utils"
import { AlertTriangle, ArrowRight, CheckCircle2, History, Loader2, RotateCcw, X, Users, ShieldAlert } from "lucide-react"

type Field = "category" | "section"

export const BULK_CATEGORY_OPTIONS: Record<string, string> = {
  awaiting_selection: "Awaiting Selection",
  trials: "Trials",
  community_member: "Community Member",
  social_player: "Social Player",
  masters_division_one: "Masters Div. 1",
}
export const BULK_SECTION_OPTIONS: Record<string, string> = {
  not_set: "Not set",
  men: "Men",
  women: "Women",
}

function valueLabel(field: string, value: string | null | undefined): string {
  if (value == null || value === "") return "Not set"
  const map = field === "category" ? BULK_CATEGORY_OPTIONS : BULK_SECTION_OPTIONS
  return map[value] ?? value
}
function fieldLabel(field: string) {
  return field === "category" ? "Membership category" : "Men/Women section"
}
function money(v: number | null | undefined) {
  return v == null ? "Not set" : formatCurrency(v)
}
function errStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === "number" ? s : null
}
function errMessage(err: unknown): string {
  const data = (err as { data?: unknown } | null)?.data
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error
  }
  return (err as Error | null)?.message || "Unknown error"
}
function newRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID()
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
    (Number(c) ^ (Math.random() * 16) >> (Number(c) / 4)).toString(16))
}
function selectionKey(ids: number[], field: Field | "", value: string) {
  return `${field}|${value}|${[...ids].sort((a, b) => a - b).join(",")}`
}

/* ---------- Shared presentation ---------- */

function WideDialog({ open, onClose, title, subtitle, children, footer, testId }: {
  open: boolean; onClose: () => void; title: string; subtitle?: string
  children: React.ReactNode; footer?: React.ReactNode; testId: string
}) {
  const previousFocus = useRef<HTMLElement | null>(null)
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" />
      <DialogPrimitive.Content data-testid={testId} {...(!subtitle ? { "aria-describedby": undefined } : {})}
        onOpenAutoFocus={() => { previousFocus.current = document.activeElement as HTMLElement | null }}
        onCloseAutoFocus={(event) => { event.preventDefault(); if (previousFocus.current?.isConnected) previousFocus.current.focus() }}
        className="fixed left-1/2 bottom-0 sm:bottom-auto sm:top-1/2 -translate-x-1/2 sm:-translate-y-1/2 z-50 w-full sm:w-[calc(100%-3rem)] sm:max-w-4xl max-h-[92dvh] bg-card rounded-t-2xl sm:rounded-2xl shadow-2xl border border-border flex flex-col outline-none animate-in fade-in-0 slide-in-from-bottom-2">
        <div className="px-5 sm:px-6 py-4 border-b border-border flex items-start justify-between gap-4">
          <div className="min-w-0">
            <DialogPrimitive.Title className="text-lg sm:text-xl font-bold font-display">{title}</DialogPrimitive.Title>
            {subtitle && <DialogPrimitive.Description className="text-sm text-muted-foreground mt-0.5">{subtitle}</DialogPrimitive.Description>}
          </div>
          <button onClick={onClose} aria-label="Close" data-testid={`${testId}-close`}
            className="p-2 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-5 sm:px-6 py-5 flex-1">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-border bg-muted/30 rounded-b-2xl">{footer}</div>}
      </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "primary" | "muted" | "warn" }) {
  const cls = tone === "primary" ? "bg-primary text-primary-foreground" : tone === "warn" ? "bg-amber-100 text-amber-900" : "bg-secondary text-secondary-foreground"
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <div className="text-[11px] uppercase tracking-wider font-semibold opacity-80">{label}</div>
      <div className="text-2xl font-display font-bold tabular-nums leading-tight">{value}</div>
    </div>
  )
}

export function BulkEditRowsTable({ field, rows, testId }: { field: string; rows: MemberBulkEditRow[]; testId: string }) {
  const sorted = useMemo(() => [...rows].sort((a, b) => Number(b.changed) - Number(a.changed) || a.name.localeCompare(b.name)), [rows])
  return (
    <div className="border border-border rounded-xl overflow-x-auto" data-testid={testId}>
      <table className="w-full text-sm min-w-[720px]">
        <thead className="bg-muted/50 text-[11px] uppercase tracking-wider text-muted-foreground">
          <tr>
            <th scope="col" className="text-left px-3 py-2 font-semibold">Member</th>
            <th scope="col" className="text-left px-3 py-2 font-semibold">{field === "category" ? "Category" : "Section"}</th>
            <th scope="col" className="text-right px-3 py-2 font-semibold">Amount due</th>
            <th scope="col" className="text-right px-3 py-2 font-semibold">Paid</th>
            <th scope="col" className="text-right px-3 py-2 font-semibold">Balance</th>
            <th scope="col" className="text-left px-3 py-2 font-semibold">Squad</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const dueChanged = r.oldAmountDue !== r.newAmountDue
            const balChanged = r.balanceBefore !== r.balanceAfter
            const teamChanged = r.teamIdBefore !== r.teamIdAfter
            return (
              <tr key={r.playerId} className={`border-t border-border align-top ${r.changed ? "" : "text-muted-foreground bg-muted/20"}`} data-testid={`${testId}-row-${r.playerId}`}>
                <td className="px-3 py-2">
                  <div className="font-medium text-foreground">{r.name}</div>
                  <div className="text-[11px] mt-0.5">
                    {r.changed
                      ? <span className="text-primary font-semibold">Changes</span>
                      : <span>No change</span>}
                    {r.customFee && <span className="ml-2 inline-block rounded bg-amber-100 text-amber-900 px-1.5 font-semibold">Custom fee</span>}
                  </div>
                  {r.warnings.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {r.warnings.map((w, i) => (
                        <li key={i} className="text-[12px] text-amber-800 flex gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{w}</li>
                      ))}
                    </ul>
                  )}
                </td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {valueLabel(field, r.oldValue)}
                  {r.changed && <><ArrowRight className="inline w-3 h-3 mx-1" aria-label="to" /><strong className="text-foreground">{valueLabel(field, r.newValue)}</strong></>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {money(r.oldAmountDue)}
                  {dueChanged && <><ArrowRight className="inline w-3 h-3 mx-1" aria-label="to" /><strong className="text-foreground">{money(r.newAmountDue)}</strong></>}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(r.amountPaid)}</td>
                <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                  {money(r.balanceBefore)}
                  {balChanged && <><ArrowRight className="inline w-3 h-3 mx-1" aria-label="to" /><strong className="text-foreground">{money(r.balanceAfter)}</strong></>}
                </td>
                <td className="px-3 py-2">
                  {r.teamNameBefore ?? "None"}
                  {teamChanged && <><ArrowRight className="inline w-3 h-3 mx-1" aria-label="to" /><strong className="text-amber-800">{r.teamNameAfter ?? "Removed"}</strong></>}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function ConsequenceCopy({ field }: { field: string }) {
  return field === "category" ? (
    <ul className="text-sm space-y-1 list-disc pl-5">
      <li>Only the <strong>current-season amount due</strong> is replaced by the new category fee, including any custom or nonstandard amounts flagged below.</li>
      <li>Payments, payment dates, archive history and squad assignments are not touched.</li>
      <li>No emails are sent and no refunds or payments are created.</li>
      <li>Where the category fee is not set, amount due shows as Not set, not $0.</li>
    </ul>
  ) : (
    <ul className="text-sm space-y-1 list-disc pl-5">
      <li>Members in a current squad that does not match the new section are <strong>removed from that squad</strong>.</li>
      <li>Fees, payments and membership categories stay unchanged.</li>
      <li>No emails are sent.</li>
    </ul>
  )
}

/* ---------- History ---------- */

function HistoryPage({ beforeId, onOlder }: { beforeId?: number; onOlder: (id: number) => void }) {
  const params = beforeId ? { beforeId } : undefined
  const q = useListMemberBulkEditHistory(params, { query: { queryKey: getListMemberBulkEditHistoryQueryKey(params) } })
  if (q.isLoading) {
    return <div className="space-y-3" aria-busy="true" aria-label="Loading history">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
  }
  if (q.isError) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm flex items-center justify-between gap-3">
        <span>Could not load bulk edit history. {errMessage(q.error)}</span>
        <Button size="sm" variant="outline" onClick={() => q.refetch()} data-testid="button-history-retry">Retry</Button>
      </div>
    )
  }
  const data = q.data
  if (!data || (data.items.length === 0 && !beforeId)) {
    return (
      <div className="text-center py-12" data-testid="status-history-empty">
        <History className="w-10 h-10 mx-auto text-muted-foreground/50" />
        <p className="mt-3 font-display font-semibold">No bulk edits yet</p>
        <p className="text-sm text-muted-foreground">Category and section batches will be recorded here with every member they touched.</p>
      </div>
    )
  }
  return (
    <div className="space-y-4">
      {data.items.map((b) => <HistoryBatch key={b.batchId} batch={b} />)}
      {data.nextBeforeId != null && (
        <div className="text-center">
          <Button variant="outline" size="sm" onClick={() => onOlder(data.nextBeforeId as number)} data-testid="button-history-older">Older batches</Button>
        </div>
      )}
    </div>
  )
}

function HistoryBatch({ batch }: { batch: MemberBulkEditResult }) {
  const [open, setOpen] = useState(false)
  return (
    <article className="rounded-xl border border-border" data-testid={`card-history-${batch.batchId}`}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className="w-full text-left p-4 flex flex-col sm:flex-row sm:items-center gap-2 hover:bg-muted/40 rounded-xl">
        <div className="flex-1 min-w-0">
          <div className="font-display font-semibold">
            {fieldLabel(batch.field)} set to {valueLabel(batch.field, batch.value)}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {batch.actor} &middot; {new Date(batch.recordedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} &middot; {batch.seasonName}
          </div>
        </div>
        <div className="text-xs tabular-nums text-muted-foreground shrink-0">
          <strong className="text-foreground">{batch.changed}</strong> changed, {batch.unchanged} unchanged {open ? "(hide)" : "(details)"}
        </div>
      </button>
      {open && <div className="px-4 pb-4"><BulkEditRowsTable field={batch.field} rows={batch.rows} testId={`table-history-${batch.batchId}`} /></div>}
    </article>
  )
}

export function MemberBulkEditHistoryDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [pages, setPages] = useState<(number | undefined)[]>([undefined])
  useEffect(() => { if (open) setPages([undefined]) }, [open])
  return (
    <WideDialog open={open} onClose={onClose} title="Bulk edit history" subtitle="Every category and section batch, newest first." testId="dialog-bulk-history">
      {open && (
        <div className="space-y-4">
          {pages.map((p, i) => (
            <HistoryPage key={p ?? "first"} beforeId={p}
              onOlder={(id) => setPages((prev) => (i === prev.length - 1 ? [...prev, id] : prev))} />
          ))}
        </div>
      )}
    </WideDialog>
  )
}

/* ---------- Editor ---------- */

type PreviewState = { key: string; preview: MemberBulkEditPreview; requestId: string }
type ApplyError = { kind: "conflict" | "retryable" | "rejected"; message: string }

export function MemberBulkEditor({ selectedPlayers, onClearSelection }: {
  selectedPlayers: Player[]
  onClearSelection: () => void
}) {
  const queryClient = useQueryClient()
  const previewMutation = usePreviewMemberBulkEdit()
  const applyMutation = useApplyMemberBulkEdit()

  const [field, setField] = useState<Field | "">("")
  const [value, setValue] = useState("")
  const [previewState, setPreviewState] = useState<PreviewState | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [acknowledged, setAcknowledged] = useState(false)
  const [applyError, setApplyError] = useState<ApplyError | null>(null)
  const [result, setResult] = useState<MemberBulkEditResult | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const ids = useMemo(() => selectedPlayers.map((p) => p.id), [selectedPlayers])
  const currentKey = selectionKey(ids, field, value)
  const seq = useRef(0)

  // Any change to selection/field/value invalidates preview, including in-flight ones.
  useEffect(() => {
    seq.current += 1
    setPreviewState(null)
    setPreviewError(null)
    setPreviewLoading(false)
    setAcknowledged(false)
    setApplyError(null)
    setReviewOpen(false)
  }, [currentKey])

  const preview = previewState && previewState.key === currentKey ? previewState.preview : null
  const canPreview = ids.length > 0 && ids.length <= 500 && field !== "" && value !== ""

  const runPreview = () => {
    if (!canPreview || !field) return
    const mySeq = ++seq.current
    const key = currentKey
    setPreviewLoading(true)
    setPreviewError(null)
    setPreviewState(null)
    setAcknowledged(false)
    setApplyError(null)
    previewMutation.mutate({ data: { playerIds: ids, field, value } }, {
      onSuccess: (p) => {
        if (seq.current !== mySeq) return
        setPreviewState({ key, preview: p, requestId: newRequestId() })
        setPreviewLoading(false)
        setReviewOpen(true)
      },
      onError: (err) => {
        if (seq.current !== mySeq) return
        setPreviewError(errMessage(err))
        setPreviewLoading(false)
      },
    })
  }

  const runApply = () => {
    if (!preview || !previewState || !field || !acknowledged || preview.changed === 0) return
    const { requestId } = previewState
    setApplyError(null)
    applyMutation.mutate({ data: { playerIds: ids, field, value, previewToken: preview.previewToken, requestId } }, {
      onSuccess: (res) => {
        setResult(res)
        setReviewOpen(false)
        setPreviewState(null)
        setField("")
        setValue("")
        onClearSelection()
        void queryClient.invalidateQueries()
      },
      onError: (err) => {
        const s = errStatus(err)
        if (s === 409) {
          setPreviewState(null)
          setAcknowledged(false)
          setApplyError({ kind: "conflict", message: "Member data changed since this preview. Run a new preview before applying." })
        } else if (s !== null && s >= 400 && s < 500) {
          setApplyError({ kind: "rejected", message: errMessage(err) })
        } else {
          setApplyError({ kind: "retryable", message: `The server response was unclear (${errMessage(err)}). The change may or may not have been saved. Retrying is safe and will not apply it twice.` })
        }
      },
    })
  }

  const options = field === "category" ? BULK_CATEGORY_OPTIONS : field === "section" ? BULK_SECTION_OPTIONS : {}
  const applying = applyMutation.isPending

  return (
    <>
      {result && (
        <div role="status" className="px-4 py-3 border-b border-border bg-emerald-50 text-emerald-950 flex flex-col sm:flex-row sm:items-center gap-2" data-testid="status-bulk-result">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
          <div className="text-sm flex-1 min-w-0">
            <strong>{fieldLabel(result.field)} set to {valueLabel(result.field, result.value)}</strong> for {result.changed} member{result.changed === 1 ? "" : "s"}
            {result.unchanged > 0 && <>, {result.unchanged} unchanged</>}.{" "}
            <span className="text-emerald-900/80 break-words">
              {result.rows.filter((r) => r.changed).map((r) => r.name).join(", ") || "No members changed."}
            </span>
            {result.unchanged > 0 && <span className="block text-emerald-900/80 break-words">Unchanged: {result.rows.filter((r) => !r.changed).map((r) => r.name).join(", ")}.</span>}
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" className="bg-white" onClick={() => setHistoryOpen(true)} data-testid="button-result-history">View in history</Button>
            <Button size="sm" variant="ghost" onClick={() => setResult(null)} aria-label="Dismiss result" data-testid="button-result-dismiss"><X className="w-4 h-4" /></Button>
          </div>
        </div>
      )}

      <div className="px-4 py-3 border-b border-border bg-primary/5 flex flex-col lg:flex-row lg:items-center gap-3" data-testid="bar-bulk-edit">
        <div className="flex items-center gap-2 text-sm">
          <Users className="w-4 h-4 text-primary" />
          <span className="font-semibold tabular-nums" data-testid="text-selected-count">{ids.length} selected</span>
          {ids.length === 0 && <span className="text-muted-foreground">Tick members below to bulk edit</span>}
          {ids.length > 500 && <span className="text-destructive font-medium">Max 500 per batch</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          {ids.length > 0 && (
            <>
              <label className="sr-only" htmlFor="bulk-field">Field to change</label>
              <Select id="bulk-field" className="w-44 bg-white" value={field} data-testid="select-bulk-field"
                onChange={(e) => { setField(e.target.value as Field | ""); setValue("") }}>
                <option value="">Choose field...</option>
                <option value="category">Membership category</option>
                <option value="section">Men/Women section</option>
              </Select>
              <label className="sr-only" htmlFor="bulk-value">New value</label>
              <Select id="bulk-value" className="w-44 bg-white" value={value} disabled={field === ""} data-testid="select-bulk-value"
                onChange={(e) => setValue(e.target.value)}>
                <option value="">{field === "" ? "Pick a field first" : "Choose new value..."}</option>
                {Object.entries(options).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Button size="sm" onClick={preview ? () => setReviewOpen(true) : runPreview} disabled={!canPreview || previewLoading} data-testid="button-bulk-preview">
                {previewLoading ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Previewing</> : preview ? "Review changes" : "Preview changes"}
              </Button>
              <Button size="sm" variant="outline" onClick={onClearSelection} data-testid="button-bulk-clear">Clear</Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setHistoryOpen(true)} data-testid="button-bulk-history">
            <History className="w-4 h-4 mr-1.5" />Bulk edit history
          </Button>
        </div>
      </div>
      {previewError && (
        <div role="alert" className="px-4 py-2 border-b border-border bg-destructive/5 text-sm flex items-center gap-3" data-testid="status-preview-error">
          <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
          <span className="flex-1">Preview failed: {previewError}. Nothing has been changed.</span>
          <Button size="sm" variant="outline" onClick={runPreview} data-testid="button-preview-retry">Retry preview</Button>
        </div>
      )}

      <WideDialog
        open={reviewOpen && (!!preview || applyError?.kind === "conflict")}
        onClose={() => { if (!applying) setReviewOpen(false) }}
        title={field ? `Review: ${fieldLabel(field)} to ${valueLabel(field, value)}` : "Review bulk edit"}
        subtitle={preview ? `${preview.seasonName} \u00b7 ${preview.total} selected member${preview.total === 1 ? "" : "s"}` : undefined}
        testId="dialog-bulk-review"
        footer={
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {preview && preview.changed > 0 && (
              <label className="flex items-start gap-2 text-sm flex-1 cursor-pointer">
                <input type="checkbox" className="mt-0.5 w-4 h-4 accent-[hsl(var(--primary))]" checked={acknowledged} disabled={applying}
                  onChange={(e) => setAcknowledged(e.target.checked)} data-testid="checkbox-bulk-ack" />
                <span>I have reviewed every member, fee and squad consequence above.</span>
              </label>
            )}
            <div className="flex gap-2 sm:ml-auto justify-end">
              <Button variant="outline" onClick={() => setReviewOpen(false)} disabled={applying} data-testid="button-bulk-cancel">Cancel</Button>
              {applyError?.kind === "conflict" ? (
                <Button onClick={runPreview} disabled={previewLoading} data-testid="button-bulk-repreview">
                  <RotateCcw className="w-4 h-4 mr-1.5" />Run new preview
                </Button>
              ) : (
                <Button onClick={runApply} disabled={!preview || preview.changed === 0 || !acknowledged || applying} data-testid="button-bulk-apply">
                  {applying ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" />Applying</>
                    : applyError?.kind === "retryable" ? "Retry apply"
                    : preview && preview.changed > 0 ? `Apply to ${preview.changed} member${preview.changed === 1 ? "" : "s"}` : "Nothing to apply"}
                </Button>
              )}
            </div>
          </div>
        }
      >
        {applyError && (
          <div role="alert" className={`mb-4 rounded-xl p-3 text-sm flex gap-2 ${applyError.kind === "retryable" ? "bg-amber-50 text-amber-950 border border-amber-200" : "bg-destructive/5 border border-destructive/30"}`} data-testid="status-apply-error">
            <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
            <span>{applyError.message}</span>
          </div>
        )}
        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 max-w-md">
              <Stat label="Will change" value={preview.changed} tone="primary" />
              <Stat label="No change" value={preview.unchanged} tone="muted" />
              <Stat label="Warnings" value={preview.warnings.length + preview.rows.reduce((n, r) => n + r.warnings.length, 0)} tone="warn" />
            </div>
            {preview.changed === 0 && (
              <p className="rounded-xl bg-secondary p-3 text-sm" data-testid="status-no-change">
                Every selected member already has {valueLabel(preview.field, preview.value)}. There is nothing to apply.
              </p>
            )}
            <div className="rounded-xl border border-border p-3 bg-muted/30">
              <div className="text-[11px] uppercase tracking-wider font-semibold text-primary mb-1.5">What this does</div>
              <ConsequenceCopy field={preview.field} />
            </div>
            {preview.warnings.length > 0 && (
              <ul className="rounded-xl bg-amber-50 border border-amber-200 p-3 space-y-1 text-sm text-amber-950" data-testid="list-preview-warnings">
                {preview.warnings.map((w, i) => <li key={i} className="flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{w}</li>)}
              </ul>
            )}
            <BulkEditRowsTable field={preview.field} rows={preview.rows} testId="table-bulk-preview" />
          </div>
        )}
      </WideDialog>

      <MemberBulkEditHistoryDialog open={historyOpen} onClose={() => setHistoryOpen(false)} />
    </>
  )
}
