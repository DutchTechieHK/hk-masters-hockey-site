import { useState, useEffect, useCallback } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Gavel, ChevronDown, ChevronUp, Copy, Check, ToggleLeft, ToggleRight } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

const SESSION_KEY = "hkm_admin_session"
function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}

async function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getStoredToken()
  const res = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", "x-session-token": token ?? "", ...(opts.headers ?? {}) },
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  if (res.status === 204) return null
  return res.json()
}

type AuctionItem = {
  id: number
  title: string
  description: string | null
  imageUrl: string | null
  startingPrice: string
  minIncrement: string
  opensAt: string | null
  closesAt: string | null
  isActive: boolean
  createdAt: string
  topBid: { bidderName: string; amount: string } | null
}

type AuctionBid = {
  id: number
  bidderName: string
  bidderEmail: string
  amount: string
  placedAt: string
}

function toLocalDatetimeInput(isoStr: string | null): string {
  if (!isoStr) return ""
  const d = new Date(isoStr)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatHKD(n: string | number) {
  return `HK$${Number(n).toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const EMPTY_FORM = { title: "", description: "", imageUrl: "", startingPrice: "0", minIncrement: "100", opensAt: "", closesAt: "", isActive: true }

export default function AuctionAdmin() {
  const { toast } = useToast()
  const [isLive, setIsLive] = useState(false)
  const [liveLoading, setLiveLoading] = useState(false)
  const [items, setItems] = useState<AuctionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedBids, setExpandedBids] = useState<number | null>(null)
  const [bids, setBids] = useState<Record<number, AuctionBid[]>>({})
  const [bidsLoading, setBidsLoading] = useState<number | null>(null)
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<AuctionItem | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)

  const fetchData = useCallback(async () => {
    try {
      const [settingsData, itemsData] = await Promise.all([
        apiFetch("/api/auction/settings"),
        apiFetch("/api/auction/items"),
      ])
      setIsLive(settingsData.isLive)
      setItems(itemsData)
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { fetchData() }, [fetchData])

  const toggleLive = async () => {
    setLiveLoading(true)
    try {
      const result = await apiFetch("/api/auction/settings", {
        method: "PATCH",
        body: JSON.stringify({ isLive: !isLive }),
      })
      setIsLive(result.isLive)
      toast({ title: result.isLive ? "Auction is now LIVE on the public site" : "Auction hidden from public site" })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLiveLoading(false)
    }
  }

  const openAddModal = () => {
    setEditingItem(null)
    setForm(EMPTY_FORM)
    setIsModalOpen(true)
  }

  const openEditModal = (item: AuctionItem) => {
    setEditingItem(item)
    setForm({
      title: item.title,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
      startingPrice: item.startingPrice,
      minIncrement: item.minIncrement,
      opensAt: toLocalDatetimeInput(item.opensAt),
      closesAt: toLocalDatetimeInput(item.closesAt),
      isActive: item.isActive,
    })
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) { toast({ title: "Title is required", variant: "destructive" }); return; }
    setSaving(true)
    try {
      const payload = {
        ...form,
        startingPrice: parseFloat(form.startingPrice) || 0,
        minIncrement: parseFloat(form.minIncrement) || 100,
        opensAt: form.opensAt ? new Date(form.opensAt).toISOString() : null,
        closesAt: form.closesAt ? new Date(form.closesAt).toISOString() : null,
      }
      if (editingItem) {
        const updated = await apiFetch(`/api/auction/items/${editingItem.id}`, { method: "PATCH", body: JSON.stringify(payload) })
        setItems(prev => prev.map(i => i.id === editingItem.id ? updated : i))
        toast({ title: "Item updated" })
      } else {
        const created = await apiFetch("/api/auction/items", { method: "POST", body: JSON.stringify(payload) })
        setItems(prev => [...prev, created])
        toast({ title: "Item created" })
      }
      setIsModalOpen(false)
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await apiFetch(`/api/auction/items/${id}`, { method: "DELETE" })
      setItems(prev => prev.filter(i => i.id !== id))
      setDeleteConfirm(null)
      toast({ title: "Item deleted" })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    }
  }

  const toggleBids = async (id: number) => {
    if (expandedBids === id) { setExpandedBids(null); return }
    setExpandedBids(id)
    if (!bids[id]) {
      setBidsLoading(id)
      try {
        const data = await apiFetch(`/api/auction/items/${id}/bids`)
        setBids(prev => ({ ...prev, [id]: data }))
      } catch (err) {
        toast({ title: (err as Error).message, variant: "destructive" })
      } finally {
        setBidsLoading(null)
      }
    }
  }

  const copyEmail = async (email: string) => {
    await navigator.clipboard.writeText(email)
    setCopiedEmail(email)
    setTimeout(() => setCopiedEmail(null), 2000)
  }

  if (loading) {
    return <PageLayout title="Silent Auction"><div className="text-muted-foreground py-24 text-center">Loading…</div></PageLayout>
  }

  return (
    <PageLayout
      title="Silent Auction"
      description="Manage auction items, bids, and public visibility."
      action={
        <Button onClick={openAddModal}>
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      }
    >
      {/* Live toggle */}
      <div className={`rounded-2xl border p-6 mb-8 flex items-center justify-between gap-4 ${isLive ? "bg-emerald-50 border-emerald-200" : "bg-gray-50 border-gray-200"}`}>
        <div>
          <p className="font-bold text-gray-900 text-lg">
            {isLive ? "🟢 Auction is LIVE" : "⚫ Auction is hidden"}
          </p>
          <p className="text-sm text-gray-500 mt-0.5">
            {isLive
              ? "The auction page and nav item are visible to the public."
              : "The auction is not visible on the public site. Toggle on when ready."}
          </p>
        </div>
        <button
          onClick={toggleLive}
          disabled={liveLoading}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors ${
            isLive ? "bg-emerald-600 text-white hover:bg-emerald-700" : "bg-gray-200 text-gray-700 hover:bg-gray-300"
          } disabled:opacity-60`}
        >
          {isLive ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
          {isLive ? "Turn Off" : "Go Live"}
        </button>
      </div>

      {/* Items list */}
      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Gavel className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No items yet. Add your first auction item.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(item => {
            const isExpanded = expandedBids === item.id
            const itemBids = bids[item.id] ?? []
            const winner = itemBids[0]
            return (
              <div key={item.id} className="bg-white border border-border rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 flex items-start gap-4">
                  {item.imageUrl && (
                    <img src={item.imageUrl} alt={item.title} className="w-16 h-16 rounded-xl object-cover shrink-0 border border-gray-100" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold text-gray-900">{item.title}</h3>
                        {item.description && <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Badge className={item.isActive ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500"}>
                          {item.isActive ? "Active" : "Draft"}
                        </Badge>
                        <button onClick={() => openEditModal(item)} className="p-1.5 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteConfirm(item.id)} className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Starting</span>
                        <p className="font-bold text-gray-800">{formatHKD(item.startingPrice)}</p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Min Inc.</span>
                        <p className="font-bold text-gray-800">{formatHKD(item.minIncrement)}</p>
                      </div>
                      {item.topBid && (
                        <div>
                          <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Top Bid</span>
                          <p className="font-bold text-emerald-700">{formatHKD(item.topBid.amount)} — {item.topBid.bidderName}</p>
                        </div>
                      )}
                      {item.closesAt && (
                        <div>
                          <span className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Closes</span>
                          <p className="font-bold text-gray-800">{new Date(item.closesAt).toLocaleString("en-HK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Bids panel */}
                <div className="border-t border-gray-100">
                  <button
                    onClick={() => toggleBids(item.id)}
                    className="w-full flex items-center justify-between px-5 py-3 text-sm font-semibold text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                  >
                    <span>Bid history {itemBids.length > 0 ? `(${itemBids.length})` : ""}</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {isExpanded && (
                    <div className="px-5 pb-4">
                      {bidsLoading === item.id ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">Loading bids…</p>
                      ) : itemBids.length === 0 ? (
                        <p className="text-sm text-muted-foreground py-4 text-center">No bids yet.</p>
                      ) : (
                        <>
                          {winner && (
                            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3">
                              <div>
                                <p className="text-xs font-bold text-amber-700 uppercase tracking-wide mb-0.5">🏆 Current Leader</p>
                                <p className="font-bold text-gray-900">{winner.bidderName} — {formatHKD(winner.amount)}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{winner.bidderEmail}</p>
                              </div>
                              <button
                                onClick={() => copyEmail(winner.bidderEmail)}
                                className="flex items-center gap-1.5 px-3 py-2 bg-amber-100 text-amber-800 hover:bg-amber-200 rounded-lg text-xs font-semibold transition-colors shrink-0"
                              >
                                {copiedEmail === winner.bidderEmail ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                                {copiedEmail === winner.bidderEmail ? "Copied!" : "Copy email"}
                              </button>
                            </div>
                          )}
                          <div className="space-y-1">
                            {itemBids.map((bid, i) => (
                              <div key={bid.id} className="flex items-center justify-between gap-3 py-2 border-b border-gray-50 last:border-0">
                                <div className="flex items-center gap-3">
                                  <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 text-xs font-bold flex items-center justify-center shrink-0">{i + 1}</span>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-900">{bid.bidderName}</p>
                                    <p className="text-xs text-gray-400">{bid.bidderEmail}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold text-gray-800">{formatHKD(bid.amount)}</p>
                                  <p className="text-xs text-gray-400">{new Date(bid.placedAt).toLocaleString("en-HK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Edit Auction Item" : "Add Auction Item"}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Title *</label>
            <Input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Signed Team Jersey" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Description</label>
            <textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder="Describe the item…"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Image URL</label>
            <Input value={form.imageUrl} onChange={e => setForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://…" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Starting Price (HKD)</label>
              <Input type="number" min="0" value={form.startingPrice} onChange={e => setForm(p => ({ ...p, startingPrice: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Min Increment (HKD)</label>
              <Input type="number" min="0" value={form.minIncrement} onChange={e => setForm(p => ({ ...p, minIncrement: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Opens At</label>
              <Input type="datetime-local" value={form.opensAt} onChange={e => setForm(p => ({ ...p, opensAt: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Closes At</label>
              <Input type="datetime-local" value={form.closesAt} onChange={e => setForm(p => ({ ...p, closesAt: e.target.value }))} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox" id="isActive" checked={form.isActive}
              onChange={e => setForm(p => ({ ...p, isActive: e.target.checked }))}
              className="w-4 h-4 accent-primary"
            />
            <label htmlFor="isActive" className="text-sm font-semibold">Active (visible when auction is live)</label>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingItem ? "Save Changes" : "Add Item"}</Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirm */}
      <Modal
        isOpen={deleteConfirm !== null}
        onClose={() => setDeleteConfirm(null)}
        title="Delete Item"
      >
        <p className="text-sm text-muted-foreground mb-6">This will permanently delete the item and all its bids. This cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
          <Button variant="destructive" onClick={() => deleteConfirm !== null && handleDelete(deleteConfirm)}>Delete</Button>
        </div>
      </Modal>
    </PageLayout>
  )
}
