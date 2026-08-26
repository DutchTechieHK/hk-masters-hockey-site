import { useMemo, useState } from "react"
import {
  useListFundraising,
  useListPlayers,
  useListTeams,
  getListFundraisingQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import {
  Banknote,
  BedDouble,
  Check,
  CircleAlert,
  Download,
  FileText,
  Filter,
  Hotel,
  Mail,
  Phone,
  Plane,
  Printer,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Target,
  Users,
} from "lucide-react"
import {
  ALL_REPORT_COLUMNS,
  ACCOMMODATION_COLUMNS,
  EMERGENCY_COLUMNS,
  FLIGHTS_COLUMNS,
  IDENTITY_COLUMNS,
  INSURANCE_COLUMNS,
  ROOM_SHARING_COLUMNS,
  exportPledgeReportCSV,
  exportPledgeReportPDF,
  exportReportCSV,
  exportReportPDF,
  PLEDGE_TIERS,
  toPledgeReportRow,
  type PledgeReportRow,
  type ReportColumn,
} from "@/lib/reports"

type PresetReport = {
  id: string
  title: string
  description: string
  icon: typeof FileText
  columns: ReportColumn[]
  filenameBase: string
}

const PRESET_REPORTS: PresetReport[] = [
  {
    id: "identity",
    title: "Identity & Passport",
    description: "Name, nationality, date of birth and passport details with expiry status.",
    icon: FileText,
    columns: IDENTITY_COLUMNS,
    filenameBase: "player-identity-report",
  },
  {
    id: "flights",
    title: "Flights & Travel",
    description: "Outbound and return flight numbers, times, arrival city and travel dates.",
    icon: Plane,
    columns: FLIGHTS_COLUMNS,
    filenameBase: "player-flights-report",
  },
  {
    id: "emergency",
    title: "Emergency Contacts",
    description: "Player phone, email and next-of-kin emergency contact details.",
    icon: Phone,
    columns: EMERGENCY_COLUMNS,
    filenameBase: "player-emergency-contacts-report",
  },
  {
    id: "rooms",
    title: "Room Sharing",
    description: "Accommodation room sharing preferences and requested roommates.",
    icon: BedDouble,
    columns: ROOM_SHARING_COLUMNS,
    filenameBase: "player-room-sharing-report",
  },
  {
    id: "accommodation",
    title: "Accommodation",
    description: "Hotel name, address and phone number for each player — useful for coaching staff in Rotterdam.",
    icon: Hotel,
    columns: ACCOMMODATION_COLUMNS,
    filenameBase: "player-accommodation-report",
  },
  {
    id: "insurance",
    title: "Insurance",
    description: "Provider, policy number, 24/7 emergency phone, policy holder, expiry date and claims email.",
    icon: ShieldCheck,
    columns: INSURANCE_COLUMNS,
    filenameBase: "player-insurance-report",
  },
]

const currency = (amount: number) =>
  `HK$${(Number(amount) || 0).toLocaleString("en-HK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`

const shortDate = (value?: string | null) => {
  if (!value) return "No date"
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime())
    ? value
    : parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}

const statusLabel = (status: PledgeReportRow["status"]) =>
  status === "received" ? "Received" : status === "confirmed" ? "Confirmed" : "Pending"

function StatusPill({ status }: { status: PledgeReportRow["status"] }) {
  return (
    <span
      data-testid={`status-payment-${status}`}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
        status === "received"
          ? "bg-emerald-100 text-emerald-800"
          : status === "confirmed"
            ? "bg-cyan-100 text-cyan-800"
            : "bg-amber-100 text-amber-800"
      }`}
    >
      {status === "received" && <Check className="h-3 w-3" />}
      {statusLabel(status)}
    </span>
  )
}

function PledgeTierBadge({ row }: { row: PledgeReportRow }) {
  const classes =
    row.tier.key === "champ"
      ? "bg-amber-100 text-amber-900 border-amber-200"
      : row.tier.key === "patron"
        ? "bg-teal-100 text-teal-900 border-teal-200"
        : row.tier.key === "friend"
          ? "bg-sky-100 text-sky-900 border-sky-200"
          : row.tier.key === "supporter"
            ? "bg-slate-100 text-slate-700 border-slate-200"
            : "bg-muted text-muted-foreground border-border"
  return (
    <span
      data-testid={`text-pledge-tier-${row.id}`}
      className={`inline-flex rounded-md border px-2 py-1 text-[11px] font-extrabold uppercase tracking-[0.08em] ${classes}`}
    >
      {row.tier.label}
    </span>
  )
}

function PledgeReport({ teams }: { teams: Array<{ id: number; name: string }> }) {
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [tierFilter, setTierFilter] = useState("all")
  const [teamFilter, setTeamFilter] = useState("all")
  const { data: fundraisingEntries = [], isLoading, isError, refetch } = useListFundraising({
    query: { queryKey: getListFundraisingQueryKey() },
  })

  const rows = useMemo(
    () =>
      fundraisingEntries.map(entry =>
        toPledgeReportRow(
          entry.teamName || !entry.teamId
            ? entry
            : { ...entry, teamName: teams.find(team => team.id === entry.teamId)?.name },
        ),
      ),
    [fundraisingEntries, teams],
  )
  const teamOptions = useMemo(
    () =>
      Array.from(
        new Set(rows.map(row => row.teamName?.trim()).filter((team): team is string => Boolean(team))),
      ).sort((a, b) => a.localeCompare(b)),
    [rows],
  )
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return rows
      .filter(row => {
        const haystack = [row.donorName, row.donorEmail, row.beneficiaryLabel, row.teamName, row.notes]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
        return !normalized || haystack.includes(normalized)
      })
      .filter(row => statusFilter === "all" || row.status === statusFilter)
      .filter(row => tierFilter === "all" || row.tier.key === tierFilter)
      .filter(row => teamFilter === "all" || row.teamName === teamFilter)
      .sort((a, b) => b.amountPledged - a.amountPledged || a.donorName.localeCompare(b.donorName))
  }, [rows, query, statusFilter, tierFilter, teamFilter])

  const totals = useMemo(
    () => ({
      pledged: filteredRows.reduce((total, row) => total + (Number(row.amountPledged) || 0), 0),
      received: filteredRows.reduce((total, row) => total + (Number(row.amountReceived) || 0), 0),
      outstanding: filteredRows.reduce((total, row) => total + row.balanceDue, 0),
    }),
    [filteredRows],
  )
  const tierCounts = useMemo(
    () =>
      PLEDGE_TIERS.map(tier => ({
        ...tier,
        count: filteredRows.filter(row => row.tier.key === tier.key).length,
      })),
    [filteredRows],
  )
  const hasFilters = query || statusFilter !== "all" || tierFilter !== "all" || teamFilter !== "all"

  return (
    <section className="mt-12" aria-labelledby="pledge-report-heading">
      <div className="relative overflow-hidden rounded-[1.5rem] bg-[#12394a] px-5 py-7 text-white shadow-xl shadow-[#12394a]/10 sm:px-8">
        <div className="absolute -right-12 -top-16 h-44 w-44 rounded-full border-[24px] border-[#e1a52d]/25" />
        <div className="absolute -bottom-20 right-24 h-40 w-40 rounded-full border-[18px] border-[#73c5c0]/20" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#a5d9d2]">
              <Target className="h-4 w-4" />
              Stewardship desk
            </div>
            <h2 id="pledge-report-heading" className="text-2xl font-bold tracking-tight sm:text-3xl">
              Pledge & supporter tiers
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#c8dce0]">
              A live view of donor commitments and the recognition or benefits owed to every supporter.
              Amounts are in Hong Kong dollars.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="button-export-pledges-csv"
              size="sm"
              className="border border-white/20 bg-white/10 text-white shadow-none hover:bg-white/20"
              disabled={!filteredRows.length}
              onClick={() => exportPledgeReportCSV(filteredRows)}
            >
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button
              data-testid="button-print-pledges"
              size="sm"
              className="border border-[#e1a52d] bg-[#e1a52d] text-[#173b4b] shadow-none hover:bg-[#efb83e]"
              disabled={!filteredRows.length}
              onClick={() => exportPledgeReportPDF(filteredRows)}
            >
              <Printer className="mr-2 h-4 w-4" /> Print report
            </Button>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div data-testid="metric-pledged-total" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Total pledged <Banknote className="h-4 w-4 text-[#d79517]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{currency(totals.pledged)}</p>
          <p className="mt-1 text-xs text-muted-foreground">{filteredRows.length} visible commitment{filteredRows.length === 1 ? "" : "s"}</p>
        </div>
        <div data-testid="metric-received-total" className="rounded-2xl border border-border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Received <Check className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-foreground">{currency(totals.received)}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {totals.pledged ? `${Math.round((totals.received / totals.pledged) * 100)}% of visible pledges` : "No pledged amount"}
          </p>
        </div>
        <div data-testid="metric-outstanding-total" className="rounded-2xl border border-[#e8d3a1] bg-[#fff9ec] p-4 shadow-sm">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.12em] text-[#856321]">
            Still outstanding <CircleAlert className="h-4 w-4 text-[#c18816]" />
          </div>
          <p className="mt-2 font-display text-2xl font-bold text-[#6c5018]">{currency(totals.outstanding)}</p>
          <p className="mt-1 text-xs text-[#856321]">Use payment status to follow up</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search pledges</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              data-testid="input-search-pledges"
              value={query}
              onChange={event => setQuery(event.target.value)}
              placeholder="Search donor, beneficiary, email or team"
              className="h-11 w-full rounded-xl border-2 border-input bg-background pl-10 pr-3 text-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-4 focus:ring-primary/10"
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <Select data-testid="select-pledge-status" className="h-11 w-full bg-background sm:w-36" value={statusFilter} onChange={event => setStatusFilter(event.target.value)}>
              <option value="all">All statuses</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="received">Received</option>
            </Select>
            <Select data-testid="select-pledge-tier" className="h-11 w-full bg-background sm:w-48" value={tierFilter} onChange={event => setTierFilter(event.target.value)}>
              <option value="all">All tiers</option>
              {PLEDGE_TIERS.map(tier => <option key={tier.key} value={tier.key}>{tier.label}</option>)}
              <option value="untiered">Below tier</option>
            </Select>
            <Select data-testid="select-pledge-team" className="h-11 w-full bg-background sm:w-40" value={teamFilter} onChange={event => setTeamFilter(event.target.value)}>
              <option value="all">All teams</option>
              {teamOptions.map(team => <option key={team} value={team}>{team}</option>)}
            </Select>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><Filter className="h-3.5 w-3.5" /> Showing {filteredRows.length} of {rows.length} pledges</span>
          {hasFilters && (
            <button
              data-testid="button-clear-pledge-filters"
              type="button"
              onClick={() => { setQuery(""); setStatusFilter("all"); setTierFilter("all"); setTeamFilter("all") }}
              className="font-bold text-primary transition-colors hover:text-accent"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {tierCounts.map(tier => (
          <button
            type="button"
            key={tier.key}
            data-testid={`button-filter-tier-${tier.key}`}
            onClick={() => setTierFilter(tierFilter === tier.key ? "all" : tier.key)}
            className={`rounded-2xl border bg-card p-4 text-left shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tierFilter === tier.key ? "border-primary ring-2 ring-primary/10" : "border-border"}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-bold uppercase tracking-[0.08em] text-muted-foreground">{tier.label}</span>
              <span className="font-display text-xl font-bold text-foreground">{tier.count}</span>
            </div>
            <p className="mt-1 text-[11px] font-medium text-muted-foreground">
              {tier.threshold ? `${currency(tier.threshold)}+` : "Under HK$500"}
            </p>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={`h-full rounded-full ${tier.key === "champ" ? "bg-[#e1a52d]" : tier.key === "patron" ? "bg-[#4baba5]" : tier.key === "friend" ? "bg-[#5b9eb9]" : "bg-[#71858c]"}`} style={{ width: `${filteredRows.length ? Math.max(8, (tier.count / filteredRows.length) * 100) : 0}%` }} />
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-3 p-5" data-testid="loading-pledge-report">
            {[1, 2, 3, 4].map(index => <div key={index} className="h-16 animate-pulse rounded-xl bg-muted" />)}
          </div>
        ) : isError ? (
          <div data-testid="error-pledge-report" className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <CircleAlert className="h-8 w-8 text-destructive" />
            <h3 className="mt-3 font-display text-lg font-bold">Pledge report unavailable</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">We could not load the authenticated fundraising list. Try again without leaving this report.</p>
            <Button data-testid="button-retry-pledges" className="mt-5" size="sm" onClick={() => void refetch()}>Try again</Button>
          </div>
        ) : filteredRows.length === 0 ? (
          <div data-testid="empty-pledge-report" className="flex flex-col items-center justify-center px-6 py-14 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-secondary text-primary"><Banknote className="h-5 w-5" /></div>
            <h3 className="mt-4 font-display text-lg font-bold">{rows.length ? "No pledges match these filters" : "No pledge records yet"}</h3>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">{rows.length ? "Clear a filter or try a different search term." : "Fundraising commitments will appear here once the first entry is recorded."}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[880px] text-left">
                <thead className="bg-[#f0f6f6] text-[10px] uppercase tracking-[0.12em] text-[#547078]">
                  <tr>
                    <th className="px-5 py-3 font-bold">Supporter</th>
                    <th className="px-4 py-3 font-bold">Tier / deliverables</th>
                    <th className="px-4 py-3 font-bold">Beneficiary</th>
                    <th className="px-4 py-3 text-right font-bold">Commitment</th>
                    <th className="px-4 py-3 font-bold">Payment</th>
                    <th className="px-5 py-3 text-right font-bold">Pledge date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map(row => (
                    <tr key={row.id} data-testid={`row-pledge-${row.id}`} className="transition-colors hover:bg-secondary/35">
                      <td className="px-5 py-4 align-top">
                        <div data-testid={`text-donor-${row.id}`} className="font-bold text-foreground">{row.donorName}</div>
                        {row.donorEmail ? <a data-testid={`link-donor-email-${row.id}`} href={`mailto:${row.donorEmail}`} className="mt-1 flex items-center gap-1.5 text-xs text-primary hover:underline"><Mail className="h-3 w-3" />{row.donorEmail}</a> : <span className="mt-1 block text-xs text-muted-foreground">No email supplied</span>}
                      </td>
                      <td className="max-w-[220px] px-4 py-4 align-top">
                        <PledgeTierBadge row={row} />
                        <p className="mt-2 text-xs leading-4 text-muted-foreground">{row.tier.deliverables}</p>
                      </td>
                      <td className="px-4 py-4 align-top">
                        <div className="font-semibold text-foreground">{row.beneficiaryLabel}</div>
                        {row.teamName && <div className="mt-1 text-xs text-muted-foreground">{row.teamName}</div>}
                      </td>
                      <td className="px-4 py-4 text-right align-top">
                        <div className="font-display font-bold text-foreground">{currency(row.amountPledged)}</div>
                        <div className="mt-1 text-xs text-muted-foreground">Due {currency(row.balanceDue)}</div>
                      </td>
                      <td className="px-4 py-4 align-top"><StatusPill status={row.status} /><div className="mt-2 text-xs text-muted-foreground">Received {currency(row.amountReceived)}</div></td>
                      <td className="px-5 py-4 text-right align-top text-xs text-muted-foreground">{shortDate(row.date ?? row.createdAt)}{row.paidAt && <span className="mt-1 block text-emerald-700">Paid {shortDate(row.paidAt)}</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-border md:hidden">
              {filteredRows.map(row => (
                <article key={row.id} data-testid={`card-pledge-${row.id}`} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div><h3 className="font-bold text-foreground">{row.donorName}</h3><p className="mt-1 text-xs text-muted-foreground">{row.donorEmail || "No email supplied"}</p></div>
                    <PledgeTierBadge row={row} />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 rounded-xl bg-secondary/45 p-3 text-sm">
                    <div><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Beneficiary</span><span className="font-semibold">{row.beneficiaryLabel}</span></div>
                    <div className="text-right"><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pledged</span><span className="font-display font-bold">{currency(row.amountPledged)}</span></div>
                    <div><span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Deliverables</span><span className="text-xs leading-4 text-muted-foreground">{row.tier.deliverables}</span></div>
                    <div className="text-right"><StatusPill status={row.status} /><span className="mt-1 block text-xs text-muted-foreground">Due {currency(row.balanceDue)}</span></div>
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">{shortDate(row.date ?? row.createdAt)}{row.teamName ? ` · ${row.teamName}` : ""}</p>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default function Reports() {
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all")
  const [customKeys, setCustomKeys] = useState<string[]>(["name", "teamName"])

  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers(
    selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined,
    {
      query: {
        queryKey: getListPlayersQueryKey(
          selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined,
        ),
      },
    },
  )

  const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players])
  const scopeLabel = selectedTeamFilter === "all" ? "All teams" : teams.find(t => String(t.id) === selectedTeamFilter)?.name ?? "Selected team"
  const customColumns = useMemo(() => ALL_REPORT_COLUMNS.filter(c => customKeys.includes(c.key)), [customKeys])
  const toggleKey = (key: string) => setCustomKeys(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
  const hasPlayers = sortedPlayers.length > 0

  return (
    <PageLayout title="Reports" description="The committee’s operational view of player readiness and supporter commitments.">
      <div className="mb-8 rounded-2xl border border-border bg-card p-4 shadow-sm sm:flex sm:items-center sm:gap-4">
        <div className="mb-3 flex items-center gap-2 sm:mb-0">
          <Users className="h-4 w-4 text-primary" />
          <span className="text-sm font-bold text-foreground">Player report scope</span>
        </div>
        <Select data-testid="select-player-team-filter" className="sm:w-56 bg-background" value={selectedTeamFilter} onChange={event => setSelectedTeamFilter(event.target.value)}>
          <option value="all">All teams</option>
          {teams.map(team => <option key={team.id} value={String(team.id)}>{team.name}</option>)}
        </Select>
        <span data-testid="text-player-report-scope" className="mt-3 text-sm text-muted-foreground sm:mt-0">
          {isLoading ? "Loading players..." : <>Reporting on <span className="font-semibold text-foreground">{scopeLabel}</span> · {sortedPlayers.length} player{sortedPlayers.length === 1 ? "" : "s"}</>}
        </span>
      </div>

      <div className="flex items-end justify-between gap-3">
        <div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Player operations</p><h2 className="mt-1 font-display text-2xl font-bold text-foreground">Ready-to-use reports</h2></div>
        <span className="hidden text-xs text-muted-foreground sm:block">Export filtered player data</span>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        {PRESET_REPORTS.map(report => {
          const Icon = report.icon
          return (
            <div key={report.id} className="flex flex-col rounded-2xl border border-border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
              <div className="mb-3 flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><Icon className="h-5 w-5" /></div>
                <div><h3 className="font-bold text-foreground">{report.title}</h3><p className="mt-0.5 text-sm text-muted-foreground">{report.description}</p></div>
              </div>
              <div className="mt-auto flex gap-2 pt-2">
                <Button data-testid={`button-export-${report.id}-csv`} variant="outline" size="sm" disabled={!hasPlayers} onClick={() => exportReportCSV({ players: sortedPlayers, columns: report.columns, scopeLabel, filenameBase: report.filenameBase })}><Download className="mr-2 h-4 w-4" /> CSV</Button>
                <Button data-testid={`button-print-${report.id}`} variant="outline" size="sm" disabled={!hasPlayers} onClick={() => exportReportPDF({ players: sortedPlayers, columns: report.columns, title: `${report.title} — ${scopeLabel}`, scopeLabel })}><Printer className="mr-2 h-4 w-4" /> Print / PDF</Button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="mb-4 flex items-start gap-3"><div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-secondary text-primary"><SlidersHorizontal className="h-5 w-5" /></div><div><h3 className="font-bold text-foreground">Build your own player report</h3><p className="mt-0.5 text-sm text-muted-foreground">Pick the columns to include, then export to CSV or a print-ready PDF.</p></div></div>
        <div className="mb-4 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 lg:grid-cols-4">
          {ALL_REPORT_COLUMNS.map(column => <label key={column.key} className="flex cursor-pointer select-none items-center gap-2 text-sm text-foreground"><input data-testid={`checkbox-player-column-${column.key}`} type="checkbox" className="rounded border-border text-primary focus:ring-primary" checked={customKeys.includes(column.key)} onChange={() => toggleKey(column.key)} /><span>{column.header}</span></label>)}
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button data-testid="button-export-custom-player-csv" variant="outline" size="sm" disabled={!hasPlayers || !customColumns.length} onClick={() => exportReportCSV({ players: sortedPlayers, columns: customColumns, scopeLabel, filenameBase: "custom-player-report" })}><Download className="mr-2 h-4 w-4" /> CSV</Button>
          <Button data-testid="button-print-custom-player" variant="outline" size="sm" disabled={!hasPlayers || !customColumns.length} onClick={() => exportReportPDF({ players: sortedPlayers, columns: customColumns, title: `Custom Player Report — ${scopeLabel}`, scopeLabel })}><Printer className="mr-2 h-4 w-4" /> Print / PDF</Button>
          {!customColumns.length && <span className="text-xs text-muted-foreground">Select at least one column.</span>}
        </div>
      </div>

      <PledgeReport teams={teams} />
    </PageLayout>
  )
}