import { useMemo, useState } from "react"
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
  const [activeTab, setActiveTab] = useState<"arrivals" | "departures">("arrivals")

  const arrivalDayGroups = useMemo(() => {
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

  const departureDayGroups = useMemo(() => {
    if (!data) return []
    const groups = new Map<string, typeof data.withDeparture>()
    for (const entry of data.withDeparture) {
      const day = entry.departure.slice(0, 10)
      const existing = groups.get(day) ?? []
      existing.push(entry)
      groups.set(day, existing)
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [data])

  const totalWithArrival = data?.withArrival.length ?? 0
  const totalWithoutArrival = data?.withoutArrival.length ?? 0
  const totalWithDeparture = data?.withDeparture.length ?? 0
  const totalWithoutDeparture = data?.withoutDeparture.length ?? 0

  return (
    <PageLayout
      title="Travel Overview"
      description="Day-by-day arrival and departure timeline for airport transfer planning. Players self-manage their own travel details."
    >
      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center text-muted-foreground">
          Loading travel data…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Tabs */}
          <div className="flex gap-1 bg-muted/40 rounded-xl p-1 w-fit border border-border">
            <button
              onClick={() => setActiveTab("arrivals")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === "arrivals"
                  ? "bg-white shadow-sm text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Arrivals
            </button>
            <button
              onClick={() => setActiveTab("departures")}
              className={`px-5 py-2 rounded-lg text-sm font-semibold transition-colors ${
                activeTab === "departures"
                  ? "bg-white shadow-sm text-foreground border border-border"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Departures
            </button>
          </div>

          {activeTab === "arrivals" && (
            <div className="space-y-8">
              {/* Arrivals summary strip */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border px-4 py-2.5 shadow-sm text-sm">
                  <Plane className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-foreground">{totalWithArrival}</span>
                  <span className="text-muted-foreground">arrival{totalWithArrival !== 1 ? "s" : ""} set</span>
                </div>
                {totalWithoutArrival > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 rounded-xl border border-amber-200 px-4 py-2.5 shadow-sm text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-amber-800">{totalWithoutArrival}</span>
                    <span className="text-amber-700">player{totalWithoutArrival !== 1 ? "s" : ""} without arrival time</span>
                  </div>
                )}
              </div>

              {/* Arrivals day-by-day timeline */}
              {arrivalDayGroups.length === 0 && totalWithoutArrival === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
                  No arrival data yet.
                </div>
              ) : (
                <>
                  {arrivalDayGroups.map(([day, entries]) => (
                    <div key={day} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plane className="w-4 h-4 text-primary" />
                          <h3 className="font-bold text-foreground">{formatDayHeading(day)}</h3>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {entries.length} player{entries.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border">
                        {entries.map((entry) => (
                          <div key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                            <div className="w-14 shrink-0 font-mono text-sm font-semibold text-foreground tabular-nums pt-0.5">
                              {formatTime(entry.arrival)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground text-sm">{entry.name}</span>
                                {entry.teamCategory && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColor(entry.teamCategory)}`}>
                                    {entry.teamCategory}
                                  </span>
                                )}
                              </div>
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

          {activeTab === "departures" && (
            <div className="space-y-8">
              {/* Departures summary strip */}
              <div className="flex flex-wrap gap-3">
                <div className="flex items-center gap-2 bg-white rounded-xl border border-border px-4 py-2.5 shadow-sm text-sm">
                  <Plane className="w-4 h-4 text-primary rotate-45" />
                  <span className="font-semibold text-foreground">{totalWithDeparture}</span>
                  <span className="text-muted-foreground">departure{totalWithDeparture !== 1 ? "s" : ""} set</span>
                </div>
                {totalWithoutDeparture > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 rounded-xl border border-amber-200 px-4 py-2.5 shadow-sm text-sm">
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="font-semibold text-amber-800">{totalWithoutDeparture}</span>
                    <span className="text-amber-700">player{totalWithoutDeparture !== 1 ? "s" : ""} without departure time</span>
                  </div>
                )}
              </div>

              {/* Departures day-by-day timeline */}
              {departureDayGroups.length === 0 && totalWithoutDeparture === 0 ? (
                <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
                  No departure data yet.
                </div>
              ) : (
                <>
                  {departureDayGroups.map(([day, entries]) => (
                    <div key={day} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                      <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Plane className="w-4 h-4 text-primary rotate-45" />
                          <h3 className="font-bold text-foreground">{formatDayHeading(day)}</h3>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {entries.length} player{entries.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border">
                        {entries.map((entry) => (
                          <div key={entry.id} className="flex flex-wrap items-start gap-3 px-5 py-3.5">
                            <div className="w-14 shrink-0 font-mono text-sm font-semibold text-foreground tabular-nums pt-0.5">
                              {formatTime(entry.departure)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold text-foreground text-sm">{entry.name}</span>
                                {entry.teamCategory && (
                                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${categoryColor(entry.teamCategory)}`}>
                                    {entry.teamCategory}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                {entry.departureCity && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    {entry.departureCity}
                                  </span>
                                )}
                                {entry.departureNote && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <MessageSquare className="w-3 h-3 shrink-0" />
                                    {entry.departureNote}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Players without departure */}
                  {data && data.withoutDeparture.length > 0 && (
                    <div className="bg-white rounded-2xl shadow-sm border border-amber-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-amber-100 bg-amber-50/60 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-500" />
                          <h3 className="font-bold text-amber-800">Departure not set</h3>
                        </div>
                        <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                          {data.withoutDeparture.length} player{data.withoutDeparture.length !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                      <div className="divide-y divide-border">
                        {data.withoutDeparture.map((entry) => (
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
        </div>
      )}
    </PageLayout>
  )
}
