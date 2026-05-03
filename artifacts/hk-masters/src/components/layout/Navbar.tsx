import { Link, useRoute } from "wouter"
import { Trophy, Users, UserRound, Shirt, DollarSign, Plane, BookOpen, Menu, X, Luggage, Star, CalendarDays, Wallet, LogOut, CalendarClock, Megaphone } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  apiAdminLogout,
  clearAdminToken,
  getStoredAdminToken,
  notifySessionExpired,
} from "@/lib/admin-auth"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/players", label: "Players", icon: UserRound },
  { href: "/kits", label: "Kits", icon: Shirt },
  { href: "/fundraising", label: "Fundraising", icon: DollarSign },
  { href: "/fees", label: "Fees", icon: Wallet },
  { href: "/sponsors", label: "Sponsors", icon: Star },
  { href: "/schedule", label: "Matches", icon: CalendarDays },
  { href: "/events", label: "Programme & Events", icon: CalendarClock },
  { href: "/announcements", label: "News", icon: Megaphone },
  { href: "/logistics", label: "Logistics", icon: Plane },
  { href: "/travel", label: "Travel", icon: Luggage },
  { href: "/journal", label: "Journal", icon: BookOpen },
]

async function handleSignOut() {
  const token = getStoredAdminToken()
  if (token) await apiAdminLogout(token)
  clearAdminToken()
  notifySessionExpired()
}

function NavIcon({ href, label, icon: Icon }: { href: string; label: string; icon: typeof Trophy }) {
  const [isActive] = useRoute(href)
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "group relative flex items-center justify-center w-9 h-9 rounded-lg transition-all duration-150",
        isActive
          ? "bg-white/20 text-white shadow-inner"
          : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className="w-[18px] h-[18px]" />
      {/* Tooltip */}
      <span className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 rounded bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
        {label}
      </span>
    </Link>
  )
}

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6">
          <div className="flex items-center h-14 gap-3">

            {/* Logo */}
            <div className="flex-shrink-0 flex items-center gap-3 pr-3 border-r border-white/20">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20">
                <Trophy className="w-5 h-5 text-white" />
              </div>
              <div className="leading-none">
                <p className="font-bold text-base text-white tracking-tight leading-none">HK Masters</p>
                <p className="text-[9px] text-primary-foreground/60 font-medium uppercase tracking-wider mt-0.5">World Cup 2026</p>
              </div>
            </div>

            {/* Desktop Nav — icon only with tooltips */}
            <div className="hidden md:flex items-center gap-0.5 flex-1 overflow-hidden">
              {NAV_ITEMS.map((item) => (
                <NavIcon key={item.href} href={item.href} label={item.label} icon={item.icon} />
              ))}
            </div>

            {/* Sign out — always visible on desktop */}
            <div className="hidden md:flex items-center ml-auto pl-3 border-l border-white/20">
              <button
                onClick={handleSignOut}
                title="Sign out"
                className="group relative flex items-center justify-center w-9 h-9 rounded-lg text-primary-foreground/70 hover:bg-white/10 hover:text-white transition-all"
              >
                <LogOut className="w-[18px] h-[18px]" />
                <span className="pointer-events-none absolute top-full right-0 mt-2 px-2 py-1 rounded bg-gray-900 text-white text-xs font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  Sign out
                </span>
              </button>
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden ml-auto">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-primary-foreground hover:bg-white/10 transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>

          </div>
        </div>
      </nav>

      {/* Mobile Nav — full labels */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="md:hidden bg-primary border-t border-white/10 overflow-hidden absolute w-full z-30 shadow-xl"
          >
            <div className="px-4 pt-2 pb-4 space-y-1">
              {NAV_ITEMS.map((item) => {
                const [isActive] = useRoute(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium transition-colors",
                      isActive
                        ? "bg-white/15 text-white"
                        : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              <button
                onClick={() => { setIsMobileMenuOpen(false); handleSignOut() }}
                className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-base font-medium text-primary-foreground/80 hover:bg-white/10 hover:text-white transition-colors"
              >
                <LogOut className="w-5 h-5" />
                <span>Sign out</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
