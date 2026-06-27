import { useState, useEffect, useRef } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Input } from "@/components/ui/input"
import { Search, HandCoins, Footprints, Package, Star, ArrowDownToLine, AlertCircle } from "lucide-react"
import { getStoredAdminToken } from "@/lib/admin-auth"
import { formatCurrency } from "@/lib/utils"
import { Link } from "wouter"
import { format, parseISO } from "date-fns"

function getToken(): string {
  return getStoredAdminToken() ?? localStorage.getItem("hkm_admin_session") ?? ""
}

type PledgeResult = {
  id: number
  donorName: string
  donorEmail: string | null
  amountPledged: number
  amountReceived: number
  status: string
  teamName: string | null
  date: string | null
}

type FunRunResult = {
  id: number
  payerName: string
  amountHkd: number
  category: string
  date: string
}

type LegoJarResult = {
  guesserName: string
  guesserEmail: string | null
  guessCount: number
  paidCount: number
  totalAmountPaid: number
}

type SponsorResult = {
  id: number
  name: string
  tier: string
  active: boolean
  contributionAmount: number | null
}

type PayoutResult = {
  id: number
  recipientName: string
  amount: number
  payoutDate: string
  method: string
  source: string
}

type SearchResults = {
  pledges: PledgeResult[]
  funRun: FunRunResult[]
  legoJar: LegoJarResult[]
  sponsors: SponsorResult[]
  payouts: PayoutResult[]
}

const CATEGORY_LABELS: Record<string, string> = {
  entry_fee: "Entry Fee",
  pledge: "Pledge",
  drinks_cookies: "Drinks & Cookies",
}

const SOURCE_LABELS: Record<string, string> = {
  fundraising: "Fundraising",
  lego_jar: "LEGO Jar",
  general: "General",
}

const STATUS_COLORS: Record<string, string> = {
  received: "bg-emerald-100 text-emerald-800",
  confirmed: "bg-blue-100 text-blue-800",
  pending: "bg-amber-100 text-amber-800",
}

const TIER_COLORS: Record<string, string> = {
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-100 text-gray-700",
  Bronze: "bg-orange-100 text-orange-800",
}

function formatDate(d: string | null | undefined) {
  if (!d) return "—"
  try { return format(parseISO(d), "d MMM yyyy") } catch { return d }
}

function SectionHeader({ icon: Icon, label, count, color }: { icon: typeof Search; label: string; count: number; color: string }) {
  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg ${color} mb-2`}>
      <Icon className="w-4 h-4" />
      <span className="text-sm font-semibold">{label}</span>
      <span className="ml-auto text-xs font-medium opacity-70">{count} result{count !== 1 ? "s" : ""}</span>
    </div>
  )
}

export default function FundraisingSearch() {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResults | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults(null)
      setError(null)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch(`/api/fundraising/search?q=${encodeURIComponent(q)}`, {
          headers: { "x-session-token": getToken() },
        })
        if (!res.ok) throw new Error("Search failed")
        const data = await res.json() as SearchResults
        setResults(data)
      } catch {
        setError("Search failed. Please try again.")
        setResults(null)
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  const totalResults = results
    ? results.pledges.length + results.funRun.length + results.legoJar.length + results.sponsors.length + results.payouts.length
    : 0

  const hasResults = totalResults > 0

  return (
    <PageLayout
      title="Fundraising Search"
      description="Search by name across all fundraising tables."
    >
      {/* Search input */}
      <div className="relative mb-6 max-w-lg">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name…"
          className="pl-9"
          autoFocus
        />
      </div>

      {/* States */}
      {query.trim().length > 0 && query.trim().length < 2 && (
        <p className="text-sm text-muted-foreground">Type at least 2 characters to search.</p>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground animate-pulse">Searching…</p>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {!loading && results && !hasResults && (
        <p className="text-sm text-muted-foreground">No results found for <strong>"{query.trim()}"</strong>.</p>
      )}

      {!loading && results && hasResults && (
        <div className="space-y-6">

          {/* Pledges */}
          {results.pledges.length > 0 && (
            <section>
              <SectionHeader icon={HandCoins} label="Pledges" count={results.pledges.length} color="bg-blue-50 text-blue-700" />
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden sm:table-cell">Team</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Pledged</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600 hidden sm:table-cell">Received</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden md:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.pledges.map((p) => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href="/fundraising" className="font-medium text-gray-900 hover:text-primary hover:underline">
                            {p.donorName}
                          </Link>
                          {p.donorEmail && <div className="text-xs text-muted-foreground">{p.donorEmail}</div>}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-600 text-xs">{p.teamName ?? "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(p.amountPledged)}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell text-emerald-700 font-semibold whitespace-nowrap">{formatCurrency(p.amountReceived)}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[p.status] ?? "bg-gray-100 text-gray-700"}`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs whitespace-nowrap">{formatDate(p.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Fun Run */}
          {results.funRun.length > 0 && (
            <section>
              <SectionHeader icon={Footprints} label="Fun Run" count={results.funRun.length} color="bg-green-50 text-green-700" />
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden sm:table-cell">Category</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.funRun.map((r) => (
                      <tr key={r.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href="/fun-run" className="font-medium text-gray-900 hover:text-primary hover:underline">
                            {r.payerName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-600 text-xs">{CATEGORY_LABELS[r.category] ?? r.category}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">{formatCurrency(r.amountHkd)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-500 text-xs whitespace-nowrap">{formatDate(r.date)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* LEGO Jar */}
          {results.legoJar.length > 0 && (
            <section>
              <SectionHeader icon={Package} label="LEGO Jar" count={results.legoJar.length} color="bg-purple-50 text-purple-700" />
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Guesses</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600 hidden sm:table-cell">Paid</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.legoJar.map((r) => (
                      <tr key={r.guesserName} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href="/lego-jar" className="font-medium text-gray-900 hover:text-primary hover:underline">
                            {r.guesserName}
                          </Link>
                          {r.guesserEmail && <div className="text-xs text-muted-foreground">{r.guesserEmail}</div>}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{r.guessCount}</td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-700">{r.paidCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-700 whitespace-nowrap">{formatCurrency(r.totalAmountPaid)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Sponsors */}
          {results.sponsors.length > 0 && (
            <section>
              <SectionHeader icon={Star} label="Sponsors" count={results.sponsors.length} color="bg-yellow-50 text-yellow-700" />
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Name</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Tier</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden sm:table-cell">Status</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600 hidden sm:table-cell">Contribution</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.sponsors.map((s) => (
                      <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href="/sponsors" className="font-medium text-gray-900 hover:text-primary hover:underline">
                            {s.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TIER_COLORS[s.tier] ?? "bg-gray-100 text-gray-700"}`}>
                            {s.tier}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${s.active ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-700"}`}>
                            {s.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right hidden sm:table-cell text-gray-700 font-medium whitespace-nowrap">
                          {s.contributionAmount != null ? formatCurrency(s.contributionAmount) : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Payouts */}
          {results.payouts.length > 0 && (
            <section>
              <SectionHeader icon={ArrowDownToLine} label="Payouts" count={results.payouts.length} color="bg-emerald-50 text-emerald-700" />
              <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50">
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600">Recipient</th>
                      <th className="px-4 py-2.5 text-right font-semibold text-gray-600">Amount</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden sm:table-cell">Source</th>
                      <th className="px-4 py-2.5 text-left font-semibold text-gray-600 hidden sm:table-cell">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.payouts.map((p) => (
                      <tr key={p.id} className="border-t border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <Link href="/payouts" className="font-medium text-gray-900 hover:text-primary hover:underline">
                            {p.recipientName}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">{formatCurrency(p.amount)}</td>
                        <td className="px-4 py-3 hidden sm:table-cell text-xs">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                            {SOURCE_LABELS[p.source] ?? p.source}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell text-gray-500 text-xs whitespace-nowrap">{formatDate(p.payoutDate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

        </div>
      )}
    </PageLayout>
  )
}
