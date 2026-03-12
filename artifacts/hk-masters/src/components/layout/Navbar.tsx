import { Link, useRoute } from "wouter"
import { Trophy, Users, UserRound, Shirt, DollarSign, Plane, Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: Trophy },
  { href: "/teams", label: "Teams", icon: Users },
  { href: "/players", label: "Players", icon: UserRound },
  { href: "/kits", label: "Kits", icon: Shirt },
  { href: "/fundraising", label: "Fundraising", icon: DollarSign },
  { href: "/logistics", label: "Logistics", icon: Plane },
]

export function Navbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <>
      <nav className="sticky top-0 z-40 w-full bg-primary text-primary-foreground shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex-shrink-0 flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center backdrop-blur-sm border border-white/20">
                <Trophy className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-display font-bold text-xl tracking-tight text-white leading-none">HK Masters</h1>
                <p className="text-[10px] text-primary-foreground/70 font-medium uppercase tracking-wider">World Cup 2026</p>
              </div>
            </div>

            {/* Desktop Nav */}
            <div className="hidden md:flex items-center space-x-1">
              {NAV_ITEMS.map((item) => {
                const [isActive] = useRoute(item.href)
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive 
                        ? "bg-white/15 text-white shadow-inner" 
                        : "text-primary-foreground/80 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>

            {/* Mobile menu button */}
            <div className="md:hidden flex items-center">
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="p-2 rounded-lg text-primary-foreground hover:bg-white/10 transition-colors"
              >
                {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Nav */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
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
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
