import { useEffect, useMemo, useState } from "react"
import type { MembershipInterestSubmission, Player } from "@workspace/api-client-react"
import { AlertTriangle, CheckCircle, RefreshCw, Upload } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

type ImportRow = {
  name: string
  email: string
  phone?: string
  membershipTier: "community_member" | "social_player" | "masters_division_one"
  rawData?: Record<string, unknown>
}

const TIER_LABELS: Record<string, string> = {
  awaiting_selection: "Awaiting Selection",
  community_member: "Community Member",
  social_player: "Social Player",
  masters_division_one: "Masters Div. 1",
}

const CONFLICT_FIELD_LABELS: Record<string, string> = {
  email: "Email address",
  dateOfBirth: "Date of birth",
  position: "Position",
}

function displayConflictValue(value: string | null) {
  return value || "Not provided"
}

type NotionSyncStatus = {
  configured: boolean
  latest: null | {
    status: "running" | "succeeded" | "failed" | "skipped"
    imported: number
    created: number
    matched: number
    needsReview: number
    skipped: number
    error: string | null
    startedAt: string
    completedAt: string | null
  }
}

function parseCsvLine(line: string) {
  const cells: string[] = []
  let value = ""
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"' && line[i + 1] === '"' && quoted) {
      value += '"'
      i++
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === "," && !quoted) {
      cells.push(value.trim())
      value = ""
    } else {
      value += char
    }
  }
  cells.push(value.trim())
  return cells
}

function normalizeTier(value: string): ImportRow["membershipTier"] | null {
  const tier = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")
  if (tier === "community_member" || tier === "social_player" || tier === "masters_division_one") {
    return tier
  }
  return null
}

function parseImport(text: string, filename: string): ImportRow[] {
  if (filename.toLowerCase().endsWith(".json")) {
    const parsed = JSON.parse(text) as ImportRow[] | { submissions: ImportRow[] }
    return Array.isArray(parsed) ? parsed : parsed.submissions
  }
  const lines = text.split(/\r?\n/).filter((line) => line.trim())
  if (lines.length < 2) return []
  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim())
  const find = (names: string[]) => headers.findIndex((header) => names.includes(header))
  const nameIndex = find(["name", "full name", "member name"])
  const emailIndex = find(["email", "email address"])
  const phoneIndex = find(["phone", "phone number", "mobile"])
  const tierIndex = find(["membership tier", "tier", "membership"])
  if (nameIndex < 0 || emailIndex < 0 || tierIndex < 0) {
    throw new Error("CSV needs Name, Email and Membership Tier columns.")
  }
  return lines.slice(1).map((line) => {
    const cells = parseCsvLine(line)
    const tier = normalizeTier(cells[tierIndex] || "")
    if (!tier) throw new Error(`Unknown membership tier: ${cells[tierIndex] || "(blank)"}`)
    const rawData = Object.fromEntries(headers.map((header, index) => [header, cells[index] || ""]))
    return {
      name: cells[nameIndex] || "",
      email: cells[emailIndex] || "",
      phone: phoneIndex >= 0 ? cells[phoneIndex] : undefined,
      membershipTier: tier,
      rawData,
    }
  }).filter((row) => row.name && row.email)
}

export function MembershipInterestPanel({
  players,
  sessionToken,
  onMembersUpdated,
}: {
  players: Player[]
  sessionToken: string | null
  onMembersUpdated: () => void
}) {
  const { toast } = useToast()
  const [submissions, setSubmissions] = useState<MembershipInterestSubmission[]>([])
  const [selectedMembers, setSelectedMembers] = useState<Record<number, string>>({})
  const [busy, setBusy] = useState(false)
  const [duplicateEmails, setDuplicateEmails] = useState<string[]>([])
  const [notionSync, setNotionSync] = useState<NotionSyncStatus | null>(null)

  const headers = useMemo<Record<string, string>>(
    () => {
      const result: Record<string, string> = {}
      if (sessionToken) result["x-session-token"] = sessionToken
      return result
    },
    [sessionToken],
  )

  const loadSubmissions = async () => {
    const response = await fetch("/api/players/membership/interest-submissions", { headers })
    if (response.ok) setSubmissions(await response.json())
  }

  const loadNotionSync = async () => {
    const response = await fetch("/api/players/membership/notion-sync", { headers })
    if (response.ok) setNotionSync(await response.json())
  }

  useEffect(() => {
    if (!sessionToken) return
    let cancelled = false
    fetch("/api/players/membership/initialize", { method: "POST", headers })
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Membership setup failed")))
      .then((result: { duplicateEmails: string[] }) => {
        if (!cancelled) setDuplicateEmails(result.duplicateEmails)
        return Promise.all([loadSubmissions(), loadNotionSync()])
      })
      .then(() => { if (!cancelled) onMembersUpdated() })
      .catch(() => { /* The existing roster remains usable if initialization is unavailable. */ })
    return () => { cancelled = true }
  }, [sessionToken])

  const importFile = async (file: File) => {
    setBusy(true)
    try {
      const rows = parseImport(await file.text(), file.name)
      if (!rows.length) throw new Error("No valid submissions were found.")
      const response = await fetch("/api/players/membership/interest-submissions", {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ submissions: rows }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Import failed")
      toast({
        title: `Imported ${result.imported} submission${result.imported === 1 ? "" : "s"}`,
        description: `${result.matched} matched automatically; ${result.needsReview} need review.`,
      })
      await loadSubmissions()
      onMembersUpdated()
    } catch (error) {
      toast({ title: (error as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const syncNotion = async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/players/membership/notion-sync", { method: "POST", headers })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || "Notion sync failed")
      toast({
        title: "Notion signups synced",
        description: `${result.created} new members; ${result.matched} existing matches; ${result.needsReview} need review.`,
      })
      await Promise.all([loadSubmissions(), loadNotionSync()])
      onMembersUpdated()
    } catch (error) {
      toast({ title: (error as Error).message, variant: "destructive" })
      await loadNotionSync()
    } finally {
      setBusy(false)
    }
  }

  const resolve = async (submission: MembershipInterestSubmission, dismiss = false) => {
    const playerId = Number(selectedMembers[submission.id] || submission.matchedPlayerId || 0)
    if (!dismiss && !playerId) {
      toast({ title: "Select a member first", variant: "destructive" })
      return
    }
    setBusy(true)
    try {
      const response = await fetch(`/api/players/membership/interest-submissions/${submission.id}`, {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: dismiss ? null : playerId,
          membershipTier: submission.membershipTier,
          dismiss,
        }),
      })
      if (!response.ok) throw new Error("Could not resolve submission")
      await loadSubmissions()
      onMembersUpdated()
      toast({
        title: dismiss ? "Submission dismissed" : "Conflict resolved",
        description: dismiss
          ? "This submission will stay dismissed unless the Notion entry changes."
          : "The selected member and their existing profile values were kept.",
      })
    } catch (error) {
      toast({ title: (error as Error).message, variant: "destructive" })
    } finally {
      setBusy(false)
    }
  }

  const pending = submissions.filter((item) => !["matched", "dismissed"].includes(item.matchStatus))

  return (
    <div className="mb-5 rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">Membership interest reconciliation</h2>
          <p className="text-sm text-muted-foreground">
            Import CSV or JSON submissions. Unique email matches are applied automatically; uncertain matches stay here for review.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy || notionSync?.configured === false}
            onClick={() => void syncNotion()}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${busy ? "animate-spin" : ""}`} />
            Sync Notion now
          </Button>
          <label>
          <input
            className="hidden"
            type="file"
            accept=".csv,.json,text/csv,application/json"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void importFile(file)
              event.target.value = ""
            }}
          />
          <span className="inline-flex h-9 cursor-pointer items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">
            <Upload className="mr-2 h-4 w-4" /> {busy ? "Working…" : "Import submissions"}
          </span>
          </label>
        </div>
      </div>

      {notionSync?.latest && (
        <div className={`mt-3 rounded-lg border p-3 text-sm ${
          notionSync.latest.status === "failed"
            ? "border-red-200 bg-red-50 text-red-800"
            : "border-slate-200 bg-slate-50 text-slate-700"
        }`}>
          <span className="font-semibold">
            Last Notion sync: {notionSync.latest.status}
          </span>
          {" · "}
          {new Date(notionSync.latest.completedAt || notionSync.latest.startedAt).toLocaleString()}
          {notionSync.latest.status === "succeeded" && (
            <span>
              {" · "}{notionSync.latest.created} created, {notionSync.latest.matched} matched, {notionSync.latest.needsReview} review, {notionSync.latest.skipped} unchanged
            </span>
          )}
          {notionSync.latest.error && <div className="mt-1">{notionSync.latest.error}</div>}
        </div>
      )}

      {duplicateEmails.length > 0 && (
        <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{duplicateEmails.length} duplicate member email{duplicateEmails.length === 1 ? "" : "s"} will always require manual review.</span>
        </div>
      )}

      {pending.length === 0 ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-emerald-700">
          <CheckCircle className="h-4 w-4" /> No submissions need review.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {pending.map((submission) => (
            <div
              key={submission.id}
              className={`rounded-xl border p-3 ${
                submission.conflictDetails?.some((detail) => detail.kind === "identity")
                  ? "border-red-200 bg-red-50/60"
                  : "border-amber-200 bg-amber-50/60"
              }`}
            >
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{submission.submittedName}</p>
                  <p className="text-xs text-muted-foreground">{submission.submittedEmail} · {TIER_LABELS[submission.membershipTier]}</p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${
                  submission.conflictDetails?.some((detail) => detail.kind === "identity")
                    ? "bg-red-100 text-red-800"
                    : "bg-amber-100 text-amber-800"
                }`}>
                  {submission.conflictDetails?.some((detail) => detail.kind === "identity")
                    ? "Identity conflict"
                    : submission.matchStatus === "conflict"
                      ? "Profile conflict"
                      : submission.matchStatus}
                </span>
              </div>
              {submission.conflictDetails && submission.conflictDetails.length > 0 && (
                <div className="mb-3 overflow-hidden rounded-lg border bg-white">
                  <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    <span>Field</span>
                    <span>Existing member</span>
                    <span>Notion submission</span>
                  </div>
                  {submission.conflictDetails.map((detail) => (
                    <div
                      key={detail.field}
                      className={`grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2 border-b px-3 py-2 text-sm last:border-b-0 ${
                        detail.kind === "identity" ? "bg-red-50/50" : ""
                      }`}
                    >
                      <span className="font-medium">{CONFLICT_FIELD_LABELS[detail.field]}</span>
                      <span className="break-words">{displayConflictValue(detail.existingValue)}</span>
                      <span className="break-words">{displayConflictValue(detail.submittedValue)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <Select
                  value={selectedMembers[submission.id] || (submission.matchedPlayerId ? String(submission.matchedPlayerId) : "")}
                  onChange={(event) => setSelectedMembers((current) => ({ ...current, [submission.id]: event.target.value }))}
                >
                  <option value="">Select existing member…</option>
                  {players.map((player) => <option key={player.id} value={player.id}>{player.name} — {player.email}</option>)}
                </Select>
                <Button type="button" size="sm" disabled={busy} onClick={() => void resolve(submission)}>
                  {submission.matchStatus === "conflict" ? "Keep existing member values" : "Match selected member"}
                </Button>
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void resolve(submission, true)}>Dismiss submission</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}