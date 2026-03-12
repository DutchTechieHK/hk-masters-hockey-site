import { useState } from "react"
import { useListKits, useCreateKit, useUpdateKit, useDeleteKit, getListKitsQueryKey, useListPlayers } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Package } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { KitOrder } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const kitSchema = z.object({
  playerId: z.coerce.number().min(1, "Player selection is required"),
  itemType: z.enum(["playing_kit", "training_kit", "travel_leisure_kit"]),
  size: z.string().min(1, "Size is required"),
  quantity: z.coerce.number().min(1),
  unitCost: z.coerce.number().min(0),
  orderStatus: z.enum(["pending", "ordered", "delivered"]),
  notes: z.string().optional()
})

type KitFormValues = z.infer<typeof kitSchema>

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  ordered: "bg-blue-100 text-blue-800",
  delivered: "bg-emerald-100 text-emerald-800"
}

export default function Kits() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  
  const { data: players = [] } = useListPlayers()
  const { data: kits = [], isLoading } = useListKits()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingKit, setEditingKit] = useState<KitOrder | null>(null)

  const createMutation = useCreateKit()
  const updateMutation = useUpdateKit()
  const deleteMutation = useDeleteKit()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<KitFormValues>({
    resolver: zodResolver(kitSchema)
  })

  const openAddModal = () => {
    setEditingKit(null)
    reset({ 
      playerId: players.length > 0 ? players[0].id : 0, 
      itemType: "playing_kit", 
      size: "", 
      quantity: 1, 
      unitCost: 0, 
      orderStatus: "pending", 
      notes: "" 
    })
    setIsModalOpen(true)
  }

  const openEditModal = (kit: KitOrder) => {
    setEditingKit(kit)
    reset({
      playerId: kit.playerId,
      itemType: kit.itemType,
      size: kit.size,
      quantity: kit.quantity,
      unitCost: kit.unitCost,
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
      toast({ title: "Order deleted successfully" })
    } catch {
      toast({ title: "Failed to delete order", variant: "destructive" })
    }
  }

  const onSubmit = async (data: KitFormValues) => {
    try {
      if (editingKit) {
        await updateMutation.mutateAsync({ id: editingKit.id, data })
        toast({ title: "Order updated successfully" })
      } else {
        await createMutation.mutateAsync({ data })
        toast({ title: "Order created successfully" })
      }
      queryClient.invalidateQueries({ queryKey: getListKitsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  return (
    <PageLayout
      title="Kit & Clothing Orders"
      description="Track uniform, training, and leisure wear orders for all players."
      action={
        <Button onClick={openAddModal} disabled={players.length === 0}>
          <Plus className="w-5 h-5 mr-2" /> Add Order
        </Button>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Summary sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border">
            <div className="w-12 h-12 bg-primary/10 text-primary rounded-xl flex items-center justify-center mb-4">
              <Package className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold font-display mb-1">Total Orders</h3>
            <p className="text-3xl font-bold text-primary">{kits.length}</p>
          </div>
          
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-border space-y-4">
            <h4 className="font-semibold text-muted-foreground uppercase text-xs tracking-wider">Status Breakdown</h4>
            <div className="space-y-3">
              {(["pending", "ordered", "delivered"] as const).map(status => {
                const count = kits.filter(k => k.orderStatus === status).length
                return (
                  <div key={status} className="flex justify-between items-center">
                    <Badge className={STATUS_COLORS[status] + " capitalize border-0 shadow-none"}>{status}</Badge>
                    <span className="font-bold">{count}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Table Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold">Player</th>
                  <th className="px-6 py-4 font-semibold">Item & Size</th>
                  <th className="px-6 py-4 font-semibold text-right">Qty x Cost</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={5} className="px-6 py-8 text-center text-muted-foreground">Loading orders...</td></tr>
                ) : kits.length === 0 ? (
                  <tr><td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">No orders found.</td></tr>
                ) : (
                  kits.map(kit => (
                    <tr key={kit.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground">{kit.playerName}</div>
                        <div className="text-xs text-muted-foreground">{kit.teamName}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium capitalize text-primary">{kit.itemType.replace(/_/g, ' ')}</div>
                        <div className="text-xs mt-1"><span className="text-muted-foreground">Size:</span> <span className="font-bold border px-1.5 py-0.5 rounded bg-muted/50">{kit.size}</span></div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div>{kit.quantity} <span className="text-muted-foreground text-xs mx-1">x</span> {formatCurrency(kit.unitCost)}</div>
                        <div className="font-bold text-primary mt-1 border-t border-dashed inline-block pt-1">{formatCurrency(kit.totalCost)}</div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge className={STATUS_COLORS[kit.orderStatus] + " capitalize border-0 shadow-none"}>
                          {kit.orderStatus}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
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
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingKit ? "Edit Order" : "New Order"}>
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
              <label className="text-sm font-semibold">Item Type</label>
              <Select {...register("itemType")}>
                <option value="playing_kit">Playing Kit</option>
                <option value="training_kit">Training Kit</option>
                <option value="travel_leisure_kit">Travel/Leisure Kit</option>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Size</label>
              <Input {...register("size")} placeholder="e.g. L" />
              {errors.size && <p className="text-xs text-destructive">{errors.size.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Quantity</label>
              <Input type="number" min="1" {...register("quantity")} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Unit Cost (HKD)</label>
              <Input type="number" step="0.01" min="0" {...register("unitCost")} />
              {errors.unitCost && <p className="text-xs text-destructive">{errors.unitCost.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Order Status</label>
            <Select {...register("orderStatus")}>
              <option value="pending">Pending</option>
              <option value="ordered">Ordered</option>
              <option value="delivered">Delivered</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes</label>
            <Input {...register("notes")} placeholder="Special requests..." />
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
