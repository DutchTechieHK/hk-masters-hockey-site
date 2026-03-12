import { useGetDashboard } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Users, DollarSign, CalendarDays, TrendingUp, AlertCircle, CheckCircle2 } from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { format, parseISO } from "date-fns"

export default function Dashboard() {
  const { data: stats, isLoading, error } = useGetDashboard()

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
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
          title="Upcoming Deadlines" 
          value={stats.upcomingDeadlines.length.toString()} 
          icon={<CalendarDays className="w-6 h-6 text-amber-500" />}
          trend="Tasks needing attention"
        />
        <StatCard 
          title="Total Outstanding" 
          value={formatCurrency(stats.teamStats.reduce((sum, t) => sum + t.feesOutstanding, 0))} 
          icon={<DollarSign className="w-6 h-6 text-rose-500" />}
          trend="Player fees remaining"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column (2/3 width) */}
        <div className="lg:col-span-2 space-y-8">
          
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
                        <p className="font-semibold text-emerald-600">{formatCurrency(team.feesPaid)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
                        <p className="font-semibold text-rose-600">{formatCurrency(team.feesOutstanding)}</p>
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

          {/* Fundraising Progress */}
          <div className="bg-white rounded-2xl shadow-sm border border-border p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <h2 className="text-xl font-display font-bold mb-6">Fundraising Goal</h2>
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

        </div>

        {/* Right Column (1/3 width) */}
        <div className="space-y-8">
          
          {/* Upcoming Deadlines */}
          <div className="bg-white rounded-2xl shadow-sm border border-border">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h2 className="text-xl font-display font-bold">Key Deadlines</h2>
              <CalendarDays className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="p-4 space-y-4">
              {stats.upcomingDeadlines.length > 0 ? (
                stats.upcomingDeadlines.map((deadline, idx) => (
                  <div key={idx} className="flex gap-4 items-start p-3 rounded-xl hover:bg-muted transition-colors">
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex flex-col items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-amber-800 uppercase">{format(parseISO(deadline.dueDate), 'MMM')}</span>
                      <span className="text-lg font-bold text-amber-900 leading-none">{format(parseISO(deadline.dueDate), 'dd')}</span>
                    </div>
                    <div>
                      <p className="font-bold text-foreground leading-tight">{deadline.title}</p>
                      <span className="inline-flex items-center px-2 py-0.5 mt-2 rounded text-xs font-medium bg-secondary text-secondary-foreground capitalize">
                        {deadline.category.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
                  <CheckCircle2 className="w-10 h-10 mb-3 text-emerald-400/50" />
                  <p>All caught up!</p>
                  <p className="text-sm">No upcoming deadlines.</p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </PageLayout>
  )
}

function StatCard({ title, value, icon, trend }: { title: string, value: string, icon: React.ReactNode, trend: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-border shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden">
      <div className="flex justify-between items-start mb-4 relative z-10">
        <h3 className="font-medium text-muted-foreground">{title}</h3>
        <div className="p-2 rounded-xl bg-muted/50 group-hover:scale-110 transition-transform">
          {icon}
        </div>
      </div>
      <div className="relative z-10">
        <p className="text-3xl font-display font-bold text-foreground">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{trend}</p>
      </div>
      <div className="absolute -bottom-6 -right-6 opacity-5 group-hover:opacity-10 transition-opacity scale-150 pointer-events-none">
        {icon}
      </div>
    </div>
  )
}
