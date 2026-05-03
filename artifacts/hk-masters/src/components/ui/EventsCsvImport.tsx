import { useState, useRef } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { getStoredAdminToken } from "@/lib/admin-auth"
import { Upload, Download, X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react"

type Team = { id: number; name: string }

type ParsedRow = {
  rowNum: number
  kind: string
  title: string
  starts_at: string
  ends_at: string
  location: string
  description: string
  team: string
  is_public: string
  errors: string[]
  teamId: number | null
  startsAtIso: string | null
  endsAtIso: string | null
  isPublic: boolean
}

type ImportResult = { rowNum: number; title: string; ok: boolean; error?: string }

const ROTTERDAM_TZ = "Europe/Amsterdam"
const ALLOWED_KINDS = ["training", "meeting", "social"]

const TEMPLATE_CSV = `kind,title,starts_at,ends_at,location,description,team,is_public
training,Wednesday Training,2026-04-02 18:00,2026-04-02 20:00,HKFC Astro,,MO40,false
meeting,Pre-tour Briefing,2026-06-15 19:30,,,Room TBC,All squads,false
social,Team Dinner,2026-07-25 19:00,,,Venue TBC,All squads,true
`

function downloadTemplate() {
  const blob = new Blob([TEMPLATE_CSV], { type: "text/csv" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "events-import-template.csv"
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
  const target = new Date(`${local}:00Z`).getTime()
  let offset = zoneOffsetMs(target, tz)
  let instant = target - offset
  offset = zoneOffsetMs(instant, tz)
  instant = target - offset
  return new Date(instant).toISOString()
}

function normaliseDateTime(raw: string): string {
  return raw.trim().replace(" ", "T").replace(/T(\d{2}:\d{2})$/, "T$1")
}

function localInputToIso(local: string): string {
  const normalised = local.trim().replace(" ", "T").replace(/T(\d{2}:\d{2})$/, "T$1")
  return new Date(normalised).toISOString()
}

function validateRows(raw: string[][], teams: Team[]): ParsedRow[] {
  const teamLower = new Map(teams.map(t => [t.name.toLowerCase(), t.id]))
  return raw.map((cols, idx) => {
    const rowNum = idx + 2
    const [kind = "", title = "", starts_at = "", ends_at = "", location = "", description = "", team = "", is_public = ""] = cols
    const errors: string[] = []

    const kindNorm = kind.toLowerCase().trim()
    if (!ALLOWED_KINDS.includes(kindNorm)) errors.push(`kind must be training, meeting or social (got "${kind}")`)

    const titleTrim = title.trim()
    if (!titleTrim) errors.push("title is required")

    const isPublic = is_public.trim().toLowerCase() === "true"

    // Match form behaviour: public events → Rotterdam (CEST) conversion; internal events → local datetime
    const toIso = (raw: string) => isPublic ? zoneInputToIso(normaliseDateTime(raw), ROTTERDAM_TZ) : localInputToIso(raw)

    let startsAtIso: string | null = null
    if (!starts_at.trim()) {
      errors.push("starts_at is required")
    } else {
      try {
        startsAtIso = toIso(starts_at)
        if (isNaN(new Date(startsAtIso).getTime())) throw new Error()
      } catch {
        errors.push(`starts_at invalid (use YYYY-MM-DD HH:mm)`)
      }
    }

    let endsAtIso: string | null = null
    if (ends_at.trim()) {
      try {
        endsAtIso = toIso(ends_at)
        if (isNaN(new Date(endsAtIso).getTime())) throw new Error()
        if (startsAtIso && endsAtIso <= startsAtIso) errors.push("ends_at must be after starts_at")
      } catch {
        errors.push(`ends_at invalid (use YYYY-MM-DD HH:mm)`)
      }
    }

    let teamId: number | null = null
    const teamTrim = team.trim()
    if (teamTrim && teamTrim.toLowerCase() !== "all squads" && teamTrim !== "") {
      const found = teamLower.get(teamTrim.toLowerCase())
      if (found === undefined) errors.push(`team "${teamTrim}" not found`)
      else teamId = found
    }

    return { rowNum, kind: kindNorm, title: titleTrim, starts_at, ends_at, location, description, team, is_public, errors, teamId, startsAtIso, endsAtIso, isPublic }
  })
}

function authHeaders(): HeadersInit {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token } : {}
}

type Props = {
  teams: Team[]
  onClose: () => void
  onImported: () => void
}

export default function EventsCsvImport({ teams, onClose, onImported }: Props) {
  const [step, setStep] = useState<"input" | "preview" | "results">("input")
  const [rawText, setRawText] = useState("")
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [results, setResults] = useState<ImportResult[]>([])
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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
    const indices = {
      kind: header.indexOf("kind"),
      title: header.indexOf("title"),
      starts_at: header.indexOf("starts_at"),
      ends_at: header.indexOf("ends_at"),
      location: header.indexOf("location"),
      description: header.indexOf("description"),
      team: header.indexOf("team"),
      is_public: header.indexOf("is_public"),
    }
    const mapped = dataRows.map(row => [
      indices.kind >= 0 ? row[indices.kind] : "",
      indices.title >= 0 ? row[indices.title] : "",
      indices.starts_at >= 0 ? row[indices.starts_at] : "",
      indices.ends_at >= 0 ? row[indices.ends_at] : "",
      indices.location >= 0 ? row[indices.location] : "",
      indices.description >= 0 ? row[indices.description] : "",
      indices.team >= 0 ? row[indices.team] : "",
      indices.is_public >= 0 ? row[indices.is_public] : "",
    ])
    setRows(validateRows(mapped, teams))
    setStep("preview")
  }

  const validRows = rows.filter(r => r.errors.length === 0)

  const handleImport = async () => {
    setImporting(true)
    const out: ImportResult[] = []
    for (const row of validRows) {
      try {
        const payload = {
          kind: row.kind,
          title: row.title,
          startsAt: row.startsAtIso,
          endsAt: row.endsAtIso,
          location: row.location.trim() || null,
          description: row.description.trim() || null,
          teamId: row.teamId,
          isPublic: row.isPublic,
        }
        const res = await fetch("/api/events", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify(payload),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`)
        }
        out.push({ rowNum: row.rowNum, title: row.title, ok: true })
      } catch (err) {
        out.push({ rowNum: row.rowNum, title: row.title, ok: false, error: (err as Error).message })
      }
    }
    setResults(out)
    setImporting(false)
    setStep("results")
    if (out.some(r => r.ok)) onImported()
  }

  const invalidCount = rows.filter(r => r.errors.length > 0).length

  return (
    <Modal isOpen onClose={onClose} title="Import Events from CSV">
      {step === "input" && (
        <div className="space-y-5">
          <div className="rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800 space-y-1">
            <p className="font-semibold">Required columns: <span className="font-mono font-normal">kind, title, starts_at</span></p>
            <p className="text-blue-700">Optional: <span className="font-mono">ends_at, location, description, team, is_public</span></p>
            <p className="text-blue-700">Times are interpreted as <strong>Rotterdam time (CEST)</strong>. Format: <span className="font-mono">YYYY-MM-DD HH:mm</span></p>
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
              placeholder={"kind,title,starts_at,...\ntraining,Wednesday Training,2026-04-02 18:00,..."}
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
                  <th className="px-3 py-2 text-left">Kind</th>
                  <th className="px-3 py-2 text-left">Title</th>
                  <th className="px-3 py-2 text-left">Starts (CEST)</th>
                  <th className="px-3 py-2 text-left">Team</th>
                  <th className="px-3 py-2 text-left">Public</th>
                  <th className="px-3 py-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map(row => (
                  <tr key={row.rowNum} className={row.errors.length > 0 ? "bg-rose-50" : "bg-white"}>
                    <td className="px-3 py-2 text-gray-400">{row.rowNum}</td>
                    <td className="px-3 py-2">{row.kind}</td>
                    <td className="px-3 py-2 font-medium max-w-[140px] truncate">{row.title}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{row.starts_at}</td>
                    <td className="px-3 py-2">{row.team || "All squads"}</td>
                    <td className="px-3 py-2">{row.is_public}</td>
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
              {importing ? <><Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Importing…</> : `Import ${validRows.length} event${validRows.length !== 1 ? "s" : ""}`}
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
                <span><strong>Row {r.rowNum}</strong> — {r.title}{r.error ? `: ${r.error}` : ""}</span>
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
