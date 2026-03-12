import { useState } from "react"
import { useListTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, getListTeamsQueryKey, useListPlayers } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, Mail, Phone, Users, ChevronLeft, CheckCircle, XCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import type { Team } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"

const teamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  category: z.string().min(1, "Category is required"),
  managerName: z.string().min(1, "Manager name is required"),
  managerEmail: z.string().email("Invalid email"),
  managerPhone: z.string().min(1, "Phone is required"),
  assistantManagerName: z.string().optional(),
  assistantManagerContact: z.string().optional(),
  whatsappGroupLink: z.string().optional(),
  targetPlayerCount: z.union([z.coerce.number().int().min(1), z.literal("")]).optional(),
  kitNotes: z.string().optional(),
  notes: z.string().optional(),
})

type TeamFormValues = z.infer<typeof teamSchema>

function TeamDetail({ team, onBack, onEdit }: { team: Team; onBack: () => void; onEdit: (team: Team) => void }) {
  const { data: players = [], isLoading } = useListPlayers({ teamId: team.id })

  return (
    <div>
      {/* Back header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Teams
      </button>

      {/* Team header card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Badge className="mb-2">{team.category}</Badge>
            <h2 className="text-3xl font-bold text-primary">{team.name}</h2>
            {team.createdAt && (
              <p className="text-xs text-muted-foreground mt-1">Created {format(new Date(team.createdAt), 'MMM d, yyyy')}</p>
            )}
          </div>
          <Button variant="outline" onClick={() => onEdit(team)} className="shrink-0">
            <Edit2 className="w-4 h-4 mr-2" /> Edit Team
          </Button>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Manager</p>
            <p className="font-semibold text-foreground">{team.managerName}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</p>
            <a href={`mailto:${team.managerEmail}`} className="font-semibold text-primary hover:underline">{team.managerEmail}</a>
          </div>
          <div>
            <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</p>
            <a href={`tel:${team.managerPhone}`} className="font-semibold text-foreground">{team.managerPhone}</a>
          </div>
        </div>
      </div>

      {/* Players roster */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Team Roster</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{players.length} player{players.length !== 1 ? 's' : ''} registered</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading players...</div>
        ) : players.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No players in this team yet.</p>
            <p className="text-sm mt-1">Add players from the Players section.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">#</th>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold hidden sm:table-cell">Position</th>
                  <th className="px-6 py-3 font-semibold">Fee Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {players.map(player => (
                  <tr key={player.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-3">
                      {player.shirtNumber != null ? (
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {player.shirtNumber}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-xs">—</div>
                      )}
                    </td>
                    <td className="px-6 py-3 font-semibold text-foreground">{player.name}</td>
                    <td className="px-6 py-3 hidden sm:table-cell text-muted-foreground">{player.position || '—'}</td>
                    <td className="px-6 py-3">
                      {player.feePaid ? (
                        <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Paid</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 bg-rose-100 text-rose-800"><XCircle className="w-3 h-3" /> Unpaid</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function Teams() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: teams = [], isLoading } = useListTeams()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  const createMutation = useCreateTeam()
  const updateMutation = useUpdateTeam()
  const deleteMutation = useDeleteTeam()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema)
  })

  const openAddModal = () => {
    setEditingTeam(null)
    reset({
      name: "", category: "Women 35+",
      managerName: "", managerEmail: "", managerPhone: "",
      assistantManagerName: "", assistantManagerContact: "",
      whatsappGroupLink: "", targetPlayerCount: "", kitNotes: "", notes: ""
    })
    setIsModalOpen(true)
  }

  const openEditModal = (team: Team) => {
    setEditingTeam(team)
    reset({
      name: team.name,
      category: team.category,
      managerName: team.managerName,
      managerEmail: team.managerEmail,
      managerPhone: team.managerPhone,
      assistantManagerName: team.assistantManagerName || "",
      assistantManagerContact: team.assistantManagerContact || "",
      whatsappGroupLink: team.whatsappGroupLink || "",
      targetPlayerCount: team.targetPlayerCount ?? "",
      kitNotes: team.kitNotes || "",
      notes: team.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this team?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() })
      toast({ title: "Team deleted successfully" })
      if (selectedTeam?.id === id) setSelectedTeam(null)
    } catch {
      toast({ title: "Failed to delete team", variant: "destructive" })
    }
  }

  const onSubmit = async (data: TeamFormValues) => {
    try {
      if (editingTeam) {
        await updateMutation.mutateAsync({ id: editingTeam.id, data })
        toast({ title: "Team updated successfully" })
        if (selectedTeam?.id === editingTeam.id) {
          setSelectedTeam({ ...selectedTeam, ...data })
        }
      } else {
        await createMutation.mutateAsync({ data })
        toast({ title: "Team created successfully" })
      }
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  return (
    <PageLayout
      title="Teams"
      description="Manage the 3 Hong Kong field hockey teams travelling to Rotterdam."
      action={
        !selectedTeam ? (
          <Button onClick={openAddModal}>
            <Plus className="w-5 h-5 mr-2" /> Add Team
          </Button>
        ) : undefined
      }
    >
      {/* Team detail view */}
      {selectedTeam ? (
        <TeamDetail
          team={selectedTeam}
          onBack={() => setSelectedTeam(null)}
          onEdit={(team) => openEditModal(team)}
        />
      ) : (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-2xl border border-border"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {teams.map(team => (
                <div
                  key={team.id}
                  className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col group hover:border-primary/30"
                  onClick={() => setSelectedTeam(team)}
                >
                  <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent relative">
                    <div className="absolute top-4 right-4 flex space-x-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); openEditModal(team) }}
                        className="p-1.5 bg-white rounded-md shadow text-blue-600 hover:bg-blue-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(team.id) }}
                        className="p-1.5 bg-white rounded-md shadow text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <Badge className="mb-3">{team.category}</Badge>
                    <h3 className="text-2xl font-display font-bold text-primary">{team.name}</h3>
                    {team.createdAt && <p className="text-xs text-muted-foreground mt-1">Created {format(new Date(team.createdAt), 'MMM d, yyyy')}</p>}
                  </div>
                  <div className="p-6 flex-1 flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><Users className="w-4 h-4 mr-2"/> Manager</p>
                      <p className="font-medium text-foreground">{team.managerName}</p>
                    </div>
                    <div className="space-y-2">
                      <a href={`mailto:${team.managerEmail}`} onClick={e => e.stopPropagation()} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Mail className="w-4 h-4 mr-3" /> {team.managerEmail}
                      </a>
                      <a href={`tel:${team.managerPhone}`} onClick={e => e.stopPropagation()} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Phone className="w-4 h-4 mr-3" /> {team.managerPhone}
                      </a>
                    </div>
                    {team.notes && (
                      <div className="mt-auto pt-4 border-t border-border">
                        <p className="text-sm italic text-muted-foreground line-clamp-2">{team.notes}</p>
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-border/50 text-xs font-medium text-primary flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Click to view team roster →
                    </div>
                  </div>
                </div>
              ))}
              {teams.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-border">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-bold text-foreground">No teams yet</h3>
                  <p className="text-muted-foreground mt-1 mb-4">Add your first team to get started.</p>
                  <Button onClick={openAddModal} variant="outline">Create a Team</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeam ? "Edit Team" : "Add New Team"}
        description={editingTeam ? "Update team details below." : "Enter details for the new team."}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Team Name</label>
              <Input placeholder="e.g. Hong Kong Dragons" {...register("name")} />
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Category</label>
              <Select {...register("category")}>
                <option value="Women 35+">Women 35+</option>
                <option value="Men 40+">Men 40+</option>
                <option value="Men 50+">Men 50+</option>
              </Select>
              {errors.category && <p className="text-xs text-destructive">{errors.category.message}</p>}
            </div>
          </div>
          
          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Manager Details</h4>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Manager Full Name *</label>
              <Input placeholder="Manager Name" {...register("managerName")} />
              {errors.managerName && <p className="text-xs text-destructive">{errors.managerName.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Manager Email *</label>
                <Input type="email" placeholder="manager@example.com" {...register("managerEmail")} />
                {errors.managerEmail && <p className="text-xs text-destructive">{errors.managerEmail.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Manager Phone *</label>
                <Input placeholder="+852 XXXX XXXX" {...register("managerPhone")} />
                {errors.managerPhone && <p className="text-xs text-destructive">{errors.managerPhone.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Assistant Manager Name</label>
                <Input placeholder="Optional" {...register("assistantManagerName")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Assistant Manager Contact</label>
                <Input placeholder="Phone or email" {...register("assistantManagerContact")} />
              </div>
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Team Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">WhatsApp Group Link</label>
                <Input placeholder="https://chat.whatsapp.com/..." {...register("whatsappGroupLink")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Target Player Count</label>
                <Input type="number" min="1" placeholder="e.g. 16" {...register("targetPlayerCount")} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Kit & Clothing Notes</label>
              <Input placeholder="Colours, design preferences, supplier notes..." {...register("kitNotes")} />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <label className="text-sm font-semibold">General Notes (Optional)</label>
            <textarea
              className="flex w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all min-h-[80px]"
              placeholder="Any additional info..."
              {...register("notes")}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingTeam ? "Update Team" : "Create Team"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
