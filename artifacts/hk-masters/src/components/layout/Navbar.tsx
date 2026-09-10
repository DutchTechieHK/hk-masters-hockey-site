import { Link, useRoute } from "wouter"
import { Trophy, Users, UserRound, DollarSign, CalendarDays, CalendarClock, Megaphone, History, Globe, PlayCircle, LogOut, Menu, X, BarChart2, Newspaper, Archive } from "lucide-react"
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
  { href: "/players", label: "Members", icon: UserRound },
  { href: "/fees", label: "Fees", icon: DollarSign },
  { href: "/matches", label: "Matches", icon: CalendarDays },
  { href: "/events", label: "Events", icon: CalendarClock },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/polls", label: "Polls", icon: BarChart2 },
  { href: "/email-history", label: "Email History", icon: History },
  { href: "/website", label: "Website", icon: Globe },
  { href: "/tutorials", label: "Tutorials", icon: PlayCircle },
]

async function handleSignOut() {
  const token = getStoredAdminToken()
  if (token) await apiAdminLogout(token)
  clearAdminToken()
  notifySessionExpired()
}

function SidebarNavItem({
  href,
  label,
  icon: Icon,
  onClick,
  isArchive = false,
}: {
  href: string
  label: string
  icon: typeof Trophy
  onClick?: () => void
  isArchive?: boolean
}) {
  const [isActive] = useRoute(href.endsWith("/*") ? href : `${href}/*`)
  const active = isActive || window.location.pathname === href || window.location.pathname.startsWith(href + "/")

  return (
    <Link
      href={href}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 px-3 py-2.5",
        active
          ? "bg-white/20 text-white shadow-inner"
          : isArchive
            ? "text-amber-200/80 hover:bg-white/10 hover:text-amber-200"
            : "text-primary-foreground/70 hover:bg-white/10 hover:text-white"
      )}
    >
      <Icon className={cn("flex-shrink-0 w-[18px] h-[18px]", isArchive && "text-amber-200/80")} />
      <span>{label}</span>
    </Link>
  )
}

const Logo = () => (
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center border border-white/20 flex-shrink-0">
      <Trophy className="w-5 h-5 text-white" />
    </div>
    <div className="leading-none">
      <p className="font-bold text-base text-white tracking-tight leading-none">HK Masters</p>
      <p className="text-[9px] text-primary-foreground/60 font-medium uppercase tracking-wider mt-0.5">League & Socials</p>
    </div>
  </div>
)

export function Navbar() {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const NavList = ({ onItemClick }: { onItemClick?: () => void }) => (
    <>
      <div className="space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <SidebarNavItem key={item.href} href={item.href} label={item.label} icon={item.icon} onClick={onItemClick} />
        ))}
      </div>

      <div className="mt-6 pt-4 border-t border-white/10">
        <p className="px-3 text-xs font-semibold text-primary-foreground/40 uppercase tracking-wider mb-2">Archives</p>
        <SidebarNavItem
          href="/archive/world-cup-2026"
          label="World Cup 2026"
          icon={Archive}
          onClick={onItemClick}
          isArchive
        />
      </div>
    </>
  )

  return (
    <>
      {/* ── Desktop: fixed left sidebar ── */}
      <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-56 z-40 bg-primary text-primary-foreground shadow-xl">
        <div className="px-4 py-5 border-b border-white/10">
          <Logo />
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <NavList />
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-foreground/70 hover:bg-white/10 hover:text-white transition-all duration-150"
          >
            <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* ── Mobile: slim top bar ── */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 h-14 bg-primary text-primary-foreground shadow-lg flex items-center justify-between px-4">
        <Logo />
        <button
          onClick={() => setDrawerOpen(true)}
          className="p-2 rounded-lg text-primary-foreground hover:bg-white/10 transition-colors"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {/* ── Mobile: slide-out drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 z-50 bg-black/50"
              onClick={() => setDrawerOpen(false)}
            />

            <motion.div
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-full max-w-[280px] bg-primary text-primary-foreground shadow-2xl flex flex-col"
            >
              <div className="flex items-center justify-between px-4 py-4 border-b border-white/10">
                <Logo />
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-primary-foreground hover:bg-white/10 transition-colors"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4">
                <NavList onItemClick={() => setDrawerOpen(false)} />
              </nav>

              <div className="px-3 py-4 border-t border-white/10">
                <button
                  onClick={() => { setDrawerOpen(false); handleSignOut() }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary-foreground/70 hover:bg-white/10 hover:text-white transition-all duration-150"
                >
                  <LogOut className="w-[18px] h-[18px] flex-shrink-0" />
                  <span>Sign out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
