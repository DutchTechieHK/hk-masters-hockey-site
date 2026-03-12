import { useState } from "react"
import { useListTeams, useCreateTeam, useUpdateTeam, useDeleteTeam, getListTeamsQueryKey } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, Mail, Phone, Users } from "lucide-react"
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
  notes: z.string().optional(),
})

type TeamFormValues = z.infer<typeof teamSchema>

export default function Teams() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: teams = [], isLoading } = useListTeams()
  
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)

  const createMutation = useCreateTeam()
  const updateMutation = useUpdateTeam()
  const deleteMutation = useDeleteTeam()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema)
  })

  const openAddModal = () => {
    setEditingTeam(null)
    reset({ name: "", category: "Women 35+", managerName: "", managerEmail: "", managerPhone: "", notes: "" })
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
    } catch {
      toast({ title: "Failed to delete team", variant: "destructive" })
    }
  }

  const onSubmit = async (data: TeamFormValues) => {
    try {
      if (editingTeam) {
        await updateMutation.mutateAsync({ id: editingTeam.id, data })
        toast({ title: "Team updated successfully" })
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
        <Button onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" /> Add Team
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
          {[1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-2xl border border-border"></div>)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teams.map(team => (
            <div key={team.id} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow flex flex-col group">
              <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent relative">
                <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex space-x-2">
                  <button onClick={() => openEditModal(team)} className="p-1.5 bg-white rounded-md shadow text-blue-600 hover:bg-blue-50 transition-colors">
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(team.id)} className="p-1.5 bg-white rounded-md shadow text-rose-600 hover:bg-rose-50 transition-colors">
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
                  <a href={`mailto:${team.managerEmail}`} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Mail className="w-4 h-4 mr-3" /> {team.managerEmail}
                  </a>
                  <a href={`tel:${team.managerPhone}`} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                    <Phone className="w-4 h-4 mr-3" /> {team.managerPhone}
                  </a>
                </div>
                {team.notes && (
                  <div className="mt-auto pt-4 border-t border-border">
                    <p className="text-sm italic text-muted-foreground line-clamp-2">{team.notes}</p>
                  </div>
                )}
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
            <h4 className="text-sm font-bold text-primary uppercase tracking-wider">Manager Details</h4>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Full Name</label>
              <Input placeholder="Manager Name" {...register("managerName")} />
              {errors.managerName && <p className="text-xs text-destructive">{errors.managerName.message}</p>}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">Email</label>
                <Input type="email" placeholder="manager@example.com" {...register("managerEmail")} />
                {errors.managerEmail && <p className="text-xs text-destructive">{errors.managerEmail.message}</p>}
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Phone</label>
                <Input placeholder="+852 XXXX XXXX" {...register("managerPhone")} />
                {errors.managerPhone && <p className="text-xs text-destructive">{errors.managerPhone.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <label className="text-sm font-semibold">Notes (Optional)</label>
            <textarea 
              className="flex w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all min-h-[100px]"
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
