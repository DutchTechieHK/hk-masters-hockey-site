import { PageLayout } from "@/components/layout/PageLayout"
import { Link } from "wouter"
import { Archive, Users, DollarSign, Shirt, Plane, FolderOpen, BookOpen, Megaphone, FileText, CheckCircle2, BarChart2, Newspaper } from "lucide-react"

function ModuleCard({ title, description, href, icon: Icon }: { title: string, description: string, href: string, icon: React.ElementType }) {
  return (
    <Link href={href} className="group block bg-white rounded-xl border border-border shadow-sm hover:shadow-md hover:border-amber-400 transition-all overflow-hidden relative">
      <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
        <Icon className="w-24 h-24 text-amber-500 -mt-6 -mr-6" />
      </div>
      <div className="p-5 flex items-start gap-4">
        <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-amber-700" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground group-hover:text-amber-700 transition-colors">{title}</h3>
          <p className="text-sm text-muted-foreground mt-1 leading-snug">{description}</p>
        </div>
      </div>
    </Link>
  )
}

export default function ArchiveLanding() {
  return (
    <PageLayout
      title="World Cup 2026 Archive"
      description="Preserved records from the Rotterdam World Cup campaign."
    >
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-8 flex items-start gap-3">
        <Archive className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h2 className="font-semibold text-amber-900">Historical Record</h2>
          <p className="text-sm text-amber-800 mt-1">
            This workspace contains historical data from the 2026 Rotterdam World Cup campaign.
            All modules are presented in read-only mode to preserve the integrity of the campaign records.
          </p>
        </div>
      </div>

      <div className="space-y-8">
        <section>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-border pb-2">Teams & Preparation</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard title="Rotterdam Teams" description="Squad selections, roles, and rosters." href="/archive/world-cup-2026/teams" icon={Users} />
            <ModuleCard title="Tournament Fees" description="Payment tracking for tournament entry." href="/archive/world-cup-2026/fees" icon={DollarSign} />
            <ModuleCard title="Readiness" description="Player tracking for documents, fees, and kits." href="/archive/world-cup-2026/readiness" icon={CheckCircle2} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-border pb-2">Campaign Ops</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard title="Fundraising & Pledges" description="Campaign totals, sponsors, and events." href="/archive/world-cup-2026/fundraising" icon={DollarSign} />
            <ModuleCard title="Kit Procurement" description="Order ledgers and distribution logs." href="/archive/world-cup-2026/kits" icon={Shirt} />
            <ModuleCard title="Travel & Logistics" description="Flight manifests, hotels, and airport transfers." href="/archive/world-cup-2026/travel" icon={Plane} />
            <ModuleCard title="Documents" description="Visas, passports, and mandatory forms." href="/archive/world-cup-2026/documents" icon={FolderOpen} />
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 border-b border-border pb-2">Communications</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard title="Announcements" description="Internal bulletins and push notifications." href="/archive/world-cup-2026/announcements" icon={Megaphone} />
            <ModuleCard title="Matches" description="Archived world cup fixture records." href="/archive/world-cup-2026/matches" icon={Archive} />
            <ModuleCard title="Events" description="Archived world cup events and RSVPs." href="/archive/world-cup-2026/events" icon={Archive} />
            <ModuleCard title="Email History" description="Log of all bulk emails and boarding invites." href="/archive/world-cup-2026/email-history" icon={Archive} />
            <ModuleCard title="Polls" description="Voting records for scheduling and logistics." href="/archive/world-cup-2026/polls" icon={BarChart2} />
            <ModuleCard title="News" description="Published articles from the public site." href="/archive/world-cup-2026/news" icon={Newspaper} />
            <ModuleCard title="Tour Journal" description="Published tour updates and stories." href="/archive/world-cup-2026/journal" icon={BookOpen} />
            <ModuleCard title="Reports" description="Exportable campaign data and sign-offs." href="/archive/world-cup-2026/reports" icon={FileText} />
          </div>
        </section>
      </div>
    </PageLayout>
  )
}