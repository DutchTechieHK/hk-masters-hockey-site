import { useGetDashboard, useListPlayers, useListKits, useGetFunRunSummary } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Users, DollarSign, CalendarDays, TrendingUp, AlertCircle, CheckCircle2, ArrowRight, Trophy, CalendarClock, ShieldCheck, Package, FileText, Gavel, Footprints, Building2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { isFullyReady } from "@/lib/readiness"
import { useMemo } from "react"

const hkdPrecise = new Intl.NumberFormat("en-HK", {
  style: "currency",
  currency: "HKD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})
import { format, parseISO } from "date-fns"
import { useLocation } from "wouter"

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDashboard()
  const { data: players = [] } = useListPlayers()
  const { data: kitOrders = [] } = useListKits()
  const { data: funRunSummary } = useGetFunRunSummary({ refetchInterval: 15000 })
  const [, navigate] = useLocation()

  const readinessStats = useMemo(() => {
    const ready = players.filter(isFullyReady).length
    return { ready, total: players.length }
  }, [players])

  const kitStats = useMemo(() => {
    const totalValue = kitOrders.reduce((s, o) => s + (o.totalCostHKD || 0), 0)
    const totalDeposited = kitOrders.reduce((s, o) => s + (o.depositAmountHKD || 0), 0)
    const balanceOutstanding = kitOrders.reduce((s, o) => {
      if (o.balancePaidDate) return s
      return s + Math.max(0, (o.totalCostHKD || 0) - (o.depositAmountHKD || 0))
    }, 0)
    const receivedCount = kitOrders.filter(o => o.orderStatus === "received").length
    const progress = totalValue > 0 ? Math.min(100, (totalDeposited / totalValue) * 100) : 0
    return { totalValue, totalDeposited, balanceOutstanding, receivedCount, orderCount: kitOrders.length, progress }
  }, [kitOrders])

  if (isLoading) {
    return (
      <PageLayout title="Dashboard">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-white rounded-2xl h-32 border border-border"></div>
          ))}
        </div>
      </PageLayout>
    )
  }

  if (error || !stats) {
    return (
      <PageLayout title="Dashboard">
        <div className="bg-destructive/10 text-destructive p-6 rounded-2xl border border-destructive/20 flex items-center space-x-3">
          <AlertCircle className="w-6 h-6" />
          <p className="font-medium">Failed to load dashboard data. Please try again later.</p>
        </div>
      </PageLayout>
    )
  }

  const fundraisingProgress = Math.min(100, (stats.totalFundsRaised / (stats.fundraisingTarget || 1)) * 100)

  return (
    <PageLayout 
      title="Dashboard overview" 
      description="Overview of your teams, financials, and upcoming logistics for Rotterdam 2026."
    >
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-8">
        <StatCard 
          title="Total Players" 
          value={stats.totalPlayers.toString()} 
          icon={<Users className="w-6 h-6 text-blue-500" />}
          trend={`${stats.teamStats.length} teams registered`}
        />
        <StatCard 
          title="Funds Raised" 
          value={formatCurrency(stats.totalFundsRaised)} 
          icon={<TrendingUp className="w-6 h-6 text-emerald-500" />}
          trend={`Target: ${formatCurrency(stats.fundraisingTarget)}`}
        />
        <StatCard 
          title="Upcoming Fixtures" 
          value={stats.upcomingMatchCount.toString()} 
          icon={<Trophy className="w-6 h-6 text-indigo-500" />}
          trend={stats.nextMatchKickoffAt
            ? `Next: ${format(parseISO(stats.nextMatchKickoffAt), "EEE d MMM, HH:mm")}`
            : "No matches scheduled"}
          onClick={() => navigate("/matches")}
          clickable
          clickableLabel="View Matches"
        />
        <StatCard
          title="Upcoming Events"
          value={(stats as unknown as { upcomingEventCount?: number }).upcomingEventCount?.toString() ?? "0"}
          icon={<CalendarClock className="w-6 h-6 text-amber-500" />}
          trend={(() => {
            const s = stats as unknown as { nextEventStartsAt?: string | null; nextEventTitle?: string | null }
            if (!s.nextEventStartsAt) return "Nothing scheduled"
            return `Next: ${format(parseISO(s.nextEventStartsAt), "EEE d MMM, HH:mm")}`
          })()}
          onClick={() => navigate("/events")}
          clickable
          clickableLabel="View Events"
        />
        <StatCard 
          title="Fees Outstanding" 
          value={hkdPrecise.format(stats.feesAmountOutstanding)} 
          icon={<DollarSign className="w-6 h-6 text-rose-500" />}
          trend={`${stats.playersPaidCount} of ${stats.totalPlayers} players paid`}
          onClick={() => navigate("/fees")}
          clickable
          clickableLabel="View Fees"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">

          {/* Fundraising Progress */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <h2 className="text-xl font-display font-bold mb-5">Fundraising Goal</h2>

            {stats.fundraisingBreakdown && (() => {
              const bd = stats.fundraisingBreakdown
              const auction = (stats as unknown as { auctionStats?: { itemCount: number } }).auctionStats
              const auctionNotStarted = !auction || auction.itemCount === 0
              const sources = [
                { label: "Online Pledges", value: bd.onlinePledges, notStarted: false },
                { label: "Lego Jar", value: bd.legoJar, notStarted: false },
                { label: "Sponsors", value: bd.sponsors, notStarted: false },
                { label: "Fun Run", value: bd.funRun, notStarted: false },
                { label: "Auction", value: bd.auction, notStarted: auctionNotStarted },
              ]
              return (
                <div className="divide-y divide-border mb-5 rounded-xl border border-border overflow-hidden">
                  {sources.map((src) => (
                    <div key={src.label} className="flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors">
                      <span className="text-sm font-medium text-foreground">{src.label}</span>
                      {src.notStarted ? (
                        <span className="text-xs font-medium text-muted-foreground italic">Not started</span>
                      ) : (
                        <span className="text-sm font-semibold text-foreground tabular-nums">{hkdPrecise.format(src.value)}</span>
                      )}
                    </div>
                  ))}
                </div>
              )
            })()}

            <div className="mb-2 flex justify-between items-end">
              <div>
                <p className="text-4xl font-bold text-foreground">{formatCurrency(stats.totalFundsRaised)}</p>
                <p className="text-muted-foreground mt-1">raised so far</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{formatCurrency(stats.fundraisingTarget)}</p>
                <p className="text-sm text-muted-foreground">Goal</p>
              </div>
            </div>
            <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${fundraisingProgress}%` }}
              />
            </div>
            <p className="text-sm font-medium text-emerald-600 mt-3 text-right">
              {fundraisingProgress.toFixed(1)}% achieved
            </p>
          </div>

          {/* Team Breakdown */}
          <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="p-6 border-b border-border">
              <h2 className="text-xl font-display font-bold">Team Breakdown</h2>
            </div>
            <div className="divide-y divide-border">
              {stats.teamStats.map((team) => (
                <div key={team.teamId} className="p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                    <div>
                      <h3 className="text-lg font-bold text-primary">{team.teamName}</h3>
                      <p className="text-sm text-muted-foreground">{team.category} • {team.playerCount} players</p>
                    </div>
                    <div className="flex gap-4">
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Fees Paid</p>
                        <p className="font-semibold text-emerald-600">{team.feesPaid} paid</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
                        <p className="font-semibold text-rose-600">{team.feesOutstanding} unpaid</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {stats.teamStats.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">No teams registered yet.</div>
              )}
            </div>
          </div>

        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-8">
          
          {/* Documents card */}
          <button
            className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
            onClick={() => navigate("/documents")}
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">Documents</h2>
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <FileText className="w-5 h-5" />
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            <div className="p-6">
              <div className="flex items-end gap-2 mb-4">
                <p className="text-4xl font-bold text-foreground">{stats.documentCounts.total}</p>
                <p className="text-lg text-muted-foreground font-medium mb-1">total</p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Mandatory</span>
                  <span className="text-sm font-semibold text-foreground">{stats.documentCounts.mandatory}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Regulation</span>
                  <span className="text-sm font-semibold text-foreground">{stats.documentCounts.regulation}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Information</span>
                  <span className="text-sm font-semibold text-foreground">{stats.documentCounts.information}</span>
                </div>
              </div>
              <p className="text-xs text-primary font-medium mt-4 flex items-center gap-1">
                View all documents <ArrowRight className="w-3 h-3" />
              </p>
            </div>
          </button>

          {/* Kit Procurement card */}
          {kitStats.orderCount > 0 && (
            <button
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
              onClick={() => navigate("/kits")}
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-display font-bold">Kit Procurement</h2>
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <Package className="w-5 h-5" />
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-foreground">{formatCurrency(kitStats.totalValue)}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">total order value across {kitStats.orderCount} item{kitStats.orderCount !== 1 ? "s" : ""}</p>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 rounded-full transition-all duration-700"
                    style={{ width: `${kitStats.progress}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mb-3">
                  <span className="text-emerald-600 font-medium">{formatCurrency(kitStats.totalDeposited)} deposited</span>
                  <span className="text-rose-600 font-medium">{formatCurrency(kitStats.balanceOutstanding)} outstanding</span>
                </div>
                {kitStats.receivedCount > 0 && (
                  <p className="text-xs text-primary font-medium flex items-center gap-1">
                    {kitStats.receivedCount} order{kitStats.receivedCount !== 1 ? "s" : ""} received — track distribution <ArrowRight className="w-3 h-3" />
                  </p>
                )}
              </div>
            </button>
          )}

          {/* Auction card */}
          {(() => {
            const auction = (stats as unknown as { auctionStats?: { itemCount: number; itemsWithBids: number; totalBidValue: number; isLive: boolean } }).auctionStats
            if (!auction || auction.itemCount === 0) return null
            return (
              <button
                className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
                onClick={() => navigate("/auction")}
              >
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-display font-bold">Auction</h2>
                    {auction.isLive && (
                      <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                        Live
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                    <Gavel className="w-5 h-5" />
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-end gap-2 mb-1">
                    <p className="text-3xl font-bold text-foreground">{formatCurrency(auction.totalBidValue)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">current top bids across {auction.itemCount} item{auction.itemCount !== 1 ? "s" : ""}</p>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{auction.itemsWithBids} item{auction.itemsWithBids !== 1 ? "s" : ""} with bids</span>
                    <span>{auction.itemCount - auction.itemsWithBids} without bids</span>
                  </div>
                  <p className="text-xs text-primary font-medium mt-4 flex items-center gap-1">
                    Manage auction <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )
          })()}

          {/* Sponsors card */}
          {(() => {
            const sponsorStats = (stats as unknown as { sponsorStats?: { count: number; contributionTotal: number; tierBreakdown: { gold: number; silver: number; bronze: number } } }).sponsorStats
            if (!sponsorStats || sponsorStats.count === 0) return null
            return (
              <button
                className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
                onClick={() => navigate("/sponsors")}
              >
                <div className="p-6 border-b border-border flex items-center justify-between">
                  <h2 className="text-xl font-display font-bold">Sponsors</h2>
                  <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                    <Building2 className="w-5 h-5" />
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
                <div className="p-6">
                  <div className="flex items-end gap-2 mb-1">
                    <p className="text-3xl font-bold text-foreground">{hkdPrecise.format(sponsorStats.contributionTotal)}</p>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">total contributions from {sponsorStats.count} active sponsor{sponsorStats.count !== 1 ? "s" : ""}</p>
                  <div className="space-y-2">
                    {sponsorStats.tierBreakdown.gold > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                          Gold
                        </span>
                        <span className="text-sm font-semibold text-foreground">{sponsorStats.tierBreakdown.gold}</span>
                      </div>
                    )}
                    {sponsorStats.tierBreakdown.silver > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" />
                          Silver
                        </span>
                        <span className="text-sm font-semibold text-foreground">{sponsorStats.tierBreakdown.silver}</span>
                      </div>
                    )}
                    {sponsorStats.tierBreakdown.bronze > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-amber-700 inline-block" />
                          Bronze
                        </span>
                        <span className="text-sm font-semibold text-foreground">{sponsorStats.tierBreakdown.bronze}</span>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-primary font-medium mt-4 flex items-center gap-1">
                    Manage sponsors <ArrowRight className="w-3 h-3" />
                  </p>
                </div>
              </button>
            )
          })()}

          {/* Fun Run summary card */}
          {funRunSummary && (
            <button
              className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
              onClick={() => navigate("/fun-run")}
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h2 className="text-xl font-display font-bold">Fun Run</h2>
                <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                  <Footprints className="w-5 h-5" />
                  <ArrowRight className="w-4 h-4" />
                </div>
              </div>
              <div className="p-6">
                <div className="flex items-end gap-2 mb-1">
                  <p className="text-3xl font-bold text-foreground">{hkdPrecise.format(funRunSummary.totalRaised)}</p>
                </div>
                <p className="text-sm text-muted-foreground mb-4">raised across {funRunSummary.count} participant{funRunSummary.count !== 1 ? "s" : ""}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Registered</span>
                    <span className="text-sm font-semibold text-foreground">{funRunSummary.count}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Completed</span>
                    <span className="text-sm font-semibold text-emerald-600">{funRunSummary.completedCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total raised</span>
                    <span className="text-sm font-semibold text-foreground">{hkdPrecise.format(funRunSummary.totalRaised)}</span>
                  </div>
                </div>
                <p className="text-xs text-primary font-medium mt-4 flex items-center gap-1">
                  View fun run <ArrowRight className="w-3 h-3" />
                </p>
              </div>
            </button>
          )}

          {/* Readiness summary card */}
          <button
            className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group overflow-hidden"
            onClick={() => navigate("/readiness")}
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">Readiness</h2>
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <ShieldCheck className="w-5 h-5" />
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            <div className="p-6">
              {readinessStats.total === 0 ? (
                <p className="text-sm text-muted-foreground">No players yet.</p>
              ) : (
                <>
                  <div className="flex items-end gap-2 mb-3">
                    <p className="text-4xl font-bold text-foreground">
                      <span className={readinessStats.ready === readinessStats.total ? "text-green-700" : "text-primary"}>
                        {readinessStats.ready}
                      </span>
                    </p>
                    <p className="text-lg text-muted-foreground font-medium mb-1">/ {readinessStats.total} ready</p>
                  </div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden mb-3">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${readinessStats.ready === readinessStats.total ? "bg-green-500" : "bg-primary"}`}
                      style={{ width: readinessStats.total > 0 ? `${Math.round((readinessStats.ready / readinessStats.total) * 100)}%` : "0%" }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {readinessStats.total - readinessStats.ready} player{readinessStats.total - readinessStats.ready !== 1 ? "s" : ""} still have open items
                  </p>
                  <p className="text-xs text-primary font-medium mt-3 flex items-center gap-1">
                    View readiness dashboard <ArrowRight className="w-3 h-3" />
                  </p>
                </>
              )}
            </div>
          </button>

          {/* Upcoming Deadlines — clickable, navigates to Logistics */}
          <button
            className="w-full text-left bg-white rounded-2xl shadow-sm border border-border hover:border-primary/40 hover:shadow-md transition-all group"
            onClick={() => navigate("/logistics")}
          >
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">Key Deadlines</h2>
              <div className="flex items-center gap-2 text-muted-foreground group-hover:text-primary transition-colors">
                <CalendarDays className="w-5 h-5" />
                <ArrowRight className="w-4 h-4" />
              </div>
            </div>
            <div className="p-4 space-y-4">
              {stats.upcomingDeadlines.length > 0 ? (
                <>
                  {stats.upcomingDeadlines.map((deadline, idx) => (
                    <div key={idx} className="flex gap-4 items-start p-3 rounded-xl hover:bg-muted transition-colors">
                      <div className="w-12 h-12 rounded-xl bg-amber-100 flex flex-col items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-amber-800 uppercase">{format(parseISO(deadline.dueDate), 'MMM')}</span>
                        <span className="text-lg font-bold text-amber-900 leading-none">{format(parseISO(deadline.dueDate), 'dd')}</span>
                      </div>
                      <div>
                        <p className="font-bold text-foreground leading-tight text-left">{deadline.title}</p>
                        <span className="inline-flex items-center px-2 py-0.5 mt-2 rounded text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                          {deadline.category.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div className="pt-2 text-center text-xs font-medium text-primary flex items-center justify-center gap-1">
                    View all tasks in Logistics <ArrowRight className="w-3 h-3" />
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-400/50" />
                  <p>All caught up!</p>
                  <p className="text-sm">No upcoming deadlines.</p>
                </div>
              )}
            </div>
          </button>

        </div>
      </div>
    </PageLayout>
  )
}

function StatCard({ 
  title, value, icon, trend, onClick, clickable, clickableLabel
}: { 
  title: string; value: string; icon: React.ReactNode; trend: string; 
  onClick?: () => void; clickable?: boolean; clickableLabel?: string
}) {
  const Component = clickable ? 'button' : 'div'
  return (
    <Component
      className={`bg-white p-6 rounded-2xl border border-border shadow-sm transition-shadow group relative overflow-hidden w-full text-left ${
        clickable ? 'hover:shadow-md hover:border-primary/40 cursor-pointer' : 'hover:shadow-md'
      }`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="font-medium text-muted-foreground">{title}</h3>
        <div className="p-2 rounded-xl bg-muted/50 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-display font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{trend}</p>
        {clickable && (
          <p className="text-xs text-primary font-medium mt-2 flex items-center gap-1">
            {clickableLabel ?? "View Logistics"} <ArrowRight className="w-3 h-3" />
          </p>
        )}
      </div>
      <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity scale-150 pointer-events-none">
        {icon}
      </div>
    </Component>
  )
}
