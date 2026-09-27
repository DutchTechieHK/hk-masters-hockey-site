import { useEffect, useState } from "react"
import type { Match } from "@workspace/api-client-react"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

type Person = { playerId: number; playerName: string; shirtNumber: number | null }
type Reply = Person & { status: string; note: string | null; respondedAt: string }
type Attendance = {
  counts: { yes: number; maybe: number; no: number; noResponse: number; invited: number }
  responses: Reply[]
  noResponse: Person[]
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

export default function MatchAttendanceModal({ match, token, onClose }: {
  match: Match; token: string; onClose: () => void
}) {
  const [attendance, setAttendance] = useState<Attendance | null>(null)
  const [error, setError] = useState("")
  const [confirming, setConfirming] = useState(false)
  const [sending, setSending] = useState(false)
  const [reminderError, setReminderError] = useState("")
  const [result, setResult] = useState<ReminderResult | null>(null)

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
                          <span className="font-medium">{reply.shirtNumber != null ? `#${reply.shirtNumber} · ` : ""}{reply.playerName}</span>
                          {reply.note && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{reply.note}</p>}
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
                    <li key={person.playerId} className="px-3 py-2 text-sm">
                      {person.shirtNumber != null ? `#${person.shirtNumber} · ` : ""}{person.playerName}
                    </li>
                  ))}
                </ul>
              ) : <p className="text-xs text-muted-foreground">Everyone has replied.</p>}
            </section>
          </>
        )}
      </div>
    </Modal>
  )
}