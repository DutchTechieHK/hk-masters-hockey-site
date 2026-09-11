import { useGetWorldCup2026Showcase } from "@workspace/api-client-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Trophy, Flag, MapPin } from "lucide-react"

export default function OverviewPage() {
  const { data: showcase, isLoading } = useGetWorldCup2026Showcase()

  if (isLoading) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-32 bg-secondary rounded-lg"></div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-40 bg-secondary rounded-lg"></div>
          <div className="h-40 bg-secondary rounded-lg"></div>
          <div className="h-40 bg-secondary rounded-lg"></div>
        </div>
      </div>
    )
  }

  if (!showcase) return null

  return (
    <div className="space-y-12 animate-in fade-in duration-700 fill-mode-both">
      {/* Hero Section */}
      <div className="relative overflow-hidden rounded-2xl bg-card border border-border shadow-sm">
        <div className="absolute inset-0 bg-primary/5 pattern-dots opacity-50" />
        <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div className="space-y-4 max-w-2xl">
            <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/20">
              <Trophy className="w-3 h-3 mr-1" />
              Completed Campaign
            </Badge>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-foreground">
              {showcase.tournament.name}
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              {showcase.tournament.location}
            </p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-auto">
            <div className="bg-background rounded-lg p-4 border border-border flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-serif font-bold text-primary">{showcase.overview.playerCount}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Players</span>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-serif font-bold text-primary">{showcase.overview.teamCount}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Teams</span>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-serif font-bold text-primary">{showcase.overview.completedFixtures}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Fixtures</span>
            </div>
            <div className="bg-background rounded-lg p-4 border border-border flex flex-col items-center justify-center text-center">
              <span className="text-3xl font-serif font-bold text-primary">{showcase.overview.scheduledItems}</span>
              <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider mt-1">Events</span>
            </div>
          </div>
        </div>
      </div>

      {/* Teams Roster */}
      <div className="space-y-6">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <Flag className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-serif font-semibold">Participating Squads</h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {showcase.teams.map((team, i) => (
            <Card key={team.id} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDelay: `${i * 100}ms` }}>
              <CardHeader>
                <div className="flex justify-between items-start mb-2">
                  <Badge variant="outline">{team.category}</Badge>
                </div>
                <CardTitle className="text-xl">{team.name}</CardTitle>
                <CardDescription>Archived squad record</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm font-medium">Squad Size</span>
                  </div>
                  <span className="font-semibold">{team.playerCount} Players</span>
                </div>
                <div className="flex items-center justify-between py-3 border-t border-border">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Trophy className="w-4 h-4" />
                    <span className="text-sm font-medium">Fees Cleared</span>
                  </div>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-500">
                    {team.paidPlayers} / {team.playerCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
