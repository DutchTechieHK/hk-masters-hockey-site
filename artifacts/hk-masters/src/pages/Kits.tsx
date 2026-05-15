import { useState, useEffect } from "react"
import * as XLSX from "xlsx"
import {
  useListKits, useCreateKit, useUpdateKit, useDeleteKit, getListKitsQueryKey,
  useListPlayers,
  useListKitDistributions, useUpsertKitDistribution, useDeleteKitDistribution,
  getListKitDistributionsQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Download, AlertTriangle, CheckCircle2, Package } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { KitOrder } from "@workspace/api-client-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"

const ITEM_TYPES = [
  { value: "playing_kit", label: "Playing Kit" },
  { value: "training_kit", label: "Training Kit" },
  { value: "travel_leisure_kit", label: "Travel/Leisure Kit" },
  { value: "accessories", label: "Accessories" },
] as const

const ORDER_STATUSES = [
  { value: "not_ordered", label: "Not Ordered", color: "bg-slate-100 text-slate-700" },
  { value: "artwork_pending", label: "Artwork Pending", color: "bg-amber-100 text-amber-800" },
  { value: "artwork_approved", label: "Artwork Approved", color: "bg-blue-100 text-blue-800" },
  { value: "ordered", label: "Ordered", color: "bg-indigo-100 text-indigo-800" },
  { value: "in_production", label: "In Production", color: "bg-purple-100 text-purple-800" },
  { value: "dispatched", label: "Dispatched", color: "bg-orange-100 text-orange-800" },
  { value: "received", label: "Received", color: "bg-emerald-100 text-emerald-800" },
] as const

const GARMENTS = [
  { key: "shirtSize", label: "Shirt" },
  { key: "shortsSize", label: "Shorts" },
  { key: "jacketSize", label: "Jacket" },
  { key: "poloSize", label: "Polo" },
  { key: "trackTopSize", label: "Track Top" },
  { key: "goalieSmockSize", label: "GK Smock" },
] as const

type GarmentKey = typeof GARMENTS[number]["key"]

const DEFAULT_SUPPLIERS: Record<string, string> = {
  playing_kit: "Kukri",
  training_kit: "",
  travel_leisure_kit: "",
  accessories: "",
}

function derivePaymentStatus(order: KitOrder): { label: string; color: string } {
  if (!order.unitCostHKD || order.totalCostHKD === 0) return { label: "N/A", color: "bg-slate-100 text-slate-500" }
  if (order.balancePaidDate) return { label: "Fully Paid", color: "bg-emerald-100 text-emerald-800" }
  if (order.depositPaidDate) {
    const depositCoversAll =
      !order.depositAmountHKD || Number(order.depositAmountHKD) >= Number(order.totalCostHKD)
    return depositCoversAll
      ? { label: "Deposit Paid", color: "bg-blue-100 text-blue-700" }
      : { label: "Balance Due", color: "bg-amber-100 text-amber-800" }
  }
  return { label: "Deposit Due", color: "bg-rose-100 text-rose-700" }
}

const kitSchema = z.object({
  itemName: z.string().min(1, "Item name is required"),
  itemType: z.enum(["playing_kit", "training_kit", "travel_leisure_kit", "accessories"]),
  supplier: z.string().optional(),
  quantity: z.coerce.number().min(1),
  unitCostHKD: z.coerce.number().min(0),
  depositAmountHKD: z.coerce.number().min(0).optional().or(z.literal("")),
  depositPaidDate: z.string().optional(),
  balanceDueDate: z.string().optional(),
  balancePaidDate: z.string().optional(),
  orderPlacedDate: z.string().optional(),
  artworkApprovedDate: z.string().optional(),
  expectedDeliveryDate: z.string().optional(),
  actualDeliveryDate: z.string().optional(),
  orderStatus: z.enum(["not_ordered", "artwork_pending", "artwork_approved", "ordered", "in_production", "dispatched", "received"]),
  notes: z.string().optional(),
})

type KitFormValues = z.infer<typeof kitSchema>

type ActiveTab = "orders" | "sizing" | "summary" | "distribution"

export default function Kits() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [activeTab, setActiveTab] = useState<ActiveTab>("orders")
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<KitOrder | null>(null)

  const { data: players = [] } = useListPlayers()
  const { data: orders = [], isLoading } = useListKits()
  const { data: distributions = [] } = useListKitDistributions()

  const createMutation = useCreateKit()
  const updateMutation = useUpdateKit()
  const deleteMutation = useDeleteKit()
  const upsertDistMutation = useUpsertKitDistribution()
  const deleteDistMutation = useDeleteKitDistribution()

  const { register, handleSubmit, reset, watch, setValue, formState: { errors, isSubmitting } } = useForm<KitFormValues>({
    resolver: zodResolver(kitSchema),
  })

  const watchedItemType = watch("itemType")
  const watchedQty = watch("quantity") || 1
  const watchedUnit = watch("unitCostHKD") || 0
  const totalPreview = (Number(watchedQty) || 1) * (Number(watchedUnit) || 0)

  useEffect(() => {
    if (editingOrder) return
    const defaultSupplier = DEFAULT_SUPPLIERS[watchedItemType] ?? ""
    setValue("supplier", defaultSupplier)
  }, [watchedItemType, editingOrder])

  const openAddModal = () => {
    setEditingOrder(null)
    reset({
      itemName: "",
      itemType: "playing_kit",
      supplier: "Kukri",
      quantity: 1,
      unitCostHKD: 0,
      depositAmountHKD: "" as unknown as number,
      depositPaidDate: "",
      balanceDueDate: "",
      balancePaidDate: "",
      orderPlacedDate: "",
      artworkApprovedDate: "",
      expectedDeliveryDate: "",
      actualDeliveryDate: "",
      orderStatus: "not_ordered",
      notes: "",
    })
    setIsModalOpen(true)
  }

  const openEditModal = (order: KitOrder) => {
    setEditingOrder(order)
    reset({
      itemName: order.itemName,
      itemType: order.itemType as KitFormValues["itemType"],
      supplier: order.supplier || "",
      quantity: order.quantity,
      unitCostHKD: order.unitCostHKD,
      depositAmountHKD: order.depositAmountHKD ?? ("" as unknown as number),
      depositPaidDate: order.depositPaidDate || "",
      balanceDueDate: order.balanceDueDate || "",
      balancePaidDate: order.balancePaidDate || "",
      orderPlacedDate: order.orderPlacedDate || "",
      artworkApprovedDate: order.artworkApprovedDate || "",
      expectedDeliveryDate: order.expectedDeliveryDate || "",
      actualDeliveryDate: order.actualDeliveryDate || "",
      orderStatus: order.orderStatus as KitFormValues["orderStatus"],
      notes: order.notes || "",
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this order?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListKitsQueryKey() })
      toast({ title: "Order deleted" })
    } catch {
      toast({ title: "Failed to delete order", variant: "destructive" })
    }
  }

  const onSubmit = async (data: KitFormValues) => {
    const payload = {
      ...data,
      depositAmountHKD: data.depositAmountHKD === "" || data.depositAmountHKD === undefined ? undefined : Number(data.depositAmountHKD),
      depositPaidDate: data.depositPaidDate || undefined,
      balanceDueDate: data.balanceDueDate || undefined,
      balancePaidDate: data.balancePaidDate || undefined,
      orderPlacedDate: data.orderPlacedDate || undefined,
      artworkApprovedDate: data.artworkApprovedDate || undefined,
      expectedDeliveryDate: data.expectedDeliveryDate || undefined,
      actualDeliveryDate: data.actualDeliveryDate || undefined,
      supplier: data.supplier || undefined,
      notes: data.notes || undefined,
    }
    try {
      if (editingOrder) {
        await updateMutation.mutateAsync({ id: editingOrder.id, data: payload })
        toast({ title: "Order updated" })
      } else {
        await createMutation.mutateAsync({ data: payload })
        toast({ title: "Order added" })
      }
      queryClient.invalidateQueries({ queryKey: getListKitsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  // Distribution helpers
  const receivedItemTypes = [...new Set(
    orders.filter(o => o.orderStatus === "received").map(o => o.itemType)
  )]

  const isCollected = (playerId: number, itemType: string) =>
    distributions.some(d => d.playerId === playerId && d.itemType === itemType)

  const toggleCollection = async (playerId: number, itemType: string) => {
    try {
      if (isCollected(playerId, itemType)) {
        await deleteDistMutation.mutateAsync({ playerId, itemType })
      } else {
        await upsertDistMutation.mutateAsync({ playerId, itemType, data: {} })
      }
      queryClient.invalidateQueries({ queryKey: getListKitDistributionsQueryKey() })
    } catch {
      toast({ title: "Failed to update collection status", variant: "destructive" })
    }
  }

  // Export Orders to Excel
  const exportOrders = () => {
    const header = ["Item", "Category", "Supplier", "Qty", "Unit Cost (HKD)", "Total (HKD)",
      "Deposit (HKD)", "Deposit Paid", "Balance Due Date", "Balance Paid", "Order Placed",
      "Artwork Approved", "Expected Delivery", "Actual Delivery", "Order Status", "Payment Status", "Notes"]
    const rows = orders.map(o => {
      const catInfo = ITEM_TYPES.find(c => c.value === o.itemType)
      const payStatus = derivePaymentStatus(o)
      const statusInfo = ORDER_STATUSES.find(s => s.value === o.orderStatus)
      return [
        o.itemName,
        catInfo?.label || o.itemType,
        o.supplier || "",
        o.quantity,
        o.unitCostHKD,
        o.totalCostHKD,
        o.depositAmountHKD || "",
        o.depositPaidDate || "",
        o.balanceDueDate || "",
        o.balancePaidDate || "",
        o.orderPlacedDate || "",
        o.artworkApprovedDate || "",
        o.expectedDeliveryDate || "",
        o.actualDeliveryDate || "",
        statusInfo?.label || o.orderStatus,
        payStatus.label,
        o.notes || "",
      ]
    })
    const totalValue2 = orders.reduce((s, o) => s + (o.totalCostHKD || 0), 0)
    const totalDeposited2 = orders.reduce((s, o) => s + (o.depositAmountHKD || 0), 0)
    const balanceOutstanding2 = orders.reduce((s, o) => {
      if (o.balancePaidDate) return s
      return s + Math.max(0, (o.totalCostHKD || 0) - (o.depositAmountHKD || 0))
    }, 0)
    const summaryRow = ["TOTALS", "", "", "", "", totalValue2, totalDeposited2, "", "", "", "", "", "", "", "", "", ""]
    const outstandingRow = ["Balance Outstanding", "", "", "", "", balanceOutstanding2, "", "", "", "", "", "", "", "", "", "", ""]
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows, [], summaryRow, outstandingRow])
    ws["!cols"] = [{ wch: 24 }, { wch: 18 }, { wch: 14 }, { wch: 6 }, { wch: 14 }, { wch: 14 },
      { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 30 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Kit Orders")
    XLSX.writeFile(wb, "HK-Masters-Kit-Orders.xlsx")
  }

  // Campaign totals
  const totalValue = orders.reduce((s, o) => s + (o.totalCostHKD || 0), 0)
  const totalDeposited = orders.reduce((s, o) => s + (o.depositAmountHKD || 0), 0)
  const balanceOutstanding = orders.reduce((s, o) => {
    if (o.balancePaidDate) return s
    const bal = (o.totalCostHKD || 0) - (o.depositAmountHKD || 0)
    return s + Math.max(0, bal)
  }, 0)

  // ── Sizing Sheet helpers ──
  const teamGroups = players.reduce<Record<number, { teamName: string; players: typeof players }>>((acc, p) => {
    const tid = p.teamId
    if (!acc[tid]) acc[tid] = { teamName: p.teamName || `Team ${tid}`, players: [] }
    acc[tid].players.push(p)
    return acc
  }, {})

  const exportSizingSheet = () => {
    const header = ["Player", "Team", ...GARMENTS.map(g => g.label)]
    const rows = players
      .sort((a, b) => (a.teamId - b.teamId) || a.name.localeCompare(b.name))
      .map(p => [
        p.name,
        p.teamName || "",
        p.shirtSize || "",
        p.shortsSize || "",
        p.jacketSize || "",
        p.poloSize || "",
        p.trackTopSize || "",
        p.goalieSmockSize || "",
      ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws["!cols"] = [{ wch: 24 }, { wch: 18 }, ...GARMENTS.map(() => ({ wch: 12 }))]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Sizing Sheet")
    XLSX.writeFile(wb, "HK-Masters-Sizing-Sheet.xlsx")
  }

  // ── Size Summary helpers ──
  const SIZE_BANDS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"]

  const garmentsWithSummary = GARMENTS.map(g => {
    const counts: Record<string, number> = {}
    let missing = 0
    players.forEach(p => {
      const val = (p[g.key as keyof typeof p] as string | undefined | null)
      if (!val) {
        missing++
      } else {
        const norm = val.toUpperCase().trim()
        counts[norm] = (counts[norm] || 0) + 1
      }
    })
    const total = players.length - missing
    return { ...g, counts, missing, total }
  })

  const exportSizeSummary = () => {
    const allSizes = Array.from(new Set(garmentsWithSummary.flatMap(g => Object.keys(g.counts))))
      .sort((a, b) => {
        const ia = SIZE_BANDS.indexOf(a), ib = SIZE_BANDS.indexOf(b)
        if (ia === -1 && ib === -1) return a.localeCompare(b)
        if (ia === -1) return 1; if (ib === -1) return -1
        return ia - ib
      })
    const header = ["Garment", ...allSizes, "TOTAL", "Missing"]
    const rows = garmentsWithSummary.map(g => [
      g.label,
      ...allSizes.map(s => g.counts[s] || 0),
      g.total,
      g.missing,
    ])
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
    ws["!cols"] = [{ wch: 16 }, ...allSizes.map(() => ({ wch: 8 })), { wch: 8 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, "Size Summary")
    XLSX.writeFile(wb, "HK-Masters-Size-Summary.xlsx")
  }

  const tabs: { id: ActiveTab; label: string; badge?: number }[] = [
    { id: "orders", label: "Orders" },
    { id: "sizing", label: "Sizing Sheet" },
    { id: "summary", label: "Size Summary" },
    ...(receivedItemTypes.length > 0 ? [{ id: "distribution" as ActiveTab, label: "Distribution" }] : []),
  ]

  return (
    <PageLayout
      title="Kits & Clothing"
      description="Campaign procurement tracker — bulk orders, payments, delivery, and sizing."
      action={
        activeTab === "orders" ? (
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportOrders} disabled={orders.length === 0}>
              <Download className="w-4 h-4 mr-2" /> Export Excel
            </Button>
            <Button onClick={openAddModal}>
              <Plus className="w-5 h-5 mr-2" /> Add Order
            </Button>
          </div>
        ) : activeTab === "distribution" ? null : (
          <Button variant="outline" onClick={activeTab === "sizing" ? exportSizingSheet : exportSizeSummary}>
            <Download className="w-4 h-4 mr-2" /> Export Excel
          </Button>
        )
      }
    >
      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit mb-6">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-white shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ─────────── ORDERS TAB ─────────── */}
      {activeTab === "orders" && (
        <div className="space-y-6">
          {/* Campaign totals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Order Value</p>
              <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Total Deposited</p>
              <p className="text-2xl font-bold text-emerald-700">{formatCurrency(totalDeposited)}</p>
            </div>
            <div className="bg-white rounded-2xl border border-border p-5 shadow-sm">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Balance Outstanding</p>
              <p className="text-2xl font-bold text-rose-600">{formatCurrency(balanceOutstanding)}</p>
            </div>
          </div>

          {/* Orders table */}
          <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Item</th>
                    <th className="px-5 py-4 font-semibold hidden sm:table-cell">Supplier</th>
                    <th className="px-5 py-4 font-semibold text-right">Qty × Unit</th>
                    <th className="px-5 py-4 font-semibold text-right hidden md:table-cell">Total</th>
                    <th className="px-5 py-4 font-semibold hidden lg:table-cell">Deposit</th>
                    <th className="px-5 py-4 font-semibold hidden lg:table-cell">Delivery</th>
                    <th className="px-5 py-4 font-semibold">Order Status</th>
                    <th className="px-5 py-4 font-semibold">Payment</th>
                    <th className="px-5 py-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isLoading ? (
                    <tr><td colSpan={9} className="px-6 py-8 text-center text-muted-foreground">Loading orders...</td></tr>
                  ) : orders.length === 0 ? (
                    <tr><td colSpan={9} className="px-6 py-12 text-center text-muted-foreground">No orders yet. Add the first one using the button above.</td></tr>
                  ) : (
                    orders.map(order => {
                      const catInfo = ITEM_TYPES.find(c => c.value === order.itemType)
                      const statusInfo = ORDER_STATUSES.find(s => s.value === order.orderStatus) ?? ORDER_STATUSES[0]
                      const payStatus = derivePaymentStatus(order)
                      return (
                        <tr key={order.id} className="hover:bg-muted/10 transition-colors group">
                          <td className="px-5 py-4">
                            <div className="font-semibold text-foreground">{order.itemName}</div>
                            <div className="text-xs text-muted-foreground">{catInfo?.label}</div>
                          </td>
                          <td className="px-5 py-4 hidden sm:table-cell text-muted-foreground text-sm">
                            {order.supplier || <span className="text-xs">—</span>}
                          </td>
                          <td className="px-5 py-4 text-right text-sm whitespace-nowrap">
                            {order.quantity} × {formatCurrency(order.unitCostHKD)}
                          </td>
                          <td className="px-5 py-4 text-right hidden md:table-cell">
                            <span className="font-bold text-primary">{formatCurrency(order.totalCostHKD)}</span>
                          </td>
                          <td className="px-5 py-4 hidden lg:table-cell text-sm">
                            {order.depositAmountHKD ? (
                              <div>
                                <div className="text-muted-foreground">{formatCurrency(order.depositAmountHKD)}</div>
                                {order.depositPaidDate && <div className="text-xs text-emerald-600">Paid {order.depositPaidDate}</div>}
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-5 py-4 hidden lg:table-cell text-sm text-muted-foreground">
                            {order.expectedDeliveryDate || <span className="text-xs">—</span>}
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={`${statusInfo.color} border-0 shadow-none whitespace-nowrap text-xs`}>
                              {statusInfo.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-4">
                            <Badge className={`${payStatus.color} border-0 shadow-none whitespace-nowrap text-xs`}>
                              {payStatus.label}
                            </Badge>
                          </td>
                          <td className="px-5 py-4 text-right">
                            <div className="flex justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditModal(order)} className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background shadow-sm border transition-all">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(order.id)} className="p-2 text-muted-foreground hover:text-rose-600 rounded bg-background shadow-sm border transition-all">
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
      )}

      {/* ─────────── SIZING SHEET TAB ─────────── */}
      {activeTab === "sizing" && (
        <div className="space-y-6">
          {players.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center text-muted-foreground">No players found.</div>
          ) : (
            Object.entries(teamGroups).map(([teamId, { teamName, players: teamPlayers }]) => (
              <div key={teamId} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
                <div className="px-5 py-3 border-b border-border bg-muted/20">
                  <h3 className="font-semibold text-sm text-foreground">{teamName}</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 text-left font-semibold">Player</th>
                        {GARMENTS.map(g => (
                          <th key={g.key} className="px-4 py-3 text-center font-semibold">{g.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {teamPlayers
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map(p => (
                          <tr key={p.id} className="hover:bg-muted/10">
                            <td className="px-4 py-3 font-medium text-foreground">{p.name}</td>
                            {GARMENTS.map(g => {
                              const val = p[g.key as keyof typeof p] as string | undefined | null
                              return (
                                <td key={g.key} className="px-4 py-3 text-center">
                                  {val ? (
                                    <span className="inline-block px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 rounded font-mono text-xs font-semibold">
                                      {val}
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 bg-rose-50 text-rose-600 border border-rose-200 rounded text-xs">
                                      —
                                    </span>
                                  )}
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ─────────── SIZE SUMMARY TAB ─────────── */}
      {activeTab === "summary" && (
        <div className="space-y-6">
          {/* Missing sizes warning */}
          {garmentsWithSummary.some(g => g.missing > 0) && (
            <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 shrink-0" />
              <div className="text-sm text-amber-800">
                <span className="font-semibold">Sizes incomplete — order not ready to place.</span>{" "}
                {garmentsWithSummary.filter(g => g.missing > 0).map(g => `${g.label}: ${g.missing} missing`).join(" · ")}
              </div>
            </div>
          )}
          {garmentsWithSummary.every(g => g.missing === 0) && players.length > 0 && (
            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span className="text-sm font-semibold text-emerald-800">All player sizes submitted — ready to place orders.</span>
            </div>
          )}

          {/* Summary table */}
          <div className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                  <tr>
                    <th className="px-5 py-4 text-left font-semibold">Garment</th>
                    {SIZE_BANDS.map(s => <th key={s} className="px-4 py-4 text-center font-semibold">{s}</th>)}
                    <th className="px-4 py-4 text-center font-semibold">Other</th>
                    <th className="px-5 py-4 text-center font-semibold">Total</th>
                    <th className="px-5 py-4 text-center font-semibold">Missing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {garmentsWithSummary.map(g => {
                    const knownSizes = SIZE_BANDS.reduce((s, band) => s + (g.counts[band] || 0), 0)
                    const otherCount = g.total - knownSizes
                    return (
                      <tr key={g.key} className="hover:bg-muted/10">
                        <td className="px-5 py-4 font-semibold text-foreground">{g.label}</td>
                        {SIZE_BANDS.map(band => (
                          <td key={band} className="px-4 py-4 text-center">
                            {g.counts[band] ? (
                              <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {g.counts[band]}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-4 py-4 text-center">
                          {otherCount > 0 ? (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 text-slate-600 font-bold text-sm">
                              {otherCount}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </td>
                        <td className="px-5 py-4 text-center">
                          <span className="font-bold text-foreground">{g.total}</span>
                          <span className="text-xs text-muted-foreground">/{players.length}</span>
                        </td>
                        <td className="px-5 py-4 text-center">
                          {g.missing > 0 ? (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 text-xs font-semibold">
                              {g.missing}
                            </span>
                          ) : (
                            <span className="text-emerald-600 text-xs font-semibold">✓</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─────────── DISTRIBUTION TAB ─────────── */}
      {activeTab === "distribution" && (
        <div className="space-y-6">
          {receivedItemTypes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-border p-12 text-center">
              <Package className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
              <p className="font-medium text-muted-foreground">No orders have been received yet.</p>
              <p className="text-sm text-muted-foreground mt-1">Once an order status is set to "Received", players will appear here to track kit collection.</p>
            </div>
          ) : (
            receivedItemTypes.map(itemType => {
              const typeInfo = ITEM_TYPES.find(t => t.value === itemType)
              const collectedCount = players.filter(p => isCollected(p.id, itemType)).length
              return (
                <div key={itemType} className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm">
                  <div className="px-6 py-4 border-b border-border flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-foreground">{typeInfo?.label || itemType}</h3>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        <span className={collectedCount === players.length ? "text-emerald-600 font-semibold" : "text-amber-600 font-semibold"}>
                          {collectedCount} of {players.length}
                        </span> players collected
                      </p>
                    </div>
                    <div className="h-9 w-9 rounded-full flex items-center justify-center"
                      style={{ background: collectedCount === players.length ? "rgb(209 250 229)" : "rgb(254 243 199)" }}>
                      {collectedCount === players.length
                        ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        : <Package className="w-5 h-5 text-amber-600" />
                      }
                    </div>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 w-full bg-muted">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: players.length > 0 ? `${Math.round((collectedCount / players.length) * 100)}%` : "0%" }}
                    />
                  </div>
                  <div className="divide-y divide-border">
                    {Object.entries(teamGroups).map(([teamId, { teamName, players: teamPlayers }]) => (
                      <div key={teamId}>
                        <div className="px-6 py-2 bg-muted/20 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                          {teamName}
                        </div>
                        {teamPlayers
                          .sort((a, b) => a.name.localeCompare(b.name))
                          .map(player => {
                            const collected = isCollected(player.id, itemType)
                            return (
                              <div key={player.id} className="flex items-center justify-between px-6 py-3 hover:bg-muted/10 transition-colors">
                                <div className="flex items-center gap-3">
                                  <div className={`w-2 h-2 rounded-full ${collected ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
                                  <span className={`text-sm font-medium ${collected ? "text-foreground" : "text-muted-foreground"}`}>
                                    {player.name}
                                  </span>
                                  {player.shirtNumber && (
                                    <span className="text-xs text-muted-foreground">#{player.shirtNumber}</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => toggleCollection(player.id, itemType)}
                                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                                    collected
                                      ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                                      : "bg-background text-muted-foreground border-border hover:border-primary/40 hover:text-foreground"
                                  }`}
                                >
                                  {collected ? (
                                    <><CheckCircle2 className="w-3.5 h-3.5" /> Collected</>
                                  ) : (
                                    <><Package className="w-3.5 h-3.5" /> Mark Collected</>
                                  )}
                                </button>
                              </div>
                            )
                          })}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* ─────────── ORDER MODAL ─────────── */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingOrder ? "Edit Order" : "New Kit Order"}>
        <form onSubmit={handleSubmit(onSubmit)}>
        <div className="space-y-5 max-h-[65vh] overflow-y-auto pr-1 pb-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <label htmlFor="ko-itemName" className="text-sm font-semibold">Item Name *</label>
              <Input id="ko-itemName" {...register("itemName")} placeholder="e.g. Playing Shirt, Track Top..." />
              {errors.itemName && <p className="text-xs text-destructive">{errors.itemName.message}</p>}
            </div>
            <div className="space-y-2">
              <label htmlFor="ko-itemType" className="text-sm font-semibold">Category</label>
              <Select id="ko-itemType" {...register("itemType")}>
                {ITEM_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label htmlFor="ko-supplier" className="text-sm font-semibold">Supplier</label>
              <Input id="ko-supplier" {...register("supplier")} placeholder="e.g. Kukri" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="ko-quantity" className="text-sm font-semibold">Quantity</label>
              <Input id="ko-quantity" type="number" min="1" {...register("quantity")} />
            </div>
            <div className="space-y-2">
              <label htmlFor="ko-unitCost" className="text-sm font-semibold">Unit Cost (HKD)</label>
              <Input id="ko-unitCost" type="number" step="0.01" min="0" {...register("unitCostHKD")} />
            </div>
          </div>

          <div className="flex justify-between items-center bg-primary/5 rounded-xl px-4 py-3 border border-primary/20">
            <span className="text-sm font-medium text-primary">Total Cost</span>
            <span className="text-lg font-bold text-primary" aria-label={`Total Cost ${formatCurrency(totalPreview)}`}>{formatCurrency(totalPreview)}</span>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Order Lifecycle</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="ko-orderStatus" className="text-sm font-semibold">Order Status</label>
                <Select id="ko-orderStatus" {...register("orderStatus")}>
                  {ORDER_STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </Select>
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-orderPlacedDate" className="text-sm font-semibold">Order Placed Date</label>
                <Input id="ko-orderPlacedDate" type="date" {...register("orderPlacedDate")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-artworkApprovedDate" className="text-sm font-semibold">Artwork Approved Date</label>
                <Input id="ko-artworkApprovedDate" type="date" {...register("artworkApprovedDate")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-expectedDelivery" className="text-sm font-semibold">Expected Delivery</label>
                <Input id="ko-expectedDelivery" type="date" {...register("expectedDeliveryDate")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-actualDelivery" className="text-sm font-semibold">Actual Delivery</label>
                <Input id="ko-actualDelivery" type="date" {...register("actualDeliveryDate")} />
              </div>
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payments</p>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="ko-depositAmount" className="text-sm font-semibold">Deposit Amount (HKD)</label>
                <Input id="ko-depositAmount" type="number" step="0.01" min="0" {...register("depositAmountHKD")} placeholder="0" />
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-depositPaidDate" className="text-sm font-semibold">Deposit Paid Date</label>
                <Input id="ko-depositPaidDate" type="date" {...register("depositPaidDate")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-balanceDueDate" className="text-sm font-semibold">Balance Due Date</label>
                <Input id="ko-balanceDueDate" type="date" {...register("balanceDueDate")} />
              </div>
              <div className="space-y-2">
                <label htmlFor="ko-balancePaidDate" className="text-sm font-semibold">Balance Paid Date</label>
                <Input id="ko-balancePaidDate" type="date" {...register("balancePaidDate")} />
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="ko-notes" className="text-sm font-semibold">Notes</label>
            <Input id="ko-notes" {...register("notes")} placeholder="Artwork notes, customisation, special instructions..." />
          </div>

        </div>
          <div className="pt-4 flex justify-end gap-3 border-t mt-4">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingOrder ? "Update Order" : "Add Order"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
