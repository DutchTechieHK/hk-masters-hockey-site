import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { getStoredAdminToken } from "@/lib/admin-auth"

export type EventReplyVersion = {
  id: number; revision: number; status: "yes" | "maybe" | "no"; note: string | null
}
export type EventReplyEdit = {
  playerId: number; playerName: string; original: EventReplyVersion | null
}

export default function EventRsvpEditor({ eventId, editing, onSaved, onConflict, onCancel }: {
  eventId: number
  editing: EventReplyEdit
  onSaved: () => void
  onConflict: () => void
  onCancel: () => void
}) {
  const [status, setStatus] = useState<"yes" | "maybe" | "no" | "clear">(editing.original?.status ?? "yes")
  const [note, setNote] = useState(editing.original?.note ?? "")
  const [confirm, setConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const panel = useRef<HTMLElement>(null)
  useEffect(() => { panel.current?.scrollIntoView({ block: "nearest" }) }, [])

  const save = async () => {
    if (saving) return
    if ((status === "maybe" || status === "no") && !note.trim()) {
      setError("A reason is required for Maybe or Not going.")
      return
    }
    if (editing.original && !confirm) { setConfirm(true); return }
    setSaving(true)
    setError("")
    try {
      const token = getStoredAdminToken()
      const response = await fetch(`/api/events/${eventId}/rsvps/${editing.playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) },
        body: JSON.stringify({
          status: status === "clear" ? null : status,
          note: status === "yes" || status === "clear" ? null : note.trim(),
          expected: editing.original ? { id: editing.original.id, revision: editing.original.revision } : null,
        }),
      })
      if (response.status === 409) { onConflict(); return }
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error ?? "Could not save the reply")
      }
      onSaved()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section ref={panel} className="space-y-3 rounded-lg border border-primary/30 bg-primary/5 p-3" aria-label={`Edit reply for ${editing.playerName}`}>
      <h4 className="font-semibold text-sm">{editing.original ? "Edit reply" : "Record reply"} · {editing.playerName}</h4>
      <p className="text-xs text-muted-foreground">Saved as an admin correction. This updates RSVP availability, not physical attendance, and does not send an email.</p>
      <label className="block text-sm">Reply
        <select className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2" value={status}
          disabled={saving} onChange={(e) => { setStatus(e.target.value as typeof status); setConfirm(false); setError("") }}>
          <option value="yes">Going</option>
          <option value="maybe">Maybe</option>
          <option value="no">Not going</option>
          {editing.original && <option value="clear">Clear reply (no response)</option>}
        </select>
      </label>
      {(status === "maybe" || status === "no") && (
        <label className="block text-sm">Reason
          <textarea className="mt-1 w-full rounded-md border border-border bg-white px-3 py-2" rows={2} maxLength={2000}
            required disabled={saving} value={note} onChange={(e) => { setNote(e.target.value); setConfirm(false) }} />
        </label>
      )}
      {confirm && <p className="text-sm text-amber-800" role="status">
        Confirm replacing {editing.playerName}'s existing reply{status === "clear" ? " with no response" : ""}?
      </p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={save} disabled={saving}>
          {saving ? "Saving…" : confirm ? "Confirm change" : editing.original ? "Review change" : "Save reply"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={saving}>Cancel</Button>
      </div>
    </section>
  )
}
