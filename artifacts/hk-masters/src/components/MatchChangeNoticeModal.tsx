import { useEffect, useState } from "react"
import type { Match } from "@workspace/api-client-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"

type Preview = {
  revisionId: number; kind: "cancelled" | "rescheduled"; current: boolean
  subject: string; message: string; changedAt: string
  total: number; ready: number; noEmail: number; sent: number; uncertain: number
  deliveries: { playerName: string; status: "sent" | "confirmed_failed" | "uncertain" }[]
}
type Result = { sent: number; uncertain: number; skippedChanged: number; historyRecorded: boolean; preview: Preview }

export default function MatchChangeNoticeModal({ match, token, onClose }: {
  match: Match; token: string; onClose: () => void
}) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState("")
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch(`/api/matches/${match.id}/change-notice`, {
      headers: { "x-session-token": token }, signal: controller.signal,
    }).then(async (response) => {
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not load change notice")
      return data as Preview
    }).then(setPreview).catch((err: Error) => {
      if (!controller.signal.aborted) setError(err.message)
    }).finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [match.id, token])

  const send = async () => {
    if (!preview?.current || !preview.ready || sending) return
    setSending(true)
    setError("")
    try {
      const response = await fetch(`/api/matches/${match.id}/change-notice`, {
        method: "POST",
        headers: { "x-session-token": token, "Content-Type": "application/json" },
        body: JSON.stringify({ revisionId: preview.revisionId }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Could not send the change notice")
      const outcome = data as Result
      setResult(outcome)
      setPreview(outcome.preview)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Fixture change · ${match.opponent}`}>
      <div className="space-y-4 text-sm">
        {loading && <p>Loading current notice and delivery history…</p>}
        {error && <p role="alert" className="text-destructive">{error}</p>}
        {preview && <>
          <p className="font-semibold">{preview.subject}</p>
          <div className="rounded-lg bg-muted/40 p-4 whitespace-pre-wrap">{preview.message}</div>
          <p>Current eligible squad: {preview.total} · Ready to email: {preview.ready} · Without email: {preview.noEmail}</p>
          <p>Already sent: {preview.sent} · Delivery uncertain: {preview.uncertain}</p>
          {!preview.current && <p role="alert" className="text-amber-800">The fixture has changed since this notice was recorded. This notice cannot be sent.</p>}
          {preview.uncertain > 0 && <p className="text-amber-800">Uncertain deliveries are blocked from automatic retries. Check Email History and independently confirm non-delivery before any manual reconciliation.</p>}
          {preview.deliveries.length > 0 && <details className="rounded-lg border p-3">
            <summary className="cursor-pointer font-medium">Per-player delivery history ({preview.deliveries.length})</summary>
            <ul className="mt-2 max-h-40 overflow-y-auto divide-y">
              {preview.deliveries.map((delivery, index) => <li key={index} className="py-1">
                {delivery.playerName} · {delivery.status === "sent" ? "Sent" : delivery.status === "confirmed_failed" ? "Confirmed not delivered" : "Uncertain / pending"}
              </li>)}
            </ul>
          </details>}
          {result && <div role="status" className="rounded-lg border p-3">
            This attempt: {result.sent} sent · {result.uncertain} uncertain · {result.skippedChanged} skipped after changes.
            {!result.historyRecorded && <p className="text-destructive">History could not be fully saved. Do not resend solely to recreate it.</p>}
          </div>}
          <div className="flex gap-2">
            <Button type="button" onClick={send} disabled={!preview.current || !preview.ready || sending}>
              {sending ? "Sending…" : `Confirm and email ${preview.ready} player${preview.ready === 1 ? "" : "s"}`}
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>Close</Button>
          </div>
        </>}
      </div>
    </Modal>
  )
}