import { useMemo } from "react"
import { useGetAdminArrivals } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Badge } from "@/components/ui/badge"
import { Plane, MapPin, AlertTriangle, MessageSquare } from "lucide-react"

function formatTime(dt: string): string {
  const d = new Date(dt)
  if (isNaN(d.getTime())) return dt
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
}

function formatDayHeading(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00")
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
}

function categoryColor(category: string | null): string {
  if (!category) return "bg-muted text-muted-foreground"
  const c = category.toLowerCase()
  if (c.includes("50")) return "bg-violet-100 text-violet-800 border-violet-200"
  if (c.includes("40")) return "bg-sky-100 text-sky-800 border-sky-200"
  return "bg-muted text-muted-foreground border-border"
}

export default function TravelOverview() {
  const { data, isLoading } = useGetAdminArrivals()

  const dayGroups = useMemo(() => {
    if (!data) return []
    const groups = new Map<string, typeof data.withArrival>()
    for (const entry of data.withArrival) {
      const day = entry.arrival.slice(0, 10)
      const existing = groups.get(day) ?? []
      existing.push(entry)
      groups.set(day, existing)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const totalWithArrival = data?.withArrival.length ?? 0
  const totalWithout = data?.withoutArrival.length ?? 0

  return (
    <PageLayout
      title="Arrivals Overview"
      description="Day-by-day arrival timeline for airport transfer planning. Players self-manage their own travel details."
    >
      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center text-muted-foreground">
          Loading arrivals…
        </div>
      ) : (
        <div className="space-y-8">
          {/* Summary strip */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 bg-white rounded-xl border border-border px-4 py-2.5 shadow-sm text-sm">
              <Plane className="w-4 h-4 text-primary" />
              <span className="font-semibold text-foreground">{totalWithArrival}</span>
              <span className="text-muted-foreground">arrival{totalWithArrival !== 1 ? "s" : ""} set</span>
            </div>
            {totalWithout > 0 && (
              <div className="flex items-center gap-2 bg-amber-50 rounded-xl border border-amber-200 px-4 py-2.5 shadow-sm text-sm">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="font-semibold text-amber-800">{totalWithout}</span>
                <span className="text-amber-700">player{totalWithout !== 1 ? "s" : ""} without arrival time</span>
              </div>
            )}
          </div>

          {/* Day-by-day timeline */}
          {dayGroups.length === 0 && totalWithout === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
              No arrival data yet.
            </div>
          ) : (
            <>
              {dayGroups.map(([day, entries]) => (
                <div key={day} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                  {/* Day heading */}
                  <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Plane className="w-4 h-4 text-primary" />
                      <h3 className="font-bold text-foreground">{formatDayHeading(day)}</h3>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {entries.length} player{entries.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {/* Player rows */}
                  <div className="divide-y divide-border">
                    {entries.map((entry) => (
                      <div key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                        {/* Time */}
                        <div className="w-14 shrink-0 font-mono text-sm font-semibold text-foreground tabular-nums pt-0.5">
                          {formatTime(entry.arrival)}
                        </div>

                        {/* Name + team chip */}
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold text-foreground text-sm">{entry.name}</span>
                            {entry.teamCategory && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColor(entry.teamCategory)}`}>
                                {entry.teamCategory}
                              </span>
                            )}
                          </div>

                          {/* Airport + travel note */}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                            {entry.arrivalCity && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="w-3 h-3 shrink-0" />
                                {entry.arrivalCity}
                              </span>
                            )}
                            {entry.travelNote && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MessageSquare className="w-3 h-3 shrink-0" />
                                {entry.travelNote}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {/* Players without arrival */}
              {data && data.withoutArrival.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                  <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/60 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-500" />
                      <h3 className="font-bold text-amber-800">Arrival not set</h3>
                    </div>
                    <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                      {data.withoutArrival.length} player{data.withoutArrival.length !== 1 ? "s" : ""}
                    </Badge>
                  </div>
                  <div className="divide-y divide-border">
                    {data.withoutArrival.map((entry) => (
                      <div key={entry.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                        <span className="font-medium text-foreground text-sm">{entry.name}</span>
                        {entry.teamCategory && (
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColor(entry.teamCategory)}`}>
                            {entry.teamCategory}
                          </span>
                        )}
                        {entry.teamName && (
                          <span className="text-xs text-muted-foreground">{entry.teamName}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </PageLayout>
  )
}
