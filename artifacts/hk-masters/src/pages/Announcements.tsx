import { useState, useEffect, useCallback, useMemo } from "react"
import { useListTeams, useListPlayers } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, Edit2, Pin, PinOff, Megaphone, Mail, Send, Clock, Users, CheckSquare, ChevronDown, ChevronUp } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getStoredAdminToken } from "@/lib/admin-auth"

type Announcement = {
  id: number
  title: string
  body: string
  teamId: number | null
  teamName: string | null
  pinned: boolean
  createdAt: string
  updatedAt: string
}

type FormState = {
  title: string
  body: string
  teamId: string
  pinned: boolean
}

type EmailBlast = {
  id: number
  subject: string
  audienceType: string
  recipientCount: number
  sentCount: number
  failedCount: number
  sentByEmail: string | null
  sentAt: string
}

type AudienceType = "all" | "teams" | "individuals"

type EmailFormState = {
  audienceType: AudienceType
  teamIds: number[]
  playerIds: number[]
  subject: string
  body: string
}

const EMPTY_EMAIL_FORM: EmailFormState = {
  audienceType: "all",
  teamIds: [],
  playerIds: [],
  subject: "",
  body: "",
}

const EMPTY_FORM: FormState = { title: "", body: "", teamId: "", pinned: false }

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

function audienceLabel(a: EmailBlast) {
  if (a.audienceType === "all") return "All players"
  if (a.audienceType === "teams") return "By squad"
  return "Selected players"
}

export default function Announcements() {
  const { toast } = useToast()
  const { data: teams = [] } = useListTeams()
  const { data: allPlayers = [] } = useListPlayers()

  // Tab state
  const [activeTab, setActiveTab] = useState<"announcements" | "email">("announcements")

  // In-app announcements state
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Email state
  const [emailForm, setEmailForm] = useState<EmailFormState>(EMPTY_EMAIL_FORM)
  const [sending, setSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [playerSearch, setPlayerSearch] = useState("")
  const [blasts, setBlasts] = useState<EmailBlast[]>([])
  const [blastsLoading, setBlastsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/announcements", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load announcements")
      setItems(await res.json())
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const refreshBlasts = useCallback(async () => {
    setBlastsLoading(true)
    try {
      const res = await fetch("/api/players/email-blasts", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load email history")
      setBlasts(await res.json())
    } catch (err) {
      console.error(err)
    } finally {
      setBlastsLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    if (activeTab === "email") refreshBlasts()
  }, [activeTab, refreshBlasts])

  // --- Announcement handlers ---

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm({ title: a.title, body: a.body, teamId: a.teamId ? String(a.teamId) : "", pinned: a.pinned })
    setFormError(null)
    setIsModalOpen(true)
  }

  const handleDelete = async (a: Announcement) => {
    if (!confirm(`Delete "${a.title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/announcements/${a.id}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Announcement deleted" })
      refresh()
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    }
  }

  const togglePin = async (a: Announcement) => {
    try {
      const res = await fetch(`/api/announcements/${a.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ title: a.title, body: a.body, teamId: a.teamId, pinned: !a.pinned }),
      })
      if (!res.ok) throw new Error("Could not update pin")
      refresh()
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        body: form.body.trim(),
        teamId: form.teamId === "" ? null : Number(form.teamId),
        pinned: form.pinned,
      }
      const url = editing ? `/api/announcements/${editing.id}` : "/api/announcements"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Save failed")
      toast({ title: editing ? "Announcement updated" : "Announcement posted" })
      setIsModalOpen(false)
      refresh()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // --- Email handlers ---

  const recipients = useMemo(() => {
    if (emailForm.audienceType === "all") return allPlayers
    if (emailForm.audienceType === "teams") {
      if (emailForm.teamIds.length === 0) return []
      return allPlayers.filter((p) => emailForm.teamIds.includes(p.teamId))
    }
    if (emailForm.audienceType === "individuals") {
      if (emailForm.playerIds.length === 0) return []
      return allPlayers.filter((p) => emailForm.playerIds.includes(p.id))
    }
    return []
  }, [emailForm.audienceType, emailForm.teamIds, emailForm.playerIds, allPlayers])

  const filteredPlayers = useMemo(() => {
    const q = playerSearch.toLowerCase()
    return allPlayers.filter(
      (p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || (p.teamName ?? "").toLowerCase().includes(q)
    )
  }, [allPlayers, playerSearch])

  const toggleTeam = (teamId: number) => {
    setEmailForm((f) => ({
      ...f,
      teamIds: f.teamIds.includes(teamId) ? f.teamIds.filter((id) => id !== teamId) : [...f.teamIds, teamId],
    }))
  }

  const togglePlayer = (playerId: number) => {
    setEmailForm((f) => ({
      ...f,
      playerIds: f.playerIds.includes(playerId) ? f.playerIds.filter((id) => id !== playerId) : [...f.playerIds, playerId],
    }))
  }

  const handleSendEmail = async () => {
    setEmailError(null)
    setSending(true)
    setShowConfirm(false)
    try {
      const payload = {
        audienceType: emailForm.audienceType,
        teamIds: emailForm.audienceType === "teams" ? emailForm.teamIds : undefined,
        playerIds: emailForm.audienceType === "individuals" ? emailForm.playerIds : undefined,
        subject: emailForm.subject.trim(),
        body: emailForm.body.trim(),
      }
      const res = await fetch("/api/players/send-bulk-email", {
        method: "POST",
        headers: authHeaders(),
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Failed to send emails")
      if (data.failed > 0) {
        toast({ title: `Sent to ${data.sent} player${data.sent !== 1 ? "s" : ""} — ${data.failed} failed to deliver`, variant: "destructive" })
      } else {
        toast({ title: `Email sent to ${data.sent} player${data.sent !== 1 ? "s" : ""}` })
      }
      setEmailForm(EMPTY_EMAIL_FORM)
      setPlayerSearch("")
      refreshBlasts()
    } catch (err) {
      const msg = (err as Error).message
      setEmailError(msg)
      toast({ title: msg, variant: "destructive" })
    } finally {
      setSending(false)
    }
  }

  const canSend = emailForm.subject.trim().length > 0 &&
    emailForm.body.trim().length > 0 &&
    recipients.length > 0 &&
    !sending

  return (
    <PageLayout
      title="Announcements"
      description="Post in-app updates or send emails directly to players."
      action={activeTab === "announcements" ? (
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New announcement
        </Button>
      ) : undefined}
    >
      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-muted/50 rounded-xl p-1 w-fit border border-border">
        <button
          onClick={() => setActiveTab("announcements")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "announcements"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Megaphone className="w-4 h-4" /> In-app feed
        </button>
        <button
          onClick={() => setActiveTab("email")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "email"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Mail className="w-4 h-4" /> Email players
        </button>
      </div>

      {/* In-app Announcements Tab */}
      {activeTab === "announcements" && (
        <>
          {loading ? (
            <p className="text-muted-foreground">Loading…</p>
          ) : items.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-10 text-center">
              <Megaphone className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-foreground">No announcements yet</p>
              <p className="text-sm text-muted-foreground mt-1">Click "New announcement" to post your first update.</p>
            </div>
          ) : (
            <ul className="space-y-3">
              {items.map((a) => (
                <li
                  key={a.id}
                  className={`bg-white rounded-xl border p-5 ${a.pinned ? "border-amber-300 ring-1 ring-amber-200" : "border-border"}`}
                >
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.pinned && (
                          <span className="text-xs font-semibold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">📌 Pinned</span>
                        )}
                        <h2 className="text-lg font-semibold text-foreground">{a.title}</h2>
                      </div>
                      <p className="mt-2 text-sm text-foreground whitespace-pre-line">{a.body}</p>
                      <p className="mt-3 text-xs text-muted-foreground">
                        {format(new Date(a.createdAt), "d MMM yyyy 'at' HH:mm")} · {a.teamName ? `For ${a.teamName}` : "All squads"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => togglePin(a)}
                        title={a.pinned ? "Unpin" : "Pin to top"}
                        className="p-1.5 text-muted-foreground hover:text-amber-700 rounded border border-transparent hover:border-amber-200 transition-all"
                      >
                        {a.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => openEdit(a)}
                        title="Edit"
                        className="p-1.5 text-muted-foreground hover:text-blue-600 rounded border border-transparent hover:border-blue-200 transition-all"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(a)}
                        title="Delete"
                        className="p-1.5 text-muted-foreground hover:text-rose-600 rounded border border-transparent hover:border-rose-200 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Email Players Tab */}
      {activeTab === "email" && (
        <div className="space-y-6">
          {/* Composer */}
          <div className="bg-white rounded-2xl border border-border p-6 space-y-5">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" /> Compose email
            </h2>

            {/* Audience */}
            <div className="space-y-3">
              <label className="text-sm font-semibold">Audience</label>
              <div className="flex gap-2 flex-wrap">
                {(["all", "teams", "individuals"] as AudienceType[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setEmailForm((f) => ({ ...f, audienceType: t, teamIds: [], playerIds: [] }))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
                      emailForm.audienceType === t
                        ? "bg-primary text-white border-primary"
                        : "bg-white text-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {t === "all" ? "All players" : t === "teams" ? "By squad" : "Individuals"}
                  </button>
                ))}
              </div>

              {/* Teams selector */}
              {emailForm.audienceType === "teams" && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Select one or more squads:</p>
                  <div className="flex flex-wrap gap-2">
                    {teams.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => toggleTeam(t.id)}
                        className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          emailForm.teamIds.includes(t.id)
                            ? "bg-primary/10 text-primary border-primary/30 font-medium"
                            : "bg-white text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {t.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Individual player selector */}
              {emailForm.audienceType === "individuals" && (
                <div className="space-y-2">
                  <button
                    onClick={() => setShowPlayerPicker((v) => !v)}
                    className="flex items-center gap-2 text-sm text-primary font-medium"
                  >
                    <CheckSquare className="w-4 h-4" />
                    {emailForm.playerIds.length > 0 ? `${emailForm.playerIds.length} player${emailForm.playerIds.length !== 1 ? "s" : ""} selected` : "Select players"}
                    {showPlayerPicker ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  {showPlayerPicker && (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="p-2 border-b border-border bg-muted/30">
                        <Input
                          value={playerSearch}
                          onChange={(e) => setPlayerSearch(e.target.value)}
                          placeholder="Search by name, email, or squad…"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="max-h-52 overflow-y-auto divide-y divide-border">
                        {filteredPlayers.map((p) => (
                          <label
                            key={p.id}
                            className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={emailForm.playerIds.includes(p.id)}
                              onChange={() => togglePlayer(p.id)}
                              className="rounded border-gray-300"
                            />
                            <span className="flex-1 min-w-0">
                              <span className="font-medium">{p.name}</span>
                              <span className="text-muted-foreground ml-2 text-xs truncate">{p.email}</span>
                            </span>
                            {p.teamName && (
                              <span className="text-xs text-muted-foreground shrink-0">{p.teamName}</span>
                            )}
                          </label>
                        ))}
                        {filteredPlayers.length === 0 && (
                          <p className="px-3 py-4 text-sm text-muted-foreground text-center">No players found</p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Subject */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Subject</label>
              <Input
                value={emailForm.subject}
                onChange={(e) => setEmailForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Important update for all players"
                maxLength={300}
              />
            </div>

            {/* Body */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Message</label>
              <Textarea
                value={emailForm.body}
                onChange={(e) => setEmailForm((f) => ({ ...f, body: e.target.value }))}
                placeholder="Write your message here…"
                rows={7}
              />
            </div>

            {/* Recipient preview */}
            {recipients.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/20 p-4">
                <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" /> {recipients.length} recipient{recipients.length !== 1 ? "s" : ""}
                </p>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {recipients.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 text-xs px-1">
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="text-muted-foreground truncate">{p.email}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {emailError && <p className="text-sm text-rose-600">{emailError}</p>}

            <div className="flex justify-end">
              <Button
                onClick={() => setShowConfirm(true)}
                disabled={!canSend}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {sending ? "Sending…" : `Send to ${recipients.length} player${recipients.length !== 1 ? "s" : ""}`}
              </Button>
            </div>
          </div>

          {/* Send history */}
          <div className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              <Clock className="w-4 h-4" /> Send history
            </h2>
            {blastsLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : blasts.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-6 text-center">
                <p className="text-sm text-muted-foreground">No emails sent yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/30 border-b border-border">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Date</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Subject</th>
                      <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Audience</th>
                      <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground">Sent / Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {blasts.map((b) => (
                      <tr key={b.id} className="hover:bg-muted/10">
                        <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                          {format(new Date(b.sentAt), "d MMM yyyy HH:mm")}
                        </td>
                        <td className="px-4 py-3 font-medium max-w-xs truncate">{b.subject}</td>
                        <td className="px-4 py-3 text-muted-foreground">{audienceLabel(b)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className={b.failedCount > 0 ? "text-amber-700" : "text-green-700"}>
                            {b.sentCount}
                          </span>
                          <span className="text-muted-foreground"> / {b.recipientCount}</span>
                          {b.failedCount > 0 && (
                            <span className="ml-2 text-xs text-rose-600">({b.failedCount} failed)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Announcement form modal */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Edit announcement" : "New announcement"}>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Title</label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Training moved to Sunday"
              maxLength={200}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Message</label>
            <Textarea
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Tell the squad what's going on…"
              rows={6}
              required
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Visible to</label>
            <Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">All squads</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.pinned}
              onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
              className="rounded border-gray-300"
            />
            Pin to top of the feed
          </label>
          {formError && <p className="text-sm text-rose-600">{formError}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? "Saving…" : (editing ? "Save changes" : "Post")}</Button>
          </div>
        </form>
      </Modal>

      {/* Send confirmation modal */}
      <Modal isOpen={showConfirm} onClose={() => setShowConfirm(false)} title="Confirm send">
        <div className="space-y-4">
          <p className="text-sm text-foreground">
            You're about to send <strong>"{emailForm.subject}"</strong> to <strong>{recipients.length} player{recipients.length !== 1 ? "s" : ""}</strong>. This cannot be undone.
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 space-y-1">
            {recipients.map((p) => (
              <div key={p.id} className="flex items-center gap-2 text-xs">
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-muted-foreground truncate">{p.email}</span>
              </div>
            ))}
          </div>
          {emailError && <p className="text-sm text-rose-600">{emailError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending} className="gap-2">
              <Send className="w-4 h-4" />
              {sending ? "Sending…" : "Send emails"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
