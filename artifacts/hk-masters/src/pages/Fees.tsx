import { useState, useMemo } from "react"
import {
  useListPlayers,
  useUpdatePlayer,
  useListTeams,
  getListPlayersQueryKey,
  useSendFeeReminders,
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
  feePaid: z.boolean(),
  paymentAmountDue: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentAmountPaid: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentDate: z.string().optional(),
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
  }>({ isOpen: false, player: null, paymentDate: "", amount: "" })

  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers()

  const updateMutation = useUpdatePlayer()
  const sendRemindersMutation = useSendFeeReminders()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FeeFormValues>({
    resolver: zodResolver(feeSchema),
  })

  const openEditModal = (player: Player) => {
    setEditingPlayer(player)
    reset({
      feePaid: player.feePaid,
      paymentAmountDue: player.paymentAmountDue ?? "",
      paymentAmountPaid: player.paymentAmountPaid ?? "",
      paymentDate: player.paymentDate || "",
      notes: player.notes || "",
    })
    setIsModalOpen(true)
  }

  const onSubmit = async (data: FeeFormValues) => {
    if (!editingPlayer) return
    try {
      const payload = {
        teamId: editingPlayer.teamId,
        name: editingPlayer.name,
        email: editingPlayer.email,
        feePaid: data.feePaid,
        paymentAmountDue: data.paymentAmountDue === "" ? undefined : Number(data.paymentAmountDue),
        paymentAmountPaid: data.paymentAmountPaid === "" ? undefined : Number(data.paymentAmountPaid),
        paymentDate: data.paymentDate || undefined,
        notes: data.notes || editingPlayer.notes || undefined,
      }
      await updateMutation.mutateAsync({ id: editingPlayer.id, data: payload as any })
      toast({ title: "Fee details updated" })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "Failed to update fee details", variant: "destructive" })
    }
  }

  const openMarkAsPaidDialog = (player: Player) => {
    setMarkAsPaidDialog({
      isOpen: true,
      player,
      paymentDate: todayStr(),
      amount: String(player.paymentAmountPaid ?? player.paymentAmountDue ?? ""),
    })
  }

  const closeMarkAsPaidDialog = () =>
    setMarkAsPaidDialog(prev => ({ ...prev, isOpen: false }))

  const confirmMarkAsPaid = async () => {
    const { player, paymentDate, amount } = markAsPaidDialog
    if (!player) return
    const parsed = parseFloat(amount)
    if (!Number.isFinite(parsed) || parsed < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" })
      return
    }
    closeMarkAsPaidDialog()
    try {
      const payload = {
        teamId: player.teamId,
        name: player.name,
        email: player.email,
        feePaid: true,
        paymentAmountDue: player.paymentAmountDue ?? parsed,
        paymentAmountPaid: parsed,
        paymentDate,
        notes: player.notes || undefined,
      }
      await updateMutation.mutateAsync({ id: player.id, data: payload as any })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      toast({ title: "Marked as paid", description: `Recorded ${formatCurrency(parsed)} from ${player.name}` })
    } catch {
      toast({ title: "Failed to mark as paid", variant: "destructive" })
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
                              <div className="flex justify-end items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
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

      {/* Mark as paid dialog */}
      <Modal isOpen={markAsPaidDialog.isOpen} onClose={closeMarkAsPaidDialog} title="Mark fee as paid">
        <div className="space-y-5">
          {markAsPaidDialog.player && (
            <p className="text-sm text-muted-foreground">
              Recording payment for <strong className="text-foreground">{markAsPaidDialog.player.name}</strong>.
            </p>
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
            {markAsPaidDialog.player?.paymentAmountDue != null && (
              <p className="text-xs text-muted-foreground">
                Amount due on file: {formatCurrency(markAsPaidDialog.player.paymentAmountDue)}
              </p>
            )}
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
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={closeMarkAsPaidDialog}>Cancel</Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmMarkAsPaid}
              disabled={!markAsPaidDialog.paymentDate || !markAsPaidDialog.amount}
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </Modal>

      {/* Edit fee modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlayer ? `Fees: ${editingPlayer.name}` : "Edit Fees"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Amount Due (HKD)</label>
              <Input type="number" min="0" step="0.01" {...register("paymentAmountDue")} placeholder="0.00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Amount Paid (HKD)</label>
              <Input type="number" min="0" step="0.01" {...register("paymentAmountPaid")} placeholder="0.00" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Payment Date</label>
            <Input type="date" max={todayStr()} {...register("paymentDate")} />
            {errors.paymentDate && <p className="text-xs text-destructive">{errors.paymentDate.message}</p>}
          </div>

          <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
            <input type="checkbox" {...register("feePaid")} className="accent-primary w-4 h-4" />
            Mark fee as paid
          </label>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes</label>
            <Input {...register("notes")} placeholder="Bank transfer reference, instalment plan, etc." />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
