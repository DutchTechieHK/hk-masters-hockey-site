import { useListPlayers, useListTeams, useListMatches } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Users, DollarSign, CalendarDays, Trophy, CalendarClock, Megaphone } from "lucide-react"
import { format, parseISO } from "date-fns"
import { useLocation } from "wouter"
import { useMemo, useState, useEffect } from "react"
import { getStoredAdminToken } from "@/lib/admin-auth"

const ROTTERDAM_ARCHIVE_CATEGORIES = new Set(["MO40", "MO50"])

const hkdPrecise = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

function StatCard({ title, value, icon, trend, onClick, clickableLabel, clickable }: { title: string, value: string | number, icon: React.ReactNode, trend?: string, onClick?: () => void, clickableLabel?: string, clickable?: boolean }) {
  return (
    <div
      onClick={clickable ? onClick : undefined}
      className={`bg-white rounded-2xl shadow-sm border border-border p-6 flex flex-col justify-between ${clickable ? "cursor-pointer hover:border-primary/40 hover:shadow-md transition-all group" : ""}`}
    >
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
          <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
            {icon}
          </div>
        </div>
        <p className="text-3xl font-display font-bold text-foreground mb-1">{value}</p>
        {trend && <p className="text-sm text-muted-foreground">{trend}</p>}
      </div>
      {clickable && (
        <div className="mt-4 pt-4 border-t border-border/50 text-xs font-medium text-primary flex items-center gap-1 group-hover:gap-1.5 transition-all">
          {clickableLabel} <span aria-hidden="true">→</span>
        </div>
      )}
    </div>
  )
}

export default function Dashboard() {
  const [, navigate] = useLocation()

  const { data: players = [] } = useListPlayers()
  const { data: allTeams = [] } = useListTeams()
  const { data: matches = [] } = useListMatches()

  const [announcements, setAnnouncements] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])

  useEffect(() => {
    const fetchLocal = async () => {
      try {
        const token = getStoredAdminToken()
        const headers = {
          "Content-Type": "application/json",
          ...(token ? { "x-session-token": token } : {}),
        }
        const [aRes, eRes] = await Promise.all([
          fetch("/api/announcements", { headers }),
          fetch("/api/events", { headers })
        ])
        if (aRes.ok) setAnnouncements(await aRes.json())
        if (eRes.ok) setEvents(await eRes.json())
      } catch (err) {
        console.error(err)
      }
    }
    fetchLocal()
  }, [])

  const activePlayers = useMemo(() => players.filter(p => p.memberStatus === "active"), [players])
  const menCount = activePlayers.filter(p => p.currentMembershipSection === "men").length
  const womenCount = activePlayers.filter(p => p.currentMembershipSection === "women").length
  const notSetCount = activePlayers.filter(p => !p.currentMembershipSection || p.currentMembershipSection === "not_set").length
  const teams = useMemo(
    () => allTeams.filter(team => !ROTTERDAM_ARCHIVE_CATEGORIES.has(team.category)),
    [allTeams],
  )

  const paidCount = activePlayers.filter(p => p.membershipFeePaid).length

  const upcomingMatches = useMemo(() => {
    const now = new Date()
    return matches
      .filter(m => new Date(m.kickoffAt) > now)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime())
  }, [matches])

  const nextMatch = upcomingMatches[0]

  const upcomingEvents = useMemo(() => {
    const now = new Date()
    return events
      .filter(e => new Date(e.startsAt) > now)
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
  }, [events])

  const nextEvent = upcomingEvents[0]

  return (
    <PageLayout
      title="League & Socials Dashboard"
      description="Current overview of HK Masters members, teams, matches, and communications."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
        <StatCard
          title="Active Members"
          value={activePlayers.length.toString()}
          icon={<Users className="w-6 h-6 text-blue-500" />}
          trend={`${teams.length} teams registered`}
          clickable
          clickableLabel="View Members"
          onClick={() => navigate("/players")}
        />
        <StatCard
          title="Membership Fees"
          value={`${paidCount} / ${activePlayers.length}`}
          icon={<DollarSign className="w-6 h-6 text-emerald-500" />}
          trend="Members paid for this season"
          clickable
          clickableLabel="View Fees"
          onClick={() => navigate("/fees")}
        />
        <StatCard
          title="Upcoming Matches"
          value={upcomingMatches.length.toString()}
          icon={<Trophy className="w-6 h-6 text-indigo-500" />}
          trend={nextMatch ? `Next: ${format(parseISO(nextMatch.kickoffAt), "EEE d MMM, HH:mm")}` : "No matches scheduled"}
          onClick={() => navigate("/matches")}
          clickable
          clickableLabel="View Matches"
        />
        <StatCard
          title="Upcoming Events"
          value={upcomingEvents.length.toString()}
          icon={<CalendarClock className="w-6 h-6 text-amber-500" />}
          trend={nextEvent ? `Next: ${format(parseISO(nextEvent.startsAt), "EEE d MMM, HH:mm")}` : "Nothing scheduled"}
          onClick={() => navigate("/events")}
          clickable
          clickableLabel="View Events"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Members Breakdown */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="text-xl font-display font-bold">Membership Breakdown</h2>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="font-medium text-foreground">Men's Section</span>
              </div>
              <span className="font-bold text-lg">{menCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                <span className="font-medium text-foreground">Women's Section</span>
              </div>
              <span className="font-bold text-lg">{womenCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                <span className="font-medium text-foreground text-muted-foreground">Not Set</span>
              </div>
              <span className="font-bold text-lg text-muted-foreground">{notSetCount}</span>
            </div>

            <div className="pt-6 border-t border-border">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Teams</h3>
              <div className="space-y-3">
                {teams.map(team => (
                  <div key={team.id} className="flex justify-between items-center text-sm">
                    <span className="font-medium text-foreground">{team.name}</span>
                    <Badge variant="outline">{team.category}</Badge>
                  </div>
                ))}
                {teams.length === 0 && <p className="text-sm text-muted-foreground">No teams active.</p>}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Announcements */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="p-6 border-b border-border flex items-center justify-between">
            <h2 className="text-xl font-display font-bold">Recent Communications</h2>
            <button onClick={() => navigate("/announcements")} className="text-sm text-primary font-medium hover:underline">
              View all
            </button>
          </div>
          <div className="divide-y divide-border flex-1">
            {announcements.slice(0, 5).map(a => (
              <div key={a.id} className="p-4 hover:bg-muted/30 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 text-muted-foreground shrink-0">
                    <Megaphone className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm">{a.title}</h3>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{a.body}</p>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {format(new Date(a.createdAt), "d MMM yyyy")}
                    </p>
                  </div>
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center justify-center h-full">
                <Megaphone className="w-8 h-8 opacity-20 mb-3" />
                No recent announcements.
              </div>
            )}
          </div>
        </div>

      </div>
    </PageLayout>
  )
}

function Badge({ children, variant = "default", className = "" }: { children: React.ReactNode, variant?: string, className?: string }) {
  const styles = variant === "outline" ? "border border-border text-foreground" : "bg-primary/10 text-primary"
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${styles} ${className}`}>
      {children}
    </span>
  )
}
