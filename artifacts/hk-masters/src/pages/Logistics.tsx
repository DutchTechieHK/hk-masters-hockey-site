import { useState } from "react"
import { useListLogistics, useCreateLogisticsTask, useUpdateLogisticsTask, useDeleteLogisticsTask, getListLogisticsQueryKey, useListTeams } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Calendar, CheckCircle2, Clock, Circle, Plane, Building2, Trophy, Package, DollarSign, MoreHorizontal } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { LogisticsTask } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"

const CATEGORIES = [
  { value: "travel", label: "Travel", icon: Plane, color: "bg-sky-100 text-sky-800 border-sky-200" },
  { value: "accommodation", label: "Accommodation", icon: Building2, color: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "tournament", label: "Tournament", icon: Trophy, color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "kits_equipment", label: "Kits & Equipment", icon: Package, color: "bg-green-100 text-green-800 border-green-200" },
  { value: "finance", label: "Finance", icon: DollarSign, color: "bg-rose-100 text-rose-800 border-rose-200" },
  { value: "other", label: "Other", icon: MoreHorizontal, color: "bg-slate-100 text-slate-700 border-slate-200" },
] as const

const taskSchema = z.object({
  title: z.string().min(1, "Task title is required"),
  teamId: z.coerce.number().optional().nullable(),
  category: z.enum(["travel", "accommodation", "tournament", "kits_equipment", "finance", "other"]),
  status: z.enum(["todo", "in_progress", "done"]),
  dueDate: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional()
})

type TaskFormValues = z.infer<typeof taskSchema>

const STATUS_CONFIG = {
  todo: { icon: <Circle className="w-5 h-5 text-slate-400" />, label: "To Do", bg: "bg-slate-50", border: "border-slate-200" },
  in_progress: { icon: <Clock className="w-5 h-5 text-amber-500" />, label: "In Progress", bg: "bg-amber-50/50", border: "border-amber-200" },
  done: { icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, label: "Done", bg: "bg-emerald-50/50", border: "border-emerald-200" },
}

function getCategoryInfo(value: string) {
  return CATEGORIES.find(c => c.value === value) ?? CATEGORIES[CATEGORIES.length - 1]
}

export default function Logistics() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: teams = [] } = useListTeams()
  const { data: tasks = [], isLoading } = useListLogistics()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<LogisticsTask | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string>("all")

  const createMutation = useCreateLogisticsTask()
  const updateMutation = useUpdateLogisticsTask()
  const deleteMutation = useDeleteLogisticsTask()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TaskFormValues>({
    resolver: zodResolver(taskSchema)
  })

  const openAddModal = (defaultCategory?: string) => {
    setEditingTask(null)
    reset({
      title: "",
      teamId: null,
      category: (defaultCategory as any) ?? "travel",
      status: "todo",
      dueDate: "",
      assignedTo: "",
      notes: ""
    })
    setIsModalOpen(true)
  }

  const openEditModal = (task: LogisticsTask) => {
    setEditingTask(task)
    reset({
      title: task.title,
      teamId: task.teamId || null,
      category: task.category as any,
      status: task.status as any,
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
      toast({ title: "Task deleted" })
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

  const filteredTasks = categoryFilter === "all" ? tasks : tasks.filter(t => t.category === categoryFilter)

  const tasksByStatus = {
    todo: filteredTasks.filter(t => t.status === "todo"),
    in_progress: filteredTasks.filter(t => t.status === "in_progress"),
    done: filteredTasks.filter(t => t.status === "done"),
  }

  return (
    <PageLayout
      title="Logistics & Planning"
      description="Plan and track flights, accommodation, tournament logistics, and finances."
      action={
        <Button onClick={() => openAddModal()}>
          <Plus className="w-5 h-5 mr-2" /> Add Task
        </Button>
      }
    >
      {/* Category filter pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
            categoryFilter === "all" ? "bg-primary text-white shadow-sm" : "bg-white border border-border hover:bg-muted/50"
          }`}
        >
          All ({tasks.length})
        </button>
        {CATEGORIES.map(cat => {
          const Icon = cat.icon
          const count = tasks.filter(t => t.category === cat.value).length
          return (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value === categoryFilter ? "all" : cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all flex items-center gap-2 ${
                categoryFilter === cat.value ? "bg-primary text-white shadow-sm" : "bg-white border border-border hover:bg-muted/50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat.label} ({count})
            </button>
          )
        })}
      </div>

      {/* Kanban board */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {(["todo", "in_progress", "done"] as const).map(status => {
          const config = STATUS_CONFIG[status]
          return (
            <div key={status} className={`rounded-2xl p-4 border ${config.border} ${config.bg} flex flex-col`} style={{ minHeight: "500px" }}>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="font-bold font-display uppercase tracking-wider text-foreground flex items-center gap-2">
                  {config.icon}
                  {config.label}
                </h3>
                <Badge variant="secondary" className="rounded-full px-2 shadow-none">{tasksByStatus[status].length}</Badge>
              </div>

              <div className="flex-1 overflow-y-auto space-y-3 pr-1 pb-2">
                {isLoading && status === "todo" && (
                  <div className="text-center p-4 text-muted-foreground text-sm">Loading...</div>
                )}
                {tasksByStatus[status].map(task => {
                  const catInfo = getCategoryInfo(task.category)
                  const CatIcon = catInfo.icon
                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-xl p-4 shadow-sm border border-border hover:border-primary/30 transition-colors group cursor-pointer relative"
                      onClick={() => openEditModal(task)}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-semibold border ${catInfo.color}`}>
                          <CatIcon className="w-3 h-3" />
                          {catInfo.label}
                        </div>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(task.id) }}
                          className="text-muted-foreground hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <h4 className="font-bold text-foreground mb-1 leading-tight text-sm">{task.title}</h4>
                      <p className="text-xs text-primary font-medium">{task.teamName || 'All Teams'}</p>

                      {task.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{task.notes}</p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          {task.dueDate ? (
                            <>
                              <Calendar className="w-3.5 h-3.5" />
                              <span className="font-medium">{format(parseISO(task.dueDate), 'MMM d, yyyy')}</span>
                            </>
                          ) : (
                            <span>No due date</span>
                          )}
                        </div>
                        {task.assignedTo && (
                          <span className="bg-muted px-2 py-0.5 rounded font-medium text-xs">{task.assignedTo}</span>
                        )}
                      </div>
                    </div>
                  )
                })}
                {!isLoading && tasksByStatus[status].length === 0 && (
                  <div className="h-24 rounded-xl border-2 border-dashed border-border flex items-center justify-center text-muted-foreground text-sm">
                    No tasks here
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingTask ? "Edit Task" : "New Task"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Task Title *</label>
            <Input {...register("title")} placeholder="e.g. Book flights to Rotterdam" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Category</label>
              <Select {...register("category")}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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
              placeholder="Links, booking references, instructions..."
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
