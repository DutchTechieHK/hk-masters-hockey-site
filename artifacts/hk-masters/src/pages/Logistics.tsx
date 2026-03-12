import { useState } from "react"
import { useListLogistics, useCreateLogisticsTask, useUpdateLogisticsTask, useDeleteLogisticsTask, getListLogisticsQueryKey, useListTeams } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Calendar, CheckCircle2, Clock, Circle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { LogisticsTask } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"

const taskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  teamId: z.coerce.number().optional().nullable(),
  category: z.enum(["travel", "accommodation", "flights", "visas", "insurance", "tournament_registration", "other"]),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional()
})

type TaskFormValues = z.infer<typeof taskSchema>

const STATUS_ICONS = {
  todo: <Circle className="w-5 h-5 text-slate-300" />,
  in_progress: <Clock className="w-5 h-5 text-amber-500" />,
  done: <CheckCircle2 className="w-5 h-5 text-emerald-500" />
}

export default function Logistics() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const { data: teams = [] } = useListTeams()
  const { data: tasks = [], isLoading } = useListLogistics()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<LogisticsTask | null>(null)

  const createMutation = useCreateLogisticsTask()
  const updateMutation = useUpdateLogisticsTask()
  const deleteMutation = useDeleteLogisticsTask()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema)
  })

  const openAddModal = () => {
    setEditingTask(null)
    reset({ 
      title: "", teamId: null, category: "travel", 
      status: "todo", dueDate: "", assignedTo: "", notes: "" 
    })
    setIsModalOpen(true)
  }

  const openEditModal = (task: LogisticsTask) => {
    setEditingTask(task)
    reset({
      title: task.title,
      teamId: task.teamId || null,
      category: task.category,
      status: task.status,
      dueDate: task.dueDate ? task.dueDate.split('T')[0] : "",
      assignedTo: task.assignedTo || "",
      notes: task.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this task?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListLogisticsQueryKey() })
      toast({ title: "Task deleted successfully" })
    } catch {
      toast({ title: "Failed to delete task", variant: "destructive" })
    }
  }

  const onSubmit = async (data: TaskFormValues) => {
    try {
      const payload = { ...data, teamId: data.teamId === 0 || !data.teamId ? undefined : data.teamId }
      if (editingTask) {
        await updateMutation.mutateAsync({ id: editingTask.id, data: payload as any })
        toast({ title: "Task updated" })
      } else {
        await createMutation.mutateAsync({ data: payload as any })
        toast({ title: "Task created" })
      }
      queryClient.invalidateQueries({ queryKey: getListLogisticsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const tasksByStatus = {
    todo: tasks.filter(t => t.status === "todo"),
    in_progress: tasks.filter(t => t.status === "in_progress"),
    done: tasks.filter(t => t.status === "done")
  }

  return (
    <PageLayout
      title="Logistics & Planning"
      description="Manage flights, accommodation, visas, and tournament registrations."
      action={
        <Button onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" /> Add Task
        </Button>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Columns mapping */}
        {(["todo", "in_progress", "done"] as const).map(status => (
          <div key={status} className="bg-muted/40 rounded-2xl p-4 border border-border/50 flex flex-col h-[calc(100vh-250px)]">
            <div className="flex items-center justify-between mb-4 px-2">
              <h3 className="font-bold font-display uppercase tracking-wider text-foreground flex items-center gap-2">
                {STATUS_ICONS[status]} 
                {status.replace('_', ' ')}
              </h3>
              <Badge variant="secondary" className="rounded-full px-2 shadow-none">{tasksByStatus[status].length}</Badge>
            </div>
            
            <div className="flex-1 overflow-y-auto space-y-3 pr-2 pb-2">
              {isLoading && status === "todo" && <div className="text-center p-4 text-muted-foreground">Loading...</div>}
              {tasksByStatus[status].map(task => (
                <div key={task.id} className="bg-card rounded-xl p-4 shadow-sm border border-border hover:border-primary/30 transition-colors group cursor-pointer relative" onClick={() => openEditModal(task)}>
                  
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className="text-[10px] uppercase">{task.category.replace('_', ' ')}</Badge>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(task.id); }} className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  
                  <h4 className="font-bold text-foreground mb-1 leading-tight">{task.title}</h4>
                  <p className="text-xs text-primary font-medium mb-3">{task.teamName || 'All Teams'}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/50 text-xs text-muted-foreground">
                    <div className="flex items-center">
                      {task.dueDate ? (
                        <>
                          <Calendar className="w-3.5 h-3.5 mr-1" />
                          {format(parseISO(task.dueDate), 'MMM d')}
                        </>
                      ) : (
                        <span>No date</span>
                      )}
                    </div>
                    {task.assignedTo && (
                      <div className="flex items-center bg-muted px-2 py-1 rounded-md">
                        {task.assignedTo}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {!isLoading && tasksByStatus[status].length === 0 && (
                <div className="h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
                  Empty
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? "Edit Task" : "New Task"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Title</label>
            <Input {...register("title")} placeholder="Book flights to Amsterdam" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Category</label>
              <Select {...register("category")}>
                <option value="travel">Travel</option>
                <option value="flights">Flights</option>
                <option value="accommodation">Accommodation</option>
                <option value="visas">Visas</option>
                <option value="insurance">Insurance</option>
                <option value="tournament_registration">Tournament Registration</option>
                <option value="other">Other</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Team (Optional)</label>
              <Select {...register("teamId")}>
                <option value="0">All Teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Status</label>
              <Select {...register("status")}>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="done">Done</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Due Date</label>
              <Input type="date" {...register("dueDate")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Assigned To</label>
              <Input {...register("assignedTo")} placeholder="Name" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes</label>
            <textarea 
              className="flex w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all min-h-[80px]"
              placeholder="Links, booking references..."
              {...register("notes")}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingTask ? "Update Task" : "Create Task"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
