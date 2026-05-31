import { PageLayout } from "@/components/layout/PageLayout"
import { Footprints } from "lucide-react"

export default function FunRun() {
  return (
    <PageLayout title="Fun Run" description="Track and manage the fun run fundraiser.">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex flex-col items-center justify-center py-24 text-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Footprints className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold text-foreground">Coming Soon</h2>
          <p className="text-muted-foreground max-w-sm">
            The Fun Run management page is on its way. Check back soon.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}
