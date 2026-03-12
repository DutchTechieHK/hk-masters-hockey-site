import { useState } from "react"
import { useListKits, useCreateKit, useUpdateKit, useDeleteKit, getListKitsQueryKey, useListPlayers } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Package, Shirt, ShoppingBag, Briefcase, Star } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { KitOrder } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const CATEGORIES = [
  { value: "playing_kit", label: "Playing Kit", icon: Shirt, color: "bg-green-100 text-green-800" },
  { value: "training_kit", label: "Training Kit", icon: Shirt, color: "bg-blue-100 text-blue-800" },
  { value: "travel_leisure_kit", label: "Travel/Leisure Kit", icon: Briefcase, color: "bg-purple-100 text-purple-800" },
  { value: "accessories", label: "Accessories", icon: Star, color: "bg-amber-100 text-amber-800" },
] as const

const STATUS_INFO = {
  not_ordered: { color: "bg-slate-100 text-slate-700", label: "Not Ordered" },
  ordered: { color: "bg-blue-100 text-blue-800", label: "Ordered" },
  received: { color: "bg-amber-100 text-amber-800", label: "Received" },
  distributed: { color: "bg-emerald-100 text-emerald-800", label: "Distributed" },
}

const kitSchema = z.object({
  playerId: z.coerce.number().min(1, "Player selection is required"),
  itemType: z.enum(["playing_kit", "training_kit", "travel_leisure_kit", "accessories"]),
  itemName: z.string().min(1, "Item name is required"),
  size: z.string().min(1, "Size is required"),
  quantity: z.coerce.number().min(1),
  unitCost: z.coerce.number().min(0),
  supplier: z.string().optional(),
  orderStatus: z.enum(["not_ordered", "ordered", "received", "distributed"]),
  notes: z.string().optional(),
})

type KitFormValues = z.infer<typeof kitSchema>

export default function Kits() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: players = [] } = useListPlayers()
  const { data: kits = [], isLoading } = useListKits()

  const [categoryFilter, setCategoryFilter] = useState<string>("all")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingKit, setEditingKit] = useState<KitOrder | null>(null)

  const createMutation = useCreateKit()
  const updateMutation = useUpdateKit()
  const deleteMutation = useDeleteKit()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<KitFormValues>({
    resolver: zodResolver(kitSchema)
  })

  const qty = watch("quantity") || 1
  const unitCost = watch("unitCost") || 0
  const totalPreview = (Number(qty) || 1) * (Number(unitCost) || 0)

  const filteredKits = categoryFilter === "all" ? kits : kits.filter(k => k.itemType === categoryFilter)

  const openAddModal = () => {
    setEditingKit(null)
    reset({
      playerId: players.length > 0 ? players[0].id : 0,
      itemType: "playing_kit",
      itemName: "",
      size: "",
      quantity: 1,
      unitCost: 0,
      supplier: "",
      orderStatus: "not_ordered",
      notes: ""
    })
    setIsModalOpen(true)
  }

  const openEditModal = (kit: KitOrder) => {
    setEditingKit(kit)
    reset({
      playerId: kit.playerId,
      itemType: kit.itemType,
      itemName: kit.itemName,
      size: kit.size,
      quantity: kit.quantity,
      unitCost: kit.unitCost,
      supplier: kit.supplier || "",
      orderStatus: kit.orderStatus,
      notes: kit.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this kit order?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListKitsQueryKey() })
      toast({ title: "Order deleted" })
    } catch {
      toast({ title: "Failed to delete order", variant: "destructive" })
    }
  }

  const onSubmit = async (data: KitFormValues) => {
    try {
      if (editingKit) {
        await updateMutation.mutateAsync({ id: editingKit.id, data })
        toast({ title: "Order updated" })
      } else {
        await createMutation.mutateAsync({ data })
        toast({ title: "Order created" })
      }
      queryClient.invalidateQueries({ queryKey: getListKitsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  // Summary calculations per category
  const categorySummary = CATEGORIES.map(cat => {
    const items = kits.filter(k => k.itemType === cat.value)
    const total = items.reduce((sum, k) => sum + (k.totalCost || 0), 0)
    return { ...cat, count: items.length, total }
  })
  const grandTotal = kits.reduce((sum, k) => sum + (k.totalCost || 0), 0)

  return (
    <PageLayout
      title="Kits & Clothing"
      description="Track all kit orders, sizes, costs, and delivery status by category."
      action={
        <Button onClick={openAddModal} disabled={players.length === 0}>
          <Plus className="w-5 h-5 mr-2" /> Add Order
        </Button>
      }
    >
      <div className="space-y-8">

        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categorySummary.map(cat => {
            const Icon = cat.icon
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value === categoryFilter ? "all" : cat.value)}
                className={`text-left bg-white rounded-2xl p-5 border shadow-sm transition-all hover:shadow-md ${
                  categoryFilter === cat.value ? "border-primary ring-2 ring-primary/20" : "border-border"
                }`}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${cat.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="font-semibold text-sm">{cat.label}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{formatCurrency(cat.total)}</p>
                <p className="text-sm text-muted-foreground mt-0.5">{cat.count} item{cat.count !== 1 ? 's' : ''}</p>
              </button>
            )
          })}
        </div>

        {/* Total budget bar */}
        <div className="bg-white rounded-2xl border border-border p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Total Kit Budget</p>
            <p className="text-3xl font-bold text-primary">{formatCurrency(grandTotal)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(STATUS_INFO) as Array<[keyof typeof STATUS_INFO, typeof STATUS_INFO[keyof typeof STATUS_INFO]]>).map(([key, { color, label }]) => {
              const count = kits.filter(k => k.orderStatus === key).length
              return (
                <div key={key} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium ${color}`}>
                  <span>{label}</span>
                  <span className="font-bold">{count}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Category filter pill tabs */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              categoryFilter === "all" ? "bg-primary text-white shadow-sm" : "bg-white border border-border hover:bg-muted/50"
            }`}
          >
            All ({kits.length})
          </button>
          {CATEGORIES.map(cat => (
            <button
              key={cat.value}
              onClick={() => setCategoryFilter(cat.value === categoryFilter ? "all" : cat.value)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                categoryFilter === cat.value ? "bg-primary text-white shadow-sm" : "bg-white border border-border hover:bg-muted/50"
              }`}
            >
              {cat.label} ({kits.filter(k => k.itemType === cat.value).length})
            </button>
          ))}
        </div>

        {/* Orders table */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-4 font-semibold">Player / Team</th>
                  <th className="px-5 py-4 font-semibold">Item</th>
                  <th className="px-5 py-4 font-semibold hidden sm:table-cell">Category</th>
                  <th className="px-5 py-4 font-semibold hidden md:table-cell">Size</th>
                  <th className="px-5 py-4 font-semibold text-right">Qty × Cost</th>
                  <th className="px-5 py-4 font-semibold hidden lg:table-cell">Supplier</th>
                  <th className="px-5 py-4 font-semibold">Status</th>
                  <th className="px-5 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={8} className="px-6 py-8 text-center text-muted-foreground">Loading orders...</td></tr>
                ) : filteredKits.length === 0 ? (
                  <tr><td colSpan={8} className="px-6 py-12 text-center text-muted-foreground">
                    {kits.length === 0 ? "No kit orders yet. Add the first one!" : "No orders in this category."}
                  </td></tr>
                ) : (
                  filteredKits.map(kit => {
                    const catInfo = CATEGORIES.find(c => c.value === kit.itemType)
                    const statusInfo = STATUS_INFO[kit.orderStatus as keyof typeof STATUS_INFO] ?? STATUS_INFO.not_ordered
                    return (
                      <tr key={kit.id} className="hover:bg-muted/10 transition-colors group">
                        <td className="px-5 py-4">
                          <div className="font-bold text-foreground">{kit.playerName ?? '—'}</div>
                          <div className="text-xs text-muted-foreground">{kit.teamName ?? ''}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-semibold text-foreground">{kit.itemName}</div>
                          <div className="text-xs text-muted-foreground sm:hidden">{catInfo?.label}</div>
                        </td>
                        <td className="px-5 py-4 hidden sm:table-cell">
                          {catInfo && (
                            <Badge className={`${catInfo.color} border-0 shadow-none`}>{catInfo.label}</Badge>
                          )}
                        </td>
                        <td className="px-5 py-4 hidden md:table-cell">
                          <span className="border px-2 py-0.5 rounded bg-muted/50 font-mono text-sm">{kit.size}</span>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="text-sm">{kit.quantity} × {formatCurrency(kit.unitCost)}</div>
                          <div className="font-bold text-primary mt-0.5">{formatCurrency(kit.totalCost)}</div>
                        </td>
                        <td className="px-5 py-4 hidden lg:table-cell text-muted-foreground text-sm">
                          {kit.supplier || <span className="text-xs">—</span>}
                        </td>
                        <td className="px-5 py-4">
                          <Badge className={`${statusInfo.color} border-0 shadow-none whitespace-nowrap`}>
                            {statusInfo.label}
                          </Badge>
                        </td>
                        <td className="px-5 py-4 text-right">
                          <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEditModal(kit)} className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background shadow-sm border transition-all">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={() => handleDelete(kit.id)} className="p-2 text-muted-foreground hover:text-rose-600 rounded bg-background shadow-sm border transition-all">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingKit ? "Edit Order" : "New Kit Order"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Player</label>
            <Select {...register("playerId")}>
              {players.map(p => <option key={p.id} value={p.id}>{p.name} ({p.teamName})</option>)}
            </Select>
            {errors.playerId && <p className="text-xs text-destructive">{errors.playerId.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Category</label>
              <Select {...register("itemType")}>
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Item Name *</label>
              <Input {...register("itemName")} placeholder="e.g. Match Shirt, Training Top..." />
              {errors.itemName && <p className="text-xs text-destructive">{errors.itemName.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Size *</label>
              <Input {...register("size")} placeholder="S / M / L / XL" />
              {errors.size && <p className="text-xs text-destructive">{errors.size.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Supplier</label>
              <Input {...register("supplier")} placeholder="e.g. Gryphon HK" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Quantity</label>
              <Input type="number" min="1" {...register("quantity")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Unit Cost (HKD)</label>
              <Input type="number" step="0.01" min="0" {...register("unitCost")} />
            </div>
          </div>

          {/* Total preview */}
          <div className="flex justify-between items-center bg-primary/5 rounded-xl px-4 py-3 border border-primary/20">
            <span className="text-sm font-medium text-primary">Total Cost</span>
            <span className="text-lg font-bold text-primary">{formatCurrency(totalPreview)}</span>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Order Status</label>
            <Select {...register("orderStatus")}>
              <option value="not_ordered">Not Ordered</option>
              <option value="ordered">Ordered</option>
              <option value="received">Received</option>
              <option value="distributed">Distributed</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes</label>
            <Input {...register("notes")} placeholder="Special requests, colour preferences..." />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingKit ? "Update Order" : "Add Order"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
