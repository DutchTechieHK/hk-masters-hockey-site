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
  Search,
  Mail,
  Wallet,
  Check,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Player } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"

const feeSchema = z.object({
  feePaid: z.boolean(),
  paymentAmountDue: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentAmountPaid: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentDate: z.string().optional(),
})

type FeeFormValues = z.infer<typeof feeSchema>

const markPaidSchema = z.object({
  paymentAmountPaid: z.coerce.number().min(0, "Amount is required"),
  paymentDate: z.string().min(1, "Date is required"),
})

type MarkPaidFormValues = z.infer<typeof markPaidSchema>

function formatCurrency(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—"
  return `HK$${n.toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

function formatDate(d?: string | null) {
  if (!d) return null
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function formatReminderDate(dt?: string | null) {
  if (!dt) return null
  const d = new Date(dt)
  if (isNaN(d.getTime())) return null
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function todayISO(): string {
  const d = new Date()
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${yyyy}-${mm}-${dd}`
}

function exportToCSV(players: Player[], teams: { id: number; name: string; category: string }[]) {
  const teamMap = Object.fromEntries(teams.map((t) => [t.id, t]))
  const headers = [
    "Team",
    "Category",
    "Name",
    "Shirt #",
    "Email",
    "Amount Due (HK$)",
    "Amount Paid (HK$)",
    "Outstanding (HK$)",
    "Status",
    "Payment Date",
    "Last Reminder Sent",
  ]
  const rows = players.map((p) => {
    const team = teamMap[p.teamId]
    const due = p.paymentAmountDue ?? 0
    const paid = p.paymentAmountPaid ?? 0
    const outstanding = Math.max(due - paid, 0)
    return [
      team ? team.name : `Team ${p.teamId}`,
      team ? team.category : "",
      p.name,
      p.shirtNumber ?? "",
      p.email,
      due || "",
      paid || "",
      outstanding || "",
      p.feePaid ? "Paid" : "Unpaid",
      p.paymentDate ?? "",
      p.feeReminderSentAt ?? "",
    ]
  })
  const csv = [headers, ...rows]
    .map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "fees.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function Fees() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [unpaidOnly, setUnpaidOnly] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)
  const [markingPaidPlayer, setMarkingPaidPlayer] = useState<Player | null>(null)

  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers()

  const updateMutation = useUpdatePlayer()
  const sendRemindersMutation = useSendFeeReminders()

  const editForm = useForm<FeeFormValues>({ resolver: zodResolver(feeSchema) })
  const markPaidForm = useForm<MarkPaidFormValues>({ resolver: zodResolver(markPaidSchema) })

  const openEditModal = (player: Player) => {
    setEditingPlayer(player)
    editForm.reset({
      feePaid: player.feePaid,
      paymentAmountDue: player.paymentAmountDue ?? "",
      paymentAmountPaid: player.paymentAmountPaid ?? "",
      paymentDate: player.paymentDate ?? "",
    })
  }

  const openMarkPaidModal = (player: Player, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setMarkingPaidPlayer(player)
    const due = player.paymentAmountDue ?? 0
    const paid = player.paymentAmountPaid ?? 0
    const suggested = paid > 0 ? paid : due
    markPaidForm.reset({
      paymentAmountPaid: suggested,
      paymentDate: player.paymentDate || todayISO(),
    })
  }

  const buildUpdatePayload = (player: Player, overrides: Partial<Player>) => {
    return {
      teamId: player.teamId,
      name: player.name,
      email: player.email,
      shirtNumber: player.shirtNumber ?? undefined,
      feePaid: overrides.feePaid ?? player.feePaid,
      paymentAmountDue:
        overrides.paymentAmountDue !== undefined
          ? overrides.paymentAmountDue ?? undefined
          : player.paymentAmountDue ?? undefined,
      paymentAmountPaid:
        overrides.paymentAmountPaid !== undefined
          ? overrides.paymentAmountPaid ?? undefined
          : player.paymentAmountPaid ?? undefined,
      paymentDate:
        overrides.paymentDate !== undefined
          ? overrides.paymentDate ?? undefined
          : player.paymentDate ?? undefined,
      phone: player.phone ?? undefined,
      position: player.position ?? undefined,
      dateOfBirth: player.dateOfBirth ?? undefined,
      nationality: player.nationality ?? undefined,
      passportNumber: player.passportNumber ?? undefined,
      passportExpiry: player.passportExpiry ?? undefined,
      emergencyContactName: player.emergencyContactName ?? undefined,
      emergencyContactPhone: player.emergencyContactPhone ?? undefined,
      flightArrivalDateTime: player.flightArrivalDateTime ?? undefined,
      flightDepartureDateTime: player.flightDepartureDateTime ?? undefined,
      arrivalCity: player.arrivalCity ?? undefined,
      roomSharingPreference: player.roomSharingPreference ?? undefined,
      roomSharingWith: player.roomSharingWith ?? undefined,
      shirtSize: player.shirtSize ?? undefined,
      shortsSize: player.shortsSize ?? undefined,
      jacketSize: player.jacketSize ?? undefined,
      travelDates: player.travelDates ?? undefined,
      dietaryRequirements: player.dietaryRequirements ?? undefined,
      medicalNotes: player.medicalNotes ?? undefined,
      notes: player.notes ?? undefined,
    }
  }

  // Re-fetch the latest player record before sending a PUT so we don't accidentally
  // clobber unrelated fields (passport, travel, notes…) that another admin may have
  // updated after this page loaded. Returns the freshest copy of the given player.
  const fetchFreshPlayer = async (player: Player): Promise<Player> => {
    try {
      await queryClient.refetchQueries({ queryKey: getListPlayersQueryKey() })
      const freshList = queryClient.getQueryData<Player[]>(getListPlayersQueryKey()) ?? players
      return freshList.find((p) => p.id === player.id) ?? player
    } catch {
      return player
    }
  }

  const onSubmitEdit = async (data: FeeFormValues) => {
    if (!editingPlayer) return
    try {
      const fresh = await fetchFreshPlayer(editingPlayer)
      const payload = buildUpdatePayload(fresh, {
        feePaid: data.feePaid,
        paymentAmountDue: data.paymentAmountDue === "" ? undefined : data.paymentAmountDue,
        paymentAmountPaid: data.paymentAmountPaid === "" ? undefined : data.paymentAmountPaid,
        paymentDate: data.paymentDate || undefined,
      })
      await updateMutation.mutateAsync({ id: editingPlayer.id, data: payload as any })
      toast({ title: "Fee details updated" })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      setEditingPlayer(null)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const onSubmitMarkPaid = async (data: MarkPaidFormValues) => {
    if (!markingPaidPlayer) return
    const due = markingPaidPlayer.paymentAmountDue ?? 0
    const isFullyPaid = due === 0 || data.paymentAmountPaid >= due
    if (!isFullyPaid) {
      const confirmed = window.confirm(
        `${formatCurrency(data.paymentAmountPaid)} is less than the amount due (${formatCurrency(due)}).\n\nRecord as a partial payment? The player will remain marked as Unpaid until the full amount is received.`,
      )
      if (!confirmed) return
    }
    try {
      const fresh = await fetchFreshPlayer(markingPaidPlayer)
      const payload = buildUpdatePayload(fresh, {
        feePaid: isFullyPaid,
        paymentAmountPaid: data.paymentAmountPaid,
        paymentDate: data.paymentDate,
      })
      await updateMutation.mutateAsync({ id: markingPaidPlayer.id, data: payload as any })
      toast({
        title: isFullyPaid ? "Marked as paid" : "Partial payment recorded",
        description: `${markingPaidPlayer.name} – ${formatCurrency(data.paymentAmountPaid)}`,
      })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      setMarkingPaidPlayer(null)
    } catch {
      toast({ title: "Failed to record payment", variant: "destructive" })
    }
  }

  const handleSendReminders = async () => {
    const unpaidVisible = visiblePlayers.filter((p) => !p.feePaid)
    if (unpaidVisible.length === 0) return
    if (
      !window.confirm(
        `Send fee reminder to ${unpaidVisible.length} unpaid player${unpaidVisible.length !== 1 ? "s" : ""}?`,
      )
    )
      return
    try {
      const result = await sendRemindersMutation.mutateAsync({
        data: { playerIds: unpaidVisible.map((p) => p.id) },
      })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      if (result.failed === 0) {
        toast({
          title: `${result.sent} reminder${result.sent !== 1 ? "s" : ""} sent`,
          description: `Successfully emailed ${result.sent} unpaid player${result.sent !== 1 ? "s" : ""}.`,
        })
      } else {
        toast({
          title: `${result.sent} sent, ${result.failed} failed`,
          description: `${result.sent} delivered. ${result.failed} could not be sent.`,
          variant: "destructive",
        })
      }
    } catch {
      toast({ title: "Failed to send reminders", variant: "destructive" })
    }
  }

  const uniqueCategories = Array.from(new Set(teams.map((t) => t.category)))
  const teamCategoryMap = Object.fromEntries(teams.map((t) => [t.id, t.category]))

  const visiblePlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let filtered =
      categoryFilter === "all"
        ? players
        : players.filter((p) => teamCategoryMap[p.teamId] === categoryFilter)
    if (q) filtered = filtered.filter((p) => p.name.toLowerCase().includes(q))
    if (unpaidOnly) filtered = filtered.filter((p) => !p.feePaid)
    return filtered
  }, [players, categoryFilter, searchQuery, unpaidOnly, teamCategoryMap])

  const teamGroups = useMemo(
    () =>
      teams
        .filter((t) => categoryFilter === "all" || t.category === categoryFilter)
        .map((team) => {
          const groupPlayers = visiblePlayers.filter((p) => p.teamId === team.id)
          const due = groupPlayers.reduce((sum, p) => sum + (p.paymentAmountDue ?? 0), 0)
          const paid = groupPlayers.reduce((sum, p) => sum + (p.paymentAmountPaid ?? 0), 0)
          const paidCount = groupPlayers.filter((p) => p.feePaid).length
          return { team, players: groupPlayers, due, paid, paidCount }
        })
        .filter((g) => g.players.length > 0),
    [teams, categoryFilter, visiblePlayers],
  )

  // Overall summary across full player list (not filtered) so the headline stays stable
  const overall = useMemo(() => {
    const due = players.reduce((s, p) => s + (p.paymentAmountDue ?? 0), 0)
    const paid = players.reduce((s, p) => s + (p.paymentAmountPaid ?? 0), 0)
    const paidCount = players.filter((p) => p.feePaid).length
    return { due, paid, paidCount, total: players.length }
  }, [players])

  const unpaidVisibleCount = visiblePlayers.filter((p) => !p.feePaid).length

  return (
    <PageLayout
      title="Fees"
      description="Tournament contribution tracking — see who's paid, mark payments received, and chase the outstanding ones."
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
      {/* Overall summary cards */}
      {!isLoading && overall.total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
          <SummaryCard
            label="Players paid"
            value={`${overall.paidCount} of ${overall.total}`}
            icon={<CheckCircle2 className="w-4 h-4" />}
            tone="green"
          />
          <SummaryCard
            label="Total due"
            value={formatCurrency(overall.due)}
            icon={<Wallet className="w-4 h-4" />}
            tone="neutral"
          />
          <SummaryCard
            label="Collected"
            value={formatCurrency(overall.paid)}
            icon={<Check className="w-4 h-4" />}
            tone="green"
          />
          <SummaryCard
            label="Outstanding"
            value={formatCurrency(Math.max(overall.due - overall.paid, 0))}
            icon={<AlertTriangle className="w-4 h-4" />}
            tone="amber"
          />
        </div>
      )}

      {/* Filters + actions */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4 items-start sm:items-center">
        <Select
          className="sm:w-48 bg-white"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
        >
          <option value="all">All Teams</option>
          {uniqueCategories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </Select>

        <div className="relative sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9 bg-white"
            placeholder="Search by name…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium select-none cursor-pointer bg-white border border-input rounded-md px-3 h-10">
          <input
            type="checkbox"
            className="accent-primary"
            checked={unpaidOnly}
            onChange={(e) => setUnpaidOnly(e.target.checked)}
          />
          Unpaid only
        </label>

        {!isLoading && unpaidVisibleCount > 0 && (
          <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              {unpaidVisibleCount} unpaid player{unpaidVisibleCount !== 1 ? "s" : ""}
            </span>
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
          No players found.
        </div>
      ) : (
        <div className="space-y-6">
          {teamGroups.map(({ team, players: groupPlayers, due, paid, paidCount }) => {
            const outstanding = Math.max(due - paid, 0)
            return (
              <div
                key={team.id}
                className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden"
              >
                {/* Team heading */}
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h3 className="font-bold text-foreground text-base">{team.name}</h3>
                    <div className="text-sm text-muted-foreground mt-0.5">
                      {team.category} ·{" "}
                      <span className="font-semibold text-foreground">
                        {paidCount} of {groupPlayers.length} paid
                      </span>
                      {due > 0 && (
                        <>
                          {" "}
                          · <span className="text-foreground font-medium">{formatCurrency(paid)}</span>{" "}
                          of <span className="text-foreground font-medium">{formatCurrency(due)}</span>{" "}
                          collected
                          {outstanding > 0 && (
                            <>
                              {" "}
                              ·{" "}
                              <span className="text-amber-700 font-semibold">
                                {formatCurrency(outstanding)} outstanding
                              </span>
                            </>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs self-start sm:self-auto">
                    {groupPlayers.length} player{groupPlayers.length !== 1 ? "s" : ""}
                  </Badge>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 font-semibold">#</th>
                        <th className="px-4 py-3 font-semibold">Name</th>
                        <th className="px-4 py-3 font-semibold">Status</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">Due</th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">Paid</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">Payment Date</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            Reminded
                          </span>
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {groupPlayers.map((player) => {
                        const isPaid = player.feePaid
                        const isUnpaid = !isPaid
                        const dueAmount = player.paymentAmountDue ?? null
                        const paidAmount = player.paymentAmountPaid ?? null
                        const missingDue = dueAmount == null
                        return (
                          <tr
                            key={player.id}
                            className={`transition-colors group cursor-pointer ${
                              isUnpaid ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-muted/10"
                            }`}
                            onClick={() => openEditModal(player)}
                          >
                            {/* Shirt # */}
                            <td className="px-4 py-3">
                              {player.shirtNumber != null ? (
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                  {player.shirtNumber}
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-xs">
                                  —
                                </div>
                              )}
                            </td>

                            {/* Name */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{player.name}</span>
                                {missingDue && (
                                  <AlertTriangle
                                    className="w-3.5 h-3.5 text-amber-500 shrink-0"
                                    aria-label="No fee amount set"
                                  />
                                )}
                              </div>
                            </td>

                            {/* Status */}
                            <td className="px-4 py-3">
                              {isPaid ? (
                                <Badge className="gap-1 bg-green-100 text-green-800 border border-green-200 hover:bg-green-100">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Paid
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="gap-1 text-amber-700 border-amber-300 bg-amber-50"
                                >
                                  <XCircle className="w-3 h-3" />
                                  Unpaid
                                </Badge>
                              )}
                            </td>

                            {/* Due */}
                            <td className="px-4 py-3 hidden md:table-cell tabular-nums">
                              {dueAmount != null ? (
                                <span className="text-foreground font-medium">
                                  {formatCurrency(dueAmount)}
                                </span>
                              ) : (
                                <span className="text-amber-600 text-xs">Not set</span>
                              )}
                            </td>

                            {/* Paid */}
                            <td className="px-4 py-3 hidden md:table-cell tabular-nums">
                              {paidAmount != null && paidAmount > 0 ? (
                                <span className="text-foreground">{formatCurrency(paidAmount)}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Payment date */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {player.paymentDate ? (
                                <span className="text-foreground tabular-nums">
                                  {formatDate(player.paymentDate)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Reminded */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {player.feeReminderSentAt ? (
                                <Badge
                                  variant="secondary"
                                  className="gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 whitespace-nowrap"
                                >
                                  <Clock className="w-3 h-3" />
                                  {formatReminderDate(player.feeReminderSentAt)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Actions */}
                            <td
                              className="px-4 py-3 text-right whitespace-nowrap"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="flex items-center justify-end gap-1.5">
                                {isUnpaid && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-2.5 text-xs border-green-300 text-green-700 hover:bg-green-50 hover:border-green-400 bg-white"
                                    onClick={(e) => openMarkPaidModal(player, e)}
                                  >
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                    Mark as paid
                                  </Button>
                                )}
                                <button
                                  onClick={() => openEditModal(player)}
                                  className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background hover:bg-blue-50 border shadow-sm transition-colors"
                                  aria-label={`Edit fee details for ${player.name}`}
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

      {/* Edit Fee Modal */}
      <Modal
        isOpen={!!editingPlayer}
        onClose={() => setEditingPlayer(null)}
        title={editingPlayer ? `Fee details: ${editingPlayer.name}` : "Edit Fee"}
      >
        {editingPlayer && (
          <form onSubmit={editForm.handleSubmit(onSubmitEdit)} className="space-y-4">
            <label className="flex items-center gap-3 p-3 border border-border rounded-lg bg-muted/20 cursor-pointer">
              <input
                type="checkbox"
                className="accent-primary w-4 h-4"
                {...editForm.register("feePaid")}
              />
              <div>
                <div className="text-sm font-semibold">Fee paid in full</div>
                <div className="text-xs text-muted-foreground">
                  Tick once the player's tournament contribution has been received.
                </div>
              </div>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Amount Due (HK$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 3500"
                  {...editForm.register("paymentAmountDue")}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Amount Paid (HK$)</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="e.g. 3500"
                  {...editForm.register("paymentAmountPaid")}
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold">Payment Date</label>
                <Input type="date" {...editForm.register("paymentDate")} />
              </div>
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button type="button" variant="outline" onClick={() => setEditingPlayer(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={editForm.formState.isSubmitting}>
                {editForm.formState.isSubmitting ? "Saving..." : "Save"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Mark As Paid Modal */}
      <Modal
        isOpen={!!markingPaidPlayer}
        onClose={() => setMarkingPaidPlayer(null)}
        title={markingPaidPlayer ? `Mark as paid: ${markingPaidPlayer.name}` : "Mark as Paid"}
      >
        {markingPaidPlayer && (
          <form onSubmit={markPaidForm.handleSubmit(onSubmitMarkPaid)} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Confirm the amount received and the payment date. If the amount is less than the amount
              due, the player will be recorded as a partial payment and remain Unpaid in summaries.
            </p>
            {markingPaidPlayer.paymentAmountDue != null && (
              <div className="text-sm bg-muted/30 border border-border rounded-md px-3 py-2">
                <span className="text-muted-foreground">Amount due on file: </span>
                <span className="font-semibold">
                  {formatCurrency(markingPaidPlayer.paymentAmountDue)}
                </span>
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Amount Received (HK$) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  {...markPaidForm.register("paymentAmountPaid")}
                />
                {markPaidForm.formState.errors.paymentAmountPaid && (
                  <p className="text-xs text-destructive">
                    {markPaidForm.formState.errors.paymentAmountPaid.message}
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Payment Date *</label>
                <Input type="date" {...markPaidForm.register("paymentDate")} />
                {markPaidForm.formState.errors.paymentDate && (
                  <p className="text-xs text-destructive">
                    {markPaidForm.formState.errors.paymentDate.message}
                  </p>
                )}
              </div>
            </div>
            <div className="pt-4 flex justify-end gap-3 border-t">
              <Button type="button" variant="outline" onClick={() => setMarkingPaidPlayer(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={markPaidForm.formState.isSubmitting}>
                <Check className="w-4 h-4 mr-1.5" />
                {markPaidForm.formState.isSubmitting ? "Saving..." : "Mark as paid"}
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </PageLayout>
  )
}

function SummaryCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string
  value: string
  icon: React.ReactNode
  tone: "green" | "amber" | "neutral"
}) {
  const toneClass =
    tone === "green"
      ? "text-green-700 bg-green-50 border-green-200"
      : tone === "amber"
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-foreground bg-muted/30 border-border"
  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wider font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  )
}
