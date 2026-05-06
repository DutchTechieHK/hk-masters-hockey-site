import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useListPlayers, useListTeams } from "@workspace/api-client-react"
import type { Player as BasePlayer } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Badge } from "@/components/ui/badge"
import { Select } from "@/components/ui/select"
import { GRID_CRITERIA, computeReadiness, isFullyReady } from "@/lib/readiness"
import {
  Plane,
  BedDouble,
  Wallet,
  BookUser,
  Shirt,
  Phone,
  CheckCircle2,
  ChevronRight,
  CheckCheck,
  XCircle,
  Filter,
} from "lucide-react"

const PASSPORT_WARN_DATE = new Date("2026-10-31")

type Player = BasePlayer & {
  passportCopyUrl?: string
  passportCopyReviewed?: boolean
}

// ─── Blocker checks (existing per-category cards) ────────────────────────────

type BlockerCheck = {
  key: string
  label: string
  description: string
  icon: typeof Plane
  tone: "amber" | "red" | "blue"
  href?: string
  detect: (p: Player) => boolean
  detail?: (p: Player) => string | null
}

const CHECKS: BlockerCheck[] = [
  {
    key: "flight",
    label: "Flight details missing",
    description: "Players who haven't submitted arrival/departure flights",
    icon: Plane,
    tone: "amber",
    href: "/travel",
    detect: (p) => !p.flightArrivalDateTime || !p.flightDepartureDateTime,
    detail: (p) => {
      const missing: string[] = []
      if (!p.flightArrivalDateTime) missing.push("arrival")
      if (!p.flightDepartureDateTime) missing.push("departure")
      return missing.length ? `Missing: ${missing.join(" + ")}` : null
    },
  },
  {
    key: "room",
    label: "Room sharing not chosen",
    description: "Players who haven't indicated a room sharing preference",
    icon: BedDouble,
    tone: "blue",
    href: "/travel",
    detect: (p) => !p.roomSharingPreference || p.roomSharingPreference.trim() === "",
  },
  {
    key: "passport-expiring",
    label: "Passport expiring soon",
    description: `Passport expires before ${PASSPORT_WARN_DATE.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`,
    icon: BookUser,
    tone: "red",
    href: "/players",
    detect: (p) => {
      if (!p.passportExpiry) return false
      const d = new Date(p.passportExpiry)
      if (isNaN(d.getTime())) return false
      return d <= PASSPORT_WARN_DATE
    },
    detail: (p) => (p.passportExpiry ? `Expires ${p.passportExpiry}` : null),
  },
  {
    key: "passport-missing",
    label: "Passport details missing",
    description: "Players with no passport number or expiry on file",
    icon: BookUser,
    tone: "amber",
    href: "/players",
    detect: (p) => !p.passportNumber || !p.passportExpiry,
  },
  {
    key: "fee-unpaid",
    label: "Tournament fee unpaid",
    description: "Players who have not paid their tournament contribution",
    icon: Wallet,
    tone: "amber",
    href: "/fees",
    detect: (p) => !p.feePaid,
    detail: (p) => {
      const due = p.paymentAmountDue ?? 0
      const paid = p.paymentAmountPaid ?? 0
      const out = Math.max(due - paid, 0)
      if (out > 0) return `Outstanding HK$${out.toLocaleString("en-HK")}`
      if (due === 0) return "No amount set"
      return null
    },
  },
  {
    key: "kit-sizes",
    label: "Kit sizes missing",
    description: "Players who haven't submitted shirt / shorts / jacket sizes",
    icon: Shirt,
    tone: "amber",
    href: "/kits",
    detect: (p) => !p.shirtSize || !p.shortsSize || !p.jacketSize,
    detail: (p) => {
      const missing: string[] = []
      if (!p.shirtSize) missing.push("shirt")
      if (!p.shortsSize) missing.push("shorts")
      if (!p.jacketSize) missing.push("jacket")
      return missing.length ? `Missing: ${missing.join(", ")}` : null
    },
  },
  {
    key: "emergency",
    label: "Emergency contact missing",
    description: "Players with no emergency contact name or phone",
    icon: Phone,
    tone: "red",
    href: "/players",
    detect: (p) => !p.emergencyContactName || !p.emergencyContactPhone,
  },
  {
    key: "passport-copy-unreviewed",
    label: "Passport copy not reviewed",
    description: "Players who uploaded a passport copy that hasn't been marked as reviewed",
    icon: BookUser,
    tone: "amber",
    href: "/players",
    detect: (p) => !!p.passportCopyUrl && !p.passportCopyReviewed,
  },
]

function toneClasses(tone: "amber" | "red" | "blue") {
  switch (tone) {
    case "red":
      return {
        wrap: "border-red-200 bg-red-50/40",
        icon: "bg-red-100 text-red-700",
        count: "text-red-700",
        chip: "bg-red-100 text-red-700 border-red-200",
      }
    case "blue":
      return {
        wrap: "border-blue-200 bg-blue-50/40",
        icon: "bg-blue-100 text-blue-700",
        count: "text-blue-700",
        chip: "bg-blue-100 text-blue-700 border-blue-200",
      }
    default:
      return {
        wrap: "border-amber-200 bg-amber-50/40",
        icon: "bg-amber-100 text-amber-700",
        count: "text-amber-700",
        chip: "bg-amber-100 text-amber-700 border-amber-200",
      }
  }
}

function daysUntilTournament(): number {
  const now = new Date()
  const diff = new Date("2026-07-22").getTime() - now.getTime()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

export default function Readiness() {
  const { data: players = [], isLoading } = useListPlayers()
  const { data: teams = [] } = useListTeams()

  const [expanded, setExpanded] = useState<string | null>(null)
  const [incompleteOnly, setIncompleteOnly] = useState(false)
  const [teamFilter, setTeamFilter] = useState<string>("")

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  )

  // Per-player readiness
  const playerReadiness = useMemo(() => {
    return players.map((p) => ({
      player: p,
      criteria: computeReadiness(p),
      ready: isFullyReady(p),
    }))
  }, [players])

  const playersFullyReady = playerReadiness.filter((r) => r.ready).length

  // Filtered rows for grid
  const filteredRows = useMemo(() => {
    return playerReadiness.filter((r) => {
      if (teamFilter && String(r.player.teamId) !== teamFilter) return false
      if (incompleteOnly && r.ready) return false
      return true
    })
  }, [playerReadiness, teamFilter, incompleteOnly])

  const blockerStats = useMemo(() => {
    return CHECKS.map((check) => {
      const players_with_blocker = players.filter(check.detect)
      return { check, players: players_with_blocker }
    })
  }, [players])

  const totalBlockers = blockerStats.reduce((s, b) => s + b.players.length, 0)
  const readyPct = players.length > 0 ? Math.round((playersFullyReady / players.length) * 100) : 0
  const days = daysUntilTournament()

  return (
    <PageLayout
      title="Tournament Readiness"
      description="Everything that's still blocking the team. One place to see who needs chasing this week."
    >
      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
          Loading readiness data…
        </div>
      ) : players.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
          No players yet. Add players via the Players page to see readiness.
        </div>
      ) : (
        <>
          {/* ── Headline stat + progress bar ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6 mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">Tournament ready</p>
                <p className="text-4xl font-bold text-foreground">
                  <span className={readyPct === 100 ? "text-green-700" : "text-primary"}>
                    {playersFullyReady}
                  </span>
                  <span className="text-xl text-muted-foreground font-medium"> of {players.length} players</span>
                </p>
              </div>
              <div className="flex gap-4 text-center shrink-0">
                <div className="px-4 py-2 rounded-xl bg-muted/30 border border-border">
                  <p className="text-2xl font-bold text-foreground">{days}</p>
                  <p className="text-xs text-muted-foreground">days to go</p>
                </div>
                <div className="px-4 py-2 rounded-xl bg-muted/30 border border-border">
                  <p className={`text-2xl font-bold ${totalBlockers === 0 ? "text-green-700" : "text-amber-700"}`}>{totalBlockers}</p>
                  <p className="text-xs text-muted-foreground">blockers</p>
                </div>
              </div>
            </div>
            <div className="h-3 w-full bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${readyPct === 100 ? "bg-green-500" : "bg-primary"}`}
                style={{ width: `${readyPct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 text-right">{readyPct}% complete</p>
          </div>

          {/* ── Per-player grid ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden mb-6">
            {/* Grid header with filters */}
            <div className="p-4 border-b border-border flex flex-wrap items-center gap-3">
              <h2 className="text-base font-semibold text-foreground flex-1">Player readiness grid</h2>
              <div className="flex items-center gap-3 flex-wrap">
                <Select
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                  className="h-8 text-sm w-40"
                >
                  <option value="">All squads</option>
                  {teams.map((t) => (
                    <option key={t.id} value={String(t.id)}>{t.name}</option>
                  ))}
                </Select>
                <button
                  onClick={() => setIncompleteOnly((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 h-8 rounded-lg text-sm font-medium border transition-all ${
                    incompleteOnly
                      ? "bg-amber-100 text-amber-800 border-amber-300"
                      : "bg-white text-muted-foreground border-border hover:border-primary/40"
                  }`}
                >
                  <Filter className="w-3.5 h-3.5" />
                  Incomplete only
                </button>
              </div>
              <p className="text-xs text-muted-foreground w-full sm:w-auto">
                {filteredRows.length} player{filteredRows.length !== 1 ? "s" : ""} shown
              </p>
            </div>

            {/* Scrollable table */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground sticky left-0 bg-muted/30 w-48">Player</th>
                    <th className="text-center px-3 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                    {GRID_CRITERIA.map((c) => (
                      <th key={c.key} className="text-center px-2 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap" title={c.label}>
                        {c.short}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td colSpan={2 + GRID_CRITERIA.length} className="px-4 py-8 text-center text-muted-foreground">
                        {incompleteOnly ? "All players in this view are fully ready!" : "No players match the current filter."}
                      </td>
                    </tr>
                  ) : (
                    filteredRows.map(({ player, criteria, ready }) => {
                      const team = teamMap[player.teamId]
                      return (
                        <Link key={player.id} href={`/players?playerId=${player.id}`} asChild>
                          <tr className="hover:bg-muted/10 cursor-pointer group">
                            <td className="px-4 py-2.5 sticky left-0 bg-white group-hover:bg-muted/10 border-r border-border/50">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                  {player.shirtNumber ?? "—"}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-foreground truncate">{player.name}</p>
                                  {team && <p className="text-xs text-muted-foreground truncate">{team.name}</p>}
                                </div>
                              </div>
                            </td>
                            <td className="text-center px-3 py-2.5">
                              {ready ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2 py-0.5">
                                  <CheckCheck className="w-3 h-3" /> Ready
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                  {GRID_CRITERIA.filter((c) => !criteria[c.key]).length} issue{GRID_CRITERIA.filter((c) => !criteria[c.key]).length !== 1 ? "s" : ""}
                                </span>
                              )}
                            </td>
                            {GRID_CRITERIA.map((c) => {
                              const passed = criteria[c.key]
                              return (
                                <td key={c.key} className="text-center px-2 py-2.5">
                                  {passed ? (
                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-700 mx-auto">
                                      <CheckCircle2 className="w-4 h-4" />
                                    </span>
                                  ) : (
                                    <span
                                      className={`inline-flex items-center justify-center w-6 h-6 rounded-full mx-auto ${
                                        c.severity === "red"
                                          ? "bg-red-100 text-red-700"
                                          : "bg-amber-100 text-amber-700"
                                      }`}
                                    >
                                      <XCircle className="w-4 h-4" />
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        </Link>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Legend */}
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 flex flex-wrap gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><CheckCircle2 className="w-3 h-3 text-green-700" /></span> Complete</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center"><XCircle className="w-3 h-3 text-amber-700" /></span> Missing (low)</span>
              <span className="flex items-center gap-1.5"><span className="w-4 h-4 rounded-full bg-red-100 flex items-center justify-center"><XCircle className="w-3 h-3 text-red-700" /></span> Missing (urgent)</span>
              <span className="ml-auto">Click a row to view the player record →</span>
            </div>
          </div>

          {/* ── Blocker cards (retained) ── */}
          <h2 className="text-sm font-semibold text-muted-foreground mb-3 mt-2">Blockers by category</h2>
          <div className="space-y-3">
            {blockerStats.map(({ check, players: blockedPlayers }) => {
              const Icon = check.icon
              const tones = toneClasses(check.tone)
              const isOpen = expanded === check.key
              const isClear = blockedPlayers.length === 0

              return (
                <div
                  key={check.key}
                  className={`rounded-2xl border bg-white overflow-hidden ${
                    isClear ? "border-green-200 bg-green-50/30" : tones.wrap
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setExpanded(isOpen ? null : check.key)}
                    disabled={isClear}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${
                      isClear ? "cursor-default" : "hover:bg-white/60"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isClear ? "bg-green-100 text-green-700" : tones.icon
                      }`}
                    >
                      {isClear ? (
                        <CheckCircle2 className="w-5 h-5" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{check.label}</h3>
                        {isClear && (
                          <Badge className="bg-green-100 text-green-800 border-green-200 hover:bg-green-100 text-xs">
                            All clear
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5 truncate">
                        {check.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {!isClear && (
                        <span className={`text-2xl font-bold ${tones.count}`}>
                          {blockedPlayers.length}
                        </span>
                      )}
                      {!isClear && (
                        <ChevronRight
                          className={`w-5 h-5 text-muted-foreground transition-transform ${
                            isOpen ? "rotate-90" : ""
                          }`}
                        />
                      )}
                    </div>
                  </button>

                  {isOpen && !isClear && (
                    <div className="border-t border-border bg-white">
                      <ul className="divide-y divide-border">
                        {blockedPlayers.map((player) => {
                          const team = teamMap[player.teamId]
                          const detail = check.detail?.(player) ?? null
                          return (
                            <li
                              key={player.id}
                              className="px-5 py-3 flex items-center gap-3 hover:bg-muted/20"
                            >
                              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                                {player.shirtNumber ?? "—"}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-foreground truncate">
                                  {player.name}
                                </p>
                                <p className="text-xs text-muted-foreground truncate">
                                  {team ? `${team.name} · ${team.category}` : "Unknown team"}
                                  {detail ? ` · ${detail}` : ""}
                                </p>
                              </div>
                              {check.href && (
                                <Link
                                  href={check.href}
                                  className="text-xs font-medium text-primary hover:underline shrink-0"
                                >
                                  Fix →
                                </Link>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {totalBlockers === 0 && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-600 mx-auto mb-2" />
              <h3 className="font-semibold text-green-900">All players fully ready</h3>
              <p className="text-sm text-green-800 mt-1">
                Nothing blocking the team right now. Nice work.
              </p>
            </div>
          )}
        </>
      )}
    </PageLayout>
  )
}
