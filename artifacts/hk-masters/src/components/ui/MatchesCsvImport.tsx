import { useState, useRef } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Upload, Download, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type Team = { id: number; name: string }

type ParsedRow = {
  rowNum: number
  team: string
  opponent: string
  kickoff_at: string
  venue: string
  status: string
  notes: string
  errors: string[]
  teamId: number | null
  kickoffAtIso: string | null
  statusNorm: string
}

type ImportResult = { rowNum: number; opponent: string; ok: boolean; error?: string }

const ALLOWED_STATUSES = ["scheduled", "in_progress", "final", "cancelled"]
const ROTTERDAM_TZ = "Europe/Amsterdam"

const TEMPLATE_CSV = `team,opponent,kickoff_at,venue,status,notes
MO40,Netherlands MO40,2026-07-23 10:00,HC Rotterdam Pitch 1,scheduled,
MO40,Germany MO40,2026-07-25 14:00,HC Rotterdam Pitch 2,scheduled,
MO50,England MO50,2026-07-24 09:00,HC Rotterdam Pitch 1,scheduled,
`

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "matches-import-template.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let inQuote = false
  let cell = ""
  const row: string[] = []
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') {
      if (inQuote && text[i + 1] === '"') { cell += '"'; i++ }
      else { inQuote = !inQuote }
    } else if (ch === ',' && !inQuote) {
      row.push(cell.trim()); cell = ""
    } else if ((ch === '\n' || ch === '\r') && !inQuote) {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ""
      if (row.some(c => c !== "")) rows.push([...row])
      row.length = 0
    } else {
      cell += ch
    }
  }
  row.push(cell.trim())
  if (row.some(c => c !== "")) rows.push(row)
  return rows
}

function zoneOffsetMs(instant: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant))
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  ) as Record<string, string>
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return wallAsUtc - instant
}

function zoneInputToIso(local: string, tz: string): string {
  const normalised = local.trim().replace(" ", "T").replace(/T(\d{2}:\d{2})$/, "T$1")
  const target = new Date(`${normalised}:00Z`).getTime()
  let offset = zoneOffsetMs(target, tz)
  let instant = target - offset
  offset = zoneOffsetMs(instant, tz)
  instant = target - offset
  return new Date(instant).toISOString()
}

function validateRows(raw: string[][], teams: Team[]): ParsedRow[] {
  const teamLower = new Map(teams.map(t => [t.name.toLowerCase(), t.id]))

  return raw.map((cols, idx) => {
    const rowNum = idx + 2
    const [team = "", opponent = "", kickoff_at = "", venue = "", status = "", notes = ""] = cols
    const errors: string[] = []

    const teamTrim = team.trim()
    let teamId: number | null = null
    if (!teamTrim) {
      errors.push("team is required")
    } else {
      const found = teamLower.get(teamTrim.toLowerCase())
      if (found === undefined) errors.push(`team "${teamTrim}" not found — check spelling`)
      else teamId = found
    }

    const opponentTrim = opponent.trim()
    if (!opponentTrim) errors.push("opponent is required")

    let kickoffAtIso: string | null = null
    if (!kickoff_at.trim()) {
      errors.push("kickoff_at is required")
    } else {
      try {
        kickoffAtIso = zoneInputToIso(kickoff_at, ROTTERDAM_TZ)
        if (isNaN(new Date(kickoffAtIso).getTime())) throw new Error()
      } catch {
        errors.push("kickoff_at invalid — use YYYY-MM-DD HH:mm")
      }
    }

    const statusTrim = status.trim().toLowerCase() || "scheduled"
    if (!ALLOWED_STATUSES.includes(statusTrim)) {
      errors.push(`status must be scheduled, in_progress, final or cancelled`)
    }

    return {
      rowNum,
      team: teamTrim,
      opponent: opponentTrim,
      kickoff_at,
      venue,
      status,
      notes,
      errors,
      teamId,
      kickoffAtIso,
      statusNorm: ALLOWED_STATUSES.includes(statusTrim) ? statusTrim : "scheduled",
    }
  })
}

type Props = {
  teams: Team[]
  sessionToken: string
  onClose: () => void
  onImported: () => void
}

export default function MatchesCsvImport({ teams, sessionToken, onClose, onImported }: Props) {
  const [step, setStep] = useState<"input" | "preview" | "results">("input")
  const [rawText, setRawText] = useState("")
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const authHeaders = (): HeadersInit => ({ "x-session-token": sessionToken })

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => setRawText(String(ev.target?.result ?? ""))
    reader.readAsText(file)
  }

  const handlePreview = () => {
    const all = parseCsv(rawText)
    if (all.length < 2) return
    const header = all[0].map(h => h.toLowerCase().trim())
    const dataRows = all.slice(1)
    const idx = {
      team: header.indexOf("team"),
      opponent: header.indexOf("opponent"),
      kickoff_at: header.indexOf("kickoff_at"),
      venue: header.indexOf("venue"),
      status: header.indexOf("status"),
      notes: header.indexOf("notes"),
    }
    const mapped = dataRows.map(row => [
      idx.team >= 0 ? row[idx.team] : "",
      idx.opponent >= 0 ? row[idx.opponent] : "",
      idx.kickoff_at >= 0 ? row[idx.kickoff_at] : "",
      idx.venue >= 0 ? row[idx.venue] : "",
      idx.status >= 0 ? row[idx.status] : "",
      idx.notes >= 0 ? row[idx.notes] : "",
    ])
    setRows(validateRows(mapped, teams))
    setStep("preview")
  }

  const validRows = rows.filter(r => r.errors.length === 0)
  const invalidCount = rows.filter(r => r.errors.length > 0).length

  const handleImport = async () => {
    setImporting(true)
    const out: ImportResult[] = []
    for (const row of validRows) {
      try {
        const payload = {
          teamId: row.teamId,
          opponent: row.opponent,
          kickoffAt: row.kickoffAtIso,
          venue: row.venue.trim() || undefined,
          status: row.statusNorm,
          notes: row.notes.trim() || undefined,
        }
        const res = await fetch("/api/matches", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
        }
        out.push({ rowNum: row.rowNum, opponent: row.opponent, ok: true })
      } catch (err) {
        out.push({ rowNum: row.rowNum, opponent: row.opponent, ok: false, error: (err as Error).message })
      }
    }
    setResults(out)
    setImporting(false)
    setStep("results")
    if (out.some(r => r.ok)) onImported()
  }

  const teamNames = teams.map(t => t.name).join(", ")

  return (
    <Modal isOpen onClose={onClose} title="Import Matches from CSV">
      {step === "input" && (
        <div className="space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Required columns: <span className="font-mono font-normal">team, opponent, kickoff_at</span></p>
            <p className="text-blue-700">Optional: <span className="font-mono">venue, status, notes</span></p>
            <p className="text-blue-700">Times are interpreted as <strong>Rotterdam time (CEST)</strong>. Format: <span className="font-mono">YYYY-MM-DD HH:mm</span></p>
            {teamNames && <p className="text-blue-700">Known teams: <span className="font-medium">{teamNames}</span></p>}
          </div>

          <div>
            <button
              type="button"
              onClick={downloadTemplate}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-[#006B3C] hover:underline"
            >
              <Download className="w-4 h-4" /> Download template CSV
            </button>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Upload CSV file</label>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={handleFile} className="block w-full text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-gray-300 file:text-sm file:font-medium file:bg-white hover:file:bg-gray-50" />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-2">Or paste CSV text</label>
            <textarea
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-[#006B3C]"
              rows={6}
              placeholder={"team,opponent,kickoff_at,venue,status,notes\nMO40,Netherlands MO40,2026-07-23 10:00,HC Rotterdam Pitch 1,scheduled,"}
              value={rawText}
              onChange={e => setRawText(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" onClick={handlePreview} disabled={!rawText.trim()}>
              <Upload className="w-4 h-4 mr-1.5" /> Preview import
            </Button>
          </div>
        </div>
      )}

      {step === "preview" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 text-sm flex-wrap">
            <span className="font-semibold text-gray-700">{rows.length} row{rows.length !== 1 ? "s" : ""} found</span>
            {validRows.length > 0 && <span className="text-emerald-700 font-medium">✓ {validRows.length} valid</span>}
            {invalidCount > 0 && <span className="text-rose-600 font-medium">✕ {invalidCount} with errors</span>}
          </div>

          <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-gray-500 uppercase text-[10px] sticky top-0">
                <tr>
                  <th className="px-3 py-2 text-left">#</th>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-3 py-2 text-left">Opponent</th>
                  <th className="px-3 py-2 text-left">Kick-off (CEST)</th>
                  <th className="px-3 py-2 text-left">Venue</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr key={row.rowNum} className={row.errors.length > 0 ? "bg-rose-50" : "bg-white"}>
                    <td className="px-3 py-2 text-gray-400">{row.rowNum}</td>
                    <td className="px-3 py-2">{row.team}</td>
                    <td className="px-3 py-2 font-medium max-w-[120px] truncate">{row.opponent}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.kickoff_at}</td>
                    <td className="px-3 py-2 max-w-[100px] truncate">{row.venue || "—"}</td>
                    <td className="px-3 py-2">
                      {row.errors.length > 0
                        ? <span className="text-rose-600" title={row.errors.join("; ")}>⚠ {row.errors[0]}{row.errors.length > 1 ? ` +${row.errors.length - 1}` : ""}</span>
                        : <span className="text-emerald-600">✓ Ready</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invalidCount > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
              {invalidCount} row{invalidCount !== 1 ? "s" : ""} with errors will be skipped. Fix the CSV and re-import to include them.
            </p>
          )}

          <div className="flex justify-between gap-3 pt-2 border-t">
            <Button type="button" variant="outline" onClick={() => setStep("input")}>← Back</Button>
            <Button type="button" onClick={handleImport} disabled={validRows.length === 0 || importing}>
              {importing
                ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importing…</>
                : `Import ${validRows.length} match${validRows.length !== 1 ? "es" : ""}`}
            </Button>
          </div>
        </div>
      )}

      {step === "results" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-4 text-center">
              <div className="text-2xl font-bold text-emerald-800">{results.filter(r => r.ok).length}</div>
              <div className="text-sm text-emerald-700 font-medium">Imported</div>
            </div>
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-4 text-center">
              <div className="text-2xl font-bold text-rose-700">{results.filter(r => !r.ok).length}</div>
              <div className="text-sm text-rose-600 font-medium">Failed</div>
            </div>
          </div>

          <div className="max-h-56 overflow-y-auto space-y-1">
            {results.map(r => (
              <div key={r.rowNum} className={`flex items-start gap-2 text-sm px-3 py-2 rounded-lg ${r.ok ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700"}`}>
                {r.ok ? <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
                <span><strong>Row {r.rowNum}</strong> — {r.opponent}{r.error ? `: ${r.error}` : ""}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2 border-t">
            <Button onClick={onClose}>Done</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
