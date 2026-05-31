import { useState, useEffect, useCallback, useRef } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, CheckCircle2, RefreshCw, PackageOpen, MapPin, Users, DollarSign, Settings, List, History, Search, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"

const SESSION_KEY = "hkm_admin_session"
function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getStoredToken()
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-session-token": token ?? "", ...(opts.headers ?? {}) },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

type Config = {
  id: number
  pricePerGuess: string
  actualCount: number | null
  status: string
  imageUrl: string | null
}

type Round = {
  id: number
  holderName: string
  squadMemberId: number | null
  location: string | null
  startedAt: string
  endedAt: string | null
  notes: string | null
  guessCount: number
  paidCount: number
  amountRaised: number
  isCurrent: boolean
}

type Guess = {
  id: number
  roundId: number | null
  guesserName: string
  guesserEmail: string | null
  guessNumber: number
  paymentMethod: string | null
  paid: boolean
  createdAt: string
}

type SquadPlayer = {
  id: number
  name: string
  shirtNumber: number | null
  teamCategory: string | null
}

const PM_LABELS: Record<string, string> = {
  payme: "PayMe",
  wise: "Wise",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
}

const PM_COLORS: Record<string, string> = {
  payme: "bg-green-100 text-green-800",
  wise: "bg-blue-100 text-blue-800",
  bank_transfer: "bg-purple-100 text-purple-800",
  cash: "bg-amber-100 text-amber-800",
}

function formatHKD(n: number) {
  return `HK$${n.toLocaleString()}`
}

// ── Squad member combobox ─────────────────────────────────────────────────────
function SquadCombobox({
  squad,
  selectedId,
  onSelect,
}: {
  squad: SquadPlayer[]
  selectedId: string
  onSelect: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const selected = squad.find((p) => String(p.id) === selectedId)

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onClick)
    return () => document.removeEventListener("mousedown", onClick)
  }, [])

  const filtered = q
    ? squad.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()) || String(p.shirtNumber ?? "").includes(q))
    : squad

  const mo40 = filtered.filter((p) => p.teamCategory?.toLowerCase().includes("mo40"))
  const mo50 = filtered.filter((p) => p.teamCategory?.toLowerCase().includes("mo50"))
  const other = filtered.filter((p) => !p.teamCategory?.toLowerCase().includes("mo40") && !p.teamCategory?.toLowerCase().includes("mo50"))

  function renderGroup(label: string, players: SquadPlayer[]) {
    if (!players.length) return null
    return (
      <div key={label}>
        <div className="px-3 py-1.5 text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/30 border-b border-border">{label}</div>
        {players.map((p) => (
          <button
            key={p.id}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(String(p.id), p.name)
              setQ("")
              setOpen(false)
            }}
            className={`w-full text-left px-4 py-2 text-sm hover:bg-muted/40 flex items-center gap-2 ${String(selectedId) === String(p.id) ? "bg-primary/5 text-primary font-semibold" : "text-foreground"}`}
          >
            {p.shirtNumber != null && <span className="text-xs text-muted-foreground w-7 shrink-0 font-mono">#{p.shirtNumber}</span>}
            <span>{p.name}</span>
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="flex items-center w-full rounded-md border border-input bg-background text-sm">
        <Search className="w-4 h-4 text-muted-foreground ml-3 shrink-0" />
        <input
          type="text"
          value={selected && !open ? selected.name : q}
          onChange={(e) => { setQ(e.target.value); onSelect("", ""); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search squad members…"
          className="flex-1 px-3 py-2 bg-transparent focus:outline-none placeholder:text-muted-foreground"
          autoComplete="off"
        />
        {selectedId && (
          <button type="button" onMouseDown={(e) => { e.preventDefault(); onSelect("", ""); setQ("") }} className="mr-2 p-1 text-muted-foreground hover:text-foreground rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {open && (
        <div className="w-full mt-1 bg-popover rounded-md border border-border shadow-lg max-h-52 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-muted-foreground text-center">No players found</div>
          ) : (
            <>
              {renderGroup("MO40", mo40)}
              {renderGroup("MO50", mo50)}
              {renderGroup("Other", other)}
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function LegoJar() {
  const { toast } = useToast()

  const [config, setConfig] = useState<Config | null>(null)
  const [rounds, setRounds] = useState<Round[]>([])
  const [guesses, setGuesses] = useState<Guess[]>([])
  const [squad, setSquad] = useState<SquadPlayer[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "guesses" | "config">("overview")

  // Pass jar dialog
  const [passJarOpen, setPassJarOpen] = useState(false)
  const [passForm, setPassForm] = useState({ holderName: "", squadMemberId: "", location: "", notes: "" })
  const [passSaving, setPassSaving] = useState(false)

  // Log guess dialog
  const [guessOpen, setGuessOpen] = useState(false)
  const [guessForm, setGuessForm] = useState({
    guesserName: "", guesserEmail: "", guessNumber: "", paymentMethod: "cash", paid: true
  })
  const [guessSaving, setGuessSaving] = useState(false)

  // Config panel
  const [configForm, setConfigForm] = useState({ pricePerGuess: "50", actualCount: "", status: "active", imageUrl: "" })
  const [configSaving, setConfigSaving] = useState(false)

  // Delete confirm
  const [deleteGuessId, setDeleteGuessId] = useState<number | null>(null)

  // Guess search/filter state
  const [guessSearch, setGuessSearch] = useState("")
  const [guessFilterPm, setGuessFilterPm] = useState("all")
  const [guessFilterPaid, setGuessFilterPaid] = useState("all")
  const [guessFilterRound, setGuessFilterRound] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, rds, gss, sq] = await Promise.all([
        apiFetch("/api/admin/lego-jar/config"),
        apiFetch("/api/admin/lego-jar/rounds"),
        apiFetch("/api/admin/lego-jar/guesses"),
        fetch("/api/public/squad").then((r) => r.ok ? r.json() : []).catch(() => []),
      ])
      setConfig(cfg)
      setRounds(rds)
      setGuesses(gss)
      setSquad(Array.isArray(sq) ? sq : [])
      setConfigForm({
        pricePerGuess: String(cfg?.pricePerGuess ?? 50),
        actualCount: cfg?.actualCount != null ? String(cfg.actualCount) : "",
        status: cfg?.status ?? "active",
        imageUrl: cfg?.imageUrl ?? "",
      })
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const currentRound = rounds.find((r) => r.isCurrent) ?? null
  const pastRounds = rounds.filter((r) => !r.isCurrent)
  const totalGuesses = guesses.length
  const paidGuesses = guesses.filter((g) => g.paid).length
  const pricePerGuess = Number(config?.pricePerGuess ?? 50)
  const totalRaised = paidGuesses * pricePerGuess

  // Filtered guesses for guesses tab
  const filteredGuesses = guesses.filter((g) => {
    const q = guessSearch.trim().toLowerCase()
    if (q) {
      const nameMatch = g.guesserName.toLowerCase().includes(q)
      const emailMatch = g.guesserEmail?.toLowerCase().includes(q) ?? false
      if (!nameMatch && !emailMatch) return false
    }
    if (guessFilterPm !== "all" && g.paymentMethod !== guessFilterPm) return false
    if (guessFilterPaid === "paid" && !g.paid) return false
    if (guessFilterPaid === "unpaid" && g.paid) return false
    if (guessFilterRound !== "all") {
      const rId = guessFilterRound === "none" ? null : parseInt(guessFilterRound, 10)
      if (g.roundId !== rId) return false
    }
    return true
  })

  // Pass the Jar
  const handlePassJar = async () => {
    if (!passForm.holderName.trim()) { toast({ title: "Holder name is required", variant: "destructive" }); return }
    setPassSaving(true)
    try {
      await apiFetch("/api/admin/lego-jar/rounds", {
        method: "POST",
        body: JSON.stringify({
          holderName: passForm.holderName.trim(),
          squadMemberId: passForm.squadMemberId || null,
          location: passForm.location.trim() || null,
          notes: passForm.notes.trim() || null,
          closeCurrentRound: true,
        }),
      })
      toast({ title: "Jar passed!", description: `Now with ${passForm.holderName.trim()}` })
      setPassJarOpen(false)
      setPassForm({ holderName: "", squadMemberId: "", location: "", notes: "" })
      await load()
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    } finally {
      setPassSaving(false)
    }
  }

  // Log a guess
  const handleLogGuess = async () => {
    if (!guessForm.guesserName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return }
    const num = parseInt(guessForm.guessNumber, 10)
    if (isNaN(num) || num < 1) { toast({ title: "Enter a valid guess number", variant: "destructive" }); return }
    setGuessSaving(true)
    try {
      await apiFetch("/api/admin/lego-jar/guesses", {
        method: "POST",
        body: JSON.stringify({
          roundId: currentRound?.id ?? null,
          guesserName: guessForm.guesserName.trim(),
          guesserEmail: guessForm.guesserEmail.trim() || null,
          guessNumber: num,
          paymentMethod: guessForm.paymentMethod,
          paid: guessForm.paid,
        }),
      })
      toast({ title: "Guess logged!" })
      setGuessOpen(false)
      setGuessForm({ guesserName: "", guesserEmail: "", guessNumber: "", paymentMethod: "cash", paid: true })
      await load()
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    } finally {
      setGuessSaving(false)
    }
  }

  // Toggle paid
  const togglePaid = async (guess: Guess) => {
    try {
      await apiFetch(`/api/admin/lego-jar/guesses/${guess.id}`, {
        method: "PATCH",
        body: JSON.stringify({ paid: !guess.paid }),
      })
      setGuesses((prev) => prev.map((g) => g.id === guess.id ? { ...g, paid: !g.paid } : g))
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    }
  }

  // Delete guess
  const handleDeleteGuess = async (id: number) => {
    try {
      await apiFetch(`/api/admin/lego-jar/guesses/${id}`, { method: "DELETE" })
      setGuesses((prev) => prev.filter((g) => g.id !== id))
      toast({ title: "Guess deleted" })
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    } finally {
      setDeleteGuessId(null)
    }
  }

  // Save config
  const handleSaveConfig = async () => {
    setConfigSaving(true)
    try {
      const price = parseFloat(configForm.pricePerGuess)
      if (isNaN(price) || price <= 0) { toast({ title: "Price must be > 0", variant: "destructive" }); return }
      const payload: Record<string, unknown> = {
        pricePerGuess: price,
        status: configForm.status,
        imageUrl: configForm.imageUrl.trim() || null,
      }
      if (configForm.actualCount.trim()) payload.actualCount = parseInt(configForm.actualCount, 10)
      else payload.actualCount = null
      await apiFetch("/api/admin/lego-jar/config", { method: "PUT", body: JSON.stringify(payload) })
      toast({ title: "Config saved" })
      await load()
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    } finally {
      setConfigSaving(false)
    }
  }

  const currentGuesses = guesses.filter((g) => g.roundId === currentRound?.id)

  return (
    <PageLayout
      title="LEGO Jar Challenge"
      description="Track guesses, jar location, and funds raised."
      action={
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button variant="outline" onClick={() => setGuessOpen(true)}>
            <Plus className="w-4 h-4 mr-1.5" /> Log Guess
          </Button>
          <Button onClick={() => setPassJarOpen(true)}>
            <PackageOpen className="w-4 h-4 mr-1.5" /> Pass the Jar
          </Button>
        </div>
      }
    >
      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {[
          { label: "Total Raised", value: formatHKD(totalRaised), icon: DollarSign, color: "text-emerald-600" },
          { label: "Guesses Sold", value: String(totalGuesses), icon: Users, color: "text-blue-600" },
          { label: "Paid Guesses", value: String(paidGuesses), icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Price / Guess", value: formatHKD(pricePerGuess), icon: DollarSign, color: "text-gray-600" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-border p-4 flex items-center gap-3 shadow-sm">
            <div className={`w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">{label}</p>
              <p className="text-xl font-bold text-foreground leading-tight">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-border">
        {([
          { id: "overview", label: "Overview", icon: PackageOpen },
          { id: "guesses", label: `All Guesses (${totalGuesses})`, icon: List },
          { id: "config", label: "Settings", icon: Settings },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
              activeTab === id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW TAB */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Current holder */}
          <div className={`rounded-2xl border-2 p-6 ${currentRound ? "border-emerald-200 bg-emerald-50/50" : "border-dashed border-gray-300 bg-gray-50"}`}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Current Jar Holder</p>
                {currentRound ? (
                  <>
                    <h2 className="text-2xl font-bold text-foreground">{currentRound.holderName}</h2>
                    {currentRound.location && (
                      <p className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                        <MapPin className="w-3.5 h-3.5" /> {currentRound.location}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-2">
                      Since {format(parseISO(currentRound.startedAt), "d MMM yyyy")}
                      {" · "}
                      <span className="font-semibold text-emerald-700">{currentRound.guessCount} guess{currentRound.guessCount !== 1 ? "es" : ""}</span>
                      {" · "}
                      <span className="font-semibold text-emerald-700">{formatHKD(currentRound.amountRaised)} raised</span>
                    </p>
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm mt-1">No one has the jar yet. Use "Pass the Jar" to start the first round.</p>
                )}
              </div>
              <Button onClick={() => setPassJarOpen(true)} variant={currentRound ? "default" : "outline"}>
                <PackageOpen className="w-4 h-4 mr-1.5" />
                {currentRound ? "Pass the Jar" : "Start first round"}
              </Button>
            </div>

            {currentRound && currentGuesses.length > 0 && (
              <div className="mt-4 pt-4 border-t border-emerald-200">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Guesses this round</p>
                <div className="space-y-1.5">
                  {currentGuesses.slice(0, 8).map((g) => (
                    <div key={g.id} className="flex items-center justify-between text-sm">
                      <span className="font-medium text-foreground">{g.guesserName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-muted-foreground">{g.guessNumber.toLocaleString()}</span>
                        {g.paymentMethod && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${PM_COLORS[g.paymentMethod] ?? "bg-gray-100 text-gray-600"}`}>
                            {PM_LABELS[g.paymentMethod] ?? g.paymentMethod}
                          </span>
                        )}
                        <button
                          onClick={() => togglePaid(g)}
                          title={g.paid ? "Mark unpaid" : "Mark paid"}
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold border transition-colors ${
                            g.paid ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-emerald-50"
                          }`}
                        >
                          {g.paid ? "Paid" : "Unpaid"}
                        </button>
                      </div>
                    </div>
                  ))}
                  {currentGuesses.length > 8 && (
                    <p className="text-xs text-muted-foreground pt-1">
                      +{currentGuesses.length - 8} more — <button className="underline" onClick={() => setActiveTab("guesses")}>view all</button>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Past rounds */}
          {pastRounds.length > 0 && (
            <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border flex items-center gap-2">
                <History className="w-4 h-4 text-muted-foreground" />
                <h3 className="font-bold text-foreground">Past rounds</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground uppercase">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Holder</th>
                    <th className="px-6 py-3 text-left font-semibold">Location</th>
                    <th className="px-6 py-3 text-left font-semibold">Dates</th>
                    <th className="px-6 py-3 text-right font-semibold">Guesses</th>
                    <th className="px-6 py-3 text-right font-semibold">Raised</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pastRounds.map((r) => (
                    <tr key={r.id} className="hover:bg-muted/10">
                      <td className="px-6 py-3 font-medium">{r.holderName}</td>
                      <td className="px-6 py-3 text-muted-foreground">{r.location ?? "—"}</td>
                      <td className="px-6 py-3 text-muted-foreground text-xs">
                        {format(parseISO(r.startedAt), "d MMM")} → {r.endedAt ? format(parseISO(r.endedAt), "d MMM yyyy") : "ongoing"}
                      </td>
                      <td className="px-6 py-3 text-right font-medium">{r.guessCount}</td>
                      <td className="px-6 py-3 text-right font-bold text-emerald-600">{formatHKD(r.amountRaised)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* GUESSES TAB */}
      {activeTab === "guesses" && (
        <div className="space-y-4">
          {/* Search + filter controls */}
          <div className="flex flex-wrap gap-3 bg-white rounded-xl border border-border p-4 shadow-sm">
            <div className="relative flex-1 min-w-52">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={guessSearch}
                onChange={(e) => setGuessSearch(e.target.value)}
                placeholder="Search by name or email…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
            <select
              value={guessFilterPm}
              onChange={(e) => setGuessFilterPm(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All payment methods</option>
              <option value="payme">PayMe</option>
              <option value="wise">Wise</option>
              <option value="bank_transfer">Bank Transfer</option>
              <option value="cash">Cash</option>
            </select>
            <select
              value={guessFilterPaid}
              onChange={(e) => setGuessFilterPaid(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Paid & unpaid</option>
              <option value="paid">Paid only</option>
              <option value="unpaid">Unpaid only</option>
            </select>
            <select
              value={guessFilterRound}
              onChange={(e) => setGuessFilterRound(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All rounds</option>
              {rounds.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.holderName}{r.isCurrent ? " (current)" : ""}
                </option>
              ))}
            </select>
            {(guessSearch || guessFilterPm !== "all" || guessFilterPaid !== "all" || guessFilterRound !== "all") && (
              <button
                onClick={() => { setGuessSearch(""); setGuessFilterPm("all"); setGuessFilterPaid("all"); setGuessFilterRound("all") }}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2"
              >
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
            <span className="ml-auto self-center text-xs text-muted-foreground">{filteredGuesses.length} of {totalGuesses}</span>
          </div>

          {/* Guesses table */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="px-6 py-3 text-left font-semibold">Guesser</th>
                    <th className="px-6 py-3 text-left font-semibold">Email</th>
                    <th className="px-6 py-3 text-right font-semibold">Guess #</th>
                    <th className="px-6 py-3 text-left font-semibold">Round / Holder</th>
                    <th className="px-6 py-3 text-left font-semibold">Payment</th>
                    <th className="px-6 py-3 text-left font-semibold">Paid</th>
                    <th className="px-6 py-3 text-left font-semibold">Date</th>
                    <th className="px-6 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading…</td></tr>
                  ) : filteredGuesses.length === 0 ? (
                    <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                      {totalGuesses === 0 ? "No guesses yet." : "No guesses match your filters."}
                    </td></tr>
                  ) : (
                    filteredGuesses.map((g) => {
                      const round = rounds.find((r) => r.id === g.roundId)
                      return (
                        <tr key={g.id} className="hover:bg-muted/10 group">
                          <td className="px-6 py-3 font-medium">{g.guesserName}</td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">{g.guesserEmail ?? "—"}</td>
                          <td className="px-6 py-3 text-right font-mono font-bold">{g.guessNumber.toLocaleString()}</td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">{round ? round.holderName : "—"}</td>
                          <td className="px-6 py-3">
                            {g.paymentMethod ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PM_COLORS[g.paymentMethod] ?? "bg-gray-100 text-gray-600"}`}>
                                {PM_LABELS[g.paymentMethod] ?? g.paymentMethod}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-6 py-3">
                            <button
                              onClick={() => togglePaid(g)}
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold border transition-colors ${
                                g.paid ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-gray-100 text-gray-500 border-gray-200 hover:bg-emerald-50"
                              }`}
                            >
                              {g.paid ? "✓ Paid" : "Unpaid"}
                            </button>
                          </td>
                          <td className="px-6 py-3 text-muted-foreground text-xs">{format(parseISO(g.createdAt), "d MMM yyyy")}</td>
                          <td className="px-6 py-3 text-right">
                            <button
                              onClick={() => setDeleteGuessId(g.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* CONFIG TAB */}
      {activeTab === "config" && (
        <div className="max-w-lg space-y-6">
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-foreground">Challenge Settings</h3>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Price per guess (HKD)</label>
              <Input
                type="number"
                min="1"
                value={configForm.pricePerGuess}
                onChange={(e) => setConfigForm((f) => ({ ...f, pricePerGuess: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Actual LEGO count <span className="font-normal text-muted-foreground">(enter when ready to reveal)</span>
              </label>
              <Input
                type="number"
                min="1"
                placeholder="Leave blank until revealed"
                value={configForm.actualCount}
                onChange={(e) => setConfigForm((f) => ({ ...f, actualCount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Jar image URL <span className="font-normal text-muted-foreground">(optional — shown on public Support page)</span>
              </label>
              <Input
                type="url"
                placeholder="https://..."
                value={configForm.imageUrl}
                onChange={(e) => setConfigForm((f) => ({ ...f, imageUrl: e.target.value }))}
              />
              {configForm.imageUrl && (
                <img src={configForm.imageUrl} alt="Jar preview" className="mt-2 w-32 h-32 object-cover rounded-xl border" />
              )}
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">Challenge status</label>
              <select
                value={configForm.status}
                onChange={(e) => setConfigForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <Button onClick={handleSaveConfig} disabled={configSaving} className="w-full">
              {configSaving ? "Saving…" : "Save settings"}
            </Button>
          </div>
        </div>
      )}

      {/* Pass the Jar dialog */}
      <Modal isOpen={passJarOpen} onClose={() => setPassJarOpen(false)} title="Pass the Jar">
        <div className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">
            {currentRound
              ? `This will close ${currentRound.holderName}'s round and start a new one.`
              : "Start the first round by selecting who has the jar."}
          </p>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Who has the jar? *</label>
            <Input
              placeholder="e.g. John Smith"
              value={passForm.holderName}
              onChange={(e) => setPassForm((f) => ({ ...f, holderName: e.target.value }))}
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1">
              Link to squad member <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <p className="text-xs text-muted-foreground mb-1.5">If the holder is on the squad, link them here.</p>
            <SquadCombobox
              squad={squad}
              selectedId={passForm.squadMemberId}
              onSelect={(id, name) => {
                setPassForm((f) => ({
                  ...f,
                  squadMemberId: id,
                  holderName: id && !f.holderName ? name : f.holderName,
                }))
              }}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Location / Event <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              placeholder="e.g. KPMG Office, Family BBQ"
              value={passForm.location}
              onChange={(e) => setPassForm((f) => ({ ...f, location: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Notes <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              placeholder="Any extra context"
              value={passForm.notes}
              onChange={(e) => setPassForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setPassJarOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handlePassJar} disabled={passSaving || !passForm.holderName.trim()}>
              {passSaving ? "Saving…" : currentRound ? "Pass the Jar" : "Start round"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Log Guess dialog */}
      <Modal isOpen={guessOpen} onClose={() => setGuessOpen(false)} title="Log a Guess">
        <div className="space-y-4 p-1">
          {currentRound && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Assigning to <strong>{currentRound.holderName}</strong>'s round
              {currentRound.location && ` · ${currentRound.location}`}
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1.5">Guesser name *</label>
              <Input
                placeholder="Jane Smith"
                value={guessForm.guesserName}
                onChange={(e) => setGuessForm((f) => ({ ...f, guesserName: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1.5">Email <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                type="email"
                placeholder="jane@example.com"
                value={guessForm.guesserEmail}
                onChange={(e) => setGuessForm((f) => ({ ...f, guesserEmail: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Guess number *</label>
              <Input
                type="number"
                min="1"
                placeholder="e.g. 342"
                value={guessForm.guessNumber}
                onChange={(e) => setGuessForm((f) => ({ ...f, guessNumber: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1.5">Payment method</label>
              <select
                value={guessForm.paymentMethod}
                onChange={(e) => setGuessForm((f) => ({ ...f, paymentMethod: e.target.value }))}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="cash">Cash</option>
                <option value="payme">PayMe</option>
                <option value="wise">Wise</option>
                <option value="bank_transfer">Bank Transfer</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={guessForm.paid}
              onChange={(e) => setGuessForm((f) => ({ ...f, paid: e.target.checked }))}
              className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm font-medium">Payment received</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setGuessOpen(false)}>Cancel</Button>
            <Button className="flex-1" onClick={handleLogGuess} disabled={guessSaving}>
              {guessSaving ? "Saving…" : "Log guess"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal isOpen={deleteGuessId !== null} onClose={() => setDeleteGuessId(null)} title="Delete Guess">
        <div className="space-y-4 p-1">
          <p className="text-sm text-muted-foreground">Are you sure you want to delete this guess? This cannot be undone.</p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteGuessId(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => deleteGuessId && handleDeleteGuess(deleteGuessId)}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
