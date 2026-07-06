import { useState, useEffect, useCallback, useMemo } from "react"
import { useListTeams, useListPlayers } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { TemplateLoader } from "@/components/email/TemplateLoader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { RichTextEditor } from "@/components/RichTextEditor"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, Edit2, Pin, PinOff, Megaphone, Mail, Send, Clock, Users, CheckSquare, ChevronDown, ChevronUp, Paperclip, X, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { useRef } from "react"
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
  sendPush: boolean
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

type BlastRecipient = {
  id: number
  playerId: number | null
  playerName: string
  playerEmail: string
  sent: boolean
  errorMessage: string | null
}

type AudienceType = "all" | "teams" | "individuals"

type EmailFormState = {
  audienceType: AudienceType
  teamIds: number[]
  playerIds: number[]
  subject: string
  body: string
  attachments: File[]
}

const EMPTY_EMAIL_FORM: EmailFormState = {
  audienceType: "all",
  teamIds: [],
  playerIds: [],
  subject: "",
  body: "",
  attachments: [],
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024
const MAX_ATTACHMENTS = 5

const EMPTY_FORM: FormState = { title: "", body: "", teamId: "", pinned: false, sendPush: true }

type WhatsAppFormState = {
  title: string
  body: string
  teamId: string
  alsoPostInApp: boolean
}

const EMPTY_WA_FORM: WhatsAppFormState = { title: "", body: "", teamId: "", alsoPostInApp: false }

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

function audienceLabel(a: EmailBlast) {
  if (a.audienceType === "all") return "All players"
  if (a.audienceType === "teams") return "By squad"
  return "Selected players"
}

// Strip simple HTML tags an announcement body might contain, so the WhatsApp
// message reads as plain text rather than showing raw markup.
function toPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function buildWaShareText(title: string, body: string): string {
  return `*${title}*\n\n${toPlainText(body)}`
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.553 4.117 1.523 5.845L.057 23.428a.5.5 0 00.515.572l5.734-1.503A11.943 11.943 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.686-.511-5.215-1.402l-.374-.22-3.876 1.016 1.034-3.77-.242-.386A9.96 9.96 0 012 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z"/>
    </svg>
  )
}

export default function Announcements() {
  const { toast } = useToast()
  const { data: teams = [] } = useListTeams()
  const { data: allPlayers = [] } = useListPlayers()

  // Tab state
  const [activeTab, setActiveTab] = useState<"announcements" | "email" | "whatsapp">("announcements")

  // In-app announcements state
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // WhatsApp compose state
  const [waForm, setWaForm] = useState<WhatsAppFormState>(EMPTY_WA_FORM)
  const [waSaving, setWaSaving] = useState(false)
  const [waError, setWaError] = useState<string | null>(null)

  // Email state
  const [emailForm, setEmailForm] = useState<EmailFormState>(EMPTY_EMAIL_FORM)
  const [sending, setSending] = useState(false)
  const [emailError, setEmailError] = useState<string | null>(null)
  const [showPlayerPicker, setShowPlayerPicker] = useState(false)
  const [playerSearch, setPlayerSearch] = useState("")
  const [blasts, setBlasts] = useState<EmailBlast[]>([])
  const [blastsLoading, setBlastsLoading] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [expandedBlastId, setExpandedBlastId] = useState<number | null>(null)
  const [blastRecipients, setBlastRecipients] = useState<Record<number, BlastRecipient[]>>({})
  const [blastRecipientsLoading, setBlastRecipientsLoading] = useState<number | null>(null)

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

  const toggleBlastExpanded = useCallback(async (blast: EmailBlast) => {
    if (expandedBlastId === blast.id) {
      setExpandedBlastId(null)
      return
    }
    setExpandedBlastId(blast.id)
    if (blastRecipients[blast.id]) return // already loaded
    if (blast.recipientCount === 0 || blast.sentCount + blast.failedCount === 0) return // no recipient data
    setBlastRecipientsLoading(blast.id)
    try {
      const res = await fetch(`/api/players/email-blasts/${blast.id}/recipients`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load recipients")
      const data: BlastRecipient[] = await res.json()
      setBlastRecipients((prev) => ({ ...prev, [blast.id]: data }))
    } catch (err) {
      console.error(err)
    } finally {
      setBlastRecipientsLoading(null)
    }
  }, [expandedBlastId, blastRecipients])

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
    setForm({ title: a.title, body: a.body, teamId: a.teamId ? String(a.teamId) : "", pinned: a.pinned, sendPush: false })
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

  const handleShareWhatsApp = (a: Announcement) => {
    const text = buildWaShareText(a.title, a.body)
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`
    window.open(waUrl, "_blank", "noopener,noreferrer")
  }

  const handleOpenSquadGroup = async (a: Announcement, groupLink: string) => {
    const text = buildWaShareText(a.title, a.body)
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Message copied — paste it into the squad group" })
    } catch {
      // clipboard unavailable — still open the group so the admin can type it manually
    }
    window.open(groupLink, "_blank", "noopener,noreferrer")
  }

  // --- WhatsApp compose handlers ---

  const waSelectedTeam = waForm.teamId ? teams.find((t) => t.id === Number(waForm.teamId)) : undefined

  const handleShareCompose = async () => {
    const title = waForm.title.trim()
    const body = waForm.body.trim()
    if (!title || !body) {
      setWaError("Title and message are required")
      return
    }
    setWaError(null)
    setWaSaving(true)
    try {
      if (waForm.alsoPostInApp) {
        const res = await fetch("/api/announcements", {
          method: "POST",
          headers: authHeaders(),
          body: JSON.stringify({
            title,
            body,
            teamId: waForm.teamId === "" ? null : Number(waForm.teamId),
            pinned: false,
            sendPush: false,
          }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data?.error || "Failed to post announcement")
        refresh()
      }
      const waUrl = `https://wa.me/?text=${encodeURIComponent(buildWaShareText(title, body))}`
      window.open(waUrl, "_blank", "noopener,noreferrer")
      toast({ title: waForm.alsoPostInApp ? "Posted to in-app feed and opened WhatsApp" : "Opened WhatsApp" })
      setWaForm(EMPTY_WA_FORM)
    } catch (err) {
      setWaError((err as Error).message)
    } finally {
      setWaSaving(false)
    }
  }

  const handleOpenWaSquadGroup = async () => {
    const title = waForm.title.trim()
    const body = waForm.body.trim()
    if (!title || !body || !waSelectedTeam?.whatsappGroupLink) return
    try {
      await navigator.clipboard.writeText(buildWaShareText(title, body))
      toast({ title: "Message copied — paste it into the squad group" })
    } catch {
      // clipboard unavailable — still open the group so the admin can type it manually
    }
    window.open(waSelectedTeam.whatsappGroupLink, "_blank", "noopener,noreferrer")
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
        sendPush: !editing && form.sendPush,
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

  const attachmentInputRef = useRef<HTMLInputElement>(null)

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    e.target.value = ""
    const combined = [...emailForm.attachments, ...picked]
    const oversized = combined.filter((f) => f.size > MAX_ATTACHMENT_SIZE)
    if (oversized.length > 0) {
      toast({ title: `Files must be under 10 MB each (${oversized.map((f) => f.name).join(", ")})`, variant: "destructive" })
      return
    }
    if (combined.length > MAX_ATTACHMENTS) {
      toast({ title: `Maximum ${MAX_ATTACHMENTS} attachments allowed`, variant: "destructive" })
      return
    }
    setEmailForm((f) => ({ ...f, attachments: combined }))
  }

  const removeAttachment = (index: number) => {
    setEmailForm((f) => ({ ...f, attachments: f.attachments.filter((_, i) => i !== index) }))
  }

  const handleSendEmail = async () => {
    setEmailError(null)
    setSending(true)
    setShowConfirm(false)
    try {
      const token = getStoredAdminToken()
      const formData = new FormData()
      formData.append("audienceType", emailForm.audienceType)
      formData.append("subject", emailForm.subject.trim())
      formData.append("body", emailForm.body.trim())
      if (emailForm.audienceType === "teams") {
        formData.append("teamIds", JSON.stringify(emailForm.teamIds))
      }
      if (emailForm.audienceType === "individuals") {
        formData.append("playerIds", JSON.stringify(emailForm.playerIds))
      }
      for (const file of emailForm.attachments) {
        formData.append("attachments", file)
      }
      const headers: Record<string, string> = token ? { "x-session-token": token } : {}
      const res = await fetch("/api/players/send-bulk-email", {
        method: "POST",
        headers,
        body: formData,
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
    emailForm.body.length > 0 &&
    recipients.length > 0 &&
    !sending

  return (
    <PageLayout
      title="Announcements"
      description="Post in-app updates, send emails, or share via WhatsApp."
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
        <button
          onClick={() => setActiveTab("whatsapp")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === "whatsapp"
              ? "bg-white shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <WhatsAppIcon className="w-4 h-4" /> WhatsApp
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
                        onClick={() => handleShareWhatsApp(a)}
                        title="Share to WhatsApp"
                        className="p-1.5 text-muted-foreground hover:text-green-600 rounded border border-transparent hover:border-green-200 transition-all"
                      >
                        <WhatsAppIcon className="w-4 h-4" />
                      </button>
                      {a.teamId && teams.find((t) => t.id === a.teamId)?.whatsappGroupLink && (
                        <button
                          onClick={() => handleOpenSquadGroup(a, teams.find((t) => t.id === a.teamId)!.whatsappGroupLink!)}
                          title="Open squad WhatsApp group (copies the message first)"
                          className="p-1.5 text-muted-foreground hover:text-green-600 rounded border border-transparent hover:border-green-200 transition-all"
                        >
                          <Users className="w-4 h-4" />
                        </button>
                      )}
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

            {/* Templates */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Templates</label>
              <TemplateLoader
                currentSubject={emailForm.subject}
                currentBody={emailForm.body}
                onLoad={(subject, body) => setEmailForm((f) => ({ ...f, subject, body }))}
              />
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
              <RichTextEditor
                value={emailForm.body}
                onChange={(html) => setEmailForm((f) => ({ ...f, body: html }))}
                minHeight={160}
              />
            </div>

            {/* Attachments */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Attachments <span className="font-normal text-muted-foreground">(optional)</span></label>
              {emailForm.attachments.length > 0 && (
                <ul className="space-y-1.5">
                  {emailForm.attachments.map((file, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm bg-muted/30 rounded-lg px-3 py-2 border border-border">
                      <Paperclip className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                      <span className="flex-1 min-w-0 truncate text-foreground">{file.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(i)}
                        className="p-0.5 rounded text-muted-foreground hover:text-rose-600 transition-colors"
                        aria-label="Remove attachment"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {emailForm.attachments.length < MAX_ATTACHMENTS && (
                <button
                  type="button"
                  onClick={() => attachmentInputRef.current?.click()}
                  className="flex items-center gap-2 text-sm text-primary font-medium hover:underline"
                >
                  <Paperclip className="w-4 h-4" />
                  Add file
                </button>
              )}
              <p className="text-xs text-muted-foreground">Up to {MAX_ATTACHMENTS} files, 10 MB each</p>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                className="sr-only"
                onChange={handleAttachmentChange}
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
              <div className="bg-white rounded-xl border border-border overflow-hidden divide-y divide-border">
                {blasts.map((b) => {
                  const isExpanded = expandedBlastId === b.id
                  const isLoadingRecipients = blastRecipientsLoading === b.id
                  const recipients = blastRecipients[b.id] ?? []
                  const failedRecipients = recipients.filter((r) => !r.sent)
                  const sentRecipients = recipients.filter((r) => r.sent)
                  const hasRecipientData = recipients.length > 0
                  return (
                    <div key={b.id}>
                      <button
                        className="w-full text-left hover:bg-muted/10 transition-colors"
                        onClick={() => toggleBlastExpanded(b)}
                      >
                        <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-3 items-center px-4 py-3 text-sm">
                          <div className="text-muted-foreground whitespace-nowrap text-xs">
                            {format(new Date(b.sentAt), "d MMM yyyy HH:mm")}
                          </div>
                          <div className="font-medium truncate">{b.subject}</div>
                          <div className="text-muted-foreground text-xs whitespace-nowrap">{audienceLabel(b)}</div>
                          <div className="text-right whitespace-nowrap">
                            <span className={b.failedCount > 0 ? "text-amber-700" : "text-green-700"}>
                              {b.sentCount}
                            </span>
                            <span className="text-muted-foreground"> / {b.recipientCount}</span>
                            {b.failedCount > 0 && (
                              <span className="ml-2 text-xs text-rose-600">({b.failedCount} failed)</span>
                            )}
                          </div>
                          <div className="text-muted-foreground">
                            {isLoadingRecipients
                              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              : isExpanded
                                ? <ChevronUp className="w-3.5 h-3.5" />
                                : <ChevronDown className="w-3.5 h-3.5" />
                            }
                          </div>
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-border bg-muted/10 px-4 py-3">
                          {isLoadingRecipients ? (
                            <p className="text-xs text-muted-foreground">Loading recipients…</p>
                          ) : !hasRecipientData ? (
                            <p className="text-xs text-muted-foreground italic">No per-recipient data recorded for this blast (sent before tracking was added).</p>
                          ) : (
                            <div className="space-y-3">
                              {failedRecipients.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-rose-600 mb-1.5 flex items-center gap-1">
                                    <XCircle className="w-3.5 h-3.5" /> {failedRecipients.length} failed to deliver
                                  </p>
                                  <div className="space-y-1">
                                    {failedRecipients.map((r) => (
                                      <div key={r.id} className="flex items-center gap-2 text-xs">
                                        <span className="font-medium text-foreground">{r.playerName}</span>
                                        <span className="text-muted-foreground">{r.playerEmail}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {sentRecipients.length > 0 && (
                                <div>
                                  <p className="text-xs font-semibold text-emerald-600 mb-1.5 flex items-center gap-1">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> {sentRecipients.length} delivered
                                  </p>
                                  <div className="space-y-1">
                                    {sentRecipients.map((r) => (
                                      <div key={r.id} className="flex items-center gap-2 text-xs">
                                        <span className="font-medium text-foreground">{r.playerName}</span>
                                        <span className="text-muted-foreground">{r.playerEmail}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* WhatsApp Tab */}
      {activeTab === "whatsapp" && (
        <div className="max-w-xl bg-white rounded-2xl border border-border p-6 space-y-5">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <WhatsAppIcon className="w-4 h-4 text-green-600" /> Compose WhatsApp message
          </h2>
          <p className="text-sm text-muted-foreground -mt-3">
            Write a message and share it straight to WhatsApp. This won't post to the in-app feed unless you check the box below.
          </p>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Title</label>
            <Input
              value={waForm.title}
              onChange={(e) => setWaForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="e.g. Training moved to Sunday"
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Message</label>
            <Textarea
              value={waForm.body}
              onChange={(e) => setWaForm((f) => ({ ...f, body: e.target.value }))}
              placeholder="Tell the squad what's going on…"
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Visible to</label>
            <Select
              value={waForm.teamId}
              onChange={(e) => setWaForm((f) => ({ ...f, teamId: e.target.value }))}
            >
              <option value="">All squads</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={waForm.alsoPostInApp}
              onChange={(e) => setWaForm((f) => ({ ...f, alsoPostInApp: e.target.checked }))}
              className="rounded border-gray-300"
            />
            Also post to in-app feed
          </label>

          {waSelectedTeam?.whatsappGroupLink && (
            <p className="text-xs text-muted-foreground bg-muted/30 border border-border rounded-lg px-3 py-2">
              {waSelectedTeam.name} has a saved WhatsApp group. Use "Open squad group" to copy this message and jump straight there.
            </p>
          )}

          {waError && <p className="text-sm text-rose-600">{waError}</p>}

          <div className="flex flex-wrap gap-2 justify-end pt-1">
            {waSelectedTeam?.whatsappGroupLink && (
              <Button
                type="button"
                variant="outline"
                onClick={handleOpenWaSquadGroup}
                disabled={!waForm.title.trim() || !waForm.body.trim()}
                className="gap-2"
              >
                <Users className="w-4 h-4" /> Open squad group
              </Button>
            )}
            <Button
              onClick={handleShareCompose}
              disabled={waSaving || !waForm.title.trim() || !waForm.body.trim()}
              className="gap-2"
            >
              <WhatsAppIcon className="w-4 h-4" />
              {waSaving ? "Sharing…" : "Share via WhatsApp"}
            </Button>
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
          {!editing && (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.sendPush}
                onChange={(e) => setForm({ ...form, sendPush: e.target.checked })}
                className="rounded border-gray-300"
              />
              Send push notification to subscribed players
            </label>
          )}
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
          {emailForm.attachments.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/10 px-3 py-2 space-y-1">
              <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Paperclip className="w-3.5 h-3.5" /> {emailForm.attachments.length} attachment{emailForm.attachments.length !== 1 ? "s" : ""}
              </p>
              {emailForm.attachments.map((f, i) => (
                <p key={i} className="text-xs text-foreground truncate pl-5">{f.name}</p>
              ))}
            </div>
          )}
          {emailError && <p className="text-sm text-rose-600">{emailError}</p>}
          {sending && (
            <p className="text-xs text-muted-foreground text-center">
              Sending — this may take up to {Math.ceil(recipients.length * 0.6 / 5) * 5} seconds. Please keep this page open.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={sending}>Cancel</Button>
            <Button onClick={handleSendEmail} disabled={sending} className="gap-2">
              <Send className="w-4 h-4" />
              {sending ? `Sending (${recipients.length} emails)…` : "Send emails"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
