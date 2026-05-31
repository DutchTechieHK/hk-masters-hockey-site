import { useState, useEffect, useCallback, useRef } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, CheckCircle2, RefreshCw, PackageOpen, MapPin, Users, DollarSign, Settings, List, History, Search, X, Pencil, Globe, Clock } from "lucide-react"
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

type Prize = {
  id: number
  rank: number
  badge: string
  badgeColor: string
  title: string
  description: string
  imageUrl: string | null
  imageAlt: string | null
}

type Round = {
  id: number
  holderName: string
  squadMemberId: number | null
  location: string | null
  startedAt: string
  endedAt: string | null
  notes: string | null
  isWebsite: boolean
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
  guesserPhone: string | null
  guessNumber: number
  paymentMethod: string | null
  paid: boolean
  paidAt: string | null
  amountPaid: number | null
  createdAt: string
}

type GuesserGroup = {
  key: string
  guesserName: string
  guesserEmail: string | null
  guesserPhone: string | null
  guesses: Guess[]
  totalAmountPaid: number
  paidCount: number
  dominantPaymentMethod: string | null
  earliestDate: string
  roundHolders: string[]
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
  const [prizes, setPrizes] = useState<Prize[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"overview" | "guesses" | "config">("overview")

  // Pass jar dialog
  const [passJarOpen, setPassJarOpen] = useState(false)
  const [passForm, setPassForm] = useState({ holderName: "", squadMemberId: "", location: "", notes: "" })
  const [passSaving, setPassSaving] = useState(false)

  // Log guess dialog
  const [guessOpen, setGuessOpen] = useState(false)
  const [guessForm, setGuessForm] = useState({
    guesserName: "", guesserEmail: "", guesserPhone: "", paymentMethod: "cash", paid: false
  })
  const [guessMode, setGuessMode] = useState<"tier1" | "tier3" | "custom">("tier1")
  const [guessNumbers, setGuessNumbers] = useState<string[]>([""])
  const [guessAmountPaid, setGuessAmountPaid] = useState("50")
  const [guessSaving, setGuessSaving] = useState(false)

  // Config panel
  const [configForm, setConfigForm] = useState({ pricePerGuess: "50", actualCount: "", status: "active", imageUrl: "" })
  const [configSaving, setConfigSaving] = useState(false)

  // Prizes panel — one form entry per prize rank
  const [prizeForms, setPrizeForms] = useState<Record<number, { title: string; description: string; imageUrl: string; imageAlt: string }>>({})
  const [prizeSaving, setPrizeSaving] = useState<Record<number, boolean>>({})

  // Delete confirm
  const [deleteGuessId, setDeleteGuessId] = useState<number | null>(null)

  // Edit guesser (group-level contact info + per-guess fields)
  const [editGroup, setEditGroup] = useState<GuesserGroup | null>(null)
  const [editContactForm, setEditContactForm] = useState({ guesserName: "", guesserEmail: "", guesserPhone: "" })
  const [editGuessRows, setEditGuessRows] = useState<{ id: number; guessNumber: string }[]>([])
  const [editGroupPaymentMethod, setEditGroupPaymentMethod] = useState("cash")
  const [editGroupPaid, setEditGroupPaid] = useState(false)
  const [editGroupPaidTouched, setEditGroupPaidTouched] = useState(false)
  const [editGroupAmountPaid, setEditGroupAmountPaid] = useState("")
  const [editGroupSaving, setEditGroupSaving] = useState(false)

  function openEditGroup(group: GuesserGroup) {
    setEditContactForm({
      guesserName: group.guesserName,
      guesserEmail: group.guesserEmail ?? "",
      guesserPhone: group.guesserPhone ?? "",
    })
    setEditGuessRows(group.guesses.map((g) => ({
      id: g.id,
      guessNumber: String(g.guessNumber),
    })))
    // A bet is one payment: use the guesser's dominant payment method, and treat
    // it as received only when every guess in the bet is already marked received.
    setEditGroupPaymentMethod(group.dominantPaymentMethod ?? group.guesses[0]?.paymentMethod ?? "cash")
    setEditGroupPaid(group.guesses.length > 0 && group.paidCount === group.guesses.length)
    setEditGroupPaidTouched(false)
    // Use the already-rounded group total — avoids writing 33+33+33=99 back to DB
    setEditGroupAmountPaid(group.totalAmountPaid > 0 ? String(group.totalAmountPaid) : "")
    setEditGroup(group)
  }

  const handleSaveEditGroup = async () => {
    if (!editGroup) return
    if (!editContactForm.guesserName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return }
    setEditGroupSaving(true)
    try {
      // Single-item model: store the full total on the first row and 0 on the
      // rest, so SUM(amount_paid) equals the total exactly (no rounding/decimals).
      const totalPaid = editGroupAmountPaid.trim() ? Number(editGroupAmountPaid) : null
      const perRowAmounts: (number | null)[] = editGroup.guesses.map((_, i) => {
        if (totalPaid == null) return null
        return i === 0 ? totalPaid : 0
      })

      const results: Guess[] = await Promise.all(
        editGroup.guesses.map((g, i) => {
          const row = editGuessRows[i]
          return apiFetch(`/api/admin/lego-jar/guesses/${g.id}`, {
            method: "PATCH",
            body: JSON.stringify({
              guesserName: editContactForm.guesserName.trim(),
              guesserEmail: editContactForm.guesserEmail.trim() || null,
              guesserPhone: editContactForm.guesserPhone.trim() || null,
              // One bet = one payment: apply the same method to every guess in
              // the group. Only touch paid status when the admin explicitly
              // toggled it, so saving unrelated edits never clears the existing
              // received status of a partially-paid bet.
              paymentMethod: editGroupPaymentMethod || null,
              ...(editGroupPaidTouched ? { paid: editGroupPaid } : {}),
              ...(row ? {
                guessNumber: parseInt(row.guessNumber, 10) || g.guessNumber,
                amountPaid: perRowAmounts[i],
              } : {}),
            }),
          })
        })
      )
      setGuesses((prev) => {
        const byId = new Map(results.map((r) => [r.id, r]))
        return prev.map((g) => byId.has(g.id) ? byId.get(g.id)! : g)
      })
      toast({ title: "Guesser updated" })
      setEditGroup(null)
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save", variant: "destructive" })
    } finally {
      setEditGroupSaving(false)
    }
  }

  const toggleAllPaid = async (group: GuesserGroup) => {
    const allPaid = group.paidCount === group.guesses.length
    const toToggle = allPaid ? group.guesses : group.guesses.filter((g) => !g.paid)
    const newPaid = !allPaid
    try {
      await Promise.all(
        toToggle.map((g) => apiFetch(`/api/admin/lego-jar/guesses/${g.id}`, {
          method: "PATCH",
          body: JSON.stringify({ paid: newPaid }),
        }))
      )
      setGuesses((prev) => prev.map((g) => toToggle.find((t) => t.id === g.id) ? { ...g, paid: newPaid } : g))
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    }
  }

  // Reassign all of a guesser's guesses to the Website designation
  const moveGroupToWebsite = async (group: GuesserGroup) => {
    const wr = rounds.find((r) => r.isWebsite)
    if (!wr) { toast({ title: "Website designation not available yet", variant: "destructive" }); return }
    const toMove = group.guesses.filter((g) => g.roundId !== wr.id)
    if (toMove.length === 0) { toast({ title: "Already on Website" }); return }
    try {
      await Promise.all(
        toMove.map((g) => apiFetch(`/api/admin/lego-jar/guesses/${g.id}`, {
          method: "PATCH",
          body: JSON.stringify({ roundId: wr.id }),
        }))
      )
      setGuesses((prev) => prev.map((g) => toMove.find((t) => t.id === g.id) ? { ...g, roundId: wr.id } : g))
      toast({ title: "Moved to Website", description: group.guesserName })
    } catch (err) {
      toast({ title: (err as Error).message || "Failed", variant: "destructive" })
    }
  }

  // Guess search/filter state
  const [guessSearch, setGuessSearch] = useState("")
  const [guessFilterPm, setGuessFilterPm] = useState("all")
  const [guessFilterPaid, setGuessFilterPaid] = useState("all")
  const [guessFilterRound, setGuessFilterRound] = useState("all")

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cfg, rds, gss, sq, pzs] = await Promise.all([
        apiFetch("/api/admin/lego-jar/config"),
        apiFetch("/api/admin/lego-jar/rounds"),
        apiFetch("/api/admin/lego-jar/guesses"),
        fetch("/api/public/squad").then((r) => r.ok ? r.json() : []).catch(() => []),
        apiFetch("/api/admin/lego-jar/prizes"),
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
      const pzArr: Prize[] = Array.isArray(pzs) ? pzs : []
      setPrizes(pzArr)
      const forms: Record<number, { title: string; description: string; imageUrl: string; imageAlt: string }> = {}
      for (const p of pzArr) {
        forms[p.rank] = {
          title: p.title,
          description: p.description,
          imageUrl: p.imageUrl ?? "",
          imageAlt: p.imageAlt ?? "",
        }
      }
      setPrizeForms(forms)
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to load data", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const currentRound = rounds.find((r) => r.isCurrent) ?? null
  const websiteRound = rounds.find((r) => r.isWebsite) ?? null
  const pastRounds = rounds.filter((r) => !r.isCurrent && !r.isWebsite)
  const totalGuesses = guesses.length
  const paidGuesses = guesses.filter((g) => g.paid).length
  const pendingGuesses = totalGuesses - paidGuesses
  const pricePerGuess = Number(config?.pricePerGuess ?? 50)
  const totalRaised = Math.round(guesses
    .filter((g) => g.paid)
    .reduce((sum, g) => sum + (g.amountPaid != null ? Number(g.amountPaid) : pricePerGuess), 0))

  // Keep the per-round/holder summary cards (guess count, paid count, amount
  // raised) in sync with the in-memory guesses list. Without this, toggling a
  // payment received or editing a guesser only updated those cards after a full
  // reload. Formulas mirror the admin rounds endpoint: guessCount counts every
  // guess in the round; paidCount and amountRaised count only paid guesses.
  useEffect(() => {
    setRounds((prev) => {
      let changed = false
      const next = prev.map((r) => {
        const rGss = guesses.filter((g) => g.roundId === r.id)
        const guessCount = rGss.length
        const paidCount = rGss.filter((g) => g.paid).length
        const amountRaised = rGss
          .filter((g) => g.paid)
          .reduce((sum, g) => sum + (g.amountPaid != null ? Number(g.amountPaid) : pricePerGuess), 0)
        if (r.guessCount === guessCount && r.paidCount === paidCount && r.amountRaised === amountRaised) return r
        changed = true
        return { ...r, guessCount, paidCount, amountRaised }
      })
      return changed ? next : prev
    })
  }, [guesses, pricePerGuess])

  // Filtered guesses for guesses tab
  const filteredGuesses = guesses.filter((g) => {
    const q = guessSearch.trim().toLowerCase()
    if (q) {
      const nameMatch = g.guesserName.toLowerCase().includes(q)
      const emailMatch = g.guesserEmail?.toLowerCase().includes(q) ?? false
      const phoneMatch = g.guesserPhone?.toLowerCase().includes(q) ?? false
      if (!nameMatch && !emailMatch && !phoneMatch) return false
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

  // Group ALL guesses by guesser name, then apply filters at group level
  // (so that matching a filter shows the full person row, not just matching guesses)
  const guesserGroups: GuesserGroup[] = (() => {
    // Step 1: build groups from every guess in the DB
    const map = new Map<string, Guess[]>()
    for (const g of guesses) {
      const key = g.guesserName.trim().toLowerCase()
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(g)
    }
    const allGroups = Array.from(map.entries()).map(([key, gs]): GuesserGroup => {
      const sorted = [...gs].sort((a, b) => a.guessNumber - b.guessNumber)
      const email = gs.find((g) => g.guesserEmail)?.guesserEmail ?? null
      const phone = gs.find((g) => g.guesserPhone)?.guesserPhone ?? null
      const paidCount = gs.filter((g) => g.paid).length
      const totalAmountPaid = Math.round(gs.filter((g) => g.paid).reduce((sum, g) => sum + (g.amountPaid != null ? Number(g.amountPaid) : pricePerGuess), 0))
      const pmCounts: Record<string, number> = {}
      for (const g of gs) { if (g.paymentMethod) pmCounts[g.paymentMethod] = (pmCounts[g.paymentMethod] ?? 0) + 1 }
      const dominantPm = Object.entries(pmCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
      const earliestDate = gs.reduce((min, g) => g.createdAt < min ? g.createdAt : min, gs[0].createdAt)
      const roundCounts: Record<number, number> = {}
      for (const g of gs) { if (g.roundId != null) roundCounts[g.roundId] = (roundCounts[g.roundId] ?? 0) + 1 }
      const roundHolders = Object.entries(roundCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([rId]) => rounds.find((r) => r.id === parseInt(rId, 10))?.holderName)
        .filter((h): h is string => !!h)
      return { key, guesserName: sorted[0].guesserName, guesserEmail: email, guesserPhone: phone, guesses: sorted, totalAmountPaid, paidCount, dominantPaymentMethod: dominantPm, earliestDate, roundHolders }
    }).sort((a, b) => a.earliestDate.localeCompare(b.earliestDate))

    // Step 2: filter at group level — include group if any guess in it matches the criteria
    return allGroups.filter((group) => {
      const q = guessSearch.trim().toLowerCase()
      if (q) {
        const anyMatch = group.guesses.some((g) =>
          g.guesserName.toLowerCase().includes(q) ||
          (g.guesserEmail?.toLowerCase().includes(q) ?? false) ||
          (g.guesserPhone?.toLowerCase().includes(q) ?? false)
        )
        if (!anyMatch) return false
      }
      if (guessFilterPm !== "all" && !group.guesses.some((g) => g.paymentMethod === guessFilterPm)) return false
      if (guessFilterPaid === "paid" && !group.guesses.some((g) => g.paid)) return false
      if (guessFilterPaid === "unpaid" && !group.guesses.some((g) => !g.paid)) return false
      if (guessFilterRound !== "all") {
        const rId = guessFilterRound === "none" ? null : parseInt(guessFilterRound, 10)
        if (!group.guesses.some((g) => g.roundId === rId)) return false
      }
      return true
    })
  })()

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

  function resetGuessDialog() {
    setGuessForm({ guesserName: "", guesserEmail: "", guesserPhone: "", paymentMethod: "cash", paid: false })
    setGuessMode("tier1")
    setGuessNumbers([""])
    setGuessAmountPaid("50")
  }

  // Log a guess (supports batches)
  const handleLogGuess = async () => {
    if (!guessForm.guesserName.trim()) { toast({ title: "Name is required", variant: "destructive" }); return }
    const validNums = guessNumbers.map((n) => n.trim()).filter(Boolean)
    if (validNums.length === 0) { toast({ title: "Enter at least one guess number", variant: "destructive" }); return }
    const parsedNums = validNums.map((n) => parseInt(n, 10))
    if (parsedNums.some((n) => isNaN(n) || n < 1)) { toast({ title: "All guess numbers must be positive integers", variant: "destructive" }); return }
    const amountPaid = guessAmountPaid.trim() ? Number(guessAmountPaid) : null
    setGuessSaving(true)
    try {
      await apiFetch("/api/admin/lego-jar/guesses", {
        method: "POST",
        body: JSON.stringify({
          roundId: currentRound?.id ?? null,
          guesserName: guessForm.guesserName.trim(),
          guesserEmail: guessForm.guesserEmail.trim() || null,
          guesserPhone: guessForm.guesserPhone.trim() || null,
          guessNumbers: parsedNums,
          paymentMethod: guessForm.paymentMethod,
          paid: guessForm.paid,
          amountPaid,
        }),
      })
      toast({ title: parsedNums.length === 1 ? "Guess logged!" : `${parsedNums.length} guesses logged!` })
      setGuessOpen(false)
      resetGuessDialog()
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

  // Save a prize
  const handleSavePrize = async (rank: number) => {
    const form = prizeForms[rank]
    if (!form) return
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return }
    if (!form.description.trim()) { toast({ title: "Description is required", variant: "destructive" }); return }
    const prize = prizes.find((p) => p.rank === rank)
    setPrizeSaving((s) => ({ ...s, [rank]: true }))
    try {
      const updated = await apiFetch(`/api/admin/lego-jar/prizes/${rank}`, {
        method: "PUT",
        body: JSON.stringify({
          badge: prize?.badge,
          badgeColor: prize?.badgeColor,
          title: form.title.trim(),
          description: form.description.trim(),
          imageUrl: form.imageUrl.trim() || null,
          imageAlt: form.imageAlt.trim() || null,
        }),
      })
      setPrizes((prev) => prev.map((p) => p.rank === rank ? updated : p))
      toast({ title: `${rank === 1 ? "1st" : rank === 2 ? "2nd" : "3rd"} prize saved` })
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save prize", variant: "destructive" })
    } finally {
      setPrizeSaving((s) => ({ ...s, [rank]: false }))
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
          <Button variant="outline" onClick={load} disabled={loading}>
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
          { label: "Verified Guesses", value: String(paidGuesses), icon: CheckCircle2, color: "text-emerald-600" },
          { label: "Pending Payment", value: String(pendingGuesses), icon: Clock, color: pendingGuesses > 0 ? "text-amber-600" : "text-gray-400" },
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
                          title={g.paid ? "Mark as pending" : "Mark payment received"}
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold border transition-colors ${
                            g.paid ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-700 border-amber-200 hover:bg-emerald-50"
                          }`}
                        >
                          {g.paid ? "Received" : "Pending"}
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

          {/* Website designation */}
          {websiteRound && (
            <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/40 p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Website (online submissions)</p>
                    <p className="text-sm text-muted-foreground">
                      Guesses submitted through the public website are tracked here, separate from the jar holders.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      <span className="font-semibold text-blue-700">{websiteRound.paidCount} verified guess{websiteRound.paidCount !== 1 ? "es" : ""}</span>
                      {websiteRound.guessCount > websiteRound.paidCount && (
                        <span className="text-amber-600"> · {websiteRound.guessCount - websiteRound.paidCount} pending</span>
                      )}
                      {" · "}
                      <span className="font-semibold text-blue-700">{formatHKD(websiteRound.amountRaised)} raised</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

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
              <option value="all">All payments</option>
              <option value="paid">Payment received</option>
              <option value="unpaid">Pending payment</option>
            </select>
            <select
              value={guessFilterRound}
              onChange={(e) => setGuessFilterRound(e.target.value)}
              className="h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">All rounds</option>
              {rounds.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.holderName}{r.isCurrent ? " (current)" : r.isWebsite ? " (online)" : ""}
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
            <span className="ml-auto self-center text-xs text-muted-foreground">
              {guesserGroups.length} {guesserGroups.length === 1 ? "guesser" : "guessers"} · {totalGuesses} guesses
            </span>
          </div>

          {/* Guesses table — one row per guesser */}
          <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 text-xs text-muted-foreground uppercase border-b border-border">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Guesser</th>
                    <th className="px-4 py-3 text-left font-semibold">Email</th>
                    <th className="px-4 py-3 text-left font-semibold">Phone</th>
                    <th className="px-4 py-3 text-left font-semibold">Guesses</th>
                    <th className="px-4 py-3 text-left font-semibold">Verified</th>
                    <th className="px-4 py-3 text-right font-semibold">Total</th>
                    <th className="px-4 py-3 text-left font-semibold">Payment</th>
                    <th className="px-4 py-3 text-left font-semibold">Holder</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loading ? (
                    <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Loading…</td></tr>
                  ) : guesserGroups.length === 0 ? (
                    <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      {totalGuesses === 0 ? "No guesses yet." : "No guesses match your filters."}
                    </td></tr>
                  ) : (
                    guesserGroups.map((group) => {
                      const allPaid = group.paidCount === group.guesses.length
                      const nonePaid = group.paidCount === 0
                      return (
                        <tr key={group.key} className="hover:bg-muted/10 group align-top">
                          <td className="px-4 py-3 font-medium whitespace-nowrap">{group.guesserName}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{group.guesserEmail ?? "—"}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">{group.guesserPhone ?? "—"}</td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {group.guesses.map((g) => (
                                <div key={g.id} className="group/chip flex items-center gap-0.5">
                                  <button
                                    onClick={() => togglePaid(g)}
                                    title={g.paid ? "Mark as pending" : "Mark payment received"}
                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-mono font-semibold border transition-colors ${
                                      g.paid
                                        ? "bg-emerald-100 text-emerald-800 border-emerald-200 hover:bg-emerald-50"
                                        : "bg-gray-100 text-gray-600 border-gray-200 hover:bg-emerald-50 hover:border-emerald-200"
                                    }`}
                                  >
                                    <span>{g.paid ? "✓" : "·"}</span>
                                    <span>{g.guessNumber.toLocaleString()}</span>
                                  </button>
                                  <button
                                    onClick={() => setDeleteGuessId(g.id)}
                                    title="Delete this guess"
                                    className="opacity-0 group-hover/chip:opacity-100 p-0.5 text-muted-foreground hover:text-destructive rounded transition-all"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${allPaid ? "text-emerald-700" : nonePaid ? "text-gray-400" : "text-amber-600"}`}>
                                {group.paidCount} / {group.guesses.length}
                              </span>
                              {!allPaid && (
                                <button
                                  onClick={() => toggleAllPaid(group)}
                                  className="text-xs text-muted-foreground hover:text-emerald-700 underline underline-offset-2 transition-colors"
                                  title="Mark all payments received"
                                >
                                  all
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-xs font-mono text-muted-foreground whitespace-nowrap">
                            {group.totalAmountPaid > 0 ? `HK$${group.totalAmountPaid.toLocaleString()}` : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {group.dominantPaymentMethod ? (
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PM_COLORS[group.dominantPaymentMethod] ?? "bg-gray-100 text-gray-600"}`}>
                                {PM_LABELS[group.dominantPaymentMethod] ?? group.dominantPaymentMethod}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {group.roundHolders.length === 0 ? "—" : group.roundHolders.length === 1 ? group.roundHolders[0] : `${group.roundHolders[0]} +${group.roundHolders.length - 1}`}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                            {format(parseISO(group.earliestDate), "d MMM yyyy")}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            {websiteRound && group.guesses.some((g) => g.roundId !== websiteRound.id) && (
                              <button
                                onClick={() => moveGroupToWebsite(group)}
                                className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-blue-600 rounded transition-all"
                                title="Move to Website designation"
                              >
                                <Globe className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openEditGroup(group)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-primary rounded transition-all"
                              title="Edit contact info"
                            >
                              <Pencil className="w-4 h-4" />
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
          {/* Prizes section */}
          <div className="bg-white rounded-2xl border border-border p-6 shadow-sm space-y-5">
            <h3 className="font-bold text-foreground">Prizes</h3>
            {prizes.length === 0 && loading && (
              <p className="text-sm text-muted-foreground">Loading prizes…</p>
            )}
            {prizes.map((prize) => {
              const form = prizeForms[prize.rank] ?? { title: "", description: "", imageUrl: "", imageAlt: "" }
              const saving = prizeSaving[prize.rank] ?? false
              const RANK_LABELS = ["", "1st Prize", "2nd Prize", "3rd Prize"]
              return (
                <div key={prize.rank} className="border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${prize.badgeColor}`}>
                      {prize.badge}
                    </span>
                    <span className="text-sm font-semibold text-foreground">{RANK_LABELS[prize.rank]}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Title *</label>
                    <Input
                      value={form.title}
                      onChange={(e) => setPrizeForms((f) => ({ ...f, [prize.rank]: { ...form, title: e.target.value } }))}
                      placeholder="e.g. 7 Nights in Bali Villa"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Description *</label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setPrizeForms((f) => ({ ...f, [prize.rank]: { ...form, description: e.target.value } }))}
                      placeholder="Describe the prize…"
                      rows={3}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Photo URL <span className="font-normal">(optional)</span></label>
                    <Input
                      type="url"
                      value={form.imageUrl}
                      onChange={(e) => setPrizeForms((f) => ({ ...f, [prize.rank]: { ...form, imageUrl: e.target.value } }))}
                      placeholder="https://…"
                    />
                    {form.imageUrl && (
                      <img src={form.imageUrl} alt="Prize preview" className="mt-2 w-32 h-24 object-cover rounded-lg border" />
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Photo alt text <span className="font-normal">(optional)</span></label>
                    <Input
                      value={form.imageAlt}
                      onChange={(e) => setPrizeForms((f) => ({ ...f, [prize.rank]: { ...form, imageAlt: e.target.value } }))}
                      placeholder="e.g. Bali villa with pool"
                    />
                  </div>
                  <Button size="sm" onClick={() => handleSavePrize(prize.rank)} disabled={saving}>
                    {saving ? "Saving…" : `Save ${RANK_LABELS[prize.rank]}`}
                  </Button>
                </div>
              )
            })}
          </div>

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
      <Modal isOpen={guessOpen} onClose={() => { setGuessOpen(false); resetGuessDialog() }} title="Log a Guess">
        <div className="space-y-4 p-1">
          {currentRound && (
            <div className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              Assigning to <strong>{currentRound.holderName}</strong>'s round
              {currentRound.location && ` · ${currentRound.location}`}
            </div>
          )}

          {/* Tier selector */}
          <div>
            <label className="block text-sm font-semibold mb-2">Pricing tier</label>
            <div className="flex gap-2">
              {([
                { key: "tier1", label: "1 guess", price: "HK$50" },
                { key: "tier3", label: "3 guesses", price: "HK$100" },
                { key: "custom", label: "Custom", price: "" },
              ] as const).map(({ key, label, price }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setGuessMode(key)
                    if (key === "tier1") { setGuessNumbers([""]); setGuessAmountPaid("50") }
                    else if (key === "tier3") { setGuessNumbers(["", "", ""]); setGuessAmountPaid("100") }
                    else { setGuessNumbers([""]); setGuessAmountPaid("") }
                  }}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border-2 font-semibold transition-all text-center ${
                    guessMode === key ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  <span className="block">{label}</span>
                  {price && <span className="text-xs font-normal opacity-80">{price}</span>}
                </button>
              ))}
            </div>
          </div>

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
            <div className="col-span-2">
              <label className="block text-sm font-semibold mb-1.5">Phone <span className="font-normal text-muted-foreground">(optional)</span></label>
              <Input
                type="tel"
                placeholder="+852 XXXX XXXX"
                value={guessForm.guesserPhone}
                onChange={(e) => setGuessForm((f) => ({ ...f, guesserPhone: e.target.value }))}
              />
            </div>

            {/* Guess number fields */}
            {guessNumbers.map((num, i) => (
              <div key={i} className={guessNumbers.length === 1 ? "col-span-2" : ""}>
                <label className="block text-sm font-semibold mb-1.5">
                  {guessNumbers.length === 1 ? "Guess number *" : `Guess ${i + 1} *`}
                </label>
                <Input
                  type="number"
                  min="1"
                  placeholder="e.g. 342"
                  value={num}
                  onChange={(e) => setGuessNumbers((prev) => prev.map((n, j) => j === i ? e.target.value : n))}
                />
              </div>
            ))}

            {/* Custom mode: add/remove */}
            {guessMode === "custom" && (
              <div className="col-span-2 flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setGuessNumbers((prev) => [...prev, ""])}
                  disabled={guessNumbers.length >= 10}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add guess
                </Button>
                {guessNumbers.length > 1 && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setGuessNumbers((prev) => prev.slice(0, -1))}
                  >
                    Remove last
                  </Button>
                )}
              </div>
            )}

            {/* Amount paid */}
            <div className={guessNumbers.length === 1 ? "" : "col-span-2"}>
              <label className="block text-sm font-semibold mb-1.5">
                Total amount paid <span className="font-normal text-muted-foreground">(HK$)</span>
              </label>
              <Input
                type="number"
                min="0"
                placeholder={guessMode === "tier1" ? "50" : guessMode === "tier3" ? "100" : "e.g. 500"}
                value={guessAmountPaid}
                onChange={(e) => setGuessAmountPaid(e.target.value)}
                readOnly={guessMode !== "custom"}
                className={guessMode !== "custom" ? "bg-muted/40 cursor-default" : ""}
              />
              {guessNumbers.length > 1 && guessAmountPaid && (
                <p className="text-xs text-muted-foreground mt-1">
                  = HK${(Number(guessAmountPaid) / guessNumbers.length).toFixed(2)} per guess
                </p>
              )}
            </div>

            <div className={guessNumbers.length === 1 ? "" : "col-span-2"}>
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
            <Button variant="outline" className="flex-1" onClick={() => { setGuessOpen(false); resetGuessDialog() }}>Cancel</Button>
            <Button className="flex-1" onClick={handleLogGuess} disabled={guessSaving}>
              {guessSaving ? "Saving…" : guessNumbers.filter(Boolean).length > 1 ? `Log ${guessNumbers.filter(Boolean).length} guesses` : "Log guess"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit guesser contact info + per-guess fields */}
      <Modal isOpen={editGroup !== null} onClose={() => setEditGroup(null)} title="Edit Guesser">
        <div className="space-y-4 p-1">
          <div>
            <label className="block text-sm font-semibold mb-1.5">Name *</label>
            <Input
              value={editContactForm.guesserName}
              onChange={(e) => setEditContactForm((f) => ({ ...f, guesserName: e.target.value }))}
              placeholder="Jane Smith"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Email <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              type="email"
              placeholder="jane@example.com"
              value={editContactForm.guesserEmail}
              onChange={(e) => setEditContactForm((f) => ({ ...f, guesserEmail: e.target.value }))}
            />
          </div>
          <div>
            <label className="block text-sm font-semibold mb-1.5">Phone <span className="font-normal text-muted-foreground">(optional)</span></label>
            <Input
              type="tel"
              placeholder="+852 XXXX XXXX"
              value={editContactForm.guesserPhone}
              onChange={(e) => setEditContactForm((f) => ({ ...f, guesserPhone: e.target.value }))}
            />
          </div>

          {/* Per-guess rows */}
          {editGuessRows.length > 0 && (
            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
                {editGuessRows.length === 1 ? "Guess details" : `${editGuessRows.length} Guesses`}
              </p>
              {/* Guess numbers — one per guess */}
              <div className="grid grid-cols-2 gap-3">
                {editGuessRows.map((row, i) => (
                  <div key={row.id}>
                    <label className="block text-xs font-semibold mb-1">
                      {editGuessRows.length === 1 ? "Guess number *" : `Guess ${i + 1} number *`}
                    </label>
                    <Input
                      type="number"
                      min="1"
                      value={row.guessNumber}
                      onChange={(e) => setEditGuessRows((prev) => prev.map((r, j) => j === i ? { ...r, guessNumber: e.target.value } : r))}
                    />
                  </div>
                ))}
              </div>

              {/* One bet = one payment: a single payment method for the whole bet */}
              <div>
                <label className="block text-xs font-semibold mb-1">Payment method</label>
                <select
                  value={editGroupPaymentMethod}
                  onChange={(e) => setEditGroupPaymentMethod(e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="cash">Cash</option>
                  <option value="payme">PayMe</option>
                  <option value="wise">Wise</option>
                  <option value="bank_transfer">Bank Transfer</option>
                </select>
              </div>

              {/* Single total amount field — stored on the first guess to avoid rounding errors */}
              <div>
                <label className="block text-xs font-semibold mb-1">Total amount paid (HK$)</label>
                <Input
                  type="number"
                  min="0"
                  placeholder={editGuessRows.length === 1 ? "e.g. 50" : "e.g. 100"}
                  value={editGroupAmountPaid}
                  onChange={(e) => setEditGroupAmountPaid(e.target.value)}
                />
              </div>

              {/* Single payment-received toggle for the whole bet */}
              <label className="flex items-center gap-2.5 cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={editGroupPaid}
                  onChange={(e) => { setEditGroupPaid(e.target.checked); setEditGroupPaidTouched(true) }}
                  className="w-4 h-4 rounded border-input"
                />
                <span className="text-sm font-medium">Payment received</span>
                {editGuessRows.length > 1 && (
                  <span className="text-xs text-muted-foreground">— applies to all {editGuessRows.length} guesses</span>
                )}
              </label>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setEditGroup(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSaveEditGroup} disabled={editGroupSaving}>
              {editGroupSaving ? "Saving…" : "Save"}
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
