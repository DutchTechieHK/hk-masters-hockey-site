import { useEffect, useMemo, useRef, useState } from "react"
import { usePreviewPortalInvitations, useSendPortalInvitations } from "@workspace/api-client-react"
import type { Player, PortalInvitationPreview, PortalInvitationResult, PortalInvitationRecipientStatus } from "@workspace/api-client-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { AlertTriangle, CheckSquare, Eye, Loader2, Mail, Search, Send, X } from "lucide-react"

type Frozen = { playerIds: number[]; resend: boolean; preview: PortalInvitationPreview }

const STATUS_STYLE: Record<PortalInvitationRecipientStatus, { label: string; cls: string }> = {
  eligible: { label: "Will be sent", cls: "bg-green-50 text-green-700 border-green-200" },
  already_invited: { label: "Already invited", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  skipped: { label: "Skipped", cls: "bg-amber-50 text-amber-700 border-amber-200" },
  blocked: { label: "Blocked", cls: "bg-rose-50 text-rose-700 border-rose-200" },
}

function errStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === "number" ? s : null
}

function errMessage(err: unknown, fallback: string): string {
  const data = (err as { data?: { error?: unknown } } | null)?.data
  if (data && typeof data.error === "string") return data.error
  return err instanceof Error && err.message ? err.message : fallback
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`

export function PortalInvitationPanel({
  activePlayers,
  onSent,
  focusSignal,
}: {
  activePlayers: Player[]
  onSent: () => void
  focusSignal?: number
}) {
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [search, setSearch] = useState("")
  const [resend, setResend] = useState(false)
  const [frozen, setFrozen] = useState<Frozen | null>(null)
  const [previewError, setPreviewError] = useState<string | null>(null)
  const [sendError, setSendError] = useState<string | null>(null)
  const [uncertainRetry, setUncertainRetry] = useState(false)
  const [result, setResult] = useState<PortalInvitationResult | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sending, setSending] = useState(false)

  const previewSeq = useRef(0)
  const requestIdRef = useRef<string | null>(null)
  const sendingRef = useRef(false)
  const panelRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (focusSignal) panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [focusSignal])

  const previewMutation = usePreviewPortalInvitations()
  const sendMutation = useSendPortalInvitations()
  const previewFnRef = useRef(previewMutation.mutateAsync)
  previewFnRef.current = previewMutation.mutateAsync
  const sendFnRef = useRef(sendMutation.mutateAsync)
  sendFnRef.current = sendMutation.mutateAsync

  const [previewLoading, setPreviewLoading] = useState(false)

  const invalidatePreview = () => {
    previewSeq.current += 1
    setFrozen(null)
    setPreviewError(null)
    setPreviewLoading(false)
    setConfirmOpen(false)
    requestIdRef.current = null
    setUncertainRetry(false)
    setSendError(null)
  }

  const nameById = useMemo(() => new Map(activePlayers.map((p) => [p.id, p.name])), [activePlayers])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const list = q
      ? activePlayers.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.teamName ?? "").toLowerCase().includes(q))
      : activePlayers
    return [...list].sort((a, b) => a.name.localeCompare(b.name))
  }, [activePlayers, search])

  const locked = sending
  const toggle = (id: number) => {
    if (locked) return
    invalidatePreview()
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]))
  }
  const selectFiltered = () => {
    if (locked) return
    invalidatePreview()
    setSelectedIds((ids) => Array.from(new Set([...ids, ...filtered.map((p) => p.id)])))
  }
  const clearSelection = () => {
    if (locked) return
    invalidatePreview()
    setSelectedIds([])
  }
  const changeResend = (v: boolean) => {
    if (locked) return
    invalidatePreview()
    setResend(v)
  }

  const runPreview = async () => {
    if (selectedIds.length === 0 || locked) return
    const seq = ++previewSeq.current
    const playerIds = [...selectedIds].sort((a, b) => a - b)
    const resendAtPreview = resend
    setFrozen(null)
    setPreviewError(null)
    setSendError(null)
    setUncertainRetry(false)
    requestIdRef.current = null
    setPreviewLoading(true)
    try {
      const preview = await previewFnRef.current({ data: { playerIds, resend: resendAtPreview } })
      if (seq !== previewSeq.current) return
      setFrozen({ playerIds, resend: resendAtPreview, preview })
    } catch (err) {
      if (seq !== previewSeq.current) return
      setPreviewError(errMessage(err, "Could not preview invitations"))
    } finally {
      if (seq === previewSeq.current) setPreviewLoading(false)
    }
  }

  const canSend = !!frozen && frozen.preview.eligible > 0 && !previewLoading && !sending

  const doSend = async () => {
    if (!frozen || sendingRef.current) return
    sendingRef.current = true
    setSending(true)
    setSendError(null)
    if (!requestIdRef.current) requestIdRef.current = crypto.randomUUID()
    const requestId = requestIdRef.current
    try {
      const res = await sendFnRef.current({
        data: { playerIds: frozen.playerIds, resend: frozen.resend, previewToken: frozen.preview.previewToken, requestId },
      })
      setResult(res)
      setConfirmOpen(false)
      invalidatePreview()
      onSent()
    } catch (err) {
      const status = errStatus(err)
      if (status === 409) {
        setConfirmOpen(false)
        invalidatePreview()
        setPreviewError("The recipient list changed since this preview. Preview again before sending. Nothing was resent automatically.")
      } else if (status === null || status >= 500) {
        setUncertainRetry(true)
        setSendError(`${errMessage(err, "The send request did not complete")}. Delivery is uncertain. Check Email History before retrying; a retry reuses the same request and will not double-send.`)
      } else {
        setConfirmOpen(false)
        invalidatePreview()
        setPreviewError(errMessage(err, "Could not send invitations"))
      }
    } finally {
      sendingRef.current = false
      setSending(false)
    }
  }

  const p = frozen?.preview
  const eligibleNames = p?.recipients.filter((r) => r.status === "eligible") ?? []
  const excludedPreviouslyInvited = p?.recipients.filter((r) => r.status === "already_invited").length ?? 0

  return (
    <div ref={panelRef} className="bg-blue-50 rounded-2xl border border-blue-200 p-5 space-y-4" data-testid="panel-portal-invitations">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-blue-950">Invite members to the portal</h2>
          <p className="text-sm text-blue-800 mt-1">
            Choose exactly who receives a portal sign-in invitation. Uses the club's standard template; the composer below is not involved.
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white border border-blue-200 text-blue-900 whitespace-nowrap self-start" data-testid="text-portal-selected-count">
          {plural(selectedIds.length, "member")} selected
        </span>
      </div>

      <div className="bg-white rounded-xl border border-border">
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 p-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search active members by name, email or team"
            className="h-8 min-w-0 flex-1 border-0 shadow-none focus-visible:ring-0 px-1"
            data-testid="input-portal-search"
          />
          <button type="button" onClick={selectFiltered} disabled={locked || filtered.length === 0} className="text-xs font-medium text-primary hover:underline whitespace-nowrap disabled:opacity-40" data-testid="button-portal-select-shown">
            Select shown ({filtered.length})
          </button>
          <button type="button" onClick={clearSelection} disabled={locked || selectedIds.length === 0} className="text-xs font-medium text-muted-foreground hover:text-foreground whitespace-nowrap disabled:opacity-40" data-testid="button-portal-clear">
            Clear
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto divide-y divide-border">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4 text-center">No active members match "{search}".</p>
          ) : filtered.map((pl) => {
            const checked = selectedIds.includes(pl.id)
            return (
              <label key={pl.id} className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer hover:bg-muted/30 ${checked ? "bg-primary/5" : ""}`} data-testid={`row-portal-player-${pl.id}`}>
                <input type="checkbox" checked={checked} disabled={locked} onChange={() => toggle(pl.id)} className="accent-[hsl(var(--primary))]" data-testid={`checkbox-portal-player-${pl.id}`} />
                <span className="min-w-0 font-medium text-foreground truncate">{pl.name}</span>
                <span className="text-xs text-muted-foreground truncate hidden sm:inline">{pl.email}</span>
                {pl.teamName && <span className="ml-auto max-w-[35%] truncate text-xs text-muted-foreground">{pl.teamName}</span>}
              </label>
            )
          })}
        </div>
      </div>

      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5" data-testid="list-portal-selected">
          {selectedIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1 text-xs bg-white border border-blue-200 text-blue-900 rounded-full pl-2.5 pr-1 py-0.5">
              {nameById.get(id) ?? `Member #${id}`}
              <button type="button" onClick={() => toggle(id)} disabled={locked} aria-label={`Remove ${nameById.get(id) ?? id}`} className="opacity-60 hover:opacity-100">
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <label className="flex items-start gap-2 text-sm text-blue-950 cursor-pointer">
          <input type="checkbox" checked={resend} disabled={locked} onChange={(e) => changeResend(e.target.checked)} className="mt-0.5 accent-[hsl(var(--primary))]" data-testid="checkbox-portal-resend" />
          <span>
            Resend to members already invited
            <span className="block text-xs text-blue-700">Off by default. Leave off unless someone lost their original email.</span>
          </span>
        </label>
        <Button variant="outline" onClick={runPreview} disabled={selectedIds.length === 0 || previewLoading || locked} className="gap-2 bg-white shrink-0" data-testid="button-portal-preview">
          {previewLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
          {previewLoading ? "Checking recipients…" : "Preview invitation"}
        </Button>
      </div>

      {previewError && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 px-4 py-3 text-sm flex items-start gap-2" data-testid="status-portal-preview-error">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{previewError} Your selection is kept.</span>
        </div>
      )}

      {previewLoading && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-2 animate-pulse">
          <div className="h-3 bg-muted rounded w-1/3" /><div className="h-3 bg-muted rounded w-2/3" /><div className="h-3 bg-muted rounded w-1/2" />
        </div>
      )}

      {p && (
        <div className="bg-white rounded-xl border border-border p-4 space-y-4" data-testid="panel-portal-preview">
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className={`px-2.5 py-1 rounded-full border ${STATUS_STYLE.eligible.cls}`}>{p.eligible} will be sent</span>
            <span className={`px-2.5 py-1 rounded-full border ${STATUS_STYLE.already_invited.cls}`}>{p.alreadyInvited} already invited</span>
            <span className={`px-2.5 py-1 rounded-full border ${STATUS_STYLE.skipped.cls}`}>{p.skipped} skipped</span>
            <span className={`px-2.5 py-1 rounded-full border ${STATUS_STYLE.blocked.cls}`}>{p.blocked} blocked</span>
            <span className="px-2.5 py-1 rounded-full border border-border text-muted-foreground">{p.total} total</span>
          </div>
          <ul className="max-h-56 overflow-y-auto divide-y divide-border border border-border rounded-lg">
            {p.recipients.map((r) => (
              <li key={r.playerId} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm" data-testid={`row-portal-recipient-${r.playerId}`}>
                <span className="font-medium text-foreground">{r.name}</span>
                <span className="text-xs text-muted-foreground">{r.email || "No email"}</span>
                <span className={`ml-auto text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status].cls}`}>{STATUS_STYLE[r.status].label}</span>
                {r.reason && <span className="w-full text-xs text-muted-foreground">{r.reason}{r.previouslyInvited && r.status === "eligible" ? " (resend)" : ""}</span>}
              </li>
            ))}
          </ul>
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Standard portal invitation template</p>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-sm"><span className="text-muted-foreground">Subject:</span> <span className="font-semibold">{p.subject}</span></p>
              <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed max-h-56 overflow-y-auto">{p.body}</div>
              <p className="text-xs text-muted-foreground break-all">Sign-in link: {p.loginUrl}</p>
            </div>
          </div>
          {p.eligible === 0 && <p className="text-sm text-amber-700">Nobody in this selection is eligible to receive an invitation.</p>}
          <div className="flex justify-end">
            <Button onClick={() => setConfirmOpen(true)} disabled={!canSend} className="gap-2" data-testid="button-portal-open-confirm">
              <Send className="w-4 h-4" /> Send to {plural(p.eligible, "member")}
            </Button>
          </div>
        </div>
      )}

      {sendError && !confirmOpen && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-900 px-4 py-3 text-sm flex items-start gap-2" data-testid="status-portal-send-error">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> <span>{sendError}</span>
        </div>
      )}

      {result && (
        <div className={`rounded-xl border px-4 py-3 text-sm ${result.failed + result.uncertain + result.pending > 0 ? "bg-amber-50 border-amber-200 text-amber-900" : "bg-green-50 border-green-200 text-green-900"}`} data-testid="status-portal-result">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-semibold flex items-center gap-1.5"><Mail className="w-4 h-4" /> Latest portal invitation result</p>
              <p className="mt-1">
                {result.sent} sent · {result.failed} failed · {result.uncertain} uncertain · {result.pending} pending · {result.skipped} skipped · {result.alreadyInvited} already invited · {result.blocked} blocked
              </p>
              {result.uncertain + result.pending > 0 && (
                <p className="mt-1 text-xs">Some deliveries are pending or uncertain. Check Email History or the email provider before retrying; the server will not automatically resend to these members.</p>
              )}
              <p className="mt-1 text-xs opacity-80">Selection kept. Preview again before sending another batch.</p>
            </div>
            <button type="button" onClick={() => setResult(null)} className="opacity-60 hover:opacity-100" aria-label="Dismiss result"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <Modal isOpen={confirmOpen} onClose={() => { if (!sending) setConfirmOpen(false) }} title="Send portal invitations">
        {p && frozen && (
          <div className="space-y-4">
            <p className="text-sm text-foreground">
              Send the standard portal invitation to <strong>{plural(p.eligible, "member")}</strong>:
            </p>
            <ul className="max-h-48 overflow-y-auto text-sm border border-border rounded-lg divide-y divide-border">
              {eligibleNames.map((r) => (
                <li key={r.playerId} className="px-3 py-1.5 flex justify-between gap-2"><span className="flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5 text-green-600" />{r.name}</span><span className="text-xs text-muted-foreground truncate">{r.email}</span></li>
              ))}
            </ul>
            <p className={`text-xs font-medium rounded-lg px-3 py-2 border ${frozen.resend ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-blue-50 border-blue-200 text-blue-800"}`}>
              {frozen.resend ? "Resend is ON: previously invited members in this list will be emailed again." : "Resend is OFF: previously invited members will not be emailed again."}
            </p>
            {p.alreadyInvited + p.skipped + p.blocked > 0 && (
              <p className="text-xs text-muted-foreground">{excludedPreviouslyInvited} previously invited, {p.skipped} skipped and {p.blocked} blocked will not be emailed.</p>
            )}
            {sendError && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{sendError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmOpen(false)} disabled={sending}>Cancel</Button>
              <Button onClick={doSend} disabled={sending || p.eligible === 0} className="gap-2" data-testid="button-portal-confirm-send">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Sending invitations…" : uncertainRetry ? "Retry same request" : "Send invitations"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
