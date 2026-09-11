import { useGetWorldCup2026Showcase } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { PlaneTakeoff, PlaneLanding, Home, Map } from "lucide-react"

export default function TravelPage() {
  const { data: showcase, isLoading } = useGetWorldCup2026Showcase()

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading travel data...</p>
        </div>
      </div>
    )
  }

  if (!showcase) return null

  const travel = showcase.travel

  return (
    <div className="space-y-8 animate-in fade-in duration-700 fill-mode-both">
      <div className="space-y-2">
        <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Travel & Logistics</h1>
        <p className="text-lg text-muted-foreground max-w-3xl">
          Historical record of the massive logistical effort to transport the club to {showcase.tournament.location}.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="overflow-hidden">
          <div className="h-2 bg-blue-600 w-full" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <PlaneLanding className="w-5 h-5 text-blue-600" />
              Arrivals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-serif font-bold text-foreground">
              {travel.arrivalConfirmed} <span className="text-lg text-muted-foreground font-sans font-normal">/ {travel.totalPlayers}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confirmed</span>
                <span className="font-medium">{Math.round((travel.arrivalConfirmed / travel.totalPlayers) * 100)}%</span>
              </div>
              <Progress value={(travel.arrivalConfirmed / travel.totalPlayers) * 100} indicatorClassName="bg-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-2 bg-purple-600 w-full" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <PlaneTakeoff className="w-5 h-5 text-purple-600" />
              Departures
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-serif font-bold text-foreground">
              {travel.departureConfirmed} <span className="text-lg text-muted-foreground font-sans font-normal">/ {travel.totalPlayers}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Confirmed</span>
                <span className="font-medium">{Math.round((travel.departureConfirmed / travel.totalPlayers) * 100)}%</span>
              </div>
              <Progress value={(travel.departureConfirmed / travel.totalPlayers) * 100} indicatorClassName="bg-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="overflow-hidden">
          <div className="h-2 bg-emerald-600 w-full" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Home className="w-5 h-5 text-emerald-600" />
              Accommodation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-4xl font-serif font-bold text-foreground">
              {travel.accommodationConfirmed} <span className="text-lg text-muted-foreground font-sans font-normal">/ {travel.totalPlayers}</span>
            </div>
            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Secured</span>
                <span className="font-medium">{Math.round((travel.accommodationConfirmed / travel.totalPlayers) * 100)}%</span>
              </div>
              <Progress value={(travel.accommodationConfirmed / travel.totalPlayers) * 100} indicatorClassName="bg-emerald-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-secondary/30 border-dashed">
        <CardContent className="flex flex-col items-center justify-center p-12 text-center space-y-4">
          <div className="w-16 h-16 bg-background rounded-full flex items-center justify-center border border-border shadow-sm">
            <Map className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-xl font-serif font-semibold">Tournament Base: {showcase.tournament.location}</h3>
          <p className="text-muted-foreground max-w-xl">
            This campaign represented one of the largest coordinated movements in club history, with {showcase.overview.playerCount} players traveling internationally.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
