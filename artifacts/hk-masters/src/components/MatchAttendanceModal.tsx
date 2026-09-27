import { useEffect, useState } from "react"
import type { Match } from "@workspace/api-client-react"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"

type Person = { playerId: number; playerName: string; shirtNumber: number | null }
type Reply = Person & { status: string; note: string | null; respondedAt: string }
type Attendance = {
  counts: { yes: number; maybe: number; no: number; noResponse: number; invited: number }
  responses: Reply[]
  noResponse: Person[]
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
              <h3 className="text-sm font-semibold mb-2">No reply yet · {attendance.noResponse.length}</h3>
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