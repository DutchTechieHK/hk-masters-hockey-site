import { useState, useEffect, useCallback } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import {
  Plus, Trash2, BarChart2, Mail, Link2, Lock, Unlock, Users, ChevronDown, ChevronUp, Loader2, CheckCircle2, Pencil, BellRing
} from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getStoredAdminToken } from "@/lib/admin-auth"

const PUBLIC_URL = import.meta.env.VITE_PUBLIC_URL || "https://www.hkmastershockey.com"

type PollOption = {
  id: number
  pollId: number
  label: string
  sortOrder: number
  voteCount: number
  voters?: { playerName: string; playerEmail: string }[]
}

type Poll = {
  id: number
  title: string
  description: string | null
  audience: string
  allowMultiple: boolean
  deadline: string | null
  closedAt: string | null
  createdAt: string
  options: PollOption[]
  totalEligible?: number
  totalVoted?: number
  nonResponders?: { id: number; name: string; email: string; accessToken: string | null }[]
}

type CreateForm = {
  title: string
  description: string
  audience: string
  allowMultiple: boolean
  deadline: string
  options: string[]
}

const EMPTY_FORM: CreateForm = {
  title: "",
  description: "",
  audience: "all",
  allowMultiple: false,
  deadline: "",
  options: ["", ""],
}

const AUDIENCES = [
  { value: "all", label: "All players" },
  { value: "MO40", label: "MO40 only" },
  { value: "MO50", label: "MO50 only" },
  { value: "both", label: "MO40 + MO50" },
]

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

function ProgressBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
      <div className="h-2 rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}

function AudienceBadge({ audience }: { audience: string }) {
  const map: Record<string, string> = { all: "All players", MO40: "MO40", MO50: "MO50", both: "MO40 + MO50" }
  return (
    <span className="text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
      {map[audience] ?? audience}
    </span>
  )
}

export default function Polls() {
  const { toast } = useToast()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [detailLoading, setDetailLoading] = useState<number | null>(null)
  const [detailData, setDetailData] = useState<Record<number, Poll>>({})
  const [emailing, setEmailing] = useState<number | null>(null)
  const [pushing, setPushing] = useState<number | null>(null)
  const [reminding, setReminding] = useState<number | null>(null)
  const [closing, setClosing] = useState<number | null>(null)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [editForm, setEditForm] = useState<CreateForm>(EMPTY_FORM)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/polls", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load polls")
      setPolls(await res.json())
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { refresh() }, [refresh])

  const loadDetail = useCallback(async (id: number) => {
    if (detailData[id]) return
    setDetailLoading(id)
    try {
      const res = await fetch(`/api/polls/${id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load poll detail")
      const data: Poll = await res.json()
      setDetailData(prev => ({ ...prev, [id]: data }))
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setDetailLoading(null)
    }
  }, [detailData, toast])

  const toggleExpand = (poll: Poll) => {
    if (expandedId === poll.id) {
      setExpandedId(null)
    } else {
      setExpandedId(poll.id)
      loadDetail(poll.id)
    }
  }

  const refreshDetail = async (id: number) => {
    try {
      const res = await fetch(`/api/polls/${id}`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to reload")
      const data: Poll = await res.json()
      setDetailData(prev => ({ ...prev, [id]: data }))
    } catch { /* ignore */ }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const labels = form.options.map(o => o.trim()).filter(Boolean)
      const payload = {
        title: form.title.trim(),
        description: form.description.trim() || null,
        audience: form.audience,
        allowMultiple: form.allowMultiple,
        deadline: form.deadline || null,
        options: labels,
      }
      const res = await fetch("/api/polls", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to create poll")
      toast({ title: "Poll created" })
      setIsCreateOpen(false)
      setForm(EMPTY_FORM)
      refresh()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleClose = async (poll: Poll) => {
    setClosing(poll.id)
    try {
      const res = await fetch(`/api/polls/${poll.id}/close`, { method: "PATCH", headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to update poll")
      toast({ title: poll.closedAt ? "Poll reopened" : "Poll closed" })
      refresh()
      if (expandedId === poll.id) {
        setDetailData(prev => { const n = { ...prev }; delete n[poll.id]; return n })
        loadDetail(poll.id)
      }
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setClosing(null)
    }
  }

  const handleDelete = async (poll: Poll) => {
    if (!confirm(`Delete poll "${poll.title}"? This cannot be undone.`)) return
    setDeleting(poll.id)
    try {
      const res = await fetch(`/api/polls/${poll.id}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to delete poll")
      toast({ title: "Poll deleted" })
      if (expandedId === poll.id) setExpandedId(null)
      refresh()
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setDeleting(null)
    }
  }

  const handleEmail = async (poll: Poll) => {
    const aud = AUDIENCES.find(a => a.value === poll.audience)?.label ?? poll.audience
    if (!confirm(`Send the poll link to ${aud}? Each player will receive a personalised email.`)) return
    setEmailing(poll.id)
    try {
      const res = await fetch(`/api/polls/${poll.id}/email`, { method: "POST", headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to send emails")
      toast({ title: `Emails sent to ${data.sent} player${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}` })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setEmailing(null)
    }
  }

  const handlePush = async (poll: Poll) => {
    const aud = AUDIENCES.find(a => a.value === poll.audience)?.label ?? poll.audience
    if (!confirm(`Send a push notification to ${aud} who have notifications enabled? The notification will link directly to the poll.`)) return
    setPushing(poll.id)
    try {
      const res = await fetch(`/api/polls/${poll.id}/push`, { method: "POST", headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to send push notifications")
      if (data.total === 0) {
        toast({ title: "No players have push notifications enabled yet" })
      } else {
        toast({ title: `Push sent to ${data.sent} of ${data.total} subscribed player${data.total !== 1 ? "s" : ""}` })
      }
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setPushing(null)
    }
  }

  const handleRemind = async (poll: Poll, nonResponderCount: number) => {
    if (!confirm(`Send a reminder to ${nonResponderCount} player${nonResponderCount !== 1 ? "s" : ""} who haven't voted yet?`)) return
    setReminding(poll.id)
    try {
      const res = await fetch(`/api/polls/${poll.id}/remind`, { method: "POST", headers: authHeaders() })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to send reminders")
      toast({ title: `Reminder sent to ${data.sent} player${data.sent !== 1 ? "s" : ""}${data.failed > 0 ? ` (${data.failed} failed)` : ""}` })
      await refreshDetail(poll.id)
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setReminding(null)
    }
  }

  const openEdit = (poll: Poll) => {
    setEditingPoll(poll)
    const deadlineValue = poll.deadline
      ? format(new Date(poll.deadline), "yyyy-MM-dd'T'HH:mm")
      : ""
    setEditForm({
      title: poll.title,
      description: poll.description ?? "",
      audience: poll.audience,
      allowMultiple: poll.allowMultiple,
      deadline: deadlineValue,
      options: poll.options.map(o => o.label),
    })
    setEditError(null)
    setIsEditOpen(true)
  }

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingPoll) return
    setEditError(null)
    setEditSaving(true)
    try {
      const hasVotes = editingPoll.options.reduce((s, o) => s + o.voteCount, 0) > 0
      const payload: Record<string, unknown> = {
        title: editForm.title.trim(),
        description: editForm.description.trim() || null,
        audience: editForm.audience,
        deadline: editForm.deadline || null,
      }
      if (!hasVotes) {
        const labels = editForm.options.map(o => o.trim()).filter(Boolean)
        payload.options = labels
      }
      const res = await fetch(`/api/polls/${editingPoll.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to update poll")
      toast({ title: "Poll updated" })
      setIsEditOpen(false)
      setEditingPoll(null)
      // Clear cached detail so it reloads fresh
      setDetailData(prev => { const n = { ...prev }; delete n[editingPoll.id]; return n })
      refresh()
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setEditSaving(false)
    }
  }

  const copyLink = (poll: Poll) => {
    const url = `${PUBLIC_URL}/polls/${poll.id}`
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied — players need their personal ?t= token from email" })
    }).catch(() => {
      toast({ title: url })
    })
  }

  const setOption = (i: number, val: string) => {
    setForm(f => { const opts = [...f.options]; opts[i] = val; return { ...f, options: opts } })
  }
  const addOption = () => {
    if (form.options.length >= 5) return
    setForm(f => ({ ...f, options: [...f.options, ""] }))
  }
  const removeOption = (i: number) => {
    if (form.options.length <= 2) return
    setForm(f => { const opts = [...f.options]; opts.splice(i, 1); return { ...f, options: opts } })
  }

  return (
    <PageLayout
      title="Polls"
      description="Create scheduling polls and collect responses from players."
      action={
        <Button onClick={() => { setForm(EMPTY_FORM); setFormError(null); setIsCreateOpen(true) }} className="gap-2">
          <Plus className="w-4 h-4" /> New poll
        </Button>
      }
    >
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : polls.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <BarChart2 className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">No polls yet</p>
          <p className="text-sm text-muted-foreground mt-1">Click "New poll" to create your first scheduling poll.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {polls.map(poll => {
            const isExpanded = expandedId === poll.id
            const detail = detailData[poll.id]
            const isClosed = !!poll.closedAt
            const isPastDeadline = poll.deadline && new Date() > new Date(poll.deadline)
            const totalVotes = poll.options.reduce((s, o) => s + o.voteCount, 0)
            const uniqueVoters = detail?.totalVoted ?? null

            return (
              <div key={poll.id} className={`bg-white rounded-xl border ${isClosed ? "border-gray-200 opacity-80" : "border-border"} overflow-hidden`}>
                {/* Header row */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <AudienceBadge audience={poll.audience} />
                        {poll.allowMultiple && (
                          <span className="text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">Multi-choice</span>
                        )}
                        {isClosed && (
                          <span className="text-xs font-medium bg-gray-100 text-gray-600 border border-gray-200 px-2 py-0.5 rounded-full">Closed</span>
                        )}
                        {!isClosed && isPastDeadline && (
                          <span className="text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">Past deadline</span>
                        )}
                      </div>
                      <h2 className="text-lg font-semibold text-foreground">{poll.title}</h2>
                      {poll.description && <p className="text-sm text-muted-foreground mt-0.5">{poll.description}</p>}
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-xs text-muted-foreground">
                        <span>Created {format(new Date(poll.createdAt), "d MMM yyyy")}</span>
                        {poll.deadline && <span>· Deadline {format(new Date(poll.deadline), "d MMM yyyy HH:mm")}</span>}
                        <span>· {totalVotes} vote{totalVotes !== 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                      <button
                        onClick={() => openEdit(poll)}
                        disabled={totalVotes > 0}
                        title={totalVotes > 0 ? "Cannot edit — votes have already been cast" : "Edit poll"}
                        className="p-1.5 text-muted-foreground hover:text-emerald-600 rounded border border-transparent hover:border-emerald-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-muted-foreground disabled:hover:border-transparent"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => copyLink(poll)}
                        title="Copy poll link"
                        className="p-1.5 text-muted-foreground hover:text-primary rounded border border-transparent hover:border-border transition-all"
                      >
                        <Link2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEmail(poll)}
                        disabled={emailing === poll.id}
                        title="Email poll to players"
                        className="p-1.5 text-muted-foreground hover:text-blue-600 rounded border border-transparent hover:border-blue-200 transition-all disabled:opacity-50"
                      >
                        {emailing === poll.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handlePush(poll)}
                        disabled={pushing === poll.id}
                        title="Push notification to players"
                        className="p-1.5 text-muted-foreground hover:text-violet-600 rounded border border-transparent hover:border-violet-200 transition-all disabled:opacity-50"
                      >
                        {pushing === poll.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <BellRing className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleClose(poll)}
                        disabled={closing === poll.id}
                        title={isClosed ? "Reopen poll" : "Close poll"}
                        className="p-1.5 text-muted-foreground hover:text-amber-600 rounded border border-transparent hover:border-amber-200 transition-all disabled:opacity-50"
                      >
                        {closing === poll.id ? <Loader2 className="w-4 h-4 animate-spin" /> : isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => handleDelete(poll)}
                        disabled={deleting === poll.id}
                        title="Delete poll"
                        className="p-1.5 text-muted-foreground hover:text-rose-600 rounded border border-transparent hover:border-rose-200 transition-all disabled:opacity-50"
                      >
                        {deleting === poll.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Quick results bar */}
                  <div className="mt-4 space-y-2">
                    {poll.options.map(opt => {
                      const pct = totalVotes > 0 ? Math.round((opt.voteCount / totalVotes) * 100) : 0
                      return (
                        <div key={opt.id}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-foreground font-medium truncate mr-2">{opt.label}</span>
                            <span className="text-muted-foreground shrink-0">{opt.voteCount} ({pct}%)</span>
                          </div>
                          <ProgressBar value={opt.voteCount} max={totalVotes} />
                        </div>
                      )
                    })}
                  </div>

                  {/* Expand toggle */}
                  <button
                    onClick={() => toggleExpand(poll)}
                    className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {detailLoading === poll.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    {isExpanded ? "Hide details" : "Show voters & non-responders"}
                  </button>
                </div>

                {/* Expanded detail */}
                {isExpanded && detail && (
                  <div className="border-t border-border bg-gray-50/60 p-5 space-y-6">
                    {/* Summary */}
                    <div className="flex items-center gap-4 text-sm flex-wrap">
                      <div className="flex items-center gap-1.5 text-foreground">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span><strong>{detail.totalVoted}</strong> voted</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-foreground">
                        <Users className="w-4 h-4 text-muted-foreground" />
                        <span><strong>{detail.totalEligible}</strong> eligible</span>
                      </div>
                      <button
                        onClick={() => refreshDetail(poll.id)}
                        className="text-xs text-primary hover:underline ml-auto"
                      >
                        Refresh
                      </button>
                    </div>

                    {/* Voters per option */}
                    <div className="space-y-4">
                      <h3 className="text-sm font-semibold text-foreground">Responses by option</h3>
                      {detail.options.map(opt => (
                        <div key={opt.id} className="bg-white rounded-lg border border-border p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-sm">{opt.label}</span>
                            <span className="text-xs text-muted-foreground">{opt.voteCount} vote{opt.voteCount !== 1 ? "s" : ""}</span>
                          </div>
                          {opt.voters && opt.voters.length > 0 ? (
                            <ul className="space-y-1">
                              {opt.voters.map((v, i) => (
                                <li key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                                  <span className="w-1.5 h-1.5 rounded-full bg-primary/40 shrink-0" />
                                  <span className="font-medium text-foreground">{v.playerName}</span>
                                  <span>·</span>
                                  <span>{v.playerEmail}</span>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground">No votes for this option yet.</p>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Non-responders */}
                    {detail.nonResponders && detail.nonResponders.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-foreground">
                            Non-responders ({detail.nonResponders.length})
                          </h3>
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8"
                            disabled={reminding === poll.id}
                            onClick={() => handleRemind(poll, detail.nonResponders!.length)}
                          >
                            {reminding === poll.id
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : <BellRing className="w-3.5 h-3.5" />
                            }
                            Remind {detail.nonResponders.length} player{detail.nonResponders.length !== 1 ? "s" : ""} who haven't voted
                          </Button>
                        </div>
                        <div className="bg-white rounded-lg border border-border divide-y divide-border">
                          {detail.nonResponders.map(p => (
                            <div key={p.id} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-medium text-foreground">{p.name}</p>
                                <p className="text-xs text-muted-foreground">{p.email}</p>
                              </div>
                              {p.accessToken && (
                                <a
                                  href={`${PUBLIC_URL}/polls/${poll.id}?t=${p.accessToken}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline shrink-0"
                                >
                                  Vote link ↗
                                </a>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {detail.nonResponders?.length === 0 && (
                      <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-4 py-3">
                        <CheckCircle2 className="w-4 h-4" />
                        Everyone has responded!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Edit modal */}
      {editingPoll && (
        <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Edit poll">
          {(() => {
            const hasVotes = editingPoll.options.reduce((s, o) => s + o.voteCount, 0) > 0
            return (
              <form onSubmit={handleEdit} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Question / Title *</label>
                  <Input
                    value={editForm.title}
                    onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g. Which training weekend works for you?"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
                  <Textarea
                    value={editForm.description}
                    onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="Add context or instructions for players…"
                    rows={2}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-semibold">
                    Options <span className="text-muted-foreground font-normal">(2–5)</span>
                    {hasVotes && <span className="ml-2 text-xs font-normal text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Locked — votes exist</span>}
                  </label>
                  <div className="space-y-2">
                    {editForm.options.map((opt, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={opt}
                          onChange={e => {
                            const opts = [...editForm.options]; opts[i] = e.target.value
                            setEditForm(f => ({ ...f, options: opts }))
                          }}
                          placeholder={`Option ${i + 1}`}
                          disabled={hasVotes}
                        />
                        {!hasVotes && editForm.options.length > 2 && (
                          <button
                            type="button"
                            onClick={() => {
                              const opts = [...editForm.options]; opts.splice(i, 1)
                              setEditForm(f => ({ ...f, options: opts }))
                            }}
                            className="text-muted-foreground hover:text-rose-600 px-1"
                          >×</button>
                        )}
                      </div>
                    ))}
                    {!hasVotes && editForm.options.length < 5 && (
                      <button
                        type="button"
                        onClick={() => setEditForm(f => ({ ...f, options: [...f.options, ""] }))}
                        className="text-sm text-primary hover:underline"
                      >+ Add option</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Audience</label>
                    <select
                      value={editForm.audience}
                      onChange={e => setEditForm(f => ({ ...f, audience: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    >
                      {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold">Deadline <span className="text-muted-foreground font-normal">(optional)</span></label>
                    <Input
                      type="datetime-local"
                      value={editForm.deadline}
                      onChange={e => setEditForm(f => ({ ...f, deadline: e.target.value }))}
                    />
                  </div>
                </div>

                {editError && (
                  <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{editError}</p>
                )}

                <div className="flex justify-end gap-3 pt-1">
                  <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancel</Button>
                  <Button type="submit" disabled={editSaving}>
                    {editSaving ? "Saving…" : "Save changes"}
                  </Button>
                </div>
              </form>
            )
          })()}
        </Modal>
      )}

      {/* Create modal */}
      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Create new poll">
        <form onSubmit={handleCreate} className="space-y-5">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Question / Title *</label>
            <Input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Which training weekend works for you?"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Textarea
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Add context or instructions for players…"
              rows={2}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Options <span className="text-muted-foreground font-normal">(2–5)</span></label>
            <div className="space-y-2">
              {form.options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={e => setOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                  />
                  {form.options.length > 2 && (
                    <button type="button" onClick={() => removeOption(i)} className="text-muted-foreground hover:text-rose-600 px-1">
                      ×
                    </button>
                  )}
                </div>
              ))}
              {form.options.length < 5 && (
                <button type="button" onClick={addOption} className="text-sm text-primary hover:underline">
                  + Add option
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Audience</label>
              <select
                value={form.audience}
                onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {AUDIENCES.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Deadline <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Input
                type="datetime-local"
                value={form.deadline}
                onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <input
              id="allow-multiple"
              type="checkbox"
              checked={form.allowMultiple}
              onChange={e => setForm(f => ({ ...f, allowMultiple: e.target.checked }))}
              className="rounded border-input"
            />
            <label htmlFor="allow-multiple" className="text-sm">Allow multiple selections</label>
          </div>

          {formError && (
            <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{formError}</p>
          )}

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create poll"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
