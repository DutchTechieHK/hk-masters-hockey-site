import { useState, useEffect } from "react"
import { Plus, Edit2 } from "lucide-react"
import { getStoredAdminToken } from "@/lib/admin-auth"

const ROTTERDAM_TZ = "Europe/Amsterdam"

const TOURNAMENT_DAYS: string[] = (() => {
  const days: string[] = []
  const d = new Date("2026-07-22T00:00:00Z")
  const end = new Date("2026-08-02T00:00:00Z")
  while (d < end) {
    days.push(new Date(d).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ }))
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return days
})()

function rtmDateKey(iso: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: ROTTERDAM_TZ })
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-GB", {
    hour: "2-digit", minute: "2-digit", hour12: false, timeZone: ROTTERDAM_TZ,
  })
}

const KIND_META: Record<string, { label: string; colour: string }> = {
  training:    { label: "Training",    colour: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  meeting:     { label: "Meeting",     colour: "bg-blue-100 text-blue-800 border-blue-200" },
  social:      { label: "Social",      colour: "bg-amber-100 text-amber-800 border-amber-200" },
  physio:      { label: "Physio",      colour: "bg-purple-100 text-purple-800 border-purple-200" },
  team_dinner: { label: "Team Dinner", colour: "bg-orange-100 text-orange-800 border-orange-200" },
  dinner:      { label: "Dinner",      colour: "bg-orange-50 text-orange-700 border-orange-100" },
  free_time:   { label: "Free Time",   colour: "bg-yellow-100 text-yellow-800 border-yellow-200" },
}

export type EventRow = {
  id: number
  kind: string
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  description: string | null
  teamId: number | null
  teamName: string | null
  isPublic: boolean
  rsvpCounts?: { yes: number; no: number; maybe: number }
}

type MatchRow = {
  id: number
  teamId: number
  teamName?: string
  teamCategory?: string
  opponent: string
  kickoffAt: string
  venue?: string
  ourScore: number | null
  theirScore: number | null
  status: string
}

export type Team = {
  id: number
  name: string
  category?: string
}

type Props = {
  events: EventRow[]
  teams: Team[]
  onEdit: (event: EventRow) => void
  onAdd: (prefillDate?: string, prefillTeamId?: number | null) => void
}

type ColItem =
  | { type: "event"; event: EventRow; sortKey: string }
  | { type: "match"; match: MatchRow; sortKey: string }

function authHeaders(): HeadersInit {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token } : {}
}

export default function ProgrammeDayPlanner({ events, teams, onEdit, onAdd }: Props) {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loadingMatches, setLoadingMatches] = useState(true)

  useEffect(() => {
    fetch("/api/matches", { headers: authHeaders() })
      .then(r => r.ok ? r.json() : [])
      .then(data => { setMatches(Array.isArray(data) ? data : []); setLoadingMatches(false) })
      .catch(() => setLoadingMatches(false))
  }, [])

  const mo40Team = teams.find(t => (t as Team & { category?: string }).category === "MO40" || t.name?.toLowerCase().includes("40"))
  const mo50Team = teams.find(t => (t as Team & { category?: string }).category === "MO50" || t.name?.toLowerCase().includes("50"))

  function buildColumnItems(teamId: number | null, teamCategory: string, dateKey: string): ColItem[] {
    const evts = events
      .filter(ev => rtmDateKey(ev.startsAt) === dateKey && (ev.teamId === teamId || ev.teamId === null))
      .map(event => ({ type: "event" as const, event, sortKey: event.startsAt }))

    const mtchs = matches
      .filter(m => rtmDateKey(m.kickoffAt) === dateKey &&
        (m.teamCategory === teamCategory || (teamId != null && m.teamId === teamId)))
      .map(match => ({ type: "match" as const, match, sortKey: match.kickoffAt }))

    return [...evts, ...mtchs].sort((a, b) => a.sortKey.localeCompare(b.sortKey))
  }

  const days = TOURNAMENT_DAYS.map(dateKey => ({
    dateKey,
    mo40Items: buildColumnItems(mo40Team?.id ?? null, "MO40", dateKey),
    mo50Items: buildColumnItems(mo50Team?.id ?? null, "MO50", dateKey),
  }))

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[100px_1fr_1fr] gap-2 mb-3 sticky top-0 bg-background/95 backdrop-blur z-10 pb-2 pt-1">
        <div />
        <div className="rounded-xl bg-[#DE2910]/8 border border-[#DE2910]/20 px-3 py-2.5">
          <div className="text-xs font-bold text-[#DE2910]">MO40</div>
          <div className="text-[10px] text-gray-500">HC Schiedam</div>
        </div>
        <div className="rounded-xl bg-[#1E3A6E]/8 border border-[#1E3A6E]/20 px-3 py-2.5">
          <div className="text-xs font-bold text-[#1E3A6E]">MO50</div>
          <div className="text-[10px] text-gray-500">HC Rotterdam</div>
        </div>
      </div>

      {loadingMatches && (
        <p className="text-xs text-muted-foreground text-center py-2">Loading matches…</p>
      )}

      {days.map(({ dateKey, mo40Items, mo50Items }) => {
        const isEmpty = mo40Items.length === 0 && mo50Items.length === 0
        const dayDate = new Date(`${dateKey}T12:00:00Z`)
        return (
          <div key={dateKey} className={`grid grid-cols-[100px_1fr_1fr] gap-2 ${isEmpty ? "opacity-50" : ""}`}>
            <div className="py-2 pr-2 border-r border-border">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">
                {dayDate.toLocaleDateString("en-GB", { weekday: "short" })}
              </div>
              <div className="text-sm font-semibold text-foreground leading-tight">
                {dayDate.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </div>
            </div>

            <DayColumn
              items={mo40Items}
              teamColor="red"
              teamId={mo40Team?.id ?? null}
              dateKey={dateKey}
              onEdit={onEdit}
              onAdd={onAdd}
            />
            <DayColumn
              items={mo50Items}
              teamColor="blue"
              teamId={mo50Team?.id ?? null}
              dateKey={dateKey}
              onEdit={onEdit}
              onAdd={onAdd}
            />
          </div>
        )
      })}
    </div>
  )
}

function DayColumn({
  items, teamColor, teamId, dateKey, onEdit, onAdd,
}: {
  items: ColItem[]
  teamColor: "red" | "blue"
  teamId: number | null
  dateKey: string
  onEdit: (ev: EventRow) => void
  onAdd: (date?: string, teamId?: number | null) => void
}) {
  const border = teamColor === "red" ? "border-[#DE2910]/15" : "border-[#1E3A6E]/15"
  const addBtn = teamColor === "red"
    ? "text-[#DE2910] hover:bg-[#DE2910]/8"
    : "text-[#1E3A6E] hover:bg-[#1E3A6E]/8"

  return (
    <div className={`rounded-lg border ${border} bg-white p-1.5 space-y-1 min-h-[52px]`}>
      {items.map((item) =>
        item.type === "event" ? (
          <EventPill key={`e-${item.event.id}`} event={item.event} onEdit={onEdit} />
        ) : (
          <MatchPill key={`m-${item.match.id}`} match={item.match} teamColor={teamColor} />
        )
      )}
      <button
        onClick={() => onAdd(dateKey, teamId)}
        className={`w-full flex items-center gap-1 text-[10px] font-semibold px-1.5 py-1 rounded transition-colors ${addBtn}`}
      >
        <Plus className="w-3 h-3" /> Add
      </button>
    </div>
  )
}

function EventPill({ event, onEdit }: { event: EventRow; onEdit: (ev: EventRow) => void }) {
  const meta = KIND_META[event.kind] ?? { label: event.kind, colour: "bg-gray-100 text-gray-700 border-gray-200" }
  return (
    <button onClick={() => onEdit(event)} className="w-full text-left group">
      <div className={`rounded border px-1.5 py-1 transition-shadow hover:shadow-sm ${meta.colour}`}>
        <div className="flex items-start justify-between gap-0.5">
          <div className="min-w-0 flex-1">
            <div className="text-[9px] font-bold uppercase tracking-wide opacity-60">
              {formatTime(event.startsAt)} · {meta.label}
            </div>
            <div className="text-[11px] font-semibold truncate leading-tight">{event.title}</div>
            {event.location && (
              <div className="text-[9px] opacity-50 truncate">{event.location}</div>
            )}
          </div>
          <Edit2 className="w-2.5 h-2.5 shrink-0 mt-0.5 opacity-0 group-hover:opacity-50 transition-opacity" />
        </div>
        {!event.isPublic && (
          <span className="text-[8px] font-bold uppercase tracking-wide opacity-40">🔒 Private</span>
        )}
        {event.teamId === null && (
          <span className="text-[8px] font-bold uppercase tracking-wide opacity-40"> · All</span>
        )}
      </div>
    </button>
  )
}

function MatchPill({ match, teamColor }: { match: MatchRow; teamColor: "red" | "blue" }) {
  const bg = teamColor === "red"
    ? "bg-[#DE2910]/8 border-[#DE2910]/25 text-[#DE2910]"
    : "bg-[#1E3A6E]/8 border-[#1E3A6E]/25 text-[#1E3A6E]"
  const statusLabel = match.status === "final" ? "FT" : match.status === "in_progress" ? "🔴 LIVE" : match.status === "cancelled" ? "CANC" : null
  return (
    <div className={`rounded border px-1.5 py-1 ${bg}`}>
      <div className="text-[9px] font-bold uppercase tracking-wide opacity-60">{formatTime(match.kickoffAt)} · Match</div>
      <div className="text-[11px] font-semibold leading-tight">🏒 vs {match.opponent}</div>
      {match.venue && <div className="text-[9px] opacity-50 truncate">{match.venue}</div>}
      {match.status === "final" && match.ourScore !== null && (
        <div className="text-[9px] font-bold">{match.ourScore}–{match.theirScore} FT</div>
      )}
      {statusLabel && match.status !== "final" && (
        <div className="text-[9px] font-bold">{statusLabel}</div>
      )}
    </div>
  )
}
