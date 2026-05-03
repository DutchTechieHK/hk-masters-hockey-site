import { useState, useEffect, useCallback } from "react"
import { useListTeams } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, Edit2, Pin, PinOff, Megaphone } from "lucide-react"
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

const EMPTY_FORM: FormState = { title: "", body: "", teamId: "", pinned: false }

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token, "Content-Type": "application/json" } : { "Content-Type": "application/json" }
}

export default function Announcements() {
  const { toast } = useToast()
  const { data: teams = [] } = useListTeams()
  const [items, setItems] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

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

  useEffect(() => { refresh() }, [refresh])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEdit = (a: Announcement) => {
    setEditing(a)
    setForm({
      title: a.title,
      body: a.body,
      teamId: a.teamId ? String(a.teamId) : "",
      pinned: a.pinned,
    })
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
        body: JSON.stringify({
          title: a.title,
          body: a.body,
          teamId: a.teamId,
          pinned: !a.pinned,
        }),
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

  return (
    <PageLayout
      title="Announcements"
      description="Post updates that players see in the app, scoped to a single squad or all squads."
      action={
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" /> New announcement
        </Button>
      }
    >
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
    </PageLayout>
  )
}
