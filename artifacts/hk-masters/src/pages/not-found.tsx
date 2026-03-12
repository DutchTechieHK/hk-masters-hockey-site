import { Link } from "wouter"
import { AlertCircle } from "lucide-react"

export default function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4">
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <AlertCircle className="w-16 h-16 text-muted-foreground/30" />
        </div>
        <h1 className="text-4xl font-display font-bold text-foreground mb-4">404 - Not Found</h1>
        <p className="text-lg text-muted-foreground mb-8">
          The page you are looking for doesn't exist or has been moved.
        </p>
        <Link href="/" className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-8 text-sm font-semibold text-primary-foreground shadow-lg hover:bg-primary/90 transition-all">
          Return to Dashboard
        </Link>
      </div>
    </div>
  )
}
