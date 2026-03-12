import { useState } from "react"
import { useListPlayers, useCreatePlayer, useUpdatePlayer, useDeletePlayer, getListPlayersQueryKey, useListTeams } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Trash2, Edit2, CheckCircle, XCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { Player } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { getInitials } from "@/lib/utils"

const playerSchema = z.object({
  teamId: z.coerce.number().min(1, "Team selection is required"),
  name: z.string().min(1, "Name is required"),
  email: z.string().email("Invalid email"),
  phone: z.string().optional(),
  position: z.string().optional(),
  shirtSize: z.string().optional(),
  shortsSize: z.string().optional(),
  jacketSize: z.string().optional(),
  travelDates: z.string().optional(),
  feePaid: z.boolean().default(false),
  passportExpiry: z.string().optional(),
  dietaryRequirements: z.string().optional(),
  notes: z.string().optional(),
})

type PlayerFormValues = z.infer<typeof playerSchema>

export default function Players() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all")
  const [searchQuery, setSearchQuery] = useState("")
  
  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers(
    selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined
  )

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

  const createMutation = useCreatePlayer()
  const updateMutation = useUpdatePlayer()
  const deleteMutation = useDeletePlayer()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<PlayerFormValues>({
    resolver: zodResolver(playerSchema)
  })

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    p.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openAddModal = () => {
    setEditingPlayer(null)
    reset({ 
      teamId: teams.length > 0 ? teams[0].id : 0, 
      name: "", email: "", phone: "", position: "", 
      shirtSize: "", shortsSize: "", jacketSize: "", 
      travelDates: "", feePaid: false, passportExpiry: "", 
      dietaryRequirements: "", notes: "" 
    })
    setIsModalOpen(true)
  }

  const openEditModal = (player: Player) => {
    setEditingPlayer(player)
    reset({
      teamId: player.teamId,
      name: player.name,
      email: player.email,
      phone: player.phone || "",
      position: player.position || "",
      shirtSize: player.shirtSize || "",
      shortsSize: player.shortsSize || "",
      jacketSize: player.jacketSize || "",
      travelDates: player.travelDates || "",
      feePaid: player.feePaid,
      passportExpiry: player.passportExpiry || "",
      dietaryRequirements: player.dietaryRequirements || "",
      notes: player.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this player?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      toast({ title: "Player deleted successfully" })
    } catch {
      toast({ title: "Failed to delete player", variant: "destructive" })
    }
  }

  const onSubmit = async (data: PlayerFormValues) => {
    try {
      if (editingPlayer) {
        await updateMutation.mutateAsync({ id: editingPlayer.id, data })
        toast({ title: "Player updated successfully" })
      } else {
        await createMutation.mutateAsync({ data })
        toast({ title: "Player added successfully" })
      }
      queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  return (
    <PageLayout
      title="Roster"
      description="Manage player profiles, sizes, travel details, and fees."
      action={
        <Button onClick={openAddModal} disabled={teams.length === 0}>
          <Plus className="w-5 h-5 mr-2" /> Add Player
        </Button>
      }
    >
      <div className="bg-white rounded-2xl shadow-sm border border-border flex flex-col min-h-[500px] overflow-hidden">
        
        {/* Filters */}
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-4 bg-muted/20">
          <div className="relative flex-1">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input 
              placeholder="Search players..." 
              className="pl-10 bg-white"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select 
            className="sm:w-64 bg-white"
            value={selectedTeamFilter}
            onChange={(e) => setSelectedTeamFilter(e.target.value)}
          >
            <option value="all">All Teams</option>
            {teams.map(t => <option key={t.id} value={t.id.toString()}>{t.name} ({t.category})</option>)}
          </Select>
        </div>

        {/* Table */}
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Player</th>
                <th className="px-6 py-4 font-semibold hidden md:table-cell">Contact</th>
                <th className="px-6 py-4 font-semibold hidden lg:table-cell">Team Info</th>
                <th className="px-6 py-4 font-semibold">Fee Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading players...</td>
                </tr>
              ) : filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No players found. {teams.length === 0 && "Add a team first."}
                  </td>
                </tr>
              ) : (
                filteredPlayers.map(player => (
                  <tr key={player.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
                          {getInitials(player.name)}
                        </div>
                        <div>
                          <div className="font-bold text-foreground">{player.name}</div>
                          <div className="text-muted-foreground text-xs md:hidden">{player.teamName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 hidden md:table-cell">
                      <div className="text-foreground">{player.email}</div>
                      <div className="text-muted-foreground text-xs">{player.phone || '-'}</div>
                    </td>
                    <td className="px-6 py-4 hidden lg:table-cell">
                      <Badge variant="outline" className="mb-1">{player.teamName}</Badge>
                      <div className="text-muted-foreground text-xs">{player.position || 'No position'}</div>
                    </td>
                    <td className="px-6 py-4">
                      {player.feePaid ? (
                        <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3"/> Paid</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 bg-rose-100 text-rose-800 hover:bg-rose-200"><XCircle className="w-3 h-3"/> Unpaid</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(player)} className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background hover:bg-blue-50 border shadow-sm transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(player.id)} className="p-2 text-muted-foreground hover:text-rose-600 rounded bg-background hover:bg-rose-50 border shadow-sm transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingPlayer ? "Edit Player" : "Add Player"}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Section 1 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2">Basic Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-semibold">Team</label>
                <Select {...register("teamId")}>
                  {teams.map(t => <option key={t.id} value={t.id}>{t.name} ({t.category})</option>)}
                </Select>
                {errors.teamId && <p className="text-xs text-destructive">{errors.teamId.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Full Name</label>
                <Input {...register("name")} placeholder="Jane Doe" />
                {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Email</label>
                <Input type="email" {...register("email")} placeholder="jane@example.com" />
                {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Phone</label>
                <Input {...register("phone")} placeholder="+852..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Position</label>
                <Input {...register("position")} placeholder="Forward, Midfield..." />
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-muted/30 rounded-xl border">
              <input 
                type="checkbox" 
                id="feePaid" 
                className="w-5 h-5 rounded border-2 text-primary focus:ring-primary accent-primary" 
                {...register("feePaid")} 
              />
              <label htmlFor="feePaid" className="font-semibold cursor-pointer">Tournament Fee Paid</label>
            </div>
          </div>

          {/* Section 2 */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider border-b pb-2">Logistics & Sizes</h4>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Shirt Size</label>
                <Input {...register("shirtSize")} placeholder="S/M/L..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Shorts Size</label>
                <Input {...register("shortsSize")} placeholder="S/M/L..." />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Jacket Size</label>
                <Input {...register("jacketSize")} placeholder="S/M/L..." />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               <div className="space-y-2">
                <label className="text-sm font-semibold">Travel Dates</label>
                <Input {...register("travelDates")} placeholder="e.g. 10 July - 25 July" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Passport Expiry</label>
                <Input type="date" {...register("passportExpiry")} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Dietary Requirements</label>
              <Input {...register("dietaryRequirements")} placeholder="None, Vegetarian, etc." />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Notes</label>
              <Input {...register("notes")} placeholder="Medical conditions, extra info..." />
            </div>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingPlayer ? "Update Player" : "Add Player"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
