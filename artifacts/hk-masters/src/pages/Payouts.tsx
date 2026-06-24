import React, { useState, useEffect, useCallback } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, Edit2, Download, ArrowDownToLine, RefreshCw, TrendingUp, Package } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { format, parseISO } from "date-fns"
import { getStoredAdminToken } from "@/lib/admin-auth"

const SESSION_KEY = "hkm_admin_session"
function getToken(): string {
  return getStoredAdminToken() ?? localStorage.getItem(SESSION_KEY) ?? ""
}

type Payout = {
  id: number
  playerId: number | null
  recipientName: string
  amount: number
  payoutDate: string
  method: string
  source: string
  reference: string | null
  notes: string | null
  createdAt: string
  playerName: string | null
}

type Player = { id: number; name: string }

type ReconciliationRow = {
  playerId: number
  playerName: string
  fundraisingReceived: number
  legoJarAllocated: number
  totalPaidOut: number
  balance: number
}

type ReconciliationData = {
  players: ReconciliationRow[]
  legoJarTotal: number
}

const METHOD_LABELS: Record<string, string> = {
  fps: "FPS",
  payme: "PayMe",
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  cheque: "Cheque",
  other: "Other",
}

const SOURCE_LABELS: Record<string, string> = {
  fundraising: "Fundraising",
  lego_jar: "LEGO Jar",
  general: "General",
}

const SOURCE_COLORS: Record<string, string> = {
  fundraising: "bg-blue-100 text-blue-800",
  lego_jar: "bg-purple-100 text-purple-800",
  general: "bg-gray-100 text-gray-800",
}

const payoutSchema = z.object({
  playerId: z.coerce.number().nullable().optional(),
  recipientName: z.string().min(1, "Recipient name is required"),
  amount: z.coerce.number().positive("Amount must be positive"),
  payoutDate: z.string().min(1, "Date is required"),
  method: z.enum(["fps", "payme", "bank_transfer", "cash", "cheque", "other"]),
  source: z.enum(["fundraising", "lego_jar", "general"]),
  reference: z.string().optional(),
  notes: z.string().optional(),
})

type PayoutFormValues = z.infer<typeof payoutSchema>

export default function Payouts() {
  const { toast } = useToast()
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"ledger" | "reconciliation">("ledger")

  const [reconciliation, setReconciliation] = useState<ReconciliationData | null>(null)
  const [recoLoading, setRecoLoading] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPayout, setEditingPayout] = useState<Payout | null>(null)
  const [saving, setSaving] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} })

  const { register, handleSubmit, reset, watch, setValue, formState: { errors } } = useForm<PayoutFormValues>({
    resolver: zodResolver(payoutSchema),
    defaultValues: {
      method: "fps",
      source: "fundraising",
      payoutDate: new Date().toISOString().split("T")[0],
    },
  })

  const watchedPlayerId = watch("playerId")

  const fetchPayouts = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/payouts", { headers: { "x-session-token": getToken() } })
      if (!res.ok) throw new Error("Failed to load payouts")
      const data = await res.json() as Payout[]
      setPayouts(data)
    } catch {
      toast({ title: "Failed to load payouts", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  const fetchPlayers = useCallback(async () => {
    try {
      const res = await fetch("/api/players", { headers: { "x-session-token": getToken() } })
      if (!res.ok) return
      const data = await res.json() as { id: number; name: string }[]
      setPlayers(data.sort((a, b) => a.name.localeCompare(b.name)))
    } catch { /* non-critical */ }
  }, [])

  const fetchReconciliation = useCallback(async () => {
    setRecoLoading(true)
    try {
      const res = await fetch("/api/payouts/reconciliation", { headers: { "x-session-token": getToken() } })
      if (!res.ok) throw new Error("Failed to load reconciliation")
      const data = await res.json() as ReconciliationData
      setReconciliation(data)
    } catch {
      toast({ title: "Failed to load reconciliation", variant: "destructive" })
    } finally {
      setRecoLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchPayouts()
    fetchPlayers()
  }, [fetchPayouts, fetchPlayers])

  useEffect(() => {
    if (activeTab === "reconciliation" && !reconciliation) {
      fetchReconciliation()
    }
  }, [activeTab, reconciliation, fetchReconciliation])

  const openAddModal = () => {
    setEditingPayout(null)
    reset({
      playerId: null,
      recipientName: "",
      amount: 0,
      payoutDate: new Date().toISOString().split("T")[0],
      method: "fps",
      source: "fundraising",
      reference: "",
      notes: "",
    })
    setIsModalOpen(true)
  }

  const openEditModal = (p: Payout) => {
    setEditingPayout(p)
    reset({
      playerId: p.playerId ?? null,
      recipientName: p.recipientName,
      amount: p.amount,
      payoutDate: p.payoutDate,
      method: p.method as PayoutFormValues["method"],
      source: p.source as PayoutFormValues["source"],
      reference: p.reference ?? "",
      notes: p.notes ?? "",
    })
    setIsModalOpen(true)
  }

  const onPlayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (!val) {
      setValue("playerId", null)
    } else {
      const pid = parseInt(val, 10)
      setValue("playerId", pid)
      const player = players.find((p) => p.id === pid)
      if (player) setValue("recipientName", player.name)
    }
  }

  const onSubmit = async (data: PayoutFormValues) => {
    setSaving(true)
    try {
      const body = {
        ...data,
        playerId: data.playerId || null,
        reference: data.reference || null,
        notes: data.notes || null,
      }
      let res: Response
      if (editingPayout) {
        res = await fetch(`/api/payouts/${editingPayout.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", "x-session-token": getToken() },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch("/api/payouts", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-session-token": getToken() },
          body: JSON.stringify(body),
        })
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(err.error ?? "Failed to save")
      }
      toast({ title: editingPayout ? "Payout updated" : "Payout recorded" })
      setIsModalOpen(false)
      fetchPayouts()
      setReconciliation(null)
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to save payout", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = (id: number, name: string) => {
    setConfirmDialog({
      isOpen: true,
      title: "Delete Payout",
      message: `Delete the payout to ${name}? This cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isOpen: false }))
        try {
          const res = await fetch(`/api/payouts/${id}`, {
            method: "DELETE",
            headers: { "x-session-token": getToken() },
          })
          if (!res.ok) throw new Error("Failed to delete")
          toast({ title: "Payout deleted" })
          fetchPayouts()
          setReconciliation(null)
        } catch {
          toast({ title: "Failed to delete payout", variant: "destructive" })
        }
      },
    })
  }

  const exportCSV = () => {
    const escape = (v: string | number | null | undefined) =>
      `"${String(v ?? "").replace(/"/g, '""')}"`
    const rows = [
      ["Date", "Recipient", "Amount (HKD)", "Method", "Source", "Reference", "Notes"].map(escape).join(","),
      ...payouts.map((p) =>
        [
          escape(p.payoutDate),
          escape(p.recipientName),
          escape(p.amount),
          escape(METHOD_LABELS[p.method] ?? p.method),
          escape(SOURCE_LABELS[p.source] ?? p.source),
          escape(p.reference ?? ""),
          escape(p.notes ?? ""),
        ].join(",")
      ),
    ]
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `hk-masters-payouts-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const totalPaidOut = payouts.reduce((s, p) => s + p.amount, 0)

  return (
    <PageLayout
      title="Payouts"
      description="Track outbound payments to players from fundraising and LEGO Jar proceeds."
    >
      {/* Summary card */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm">
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
            <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Paid Out</p>
            <p className="text-xl font-bold text-gray-900">{formatCurrency(totalPaidOut)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            activeTab === "ledger"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-gray-700"
          }`}
        >
          Ledger
        </button>
        <button
          onClick={() => setActiveTab("reconciliation")}
          className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
            activeTab === "reconciliation"
              ? "border-primary text-primary bg-primary/5"
              : "border-transparent text-muted-foreground hover:text-gray-700"
          }`}
        >
          Reconciliation
        </button>
      </div>

      {activeTab === "ledger" && (
        <>
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <Button onClick={openAddModal} size="sm" className="gap-1.5">
              <Plus className="w-4 h-4" /> Log Payout
            </Button>
            <Button onClick={exportCSV} variant="outline" size="sm" className="gap-1.5" disabled={payouts.length === 0}>
              <Download className="w-4 h-4" /> Export CSV
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
          ) : payouts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground gap-2">
              <ArrowDownToLine className="w-10 h-10 opacity-30" />
              <p className="text-sm">No payouts recorded yet.</p>
              <Button onClick={openAddModal} size="sm" className="mt-2 gap-1.5">
                <Plus className="w-4 h-4" /> Log First Payout
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Date</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Recipient</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Amount</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">Method</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">Source</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">Reference</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden lg:table-cell">Notes</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {payouts.map((p) => (
                    <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                        {p.payoutDate ? format(parseISO(p.payoutDate), "d MMM yyyy") : "—"}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">{p.recipientName}</td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-700 whitespace-nowrap">
                        {formatCurrency(p.amount)}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell text-gray-600">
                        {METHOD_LABELS[p.method] ?? p.method}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_COLORS[p.source] ?? "bg-gray-100 text-gray-700"}`}>
                          {SOURCE_LABELS[p.source] ?? p.source}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                        {p.reference ?? "—"}
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs max-w-[180px] truncate">
                        {p.notes ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(p)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(p.id, p.recipientName)}
                            className="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                    <td className="px-4 py-3 font-semibold text-gray-700" colSpan={2}>
                      Total ({payouts.length} payout{payouts.length !== 1 ? "s" : ""})
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-700">
                      {formatCurrency(totalPaidOut)}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </>
      )}

      {activeTab === "reconciliation" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">
              Fundraising received per player vs. amounts paid out.
            </p>
            <Button
              onClick={() => { setReconciliation(null); fetchReconciliation() }}
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={recoLoading}
            >
              <RefreshCw className={`w-4 h-4 ${recoLoading ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>

          {/* LEGO Jar summary card */}
          {reconciliation && (
            <div className="mb-5 flex items-center gap-3 bg-purple-50 border border-purple-200 rounded-xl px-5 py-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 flex items-center justify-center">
                <Package className="w-5 h-5 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">LEGO Jar Total Collected</p>
                <p className="text-xl font-bold text-purple-900">{formatCurrency(reconciliation.legoJarTotal)}</p>
              </div>
            </div>
          )}

          {recoLoading ? (
            <div className="flex items-center justify-center py-20 text-muted-foreground">Loading…</div>
          ) : !reconciliation ? null : reconciliation.players.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
              <TrendingUp className="w-10 h-10 opacity-30" />
              <p className="text-sm">No fundraising or payout data yet.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left font-semibold text-gray-600">Player</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Fundraising In</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600 hidden md:table-cell">LEGO Jar</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Paid Out</th>
                    <th className="px-4 py-3 text-right font-semibold text-gray-600">Balance</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-600 hidden sm:table-cell">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {reconciliation.players.map((row) => {
                    const isNegative = row.balance < -0.005
                    const isZero = Math.abs(row.balance) < 0.005
                    const balanceClass = isNegative
                      ? "text-red-600 font-bold"
                      : isZero
                        ? "text-emerald-600 font-semibold"
                        : "text-amber-600 font-semibold"
                    const statusLabel = isNegative
                      ? "Overpaid"
                      : isZero
                        ? "Settled"
                        : "Outstanding"
                    const statusClass = isNegative
                      ? "bg-red-100 text-red-700"
                      : isZero
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-amber-100 text-amber-700"
                    return (
                      <tr key={row.playerId} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-gray-900">{row.playerName}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.fundraisingReceived)}</td>
                        <td className="px-4 py-3 text-right hidden md:table-cell">
                          {row.legoJarAllocated > 0
                            ? <span className="text-purple-700 font-medium">{formatCurrency(row.legoJarAllocated)}</span>
                            : <span className="text-gray-400">—</span>
                          }
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{formatCurrency(row.totalPaidOut)}</td>
                        <td className={`px-4 py-3 text-right ${balanceClass}`}>
                          {formatCurrency(row.balance)}
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${statusClass}`}>
                            {statusLabel}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPayout ? "Edit Payout" : "Log Payout"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Player selector */}
          <div>
            <label className="block text-sm font-medium mb-1">Player (optional)</label>
            <select
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              value={watchedPlayerId ?? ""}
              onChange={onPlayerChange}
            >
              <option value="">— Free text / unlinked —</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground mt-1">Linking to a player helps reconciliation. Leave blank for non-squad payouts.</p>
          </div>

          {/* Recipient name */}
          <div>
            <label className="block text-sm font-medium mb-1">Recipient Name *</label>
            <Input {...register("recipientName")} placeholder="e.g. John Smith" />
            {errors.recipientName && <p className="text-xs text-red-600 mt-1">{errors.recipientName.message}</p>}
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Amount (HKD) *</label>
              <Input {...register("amount")} type="number" step="0.01" min="0.01" placeholder="0.00" />
              {errors.amount && <p className="text-xs text-red-600 mt-1">{errors.amount.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date *</label>
              <Input {...register("payoutDate")} type="date" />
              {errors.payoutDate && <p className="text-xs text-red-600 mt-1">{errors.payoutDate.message}</p>}
            </div>
          </div>

          {/* Method + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Payment Method *</label>
              <select
                {...register("method")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="fps">FPS</option>
                <option value="payme">PayMe</option>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Source *</label>
              <select
                {...register("source")}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="fundraising">Fundraising</option>
                <option value="lego_jar">LEGO Jar</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>

          {/* Reference */}
          <div>
            <label className="block text-sm font-medium mb-1">Reference (optional)</label>
            <Input {...register("reference")} placeholder="Transaction ref, receipt number, etc." />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium mb-1">Notes (optional)</label>
            <textarea
              {...register("notes")}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              placeholder="Any additional notes…"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving…" : editingPayout ? "Save Changes" : "Log Payout"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Dialog */}
      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
      >
        <p className="text-sm text-gray-700 mb-5">{confirmDialog.message}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={confirmDialog.onConfirm}>
            Delete
          </Button>
        </div>
      </Modal>
    </PageLayout>
  )
}
