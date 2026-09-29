import { useEffect, useState } from "react"
import type { Match } from "@workspace/api-client-react"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Person = { playerId: number; playerName: string; shirtNumber: number | null }
type Reply = Person & { id: number; revision: number; source: string; status: string; note: string | null; respondedAt: string }
type Change = {
  playerId: number; actor: string; changedAt: string
  previousStatus: string | null; previousNote: string | null
  newStatus: string | null; newNote: string | null
}
type Attendance = {
  counts: { yes: number; maybe: number; no: number; noResponse: number; invited: number }
  responses: Reply[]
  noResponse: Person[]
  history: Change[]
}
type ReminderResult = {
  sent: number; total: number; skippedNoEmail: number; skippedAlreadySent: number
  skippedUncertain: number; skippedChanged: number
  failed: number; historyRecorded: boolean
}

const statuses = [
  { key: "yes", label: "Going" },
  { key: "maybe", label: "Maybe" },
  { key: "no", label: "Not going" },
] as const

export default function MatchAttendanceModal({ match, token, onClose, onChanged }: {
  match: Match; token: string; onClose: () => void; onChanged: () => void
}) {
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [reminderError, setReminderError] = useState("")
  const [result, setResult] = useState<ReminderResult | null>(null)
  const [editing, setEditing] = useState<{ person: Person; original: Reply | null } | null>(null)
  const [editStatus, setEditStatus] = useState<"yes" | "maybe" | "no" | "clear">("yes")
  const [editNote, setEditNote] = useState("")
  const [confirmEdit, setConfirmEdit] = useState(false)
  const [editError, setEditError] = useState("")
  const [saving, setSaving] = useState(false)
  const canEdit = match.status !== "cancelled"

  const startEdit = (person: Person, original: Reply | null) => {
    setEditing({ person, original })
    setEditStatus((original?.status as "yes" | "maybe" | "no") ?? "yes")
    setEditNote(original?.note ?? "")
    setConfirmEdit(false)
    setEditError("")
  }

  const saveEdit = async () => {
    if (!editing || saving) return
    if (editStatus !== "yes" && editStatus !== "clear" && !editNote.trim()) {
      setEditError("A reason is required for Maybe or Not going.")
      return
    }
    if (editing.original && !confirmEdit) { setConfirmEdit(true); return }
    setSaving(true)
    setEditError("")
    try {
      const response = await fetch(`/api/matches/${match.id}/rsvps/${editing.person.playerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", "x-session-token": token },
        body: JSON.stringify({
          status: editStatus === "clear" ? null : editStatus,
          note: editStatus === "yes" || editStatus === "clear" ? null : editNote.trim(),
          expected: editing.original ? { id: editing.original.id, revision: editing.original.revision } : null,
        }),
      })
      if (!response.ok) {
        const data = await response.json().catch(() => ({})) as { error?: string }
        if (response.status === 409) {
          const fresh = await fetch(`/api/matches/${match.id}/rsvps`, { headers: { "x-session-token": token } })
          if (fresh.ok) setAttendance(await fresh.json() as Attendance)
          setConfirmEdit(false)
        }
        throw new Error(data.error ?? "Could not save attendance")
      }
      onChanged()
      const fresh = await fetch(`/api/matches/${match.id}/rsvps`, { headers: { "x-session-token": token } })
      if (!fresh.ok) throw new Error("Saved, but could not refresh the roster. Close and reopen attendance.")
      setAttendance(await fresh.json() as Attendance)
      setEditing(null)
    } catch (err) {
      setEditError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const editAction = (person: Person, original: Reply | null) => canEdit && (
    <Button type="button" size="sm" variant="outline" onClick={() => startEdit(person, original)}
      disabled={saving} aria-label={`${original ? "Edit" : "Record"} attendance for ${person.playerName}`}>
      {original ? "Edit" : "Record reply"}
    </Button>
  )

  const remind = async () => {
    if (sending || !attendance?.noResponse.length) return
    setSending(true)
    setReminderError("")
    setConfirming(false)
    try {
      const response = await fetch(`/api/matches/${match.id}/rsvps/remind`, {
        method: "POST", headers: { "x-session-token": token },
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not send match reminders")
      setResult(data as ReminderResult)
      const roster = await fetch(`/api/matches/${match.id}/rsvps`, {
        headers: { "x-session-token": token },
      })
      if (roster.ok) setAttendance(await roster.json() as Attendance)
    } catch (err) {
      setReminderError((err as Error).message)
    } finally {
      setSending(false)
    }
  }
  const canRemind = match.status === "scheduled" &&
    new Date(match.kickoffAt).getTime() > Date.now() && attendance?.noResponse.length

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/matches/${match.id}/rsvps`, {
      headers: { "x-session-token": token },
      signal: controller.signal,
    }).then(async (response) => {
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Could not load match attendance")
      }
      return response.json() as Promise<Attendance>
    }).then(setAttendance).catch((err: Error) => {
      if (!controller.signal.aborted) setError(err.message)
    })
    return () => controller.abort()
  }, [match.id, token])

  return (
    <Modal isOpen onClose={onClose} title={`Attendance · HK Masters vs ${match.opponent}`}>
      <div className="max-h-[70vh] overflow-y-auto space-y-5">
        <p className="text-sm text-muted-foreground">
          {new Date(match.kickoffAt).toLocaleString("en-GB", {
            weekday: "short", day: "numeric", month: "long", year: "numeric",
            hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Hong_Kong",
          })} HKT
        </p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!attendance && !error && <p className="text-sm text-muted-foreground">Loading attendance…</p>}
        {attendance && (
          <>
            {match.status === "cancelled" && <p className="text-sm text-muted-foreground">Cancelled match replies are read-only.</p>}
            <p className="text-sm font-medium">
              {attendance.counts.invited} squad members · {attendance.counts.yes} going ·{" "}
              {attendance.counts.maybe} maybe · {attendance.counts.no} not going ·{" "}
              {attendance.counts.noResponse} no reply
            </p>
            {statuses.map(({ key, label }) => {
              const replies = attendance.responses.filter((response) => response.status === key)
              return (
                <section key={key}>
                  <h3 className="text-sm font-semibold mb-2"><Badge variant="outline">{label} · {replies.length}</Badge></h3>
                  {replies.length ? (
                    <ul className="divide-y divide-border border border-border rounded-lg">
                      {replies.map((reply) => (
                         <li key={reply.playerId} className="px-3 py-2 text-sm">
                           <div className="flex items-center justify-between gap-3">
                             <span className="font-medium">{reply.shirtNumber != null ? `#${reply.shirtNumber} · ` : ""}{reply.playerName}</span>
                             {editAction(reply, reply)}
                           </div>
                          {reply.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{reply.note}</p>}
                           {reply.source === "admin" && <p className="text-xs text-muted-foreground mt-1">
                             Admin correction by {attendance.history.filter((h) => h.playerId === reply.playerId).at(-1)?.actor ?? "Admin"}
                           </p>}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="text-xs text-muted-foreground">No replies</p>}
                </section>
              )
            })}
            <section>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold">No reply yet · {attendance.noResponse.length}</h3>
                {canRemind && !result && !confirming && (
                  <Button type="button" size="sm" onClick={() => setConfirming(true)} disabled={sending}>
                    Remind nonresponders
                  </Button>
                )}
              </div>
              {confirming && (
                <div className="rounded-lg border border-border p-3 mb-3 text-sm space-y-2">
                  <p>Send an email reminder to eligible players who have not replied to this match? Players without an email address, already reminded, or with an uncertain earlier delivery will be skipped.</p>
                  <p className="text-xs text-muted-foreground">The recipient list is checked again when you send.</p>
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={remind} disabled={sending}>Send reminders</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
                  </div>
                </div>
              )}
              {sending && <p role="status" className="text-sm">Sending reminders…</p>}
              {reminderError && <p role="alert" className="text-sm text-destructive">{reminderError}</p>}
              {result && (
                <div role="status" className={`rounded-lg border p-3 mb-3 text-sm ${result.failed || !result.historyRecorded ? "text-destructive border-destructive" : "border-border"}`}>
                  {result.sent} sent · {result.skippedNoEmail} without email · {result.skippedAlreadySent} already reminded · {result.failed} failed or uncertain.
                  {(result.failed > 0 || result.skippedUncertain > 0) && <p>{result.skippedUncertain} earlier deliveries remain uncertain. Check Email History and confirm delivery before any manual retry; uncertain deliveries are not resent automatically.</p>}
                  {result.skippedChanged > 0 && <p>{result.skippedChanged} skipped because the match or player eligibility changed during sending.</p>}
                  {!result.historyRecorded && <p>Delivery history could not be fully saved. Do not resend solely to create a history entry.</p>}
                </div>
              )}
              {attendance.noResponse.length ? (
                <ul className="divide-y divide-border border border-border rounded-lg">
                  {attendance.noResponse.map((person) => (
                     <li key={person.playerId} className="px-3 py-2 text-sm flex items-center justify-between gap-3">
                       <span>{person.shirtNumber != null ? `#${person.shirtNumber} · ` : ""}{person.playerName}</span>
                       {editAction(person, null)}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">Everyone has replied.</p>}
            </section>
            {editing && (
              <section className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3" aria-label={`Edit attendance for ${editing.person.playerName}`}>
                <h3 className="font-semibold text-sm">{editing.original ? "Correct" : "Record"} reply · {editing.person.playerName}</h3>
                {editing.original && <p className="text-xs text-muted-foreground">Current reply: {statuses.find((s) => s.key === editing.original?.status)?.label} {editing.original.note ? `· ${editing.original.note}` : ""}</p>}
                <label className="block text-sm">Reply
                  <select className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2"
                    value={editStatus} onChange={(e) => { setEditStatus(e.target.value as typeof editStatus); setConfirmEdit(false) }} disabled={saving}>
                    {statuses.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                    {editing.original && <option value="clear">Clear reply (no response)</option>}
                  </select>
                </label>
                {(editStatus === "maybe" || editStatus === "no") && (
                  <label className="block text-sm">Reason
                    <textarea className="mt-1 block w-full rounded-md border border-border bg-white px-3 py-2"
                      value={editNote} onChange={(e) => { setEditNote(e.target.value); setConfirmEdit(false) }}
                      maxLength={2000} rows={2} disabled={saving} required />
                  </label>
                )}
                {confirmEdit && <p className="text-sm text-amber-800" role="status">
                  Confirm replacing {editing.person.playerName}'s existing reply{editStatus === "clear" ? " with no response" : ""}? This will be recorded as an admin correction.
                </p>}
                {editError && <p role="alert" className="text-sm text-destructive">{editError}</p>}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={saveEdit} disabled={saving}>
                    {saving ? "Saving…" : confirmEdit ? "Confirm change" : editing.original ? "Review change" : "Save reply"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)} disabled={saving}>Cancel</Button>
                </div>
              </section>
            )}
            {attendance.history.length > 0 && (
              <details className="text-xs border-t border-border pt-3">
                <summary className="cursor-pointer font-medium">Admin correction history ({attendance.history.length})</summary>
                <ul className="mt-2 space-y-2">
                  {attendance.history.map((h, i) => (
                    <li key={`${h.playerId}-${h.changedAt}-${i}`}>
                      {new Date(h.changedAt).toLocaleString("en-GB", { timeZone: "Asia/Hong_Kong" })} HKT · {h.actor} ·{" "}
                      {attendance.responses.find((r) => r.playerId === h.playerId)?.playerName ??
                        attendance.noResponse.find((p) => p.playerId === h.playerId)?.playerName ?? `Player #${h.playerId}`}:{" "}
                      {h.previousStatus ?? "No reply"}{h.previousNote ? ` (${h.previousNote})` : ""} → {h.newStatus ?? "No reply"}
                      {h.newNote ? ` (${h.newNote})` : ""}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}