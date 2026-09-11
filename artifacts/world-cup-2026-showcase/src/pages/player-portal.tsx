import { useGetWorldCup2026Showcase } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, CircleDashed, FileText, Plane, Receipt, CalendarDays } from "lucide-react"

export default function PlayerPortalPage() {
  const { data: showcase, isLoading } = useGetWorldCup2026Showcase()

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading archive...</p>
        </div>
      </div>
    )
  }

  if (!showcase) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-700 fill-mode-both">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Archived Player Experience</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          During the campaign, players used this portal to manage their readiness, upload documents, and track financial commitments. Below is an aggregated view of what players accomplished.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Dashboard Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="border-b border-border pb-4 mb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Documentation & Readiness
                </CardTitle>
                <Badge variant="outline">Aggregate archive</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {showcase.readiness.map((item, i) => {
                const percent = Math.round((item.complete / item.total) * 100) || 0
                const isDone = percent === 100
                
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <div className="flex items-center gap-2">
                        {isDone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        ) : (
                          <CircleDashed className="w-4 h-4 text-muted-foreground" />
                        )}
                        <span className="font-medium">{item.label}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{item.complete} / {item.total}</span>
                    </div>
                    <Progress value={percent} indicatorClassName={isDone ? "bg-emerald-600" : "bg-primary"} />
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b border-border pb-4 mb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl flex items-center gap-2">
                  <Plane className="w-5 h-5 text-primary" />
                  Travel Coordination Status
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Arrivals Confirmed</p>
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {showcase.travel.totalPlayers === 0 ? 0 : Math.round((showcase.travel.arrivalConfirmed / showcase.travel.totalPlayers) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{showcase.travel.arrivalConfirmed} players</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Departures Confirmed</p>
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {showcase.travel.totalPlayers === 0 ? 0 : Math.round((showcase.travel.departureConfirmed / showcase.travel.totalPlayers) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{showcase.travel.departureConfirmed} players</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-1">Accommodation Set</p>
                  <p className="text-2xl font-serif font-bold text-foreground">
                    {showcase.travel.totalPlayers === 0 ? 0 : Math.round((showcase.travel.accommodationConfirmed / showcase.travel.totalPlayers) * 100)}%
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">{showcase.travel.accommodationConfirmed} players</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Column */}
        <div className="space-y-6">
          <Card className="bg-primary text-primary-foreground border-transparent">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="w-5 h-5" />
                Financial Standing
              </CardTitle>
              <CardDescription className="text-primary-foreground/80">
                Tour contributions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm font-medium text-primary-foreground/80 mb-1">Total Due</p>
                <p className="text-3xl font-serif font-bold">
                  HK${showcase.fees.due.toLocaleString()}
                </p>
              </div>
              <div className="pt-4 border-t border-primary-foreground/20">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-sm">Collection Rate</span>
                  <span className="text-sm font-bold">
                    {showcase.fees.totalPlayers === 0 ? 0 : Math.round((showcase.fees.paidPlayers / showcase.fees.totalPlayers) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={showcase.fees.totalPlayers === 0 ? 0 : (showcase.fees.paidPlayers / showcase.fees.totalPlayers) * 100} 
                  className="bg-primary-foreground/20 h-1.5"
                  indicatorClassName="bg-white"
                />
                <p className="text-xs text-primary-foreground/70 mt-2">
                  {showcase.fees.paidPlayers} of {showcase.fees.totalPlayers} players cleared
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                Archived Programme
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {showcase.schedule.slice(-3).map((item) => (
                  <div key={`${item.type}-${item.id}`} className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">{item.title}</p>
                      <p className="text-muted-foreground">
                        {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Europe/Amsterdam" }).format(new Date(item.startsAt))}
                        {item.location ? ` · ${item.location}` : ""}
                      </p>
                    </div>
                  </div>
                ))}
                {showcase.schedule.length === 0 && (
                  <div className="flex gap-3 text-sm">
                    <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 shrink-0" />
                  <div>
                      <p className="font-medium text-foreground">No archived programme items</p>
                      <p className="text-muted-foreground">The archive contains no schedule records for this environment.</p>
                  </div>
                </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
