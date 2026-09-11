import { useGetWorldCup2026Showcase } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { ShieldAlert, BarChart3, Users, DollarSign } from "lucide-react"

export default function AdminPage() {
  const { data: showcase, isLoading } = useGetWorldCup2026Showcase()

  if (isLoading) {
    return (
      <div className="h-64 flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Loading admin data...</p>
        </div>
      </div>
    )
  }

  if (!showcase) return null

  return (
    <div className="space-y-8 animate-in fade-in duration-700 fill-mode-both">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-foreground">Team Management</h1>
          <p className="text-lg text-muted-foreground max-w-2xl">
            A look back at the campaign readiness and financial administration handled by the organising committee.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Readiness Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              Campaign Readiness Indicators
            </CardTitle>
            <CardDescription>Overall progression of mandatory tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {showcase.readiness.map((item, i) => {
              const percent = Math.round((item.complete / item.total) * 100) || 0
              return (
                <div key={i} className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-foreground">{item.label}</span>
                    <span className="text-muted-foreground">{item.complete} / {item.total}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={percent} className="flex-1" />
                    <span className="text-xs font-semibold w-9 text-right">{percent}%</span>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Financial Breakdown */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-emerald-600" />
                Financial Overview
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Total Budget Due</p>
                <p className="text-2xl font-serif font-bold">HK${showcase.fees.due.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Amount Collected</p>
                <p className="text-2xl font-serif font-bold text-emerald-600">HK${showcase.fees.paid.toLocaleString()}</p>
              </div>
              <div className="space-y-1 col-span-2 pt-4 border-t border-border">
                <div className="flex justify-between items-end mb-2">
                  <p className="text-sm text-muted-foreground">Outstanding Balance</p>
                  <p className="text-lg font-serif font-bold text-destructive">
                    HK${showcase.fees.outstanding.toLocaleString()}
                  </p>
                </div>
                <Progress 
                  value={showcase.fees.due === 0 ? 0 : (showcase.fees.paid / showcase.fees.due) * 100} 
                  indicatorClassName="bg-emerald-600" 
                />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-primary" />
                Admin Controls
              </CardTitle>
              <CardDescription>
                Interactive controls are permanently disabled in this archive.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <div className="px-3 py-2 bg-background/50 border border-border rounded text-sm text-muted-foreground cursor-not-allowed">
                  Send Payment Reminders
                </div>
                <div className="px-3 py-2 bg-background/50 border border-border rounded text-sm text-muted-foreground cursor-not-allowed">
                  Export Manifest
                </div>
                <div className="px-3 py-2 bg-background/50 border border-border rounded text-sm text-muted-foreground cursor-not-allowed">
                  Broadcast Announcement
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
