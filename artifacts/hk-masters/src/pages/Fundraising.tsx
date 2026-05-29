import { useState, useEffect } from "react"
import { useListFundraising, useCreateFundraising, useUpdateFundraising, useDeleteFundraising, getListFundraisingQueryKey, useListTeams } from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, TrendingUp, HandCoins, Lock, CheckCircle2, MailCheck, AlertTriangle, AlertCircle, Download, BarChart2, List } from "lucide-react"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import type { FundraisingEntry } from "@workspace/api-client-react"
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
  donorEmail: z.string().email("Invalid email address").optional().or(z.literal("")),
  amountPledged: z.coerce.number().min(0),
  amountReceived: z.coerce.number().min(0),
  date: z.string().optional(),
  teamId: z.coerce.number().optional().nullable(),
  status: z.enum(["pending", "confirmed", "received"]),
  notes: z.string().optional(),
  beneficiary: z.string().optional(),
  paidAt: z.string().optional()
})

type FundFormValues = z.infer<typeof fundSchema>

const STATUS_COLORS = {
  pending: "bg-amber-100 text-amber-800",
  confirmed: "bg-blue-100 text-blue-800",
  received: "bg-emerald-100 text-emerald-800"
}

type BreakdownRow = {
  key: string
  label: string
  totalPledged: number
  totalReceived: number
  count: number
  isTeam: boolean
}

type BreakdownResult = {
  teamRows: BreakdownRow[]
  playerRows: BreakdownRow[]
}

function normaliseTeamBucket(b: string): "MO40" | "MO50" | null {
  const s = b.toLowerCase().replace(/\s+/g, "")
  if (s === "mo40" || s === "mo40team") return "MO40"
  if (s === "mo50" || s === "mo50team") return "MO50"
  return null
}

function buildBreakdown(entries: FundraisingEntry[], playerTeamMap: Map<string, string>): BreakdownResult {
  const mo40: BreakdownRow = { key: "MO40", label: "MO40", totalPledged: 0, totalReceived: 0, count: 0, isTeam: true }
  const mo50: BreakdownRow = { key: "MO50", label: "MO50", totalPledged: 0, totalReceived: 0, count: 0, isTeam: true }
  const general: BreakdownRow = { key: "general", label: "General", totalPledged: 0, totalReceived: 0, count: 0, isTeam: true }
  const playerMap = new Map<string, BreakdownRow>()

  for (const e of entries) {
    const b = e.beneficiary?.trim()
    if (!b) {
      general.totalPledged += e.amountPledged
      general.totalReceived += e.amountReceived
      general.count++
    } else {
      const teamBucket = normaliseTeamBucket(b)
      if (teamBucket === "MO40") {
        mo40.totalPledged += e.amountPledged
        mo40.totalReceived += e.amountReceived
        mo40.count++
      } else if (teamBucket === "MO50") {
        mo50.totalPledged += e.amountPledged
        mo50.totalReceived += e.amountReceived
        mo50.count++
      } else {
        if (!playerMap.has(b)) {
          playerMap.set(b, { key: b, label: b, totalPledged: 0, totalReceived: 0, count: 0, isTeam: false })
        }
        const row = playerMap.get(b)!
        row.totalPledged += e.amountPledged
        row.totalReceived += e.amountReceived
        row.count++

        const teamCategory = playerTeamMap.get(b) ?? ""
        if (teamCategory.toLowerCase().includes("mo40")) {
          mo40.totalPledged += e.amountPledged
          mo40.totalReceived += e.amountReceived
          mo40.count++
        } else if (teamCategory.toLowerCase().includes("mo50")) {
          mo50.totalPledged += e.amountPledged
          mo50.totalReceived += e.amountReceived
          mo50.count++
        }
      }
    }
  }

  const playerRows = Array.from(playerMap.values()).sort((a, b) => b.totalPledged - a.totalPledged)
  const teamRows = [mo40, mo50, general].sort((a, b) => b.totalPledged - a.totalPledged)
  return { teamRows, playerRows }
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
  const { data: entries = [], isLoading } = useListFundraising({ query: { queryKey: getListFundraisingQueryKey(), enabled: !!sessionToken } })

  const [playerTeamMap, setPlayerTeamMap] = useState<Map<string, string>>(new Map())
  useEffect(() => {
    fetch("/api/public/squad")
      .then((r) => r.json())
      .then((data: Array<{ name: string; teamCategory: string | null }>) => {
        const map = new Map<string, string>()
        data.forEach((p) => { if (p.name) map.set(p.name, p.teamCategory ?? "") })
        setPlayerTeamMap(map)
      })
      .catch(() => { /* non-critical */ })
  }, [])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<FundraisingEntry | null>(null)
  const [activeTab, setActiveTab] = useState<"records" | "breakdown">("records")

  const createMutation = useCreateFundraising()
  const updateMutation = useUpdateFundraising()
  const deleteMutation = useDeleteFundraising()

  const { register, handleSubmit, reset, control, formState: { errors, isSubmitting } } = useForm<FundFormValues>({
    resolver: zodResolver(fundSchema)
  })
  const watchedEmail = useWatch({ control, name: "donorEmail" })
  const watchedStatus = useWatch({ control, name: "status" })

  const openAddModal = () => {
    setEditingEntry(null)
    reset({ 
      donorName: "", donorEmail: "", amountPledged: 0, amountReceived: 0, 
      date: new Date().toISOString().split('T')[0],
      teamId: null, status: "pending", notes: "", beneficiary: ""
    })
    setIsModalOpen(true)
  }

  const openEditModal = (entry: FundraisingEntry) => {
    setEditingEntry(entry)
    reset({
      donorName: entry.donorName,
      donorEmail: entry.donorEmail || "",
      amountPledged: entry.amountPledged,
      amountReceived: entry.amountReceived,
      date: entry.date ? entry.date.split('T')[0] : "",
      teamId: entry.teamId || null,
      status: entry.status,
      notes: entry.notes || "",
      beneficiary: entry.beneficiary || "",
      paidAt: entry.paidAt ? entry.paidAt.split('T')[0] : ""
    })
    setIsModalOpen(true)
  }

  const [resendingId, setResendingId] = useState<number | null>(null)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} })

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm })
  }

  const closeConfirm = () => {
    setConfirmDialog(prev => ({ ...prev, isOpen: false }))
  }

  const todayStr = () => new Date().toISOString().split('T')[0]

  const [markAsPaidDialog, setMarkAsPaidDialog] = useState<{
    isOpen: boolean
    entry: FundraisingEntry | null
    paymentDate: string
  }>({ isOpen: false, entry: null, paymentDate: "" })

  const closeMarkAsPaidDialog = () => {
    setMarkAsPaidDialog(prev => ({ ...prev, isOpen: false }))
  }

  const handleResendReceipt = async (entry: FundraisingEntry) => {
    setResendingId(entry.id)
    try {
      const res = await fetch(`/api/fundraising/${entry.id}/resend-receipt`, {
        method: "POST",
        headers: { "x-session-token": sessionToken ?? "" },
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Failed to resend receipt")
      }
      toast({ title: "Receipt resent", description: `Thank-you email sent to ${entry.donorEmail}` })
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to resend receipt", variant: "destructive" })
    } finally {
      setResendingId(null)
    }
  }

  const handleDelete = (id: number) => {
    showConfirm(
      "Delete Record",
      "Are you sure you want to delete this record? This action cannot be undone.",
      async () => {
        closeConfirm()
        try {
          await deleteMutation.mutateAsync({ id })
          queryClient.invalidateQueries({ queryKey: getListFundraisingQueryKey() })
          toast({ title: "Record deleted successfully" })
        } catch {
          toast({ title: "Failed to delete record", variant: "destructive" })
        }
      }
    )
  }

  const doMarkAsPaid = async (entry: FundraisingEntry, paymentDate: string) => {
    try {
      const paidAt = paymentDate
        ? new Date(paymentDate + "T12:00:00").toISOString()
        : new Date().toISOString()
      const amountReceived = entry.amountReceived > 0 ? entry.amountReceived : entry.amountPledged
      await updateMutation.mutateAsync({
        id: entry.id,
        data: {
          donorName: entry.donorName,
          amountPledged: entry.amountPledged,
          amountReceived,
          date: entry.date,
          teamId: entry.teamId ?? undefined,
          status: "received",
          notes: entry.notes || undefined,
          beneficiary: entry.beneficiary || undefined,
          paidAt,
        },
      })
      queryClient.invalidateQueries({ queryKey: getListFundraisingQueryKey() })
      toast({ title: "Marked as paid", description: `Payment recorded for ${entry.donorName}` })
    } catch {
      toast({ title: "Failed to mark as paid", variant: "destructive" })
    }
  }

  const handleMarkAsPaid = (entry: FundraisingEntry) => {
    setMarkAsPaidDialog({ isOpen: true, entry, paymentDate: todayStr() })
  }

  const confirmMarkAsPaid = async () => {
    const { entry, paymentDate } = markAsPaidDialog
    if (!entry) return
    closeMarkAsPaidDialog()
    await doMarkAsPaid(entry, paymentDate)
  }

  const doSaveRecord = async (data: FundFormValues) => {
    try {
      const base = {
        ...data,
        teamId: data.teamId === 0 || !data.teamId ? undefined : data.teamId,
        donorEmail: data.donorEmail || undefined,
        beneficiary: data.beneficiary?.trim() || undefined,
      }
      
      if (editingEntry) {
        const payload = { ...base, paidAt: data.paidAt ? new Date(data.paidAt).toISOString() : null }
        await updateMutation.mutateAsync({ id: editingEntry.id, data: payload as any })
        toast({ title: "Record updated" })
      } else {
        const { paidAt: _unused, ...createPayload } = base
        await createMutation.mutateAsync({ data: createPayload as any })
        toast({ title: "Record created" })
      }
      queryClient.invalidateQueries({ queryKey: getListFundraisingQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  const onSubmit = async (data: FundFormValues) => {
    if (data.status === "received" && !data.donorEmail) {
      showConfirm(
        "No Email on File",
        "This donor has no email on file. A receipt cannot be sent. Save as received anyway?",
        () => {
          closeConfirm()
          doSaveRecord(data)
        }
      )
      return
    }
    await doSaveRecord(data)
  }

  const totalPledged = entries.reduce((sum, e) => sum + e.amountPledged, 0)
  const totalReceived = entries.reduce((sum, e) => sum + e.amountReceived, 0)

  const [exportStatusFilter, setExportStatusFilter] = useState<"all" | "pending" | "confirmed" | "received">("all")

  const exportCSV = async () => {
    const params = exportStatusFilter !== "all" ? `?status=${exportStatusFilter}` : ""
    const res = await fetch(`/api/fundraising/export${params}`, {
      headers: { "x-session-token": sessionToken ?? "" },
    })
    if (!res.ok) {
      toast({ title: "Export failed", variant: "destructive" })
      return
    }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const suffix = exportStatusFilter !== "all" ? `-${exportStatusFilter}` : ""
    a.download = `hk-masters-fundraising${suffix}-${format(new Date(), "yyyy-MM-dd")}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const { teamRows, playerRows } = buildBreakdown(entries, playerTeamMap)

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
        <div className="flex gap-2 items-center">
          <select
            value={exportStatusFilter}
            onChange={e => setExportStatusFilter(e.target.value as typeof exportStatusFilter)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm text-foreground shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
            aria-label="Filter by status for export"
          >
            <option value="all">All statuses</option>
            <option value="pending">Pending only</option>
            <option value="confirmed">Confirmed only</option>
            <option value="received">Received only</option>
          </select>
          <Button variant="outline" onClick={exportCSV} disabled={entries.length === 0}>
            <Download className="w-4 h-4 mr-2" /> Export CSV
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="w-5 h-5 mr-2" /> Record Donation
          </Button>
        </div>
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

      {/* Tab Bar */}
      <div className="flex gap-1 mb-4 border-b border-border">
        <button
          onClick={() => setActiveTab("records")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "records"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <List className="w-4 h-4" /> Records
        </button>
        <button
          onClick={() => setActiveTab("breakdown")}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors -mb-px ${
            activeTab === "breakdown"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          <BarChart2 className="w-4 h-4" /> Breakdown
        </button>
      </div>

      {activeTab === "records" && (
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-4 font-semibold">Donor / Sponsor</th>
                  <th className="px-6 py-4 font-semibold">Email</th>
                  <th className="px-6 py-4 font-semibold">Beneficiary</th>
                  <th className="px-6 py-4 font-semibold">Payment</th>
                  <th className="px-6 py-4 font-semibold text-right">Pledged</th>
                  <th className="px-6 py-4 font-semibold text-right">Received</th>
                  <th className="px-6 py-4 font-semibold">Status</th>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Paid Date</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr><td colSpan={10} className="px-6 py-8 text-center text-muted-foreground">Loading records...</td></tr>
                ) : entries.length === 0 ? (
                  <tr><td colSpan={10} className="px-6 py-12 text-center text-muted-foreground">No fundraising records yet.</td></tr>
                ) : (
                  entries.map(entry => (
                    <tr key={entry.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-foreground">{entry.donorName}</div>
                        {entry.teamName && <div className="text-xs text-muted-foreground">{entry.teamName}</div>}
                      </td>
                      <td className="px-6 py-4 text-muted-foreground">
                        {entry.donorEmail
                          ? <a href={`mailto:${entry.donorEmail}`} className="hover:text-primary transition-colors">{entry.donorEmail}</a>
                          : <span className="text-xs italic">—</span>
                        }
                      </td>
                      <td className="px-6 py-4">
                        {entry.beneficiary
                          ? <span className="text-xs font-medium bg-primary/8 text-primary px-2 py-0.5 rounded-full">{entry.beneficiary}</span>
                          : <span className="text-xs italic text-muted-foreground">—</span>
                        }
                      </td>
                      <td className="px-6 py-4">
                        {entry.paymentMethod === "payme" && (
                          <span className="text-xs font-medium bg-green-100 text-green-800 px-2 py-0.5 rounded-full">PayMe</span>
                        )}
                        {entry.paymentMethod === "wise" && (
                          <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Wise</span>
                        )}
                        {entry.paymentMethod === "bank_transfer" && (
                          <span className="text-xs font-medium bg-purple-100 text-purple-800 px-2 py-0.5 rounded-full">Bank Transfer</span>
                        )}
                        {!entry.paymentMethod && (
                          <span className="text-xs italic text-muted-foreground">—</span>
                        )}
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
                      <td className="px-6 py-4 text-muted-foreground">
                        {entry.paidAt
                          ? <span className="text-emerald-600 font-medium">{format(parseISO(entry.paidAt), 'MMM d, yyyy')}</span>
                          : <span className="text-xs italic">—</span>
                        }
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end items-center space-x-2">
                          {entry.status === "received" && !entry.donorEmail && (
                            <span
                              title="No email on file — receipt cannot be sent. Edit this record to add an email address."
                              className="p-1.5 text-amber-500 cursor-help"
                            >
                              <AlertTriangle className="w-4 h-4" />
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          {entry.status !== "received" && (
                            <button
                              onClick={() => handleMarkAsPaid(entry)}
                              title="Mark as paid"
                              className="p-2 text-muted-foreground hover:text-emerald-600 rounded bg-background shadow-sm border transition-all"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {entry.status === "received" && (
                            <button
                              onClick={() => entry.donorEmail ? handleResendReceipt(entry) : undefined}
                              title={entry.donorEmail ? "Resend receipt email" : "No email on file — cannot resend receipt"}
                              disabled={resendingId === entry.id || !entry.donorEmail}
                              className="p-2 text-muted-foreground hover:text-emerald-600 rounded bg-background shadow-sm border transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                            >
                              <MailCheck className="w-4 h-4" />
                            </button>
                          )}
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
      )}

      {activeTab === "breakdown" && (
        <div className="space-y-4">
          {isLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-border px-6 py-12 text-center text-muted-foreground">Loading...</div>
          ) : entries.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-border px-6 py-12 text-center text-muted-foreground">No fundraising records yet.</div>
          ) : (
            <>
              <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="px-6 py-3 border-b border-border bg-muted/20">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Team Totals</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Team-level pledges plus pledges for individual players on each team</p>
                </div>
                <table className="w-full text-sm text-left">
                  <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Team</th>
                      <th className="px-6 py-3 font-semibold text-center">Pledges</th>
                      <th className="px-6 py-3 font-semibold text-right">Total Pledged</th>
                      <th className="px-6 py-3 font-semibold text-right">Total Received</th>
                      <th className="px-6 py-3 font-semibold text-right">% Collected</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {teamRows.map((row) => {
                      const pct = row.totalPledged > 0 ? (row.totalReceived / row.totalPledged) * 100 : 0
                      return (
                        <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                          <td className="px-6 py-3">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              row.key === "general"
                                ? "bg-gray-100 text-gray-600"
                                : "bg-primary/10 text-primary"
                            }`}>{row.label}</span>
                          </td>
                          <td className="px-6 py-3 text-center text-muted-foreground">{row.count}</td>
                          <td className="px-6 py-3 text-right font-medium text-foreground">{formatCurrency(row.totalPledged)}</td>
                          <td className="px-6 py-3 text-right font-bold text-emerald-600">{formatCurrency(row.totalReceived)}</td>
                          <td className="px-6 py-3 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                              </div>
                              <span className="text-xs text-muted-foreground w-10 text-right">{row.count > 0 ? `${pct.toFixed(0)}%` : "—"}</span>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {playerRows.length > 0 && (
                <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                  <div className="px-6 py-3 border-b border-border bg-muted/20">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Individual Players</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Pledges designated for a specific player · sorted by total pledged</p>
                  </div>
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                      <tr>
                        <th className="px-6 py-3 font-semibold">Player</th>
                        <th className="px-6 py-3 font-semibold text-center">Pledges</th>
                        <th className="px-6 py-3 font-semibold text-right">Total Pledged</th>
                        <th className="px-6 py-3 font-semibold text-right">Total Received</th>
                        <th className="px-6 py-3 font-semibold text-right">% Collected</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {playerRows.map((row) => {
                        const pct = row.totalPledged > 0 ? (row.totalReceived / row.totalPledged) * 100 : 0
                        return (
                          <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                            <td className="px-6 py-3 font-medium text-foreground">{row.label}</td>
                            <td className="px-6 py-3 text-center text-muted-foreground">{row.count}</td>
                            <td className="px-6 py-3 text-right font-medium text-foreground">{formatCurrency(row.totalPledged)}</td>
                            <td className="px-6 py-3 text-right font-bold text-emerald-600">{formatCurrency(row.totalReceived)}</td>
                            <td className="px-6 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                                  <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                                </div>
                                <span className="text-xs text-muted-foreground w-10 text-right">{pct.toFixed(0)}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-border bg-muted/20">
                      <tr>
                        <td className="px-6 py-3 text-xs font-bold text-muted-foreground uppercase">All players</td>
                        <td className="px-6 py-3 text-center text-sm font-semibold">{playerRows.reduce((s, r) => s + r.count, 0)}</td>
                        <td className="px-6 py-3 text-right text-sm font-bold">{formatCurrency(playerRows.reduce((s, r) => s + r.totalPledged, 0))}</td>
                        <td className="px-6 py-3 text-right text-sm font-bold text-emerald-600">{formatCurrency(playerRows.reduce((s, r) => s + r.totalReceived, 0))}</td>
                        <td className="px-6 py-3"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={closeConfirm}
        title={confirmDialog.title}
      >
        <div className="space-y-5">
          <div className="flex gap-3">
            <div className="flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-full bg-rose-100">
              <AlertCircle className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed pt-2">{confirmDialog.message}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={closeConfirm}>Cancel</Button>
            <Button
              type="button"
              className="bg-rose-600 hover:bg-rose-700 text-white"
              onClick={confirmDialog.onConfirm}
            >
              Confirm
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={markAsPaidDialog.isOpen} onClose={closeMarkAsPaidDialog} title="Mark as Paid">
        <div className="space-y-5">
          {markAsPaidDialog.entry && !markAsPaidDialog.entry.donorEmail && (
            <div className="flex gap-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">This donor has no email on file — a receipt cannot be sent.</p>
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Payment Date</label>
            <Input
              type="date"
              value={markAsPaidDialog.paymentDate}
              max={todayStr()}
              onChange={e => setMarkAsPaidDialog(prev => ({ ...prev, paymentDate: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">Defaults to today. Change if the payment was received on an earlier date.</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={closeMarkAsPaidDialog}>Cancel</Button>
            <Button
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={confirmMarkAsPaid}
              disabled={!markAsPaidDialog.paymentDate}
            >
              Confirm Payment
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingEntry ? "Edit Record" : "New Donation Record"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Donor / Sponsor Name</label>
            <Input {...register("donorName")} placeholder="Company X or Individual Name" />
            {errors.donorName && <p className="text-xs text-destructive">{errors.donorName.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Donor Email <span className="font-normal text-muted-foreground">(Optional)</span></label>
            <Input
              type="email"
              {...register("donorEmail")}
              placeholder="donor@example.com"
              className={watchedStatus === "received" && !watchedEmail ? "border-amber-400 focus:ring-amber-400" : ""}
            />
            {errors.donorEmail && <p className="text-xs text-destructive">{errors.donorEmail.message}</p>}
            {watchedStatus === "received" && !watchedEmail && (
              <p className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 shrink-0" />
                No email on file — a receipt cannot be sent to this donor.
              </p>
            )}
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

          <div className="space-y-2">
            <label className="text-sm font-semibold">Status</label>
            <Select {...register("status")}>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="received">Received</option>
            </Select>
          </div>

          <div className={editingEntry ? "grid grid-cols-2 gap-4" : ""}>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Date</label>
              <Input type="date" {...register("date")} />
            </div>
            {editingEntry && (
              <div className="space-y-2">
                <label className="text-sm font-semibold">Payment Date <span className="font-normal text-muted-foreground">(Optional)</span></label>
                <Input type="date" {...register("paidAt")} />
                <p className="text-xs text-muted-foreground">Clear to remove the payment date.</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">
              Beneficiary <span className="font-normal text-muted-foreground">(Optional)</span>
            </label>
            <Input
              {...register("beneficiary")}
              placeholder="e.g. MO40 Team, MO50 Team, or a player name"
            />
            <p className="text-xs text-muted-foreground">Who is this donation supporting? Leave blank for a general donation.</p>
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
