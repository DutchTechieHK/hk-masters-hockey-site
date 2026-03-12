import { ReactNode } from "react"
import { motion } from "framer-motion"
import { Navbar } from "./Navbar"

interface PageLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  action?: ReactNode
}

export function PageLayout({ children, title, description, action }: PageLayoutProps) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      
      {/* Optional Hero Area */}
      {(title || description || action) && (
        <div className="bg-white border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                {title && <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground">{title}</h1>}
                {description && <p className="mt-2 text-lg text-muted-foreground max-w-2xl">{description}</p>}
              </div>
              {action && <div className="flex-shrink-0">{action}</div>}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {children}
        </motion.div>
      </main>
    </div>
  )
}
