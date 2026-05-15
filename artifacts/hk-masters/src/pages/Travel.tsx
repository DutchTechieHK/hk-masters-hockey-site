import { useState, useMemo } from "react"
import { useListPlayers, useUpdatePlayer, useListTeams, getListPlayersQueryKey, useSendTravelReminders } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Download, AlertTriangle, Edit2, Plane, BedDouble, MapPin, Mail, Search, ChevronUp, ChevronDown, ChevronsUpDown, Clock } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Player, CreatePlayer } from "@workspace/api-client-react"
import { useToast } from "@/hooks/use-toast"
import { MaskedInput } from "@/components/MaskedInput"

function venueForCategory(category: string): string {
  const c = category.toLowerCase()
  if (c.includes("50")) return "Rotterdam"
  if (c.includes("40")) return "Schiedam"
  return category
}

const playerSchema = z.object({
  teamId: z.coerce.number().min(1, "Team selection is required"),
  name: z.string().min(1, "Name is required"),
  shirtNumber: z.union([z.coerce.number().int().min(1).max(99), z.literal("")]).optional(),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  position: z.string().optional(),
  dateOfBirth: z.string().optional(),
  nationality: z.string().optional(),
  passportNumber: z.string().optional(),
  passportExpiry: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  flightArrivalDateTime: z.string().optional(),
  flightDepartureDateTime: z.string().optional(),
  arrivalCity: z.string().optional(),
  outboundFlightNumber: z.string().optional(),
  outboundDepartureDateTime: z.string().optional(),
  returnFlightNumber: z.string().optional(),
  returnArrivalDateTime: z.string().optional(),
  roomSharingPreference: z.string().optional(),
  roomSharingWith: z.string().optional(),
  shirtSize: z.string().optional(),
  shortsSize: z.string().optional(),
  jacketSize: z.string().optional(),
  poloSize: z.string().optional(),
  trackTopSize: z.string().optional(),
  goalieSmockSize: z.string().optional(),
  travelDates: z.string().optional(),
  feePaid: z.boolean().default(false),
  paymentAmountDue: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentAmountPaid: z.union([z.coerce.number().min(0), z.literal("")]).optional(),
  paymentDate: z.string().optional(),
  dietaryRequirements: z.string().optional(),
  medicalNotes: z.string().optional(),
  notes: z.string().optional(),
})

type PlayerFormValues = z.infer<typeof playerSchema>

function toCreatePlayer(data: PlayerFormValues): CreatePlayer {
  return {
    teamId: data.teamId,
    name: data.name,
    email: data.email,
    feePaid: data.feePaid,
    shirtNumber: data.shirtNumber === "" ? undefined : data.shirtNumber,
    paymentAmountDue: data.paymentAmountDue === "" ? undefined : data.paymentAmountDue,
    paymentAmountPaid: data.paymentAmountPaid === "" ? undefined : data.paymentAmountPaid,
    phone: data.phone || undefined,
    position: data.position || undefined,
    dateOfBirth: data.dateOfBirth || undefined,
    nationality: data.nationality || undefined,
    passportNumber: data.passportNumber || undefined,
    passportExpiry: data.passportExpiry || undefined,
    emergencyContactName: data.emergencyContactName || undefined,
    emergencyContactPhone: data.emergencyContactPhone || undefined,
    flightArrivalDateTime: data.flightArrivalDateTime || undefined,
    flightDepartureDateTime: data.flightDepartureDateTime || undefined,
    arrivalCity: data.arrivalCity || undefined,
    outboundFlightNumber: data.outboundFlightNumber || undefined,
    outboundDepartureDateTime: data.outboundDepartureDateTime || undefined,
    returnFlightNumber: data.returnFlightNumber || undefined,
    returnArrivalDateTime: data.returnArrivalDateTime || undefined,
    roomSharingPreference: data.roomSharingPreference || undefined,
    roomSharingWith: data.roomSharingWith || undefined,
    shirtSize: data.shirtSize || undefined,
    shortsSize: data.shortsSize || undefined,
    jacketSize: data.jacketSize || undefined,
    poloSize: data.poloSize || undefined,
    trackTopSize: data.trackTopSize || undefined,
    goalieSmockSize: data.goalieSmockSize || undefined,
    travelDates: data.travelDates || undefined,
    paymentDate: data.paymentDate || undefined,
    dietaryRequirements: data.dietaryRequirements || undefined,
    medicalNotes: data.medicalNotes || undefined,
    notes: data.notes || undefined,
  }
}

function formatDateTime(dt?: string | null) {
  if (!dt) return null
  const d = new Date(dt)
  if (isNaN(d.getTime())) return dt
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
}

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

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-xs font-bold text-primary uppercase tracking-wider border-b border-border pb-2 mt-6 mb-3">
      {children}
    </h4>
  )
}

function exportToCSV(players: Player[], teams: { id: number; name: string; category: string }[]) {
  const teamMap = Object.fromEntries(teams.map(t => [t.id, t]))
  const headers = [
    "Team",
    "Category",
    "Name",
    "Shirt #",
    "Outbound Flight #",
    "Departs HK (HKT)",
    "Arrives Europe (local)",
    "Arrival City/Airport",
    "Return Flight #",
    "Departs Europe (local)",
    "Arrives HK (HKT)",
    "Room Sharing",
    "Room Sharing With",
    "Travel Missing",
  ]
  const rows = players.map(p => {
    const team = teamMap[p.teamId]
    return [
      team ? team.name : `Team ${p.teamId}`,
      team ? team.category : "",
      p.name,
      p.shirtNumber ?? "",
      p.outboundFlightNumber ?? "",
      p.outboundDepartureDateTime ?? "",
      p.flightArrivalDateTime ?? "",
      p.arrivalCity ?? "",
      p.returnFlightNumber ?? "",
      p.flightDepartureDateTime ?? "",
      p.returnArrivalDateTime ?? "",
      p.roomSharingPreference ?? "",
      p.roomSharingWith ?? "",
      !p.flightArrivalDateTime ? "Yes" : "No",
    ]
  })

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "travel-manifest.csv"
  a.click()
  URL.revokeObjectURL(url)
}

export default function Travel() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortField, setSortField] = useState<"arrival" | "departure" | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers()

  const updateMutation = useUpdatePlayer()
  const sendRemindersMutation = useSendTravelReminders()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerSchema),
  })

  const openEditModal = (player: Player) => {
    setEditingPlayer(player)
    reset({
      teamId: player.teamId,
      name: player.name,
      shirtNumber: player.shirtNumber ?? "",
      email: player.email,
      phone: player.phone || "",
      position: player.position || "",
      dateOfBirth: player.dateOfBirth || "",
      nationality: player.nationality || "",
      passportNumber: player.passportNumber || "",
      passportExpiry: player.passportExpiry || "",
      emergencyContactName: player.emergencyContactName || "",
      emergencyContactPhone: player.emergencyContactPhone || "",
      flightArrivalDateTime: player.flightArrivalDateTime || "",
      flightDepartureDateTime: player.flightDepartureDateTime || "",
      arrivalCity: player.arrivalCity || "",
      outboundFlightNumber: player.outboundFlightNumber || "",
      outboundDepartureDateTime: player.outboundDepartureDateTime || "",
      returnFlightNumber: player.returnFlightNumber || "",
      returnArrivalDateTime: player.returnArrivalDateTime || "",
      roomSharingPreference: player.roomSharingPreference || "shared",
      roomSharingWith: player.roomSharingWith || "",
      shirtSize: player.shirtSize || "",
      shortsSize: player.shortsSize || "",
      jacketSize: player.jacketSize || "",
      poloSize: player.poloSize || "",
      trackTopSize: player.trackTopSize || "",
      goalieSmockSize: player.goalieSmockSize || "",
      travelDates: player.travelDates || "",
      feePaid: player.feePaid,
      paymentAmountDue: player.paymentAmountDue ?? "",
      paymentAmountPaid: player.paymentAmountPaid ?? "",
      paymentDate: player.paymentDate || "",
      dietaryRequirements: player.dietaryRequirements || "",
      medicalNotes: player.medicalNotes || "",
      notes: player.notes || "",
    })
    setIsModalOpen(true)
  }

  const onSubmit = async (data: PlayerFormValues) => {
    if (!editingPlayer) return
    try {
      await updateMutation.mutateAsync({ id: editingPlayer.id, data: toCreatePlayer(data) })
      toast({ title: "Player updated" })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const handleSendReminders = async () => {
    const missingPlayers = visiblePlayers.filter(p => !p.flightArrivalDateTime)
    if (missingPlayers.length === 0) return
    try {
      const result = await sendRemindersMutation.mutateAsync({ data: { playerIds: missingPlayers.map(p => p.id) } })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      if (result.failed === 0) {
        toast({ title: `${result.sent} reminder${result.sent !== 1 ? "s" : ""} sent`, description: `Successfully emailed ${result.sent} player${result.sent !== 1 ? "s" : ""} missing flight details.` })
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

  // Toggle sort: same field cycles asc→desc→off, new field starts asc
  const handleSort = (field: "arrival" | "departure") => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc")
      else { setSortField(null); setSortDir("asc") }
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  // Derive unique categories from teams in a stable order
  const uniqueCategories = Array.from(new Set(teams.map(t => t.category)))

  // Map team id → category for filtering
  const teamCategoryMap = Object.fromEntries(teams.map(t => [t.id, t.category]))

  // Filter all players by selected category and search query, then sort
  const visiblePlayers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let filtered = categoryFilter === "all"
      ? players
      : players.filter(p => teamCategoryMap[p.teamId] === categoryFilter)
    if (q) {
      filtered = filtered.filter(p => p.name.toLowerCase().includes(q))
    }
    if (sortField) {
      const key = sortField === "arrival" ? "flightArrivalDateTime" : "flightDepartureDateTime"
      filtered = [...filtered].sort((a, b) => {
        const av = a[key] ?? ""
        const bv = b[key] ?? ""
        if (av === bv) return 0
        if (av === "") return 1   // missing values sink to bottom
        if (bv === "") return -1
        return sortDir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av)
      })
    }
    return filtered
  }, [players, categoryFilter, searchQuery, sortField, sortDir, teamCategoryMap])

  // Group visible players by team, preserving team order
  const teamGroups = useMemo(() => teams
    .filter(t => categoryFilter === "all" || t.category === categoryFilter)
    .map(team => ({
      team,
      players: visiblePlayers.filter(p => p.teamId === team.id),
    }))
    .filter(g => g.players.length > 0),
    [teams, categoryFilter, visiblePlayers]
  )

  const missingCount = visiblePlayers.filter(p => !p.flightArrivalDateTime).length

  return (
    <PageLayout
      title="Travel"
      description="Flight and accommodation details for all players."
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
      {/* Filters + summary */}
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

        {!isLoading && missingCount > 0 && (
          <div className="flex items-center gap-3 text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm font-medium">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{missingCount} player{missingCount !== 1 ? "s" : ""} missing flight info</span>
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
          Loading travel details...
        </div>
      ) : visiblePlayers.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center text-muted-foreground">
          No players found.
        </div>
      ) : (
        <div className="space-y-6">
          {teamGroups.map(({ team, players: groupPlayers }) => {
            const venue = venueForCategory(team.category)
            return (
              <div key={team.id} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                {/* Team heading */}
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <div>
                    <h3 className="font-bold text-foreground text-base">{team.name}</h3>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{venue}</span>
                      <span className="text-muted-foreground/50 mx-1">·</span>
                      <span>{team.category}</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
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
                        <th className="px-4 py-3 font-semibold">
                          <button
                            type="button"
                            onClick={() => handleSort("arrival")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                          >
                            <Plane className="w-3.5 h-3.5" />
                            Arrival
                            {sortField === "arrival" ? (
                              sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">
                          <button
                            type="button"
                            onClick={() => handleSort("departure")}
                            className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                          >
                            <Plane className="w-3.5 h-3.5 rotate-180" />
                            Departure
                            {sortField === "departure" ? (
                              sortDir === "asc" ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
                            ) : (
                              <ChevronsUpDown className="w-3.5 h-3.5 opacity-40" />
                            )}
                          </button>
                        </th>
                        <th className="px-4 py-3 font-semibold hidden md:table-cell">Airport</th>
                        <th className="px-4 py-3 font-semibold hidden xl:table-cell">
                          <span className="flex items-center gap-1.5"><BedDouble className="w-3.5 h-3.5" />Room</span>
                        </th>
                        <th className="px-4 py-3 font-semibold hidden xl:table-cell">Sharing With</th>
                        <th className="px-4 py-3 font-semibold hidden lg:table-cell">
                          <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />Reminded</span>
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">Edit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {groupPlayers.map(player => {
                        const missingFlight = !player.flightArrivalDateTime
                        return (
                          <tr
                            key={player.id}
                            className={`transition-colors group cursor-pointer ${missingFlight ? "bg-amber-50/60 hover:bg-amber-50" : "hover:bg-muted/10"}`}
                            onClick={() => openEditModal(player)}
                          >
                            {/* Shirt # */}
                            <td className="px-4 py-3">
                              {player.shirtNumber != null ? (
                                <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                                  {player.shirtNumber}
                                </div>
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-xs">—</div>
                              )}
                            </td>

                            {/* Name */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-foreground">{player.name}</span>
                                {missingFlight && (
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" title="No flight info" />
                                )}
                              </div>
                            </td>

                            {/* Arrival */}
                            <td className="px-4 py-3">
                              {player.flightArrivalDateTime ? (
                                <span className="text-foreground font-medium tabular-nums">
                                  {formatDateTime(player.flightArrivalDateTime)}
                                </span>
                              ) : (
                                <span className="text-amber-600 text-xs font-medium">Not set</span>
                              )}
                            </td>

                            {/* Departure */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {player.flightDepartureDateTime ? (
                                <span className="text-foreground tabular-nums">
                                  {formatDateTime(player.flightDepartureDateTime)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">Not set</span>
                              )}
                            </td>

                            {/* Airport */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              {player.arrivalCity ? (
                                <span className="text-foreground">{player.arrivalCity}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Room sharing preference */}
                            <td className="px-4 py-3 hidden xl:table-cell">
                              {player.roomSharingPreference ? (
                                <Badge variant={player.roomSharingPreference === "single" ? "outline" : "secondary"} className="capitalize">
                                  {player.roomSharingPreference}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Room sharing with */}
                            <td className="px-4 py-3 hidden xl:table-cell">
                              {player.roomSharingWith ? (
                                <span className="text-foreground">{player.roomSharingWith}</span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Reminded */}
                            <td className="px-4 py-3 hidden lg:table-cell">
                              {player.travelReminderSentAt ? (
                                <Badge variant="secondary" className="gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 whitespace-nowrap">
                                  <Clock className="w-3 h-3" />
                                  {formatReminderDate(player.travelReminderSentAt)}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </td>

                            {/* Edit */}
                            <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => openEditModal(player)}
                                className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background hover:bg-blue-50 border shadow-sm transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
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

      {/* Edit Player Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlayer ? `Edit: ${editingPlayer.name}` : "Edit Player"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-1">

          <SectionHeading>Basic Info</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Team *</label>
              <Select {...register("teamId")}>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
              </Select>
              {errors.teamId && <p className="text-xs text-destructive">{errors.teamId.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Full Name *</label>
              <Input {...register("name")} placeholder="Jane Doe" />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Shirt Number</label>
              <Input type="number" min="1" max="99" {...register("shirtNumber")} placeholder="1–99" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Email *</label>
              <Input type="email" {...register("email")} placeholder="jane@example.com" />
              {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Phone</label>
              <Input {...register("phone")} placeholder="+852 XXXX XXXX" />
            </div>
          </div>

          <SectionHeading>Outbound Flight (Hong Kong → Europe)</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Flight Number</label>
              <Input {...register("outboundFlightNumber")} placeholder="e.g. KL888" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Departs Hong Kong (HKT)</label>
              <Input type="datetime-local" {...register("outboundDepartureDateTime")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Arrives in Europe (local time)</label>
              <Input type="datetime-local" {...register("flightArrivalDateTime")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Arrival City/Airport</label>
              <Input {...register("arrivalCity")} placeholder="e.g. Amsterdam Schiphol (AMS)" />
            </div>
          </div>

          <SectionHeading>Return Flight (Europe → Hong Kong)</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Flight Number</label>
              <Input {...register("returnFlightNumber")} placeholder="e.g. KL887" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Departs Europe (local time)</label>
              <Input type="datetime-local" {...register("flightDepartureDateTime")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Arrives Hong Kong (HKT)</label>
              <Input type="datetime-local" {...register("returnArrivalDateTime")} />
            </div>
          </div>

          <SectionHeading>Accommodation</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Travel Dates (Summary)</label>
              <Input {...register("travelDates")} placeholder="e.g. 10 Jul – 25 Jul" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Room Sharing Preference</label>
              <Select {...register("roomSharingPreference")}>
                <option value="shared">Shared</option>
                <option value="single">Single</option>
              </Select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">Room Sharing With</label>
              <Input {...register("roomSharingWith")} placeholder="Preferred roommate" />
            </div>
          </div>

          <SectionHeading>Other Details</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Position</label>
              <Input {...register("position")} placeholder="Forward, Midfield, Defender, GK..." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Nationality</label>
              <Input {...register("nationality")} placeholder="e.g. Hong Kong" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Passport Number</label>
              <MaskedInput {...register("passportNumber")} placeholder="A1234567" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Passport Expiry</label>
              <Input type="date" {...register("passportExpiry")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Emergency Contact Name</label>
              <Input {...register("emergencyContactName")} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Emergency Contact Phone</label>
              <Input {...register("emergencyContactPhone")} placeholder="+852 XXXX XXXX" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Dietary Requirements</label>
              <Input {...register("dietaryRequirements")} placeholder="None, Vegetarian, Halal, etc." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Medical Notes</label>
              <Input {...register("medicalNotes")} placeholder="Allergies, conditions, medication..." />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-semibold">General Notes</label>
              <Input {...register("notes")} placeholder="Any other information..." />
            </div>
          </div>

          <div className="pt-6 flex justify-end gap-3 border-t mt-6">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Update Player"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
