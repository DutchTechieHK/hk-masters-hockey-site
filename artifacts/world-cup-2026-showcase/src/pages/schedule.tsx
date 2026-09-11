import { useGetWorldCup2026Showcase } from "@workspace/api-client-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Calendar, MapPin, Trophy } from "lucide-react"

export default function SchedulePage() {
  const { data: showcase, isLoading } = useGetWorldCup2026Showcase()

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading historical schedule...</p>
        </div>
      </div>
    )
  }

  if (!showcase) return null

  // Sort schedule chronologically if needed, assuming API returns it sorted or we just render it
  const schedule = showcase.schedule

  return (
    <div className="space-y-8 animate-in fade-in duration-700 fill-mode-both">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Tournament Schedule</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          The historical match and event itinerary for the {showcase.tournament.name}.
        </p>
      </div>

      <div className="relative border-l-2 border-border ml-3 md:ml-6 space-y-8 pb-8">
        {schedule.map((item, i) => {
          const date = new Date(item.startsAt)
          const isFixture = item.type === 'fixture'
          
          return (
            <div key={item.id} className="relative pl-6 md:pl-10">
              {/* Timeline dot */}
              <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-background ${
                isFixture ? 'bg-primary' : 'bg-muted-foreground'
              }`} />
              
              <Card className="overflow-hidden hover:shadow-md transition-shadow">
                <div className={`h-1 w-full ${isFixture ? 'bg-primary' : 'bg-muted'}`} />
                <CardContent className="p-4 md:p-6">
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                    <div className="space-y-3 flex-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={isFixture ? "default" : "secondary"}>
                          {isFixture ? 'Match' : 'Event'}
                        </Badge>
                        <span className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {date.toLocaleDateString('en-GB', { 
                            weekday: 'short', 
                            month: 'short', 
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      
                      <h3 className="text-xl font-serif font-bold text-foreground">
                        {item.title}
                      </h3>
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="w-4 h-4" />
                        {item.location}
                      </div>
                    </div>

                    {isFixture && item.score && (
                      <div className="shrink-0 bg-secondary/50 rounded-lg p-3 text-center border border-border min-w-[100px]">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">Final Score</p>
                        <p className="text-2xl font-serif font-bold text-primary">{item.score}</p>
                      </div>
                    )}
                    {isFixture && !item.score && (
                      <div className="shrink-0 flex items-center justify-center text-muted-foreground">
                        <Trophy className="w-8 h-8 opacity-20" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          )
        })}
      </div>
    </div>
  )
}
