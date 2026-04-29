import { useState, useEffect } from "react"
import { useListFundraising, useCreateFundraising, useUpdateFundraising, useDeleteFundraising, getListFundraisingQueryKey, useListTeams } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, TrendingUp, HandCoins, Lock } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { FundraisingEntry } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { format, parseISO } from "date-fns"

const SESSION_KEY = "hkm_admin_session"
function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
function storeToken(token: string) {
  try { localStorage.setItem(SESSION_KEY, token) } catch { /* noop */ }
}
async function apiLogin(password: string): Promise<string> {
  const res = await fetch("/api/admin/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error ?? "Login failed")
  }
  const data = await res.json() as { token: string }
  return data.token
}
async function apiCheckSession(token: string): Promise<boolean> {
  const res = await fetch("/api/admin/auth", { headers: { "x-session-token": token } })
  const data = await res.json() as { authenticated: boolean }
  return data.authenticated
}

const fundSchema = z.object({
  donorName: z.string().min(1, "Donor name is required"),
  amountPledged: z.coerce.number().min(0),
  amountReceived: z.coerce.number().min(0),
  date: z.string().optional(),
  teamId: z.coerce.number().optional().nullable(),
  status: z.enum(["pending", "confirmed", "received"]),
  notes: z.string().optional()
})

type FundFormValues = z.infer<typeof fundSchema>

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  received: "bg-emerald-100 text-emerald-800"
}

export default function Fundraising() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState<string | null>(null)
  const [loginLoading, setLoginLoading] = useState(false)

  useEffect(() => {
    const stored = getStoredToken()
    if (stored) {
      apiCheckSession(stored).then((valid) => {
        if (valid) setSessionToken(stored)
        setSessionChecked(true)
      }).catch(() => setSessionChecked(true))
    } else {
      setSessionChecked(true)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const token = await apiLogin(loginPassword)
      storeToken(token)
      setSessionToken(token)
      setLoginPassword("")
      queryClient.invalidateQueries()
    } catch (err) {
      setLoginError((err as Error).message || "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  const { data: teams = [] } = useListTeams()
  const { data: entries = [], isLoading } = useListFundraising({ query: { enabled: !!sessionToken } })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FundraisingEntry | null>(null)

  const createMutation = useCreateFundraising()
  const updateMutation = useUpdateFundraising()
  const deleteMutation = useDeleteFundraising()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<FundFormValues>({
    resolver: zodResolver(fundSchema)
  })

  const openAddModal = () => {
    setEditingEntry(null)
    reset({ 
      donorName: "", amountPledged: 0, amountReceived: 0, 
      date: new Date().toISOString().split('T')[0],
      teamId: null, status: "pending", notes: "" 
    })
    setIsModalOpen(true)
  }

  const openEditModal = (entry: FundraisingEntry) => {
    setEditingEntry(entry)
    reset({
      donorName: entry.donorName,
      amountPledged: entry.amountPledged,
      amountReceived: entry.amountReceived,
      date: entry.date ? entry.date.split('T')[0] : "",
      teamId: entry.teamId || null,
      status: entry.status,
      notes: entry.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this record?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListFundraisingQueryKey() })
      toast({ title: "Record deleted successfully" })
    } catch {
      toast({ title: "Failed to delete record", variant: "destructive" })
    }
  }

  const onSubmit = async (data: FundFormValues) => {
    try {
      // API expects undefined rather than null for absent teamId if not assigned to specific team
      const payload = { ...data, teamId: data.teamId === 0 || !data.teamId ? undefined : data.teamId }
      
      if (editingEntry) {
        await updateMutation.mutateAsync({ id: editingEntry.id, data: payload as any })
        toast({ title: "Record updated" })
      } else {
        await createMutation.mutateAsync({ data: payload as any })
        toast({ title: "Record created" })
      }
      queryClient.invalidateQueries({ queryKey: getListFundraisingQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const totalPledged = entries.reduce((sum, e) => sum + e.amountPledged, 0)
  const totalReceived = entries.reduce((sum, e) => sum + e.amountReceived, 0)

  if (!sessionChecked) {
    return (
      <PageLayout title="Sponsors & Fundraising" description="Checking access...">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </PageLayout>
    )
  }

  if (!sessionToken) {
    return (
      <PageLayout title="Sponsors & Fundraising" description="Admin access required to view fundraising records.">
        <div className="max-w-sm mx-auto mt-12">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto mb-5">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-center mb-1">Admin Login</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Enter your admin password to access fundraising records.</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="password"
                placeholder="Admin password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                autoFocus
              />
              {loginError && <p className="text-xs text-destructive">{loginError}</p>}
              <Button type="submit" className="w-full" disabled={loginLoading || !loginPassword}>
                {loginLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </div>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Sponsors & Fundraising"
      description="Manage incoming sponsorships, donations, and fundraising efforts."
      action={
        <Button onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" /> Record Donation
        </Button>
      }
    >
      {/* Top Banner */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-2xl p-8 text-white relative overflow-hidden shadow-lg shadow-emerald-900/20">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <HandCoins className="w-64 h-64" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100 font-medium mb-1 uppercase tracking-wider text-sm">Total Received</p>
            <p className="text-5xl font-display font-bold">{formatCurrency(totalReceived)}</p>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-8 border border-border shadow-sm flex flex-col justify-center">
           <div className="flex items-center justify-between mb-2">
             <div className="flex items-center text-muted-foreground"><TrendingUp className="w-5 h-5 mr-2"/> Total Pledged Pipeline</div>
           </div>
           <p className="text-3xl font-display font-bold text-foreground">{formatCurrency(totalPledged)}</p>
           <div className="w-full bg-muted h-2 rounded-full mt-4 overflow-hidden">
             <div className="bg-primary h-full rounded-full transition-all duration-1000" style={{ width: `${Math.min(100, (totalReceived / (totalPledged || 1)) * 100)}%` }}></div>
           </div>
           <p className="text-xs text-muted-foreground mt-2 text-right">{((totalReceived / (totalPledged || 1)) * 100).toFixed(0)}% Collected</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-4 font-semibold">Donor / Sponsor</th>
                <th className="px-6 py-4 font-semibold text-right">Pledged</th>
                <th className="px-6 py-4 font-semibold text-right">Received</th>
                <th className="px-6 py-4 font-semibold">Status</th>
                <th className="px-6 py-4 font-semibold">Date</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-muted-foreground">Loading records...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-12 text-center text-muted-foreground">No fundraising records yet.</td></tr>
              ) : (
                entries.map(entry => (
                  <tr key={entry.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="font-bold text-foreground">{entry.donorName}</div>
                      <div className="text-xs text-muted-foreground">{entry.teamName || 'All Teams (General)'}</div>
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-foreground">{formatCurrency(entry.amountPledged)}</td>
                    <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(entry.amountReceived)}</td>
                    <td className="px-6 py-4">
                      <Badge className={STATUS_COLORS[entry.status] + " capitalize border-0 shadow-none"}>
                        {entry.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 text-muted-foreground">
                      {entry.date ? format(parseISO(entry.date), 'MMM d, yyyy') : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openEditModal(entry)} className="p-2 text-muted-foreground hover:text-blue-600 rounded bg-background shadow-sm border transition-all">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(entry.id)} className="p-2 text-muted-foreground hover:text-rose-600 rounded bg-background shadow-sm border transition-all">
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

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEntry ? "Edit Record" : "New Donation Record"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Donor / Sponsor Name</label>
            <Input {...register("donorName")} placeholder="Company X or Individual Name" />
            {errors.donorName && <p className="text-xs text-destructive">{errors.donorName.message}</p>}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Amount Pledged (HKD)</label>
              <Input type="number" min="0" {...register("amountPledged")} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Amount Received (HKD)</label>
              <Input type="number" min="0" {...register("amountReceived")} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Target Team (Optional)</label>
              <Select {...register("teamId")}>
                <option value="0">General Fund (All Teams)</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Status</label>
              <Select {...register("status")}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="received">Received</option>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Date</label>
            <Input type="date" {...register("date")} />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes</label>
            <Input {...register("notes")} placeholder="Agreements, conditions..." />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingEntry ? "Update Record" : "Add Record"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
