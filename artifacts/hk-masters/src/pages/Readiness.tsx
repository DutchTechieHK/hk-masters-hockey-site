import { useMemo, useState } from "react"
import { Link } from "wouter"
import { useListPlayers, useListTeams } from "@workspace/api-client-react"
import type { Player } from "@workspace/api-client-react/src/generated/api.schemas"
import { PageLayout } from "@/components/layout/PageLayout"
import { Badge } from "@/components/ui/badge"
import {
  Plane,
  BedDouble,
  Wallet,
  BookUser,
  Shirt,
  Phone,
  CheckCircle2,
  ChevronRight,
} from "lucide-react"

const TOURNAMENT_END = new Date("2026-08-01")
const PASSPORT_WARN_DATE = new Date("2026-10-31")

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

  const teamMap = useMemo(
    () => Object.fromEntries(teams.map((t) => [t.id, t])),
    [teams],
  )

  const blockerStats = useMemo(() => {
    return CHECKS.map((check) => {
      const players_with_blocker = players.filter(check.detect)
      return { check, players: players_with_blocker }
    })
  }, [players])

  const totalBlockers = blockerStats.reduce((s, b) => s + b.players.length, 0)
  const playersFullyReady = useMemo(() => {
    return players.filter((p) => !CHECKS.some((c) => c.detect(p))).length
  }, [players])

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
          {/* Top summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-2xl shadow-sm border border-border p-5">
              <p className="text-sm font-medium text-muted-foreground">Days to tournament</p>
              <p className="text-3xl font-bold text-foreground mt-1">{days}</p>
              <p className="text-xs text-muted-foreground mt-1">Kicks off 22 Jul 2026</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-border p-5">
              <p className="text-sm font-medium text-muted-foreground">Players fully ready</p>
              <p className="text-3xl font-bold text-green-700 mt-1">
                {playersFullyReady}{" "}
                <span className="text-base text-muted-foreground font-medium">
                  of {players.length}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {players.length > 0
                  ? `${Math.round((playersFullyReady / players.length) * 100)}% complete`
                  : "—"}
              </p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm border border-border p-5">
              <p className="text-sm font-medium text-muted-foreground">Open blockers</p>
              <p
                className={`text-3xl font-bold mt-1 ${
                  totalBlockers === 0 ? "text-green-700" : "text-amber-700"
                }`}
              >
                {totalBlockers}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Across {players.length} player{players.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Blocker cards */}
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
