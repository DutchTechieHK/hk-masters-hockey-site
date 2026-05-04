import { useState, useMemo } from "react"
import {
  useListPlayers,
  useUpdatePlayer,
  type CreatePlayer,
  useListTeams,
  getListPlayersQueryKey,
  useSendFeeReminders,
  useListPlayerPayments,
  useCreatePlayerPayment,
  deletePlayerPayment,
  getListPlayerPaymentsQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Download,
  AlertTriangle,
  Edit2,
  Mail,
  Search,
  CheckCircle2,
  Clock,
  HandCoins,
  Wallet,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Player } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const feeSchema = z.object({
  paymentAmountDue: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  notes: z.string().optional(),
})

type FeeFormValues = z.infer<typeof feeSchema>

function formatReminderDate(dt?: string | null) {
  if (!dt) return null
  const d = new Date(dt)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatPaymentDate(s?: string | null) {
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return s
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function todayStr() {
  return new Date().toISOString().split("T")[0]
}

function isMissingFeeDetails(p: Player): boolean {
  // amount due not set OR (marked paid but missing amount paid / payment date)
  const dueMissing = p.paymentAmountDue == null
  if (dueMissing) return true
  if (p.feePaid) {
    if (p.paymentAmountPaid == null || !p.paymentDate) return true
  }
  return false
}

function exportToCSV(players: Player[], teams: { id: number; name: string; category: string }[]) {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
  const headers = [
    "Team",
    "Category",
    "Name",
    "Email",
    "Amount Due (HKD)",
    "Amount Paid (HKD)",
    "Payment Date",
    "Status",
    "Reminded On",
  ]
  const rows = players.map(p => {
    const team = teamMap[p.teamId]
    return [
      team ? team.name : `Team ${p.teamId}`,
      team ? team.category : "",
      p.name,
      p.email,
      p.paymentAmountDue ?? "",
      p.paymentAmountPaid ?? "",
      p.paymentDate ?? "",
      p.feePaid ? "Paid" : "Unpaid",
      p.feeReminderSentAt ? new Date(p.feeReminderSentAt).toISOString().split("T")[0] : "",
    ]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "player-fees.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function Fees() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [showOnlyUnpaid, setShowOnlyUnpaid] = useState(false)

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

  const [markAsPaidDialog, setMarkAsPaidDialog] = useState<{
    isOpen: boolean
    player: Player | null
    paymentDate: string
    amount: string
    method: string
    notes: string
  }>({ isOpen: false, player: null, paymentDate: "", amount: "", method: "", notes: "" })

  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers()

  const updateMutation = useUpdatePlayer()
  const sendRemindersMutation = useSendFeeReminders()
  const createPaymentMutation = useCreatePlayerPayment()

  const { data: editingPayments = [], isLoading: isLoadingPayments } = useListPlayerPayments(
    editingPlayer?.id ?? 0,
    { query: { enabled: !!editingPlayer } }
  )

  const editingPaymentsTotal = editingPayments.reduce((s, p) => s + (p.amount ?? 0), 0)
  const editingDue = editingPlayer?.paymentAmountDue ?? null
  const editingBalance = editingDue == null ? null : Math.max(0, editingDue - editingPaymentsTotal)

  const invalidatePlayerData = (playerId: number) => {
    queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
    queryClient.invalidateQueries({ queryKey: getListPlayerPaymentsQueryKey(playerId) })
  }

  const handleDeletePayment = async (playerId: number, paymentId: number) => {
    try {
      await deletePlayerPayment(playerId, paymentId)
      invalidatePlayerData(playerId)
      toast({ title: "Payment removed" })
    } catch {
      toast({ title: "Failed to remove payment", variant: "destructive" })
    }
  }

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FeeFormValues>({
    resolver: zodResolver(feeSchema),
  })

  const openEditModal = (player: Player) => {
    setEditingPlayer(player)
    reset({
      paymentAmountDue: player.paymentAmountDue ?? "",
      notes: player.notes || "",
    })
    setIsModalOpen(true)
  }

  const closeEditModal = () => {
    setIsModalOpen(false)
    setEditingPlayer(null)
  }

  const onSubmit = async (data: FeeFormValues) => {
    if (!editingPlayer) return
    try {
      const payload: CreatePlayer = {
        teamId: editingPlayer.teamId,
        name: editingPlayer.name,
        email: editingPlayer.email,
        feePaid: editingPlayer.feePaid,
        paymentAmountDue: data.paymentAmountDue === "" ? undefined : Number(data.paymentAmountDue),
        notes: data.notes || editingPlayer.notes || undefined,
      }
      await updateMutation.mutateAsync({ id: editingPlayer.id, data: payload })
      toast({ title: "Fee details updated" })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      closeEditModal()
    } catch {
      toast({ title: "Failed to update fee details", variant: "destructive" })
    }
  }

  const openMarkAsPaidDialog = (player: Player) => {
    const due = player.paymentAmountDue ?? 0
    const alreadyPaid = player.paymentAmountPaid ?? 0
    const remaining = Math.max(0, due - alreadyPaid)
    setMarkAsPaidDialog({
      isOpen: true,
      player,
      paymentDate: todayStr(),
      amount: remaining > 0 ? String(remaining) : "",
      method: "",
      notes: "",
    })
  }

  const closeMarkAsPaidDialog = () =>
    setMarkAsPaidDialog(prev => ({ ...prev, isOpen: false }))

  const confirmMarkAsPaid = async () => {
    const { player, paymentDate, amount, method, notes } = markAsPaidDialog
    if (!player) return
    const parsed = parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    if (!paymentDate) {
      toast({ title: "Pick a payment date", variant: "destructive" })
      return
    }
    closeMarkAsPaidDialog()
    try {
      await createPaymentMutation.mutateAsync({
        id: player.id,
        data: {
          amount: parsed,
          paymentDate,
          method: method || undefined,
          notes: notes || undefined,
        },
      })
      invalidatePlayerData(player.id)
      toast({ title: "Payment recorded", description: `Recorded ${formatCurrency(parsed)} from ${player.name}` })
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" })
    }
  }

  const handleSendReminders = async () => {
    const unpaid = visiblePlayers.filter(p => !p.feePaid)
    if (unpaid.length === 0) return
    try {
      const result = await sendRemindersMutation.mutateAsync({ data: { playerIds: unpaid.map(p => p.id) } })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      if (result.failed === 0) {
        toast({ title: `${result.sent} reminder${result.sent !== 1 ? "s" : ""} sent`, description: `Successfully emailed ${result.sent} unpaid player${result.sent !== 1 ? "s" : ""}.` })
      } else {
        toast({
          title: `${result.sent} sent, ${result.failed} failed`,
          description: `${result.sent} reminder${result.sent !== 1 ? "s" : ""} delivered. ${result.failed} could not be sent.`,
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Failed to send reminders", variant: "destructive" })
    }
  }

  const uniqueCategories = Array.from(new Set(teams.map(t => t.category)))
  const teamCategoryMap = Object.fromEntries(teams.map(t => [t.id, t.category]))

  const visiblePlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let filtered = categoryFilter === "all"
      ? players
      : players.filter(p => teamCategoryMap[p.teamId] === categoryFilter)
    if (q) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q))
    }
    if (showOnlyUnpaid) {
      filtered = filtered.filter(p => !p.feePaid)
    }
    return filtered
  }, [players, categoryFilter, searchQuery, showOnlyUnpaid, teamCategoryMap])

  const teamGroups = useMemo(
    () =>
      teams
        .filter(t => categoryFilter === "all" || t.category === categoryFilter)
        .map(team => ({
          team,
          players: visiblePlayers.filter(p => p.teamId === team.id),
        }))
        .filter(g => g.players.length > 0),
    [teams, categoryFilter, visiblePlayers]
  )

  // Per-team totals computed from the FULL player list (not search-filtered) so summary stays stable
  const teamTotals = useMemo(() => {
    const map = new Map<number, { paid: number; total: number; collected: number; due: number }>()
    for (const team of teams) {
      const teamPlayers = players.filter(p => p.teamId === team.id)
      map.set(team.id, {
        total: teamPlayers.length,
        paid: teamPlayers.filter(p => p.feePaid).length,
        collected: teamPlayers.reduce((sum, p) => sum + (p.paymentAmountPaid ?? 0), 0),
        due: teamPlayers.reduce((sum, p) => sum + (p.paymentAmountDue ?? 0), 0),
      })
    }
    return map
  }, [teams, players])

  const overallTotals = useMemo(() => {
    const scoped = categoryFilter === "all"
      ? players
      : players.filter(p => teamCategoryMap[p.teamId] === categoryFilter)
    return {
      total: scoped.length,
      paid: scoped.filter(p => p.feePaid).length,
      collected: scoped.reduce((sum, p) => sum + (p.paymentAmountPaid ?? 0), 0),
      due: scoped.reduce((sum, p) => sum + (p.paymentAmountDue ?? 0), 0),
    }
  }, [players, categoryFilter, teamCategoryMap])

  const unpaidCount = visiblePlayers.filter(p => !p.feePaid).length

  return (
    <PageLayout
      title="Fees"
      description="Track tournament fees: who has paid, who still owes, and chase the rest."
      action={
        <Button
          variant="outline"
          onClick={() => exportToCSV(visiblePlayers, teams)}
          disabled={visiblePlayers.length === 0}
        >
          <Download className="w-4 h-4 mr-2" /> Export CSV
        </Button>
      }
    >
      {/* Top summary banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-2xl p-7 text-white relative overflow-hidden shadow-lg shadow-emerald-900/20">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <HandCoins className="w-56 h-56" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100 font-medium mb-1 uppercase tracking-wider text-sm">Total Collected</p>
            <p className="text-4xl font-display font-bold">{formatCurrency(overallTotals.collected)}</p>
            <p className="text-emerald-100/80 text-sm mt-2">
              of {formatCurrency(overallTotals.due)} expected ·{" "}
              {overallTotals.due > 0
                ? Math.round((overallTotals.collected / overallTotals.due) * 100)
                : 0}
              % collected
            </p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-7 border border-border shadow-sm flex flex-col justify-center">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center text-muted-foreground"><Wallet className="w-5 h-5 mr-2"/> Players Paid</div>
          </div>
          <p className="text-3xl font-display font-bold text-foreground">
            {overallTotals.paid} <span className="text-muted-foreground text-xl font-medium">of {overallTotals.total}</span>
          </p>
          <div className="w-full bg-muted h-2 rounded-full mt-4 overflow-hidden">
            <div
              className="bg-emerald-500 h-full rounded-full transition-all duration-1000"
              style={{ width: `${overallTotals.total > 0 ? (overallTotals.paid / overallTotals.total) * 100 : 0}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-2 text-right">
            {overallTotals.total - overallTotals.paid} still outstanding
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4 items-start sm:items-center">
        <Select
          className="sm:w-56 bg-white"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Teams</option>
          {uniqueCategories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </Select>

        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 bg-white"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-foreground bg-white border border-border rounded-md px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors">
          <input
            type="checkbox"
            checked={showOnlyUnpaid}
            onChange={e => setShowOnlyUnpaid(e.target.checked)}
            className="accent-primary"
          />
          Only show unpaid
        </label>

        {!isLoading && unpaidCount > 0 && (
          <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{unpaidCount} player{unpaidCount !== 1 ? "s" : ""} still to pay</span>
            <Button
              size="sm"
              variant="outline"
              className="ml-1 h-7 px-2.5 text-xs border-amber-300 text-amber-800 hover:bg-amber-100 hover:border-amber-400 bg-white"
              onClick={handleSendReminders}
              disabled={sendRemindersMutation.isPending}
            >
              <Mail className="w-3.5 h-3.5 mr-1.5" />
              {sendRemindersMutation.isPending ? "Sending…" : "Send Reminders"}
            </Button>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center text-muted-foreground">
          Loading fee details...
        </div>
      ) : visiblePlayers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
          No players match these filters.
        </div>
      ) : (
        <div className="space-y-6">
          {teamGroups.map(({ team, players: groupPlayers }) => {
            const totals = teamTotals.get(team.id) ?? { paid: 0, total: 0, collected: 0, due: 0 }
            return (
              <div key={team.id} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                {/* Team heading + per-team summary */}
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-foreground text-base">{team.name}</h3>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      <span className="font-medium text-foreground">{totals.paid}</span> of{" "}
                      <span className="font-medium text-foreground">{totals.total}</span> paid
                      <span className="text-muted-foreground/50 mx-1.5">·</span>
                      <span className="font-medium text-emerald-700">{formatCurrency(totals.collected)}</span> of{" "}
                      <span className="font-medium text-foreground">{formatCurrency(totals.due)}</span> collected
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs self-start sm:self-auto">
                    {team.category}
                  </Badge>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold text-right">Due</th>
                        <th className="px-4 py-3 font-semibold text-right">Paid</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">Date</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Reminded</span>
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {groupPlayers.map(player => {
                        const missing = isMissingFeeDetails(player)
                        const rowBg = !player.feePaid
                          ? "bg-amber-50/60 hover:bg-amber-50"
                          : "hover:bg-muted/10"
                        return (
                          <tr
                            key={player.id}
                            className={`transition-colors group cursor-pointer ${rowBg}`}
                            onClick={() => openEditModal(player)}
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{player.name}</span>
                                {missing && (
                                  <span title="Missing fee details">
                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-muted-foreground">{player.email}</div>
                            </td>

                            <td className="px-4 py-3 text-right tabular-nums">
                              {player.paymentAmountDue != null ? (
                                <span className="text-foreground font-medium">{formatCurrency(player.paymentAmountDue)}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">Not set</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right tabular-nums">
                              {player.paymentAmountPaid != null && player.paymentAmountPaid > 0 ? (
                                <span className="text-emerald-700 font-bold">{formatCurrency(player.paymentAmountPaid)}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3 hidden md:table-cell">
                              {player.paymentDate ? (
                                <span className="text-foreground tabular-nums">{formatPaymentDate(player.paymentDate)}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {player.feePaid ? (
                                <Badge className="bg-emerald-100 text-emerald-800 border-0 shadow-none capitalize">Paid</Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-800 border-0 shadow-none capitalize">Unpaid</Badge>
                              )}
                            </td>

                            <td className="px-4 py-3 hidden lg:table-cell">
                              {player.feeReminderSentAt ? (
                                <Badge variant="secondary" className="gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 whitespace-nowrap">
                                  <Clock className="w-3 h-3" />
                                  {formatReminderDate(player.feeReminderSentAt)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <div className="flex justify-end items-center gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                                {!player.feePaid && (
                                  <button
                                    onClick={() => openMarkAsPaidDialog(player)}
                                    title="Mark as paid"
                                    className="p-2 text-muted-foreground hover:text-emerald-600 rounded bg-background hover:bg-emerald-50 border shadow-sm transition-all"
                                  >
                                    <CheckCircle2 className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => openEditModal(player)}
                                  title="Edit fee details"
                                  className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background hover:bg-blue-50 border shadow-sm transition-all"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Mark as paid / record payment dialog */}
      <Modal isOpen={markAsPaidDialog.isOpen} onClose={closeMarkAsPaidDialog} title="Record payment">
        <div className="space-y-5">
          {markAsPaidDialog.player && (
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                Recording payment for <strong className="text-foreground">{markAsPaidDialog.player.name}</strong>.
              </p>
              {markAsPaidDialog.player.paymentAmountDue != null && (
                <p className="text-xs">
                  {formatCurrency(markAsPaidDialog.player.paymentAmountPaid ?? 0)} paid of{" "}
                  {formatCurrency(markAsPaidDialog.player.paymentAmountDue)} due
                  {(markAsPaidDialog.player.paymentAmountDue - (markAsPaidDialog.player.paymentAmountPaid ?? 0)) > 0 && (
                    <> · <strong className="text-amber-700">{formatCurrency(Math.max(0, markAsPaidDialog.player.paymentAmountDue - (markAsPaidDialog.player.paymentAmountPaid ?? 0)))} outstanding</strong></>
                  )}
                </p>
              )}
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Amount Received (HKD)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={markAsPaidDialog.amount}
              onChange={e => setMarkAsPaidDialog(prev => ({ ...prev, amount: e.target.value }))}
              placeholder="0.00"
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Payment Date</label>
            <Input
              type="date"
              value={markAsPaidDialog.paymentDate}
              max={todayStr()}
              onChange={e => setMarkAsPaidDialog(prev => ({ ...prev, paymentDate: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Defaults to today.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Method (optional)</label>
              <Input
                value={markAsPaidDialog.method}
                onChange={e => setMarkAsPaidDialog(prev => ({ ...prev, method: e.target.value }))}
                placeholder="Bank transfer, Cash…"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Notes (optional)</label>
              <Input
                value={markAsPaidDialog.notes}
                onChange={e => setMarkAsPaidDialog(prev => ({ ...prev, notes: e.target.value }))}
                placeholder="Reference, instalment #2…"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={closeMarkAsPaidDialog}>Cancel</Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmMarkAsPaid}
              disabled={!markAsPaidDialog.paymentDate || !markAsPaidDialog.amount || createPaymentMutation.isPending}
            >
              {createPaymentMutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit fee modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={closeEditModal}
        title={editingPlayer ? `Fees: ${editingPlayer.name}` : "Edit Fees"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Amount Due (HKD)</label>
            <Input type="number" min="0" step="0.01" {...register("paymentAmountDue")} placeholder="0.00" />
            {errors.paymentAmountDue && <p className="text-xs text-destructive">{String(errors.paymentAmountDue.message)}</p>}
          </div>

          {/* Payment summary */}
          <div className="rounded-lg border border-border bg-muted/20 p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Total received</span>
              <span className="font-semibold text-emerald-700 tabular-nums">{formatCurrency(editingPaymentsTotal)}</span>
            </div>
            {editingDue != null && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Outstanding balance</span>
                <span className={`font-semibold tabular-nums ${editingBalance && editingBalance > 0 ? "text-amber-700" : "text-emerald-700"}`}>
                  {formatCurrency(editingBalance ?? 0)}
                </span>
              </div>
            )}
          </div>

          {/* Payment history */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Payment history</label>
              {editingPlayer && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    closeEditModal()
                    openMarkAsPaidDialog(editingPlayer)
                  }}
                >
                  + Add payment
                </Button>
              )}
            </div>
            {isLoadingPayments ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : editingPayments.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No payments recorded yet.</p>
            ) : (
              <div className="rounded-lg border border-border divide-y divide-border max-h-64 overflow-y-auto">
                {editingPayments.map(p => (
                  <div key={p.id} className="px-3 py-2 flex items-center justify-between gap-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-semibold tabular-nums text-emerald-700">{formatCurrency(p.amount)}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{formatPaymentDate(p.paymentDate)}</span>
                      </div>
                      {(p.method || p.notes) && (
                        <div className="text-xs text-muted-foreground truncate">
                          {[p.method, p.notes].filter(Boolean).join(" · ")}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => editingPlayer && handleDeletePayment(editingPlayer.id, p.id)}
                      className="text-xs text-muted-foreground hover:text-destructive px-2 py-1 rounded hover:bg-destructive/10 transition-colors"
                      title="Delete this payment"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes</label>
            <Input {...register("notes")} placeholder="Bank transfer reference, instalment plan, etc." />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={closeEditModal}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
