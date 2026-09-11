import { type ReactNode } from "react"
import { Link, useLocation } from "wouter"
import { cn } from "@/lib/utils"
import { Archive, LayoutDashboard, Plane, ShieldAlert, CalendarDays, History } from "lucide-react"

export function Shell({ children }: { children: ReactNode }) {
  const [location] = useLocation()
  
  const navItems = [
    { href: "/", label: "Campaign Overview", icon: LayoutDashboard },
    { href: "/player-portal", label: "Player Portal", icon: History },
    { href: "/admin", label: "Team Admin", icon: ShieldAlert },
    { href: "/travel", label: "Travel & Logistics", icon: Plane },
    { href: "/schedule", label: "Tournament Schedule", icon: CalendarDays },
  ]

  return (
    <div className="min-h-screen flex flex-col w-full">
      {/* Read-Only Banner */}
      <div className="bg-primary text-primary-foreground px-4 py-2 text-sm font-medium flex items-center justify-center gap-2">
        <Archive className="h-4 w-4" />
        <span>
          <strong>HISTORICAL ARCHIVE:</strong> This is a read-only showcase of the 2026 World Cup campaign. Interactive features are disabled.
        </span>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="max-w-6xl mx-auto px-4 md:px-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between py-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-primary rounded flex items-center justify-center shrink-0">
                <span className="text-primary-foreground font-serif font-bold text-xl leading-none">HK</span>
              </div>
              <div>
                <h1 className="font-serif font-bold text-xl tracking-tight leading-tight">Masters Hockey</h1>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Historical Records</p>
              </div>
            </div>
            
            <nav className="flex items-center gap-1 md:gap-2 overflow-x-auto pb-2 md:pb-0 scrollbar-none">
              {navItems.map((item) => {
                const isActive = location === item.href
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium whitespace-nowrap transition-colors",
                      isActive 
                        ? "bg-secondary text-secondary-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                )
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 md:px-6 py-8 md:py-12">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-border bg-card mt-auto">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-8 text-center md:text-left flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            &copy; {new Date().getFullYear()} HK Masters Hockey. Archived for historical preservation.
          </p>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Archive className="h-4 w-4" />
            <span>Read-Only Mode</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
