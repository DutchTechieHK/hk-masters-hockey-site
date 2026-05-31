import { useState, useEffect, useCallback } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, Edit2, Footprints, Lock, CheckCircle2, Timer, TrendingUp, DollarSign } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { format, parseISO } from "date-fns"

const SESSION_KEY = "hkm_admin_session"
function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
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

function apiFetch(path: string, opts: RequestInit = {}) {
  const token = getStoredToken()
  return fetch(path, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-session-token": token ?? "",
      ...(opts.headers ?? {}),
    },
  }).then(async (res) => {
    if (res.status === 204) return null
    const data = await res.json()
    if (!res.ok) throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`)
    return data
  })
}

type Participant = {
  id: number
  participantName: string
  participantEmail: string | null
  pledgePerKm: number
  distanceKm: number | null
  totalRaised: number | null
  status: string
  notes: string | null
  createdAt: string
}

type FormValues = {
  participantName: string
  participantEmail: string
  pledgePerKm: string
  distanceKm: string
  notes: string
}

const EMPTY_FORM: FormValues = {
  participantName: "",
  participantEmail: "",
  pledgePerKm: "",
  distanceKm: "",
  notes: "",
}

function participantToForm(p: Participant): FormValues {
  return {
    participantName: p.participantName,
    participantEmail: p.participantEmail ?? "",
    pledgePerKm: p.pledgePerKm > 0 ? String(p.pledgePerKm) : "",
    distanceKm: p.distanceKm != null ? String(p.distanceKm) : "",
    notes: p.notes ?? "",
  }
}

export default function FunRun() {
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
      localStorage.setItem(SESSION_KEY, token)
      setSessionToken(token)
      setLoginPassword("")
    } catch (err) {
      setLoginError((err as Error).message || "Login failed")
    } finally {
      setLoginLoading(false)
    }
  }

  const [participants, setParticipants] = useState<Participant[]>([])
  const [loading, setLoading] = useState(false)

  const fetchParticipants = useCallback(async () => {
    if (!sessionToken) return
    setLoading(true)
    try {
      const data = await apiFetch("/api/fun-run")
      setParticipants(data as Participant[])
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to load participants", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [sessionToken, toast])

  useEffect(() => {
    if (sessionToken) fetchParticipants()
  }, [sessionToken, fetchParticipants])

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingParticipant, setEditingParticipant] = useState<Participant | null>(null)
  const [formValues, setFormValues] = useState<FormValues>(EMPTY_FORM)
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
  const [formSubmitting, setFormSubmitting] = useState(false)

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
  }>({ isOpen: false, title: "", message: "", onConfirm: () => {} })

  const [recordDistanceDialog, setRecordDistanceDialog] = useState<{
    isOpen: boolean
    participant: Participant | null
    distanceKm: string
  }>({ isOpen: false, participant: null, distanceKm: "" })

  const showConfirm = (title: string, message: string, onConfirm: () => void) => {
    setConfirmDialog({ isOpen: true, title, message, onConfirm })
  }

  const openAddModal = () => {
    setEditingParticipant(null)
    setFormValues(EMPTY_FORM)
    setFormErrors({})
    setIsModalOpen(true)
  }

  const openEditModal = (p: Participant) => {
    setEditingParticipant(p)
    setFormValues(participantToForm(p))
    setFormErrors({})
    setIsModalOpen(true)
  }

  const validateForm = (values: FormValues): Partial<Record<keyof FormValues, string>> => {
    const errors: Partial<Record<keyof FormValues, string>> = {}
    if (!values.participantName.trim()) errors.participantName = "Name is required"
    if (values.participantEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.participantEmail.trim())) {
      errors.participantEmail = "Invalid email address"
    }
    const pledge = parseFloat(values.pledgePerKm)
    if (values.pledgePerKm && (isNaN(pledge) || pledge < 0)) {
      errors.pledgePerKm = "Must be a non-negative number"
    }
    const dist = parseFloat(values.distanceKm)
    if (values.distanceKm && (isNaN(dist) || dist < 0)) {
      errors.distanceKm = "Must be a non-negative number"
    }
    return errors
  }

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const errors = validateForm(formValues)
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors)
      return
    }
    setFormSubmitting(true)
    try {
      const body = {
        participantName: formValues.participantName.trim(),
        participantEmail: formValues.participantEmail.trim() || null,
        pledgePerKm: formValues.pledgePerKm ? parseFloat(formValues.pledgePerKm) : 0,
        distanceKm: formValues.distanceKm ? parseFloat(formValues.distanceKm) : null,
        notes: formValues.notes.trim() || null,
      }
      if (editingParticipant) {
        const updated = await apiFetch(`/api/fun-run/${editingParticipant.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        }) as Participant
        setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p))
        toast({ title: "Participant updated" })
      } else {
        const created = await apiFetch("/api/fun-run", {
          method: "POST",
          body: JSON.stringify(body),
        }) as Participant
        setParticipants(prev => [...prev, created])
        toast({ title: "Participant added" })
      }
      setIsModalOpen(false)
    } catch (err) {
      toast({ title: (err as Error).message || "An error occurred", variant: "destructive" })
    } finally {
      setFormSubmitting(false)
    }
  }

  const handleDelete = (p: Participant) => {
    showConfirm(
      "Delete Participant",
      `Remove ${p.participantName} from the fun run? This action cannot be undone.`,
      async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }))
        try {
          await apiFetch(`/api/fun-run/${p.id}`, { method: "DELETE" })
          setParticipants(prev => prev.filter(x => x.id !== p.id))
          toast({ title: "Participant deleted" })
        } catch (err) {
          toast({ title: (err as Error).message || "Failed to delete", variant: "destructive" })
        }
      }
    )
  }

  const openRecordDistance = (p: Participant) => {
    setRecordDistanceDialog({
      isOpen: true,
      participant: p,
      distanceKm: p.distanceKm != null ? String(p.distanceKm) : "",
    })
  }

  const handleRecordDistance = async () => {
    const { participant, distanceKm } = recordDistanceDialog
    if (!participant) return
    const dist = parseFloat(distanceKm)
    if (isNaN(dist) || dist < 0) {
      toast({ title: "Please enter a valid distance", variant: "destructive" })
      return
    }
    setRecordDistanceDialog(prev => ({ ...prev, isOpen: false }))
    try {
      const updated = await apiFetch(`/api/fun-run/${participant.id}`, {
        method: "PUT",
        body: JSON.stringify({ distanceKm: dist, status: "completed" }),
      }) as Participant
      setParticipants(prev => prev.map(p => p.id === updated.id ? updated : p))
      toast({ title: "Distance recorded", description: `${participant.participantName}: ${dist} km` })
    } catch (err) {
      toast({ title: (err as Error).message || "Failed to record distance", variant: "destructive" })
    }
  }

  const totalRaised = participants.reduce((sum, p) => sum + (p.totalRaised ?? 0), 0)
  const totalPledgedPipeline = participants.reduce((sum, p) => sum + p.pledgePerKm, 0)
  const completedCount = participants.filter(p => p.status === "completed").length
  const registeredCount = participants.filter(p => p.status === "registered").length

  if (!sessionChecked) {
    return (
      <PageLayout title="Fun Run" description="Checking access...">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </PageLayout>
    )
  }

  if (!sessionToken) {
    return (
      <PageLayout title="Fun Run" description="Admin access required.">
        <div className="max-w-sm mx-auto mt-12">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto mb-5">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-center mb-1">Admin Login</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Enter your admin password to access fun run records.</p>
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
      title="Fun Run"
      description="Track participants, pledges per km, and total funds raised."
      action={
        <Button onClick={openAddModal}>
          <Plus className="w-5 h-5 mr-2" /> Add Participant
        </Button>
      }
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg shadow-emerald-900/20">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <DollarSign className="w-32 h-32" />
          </div>
          <div className="relative z-10">
            <p className="text-emerald-100 font-medium mb-1 uppercase tracking-wider text-xs">Total Raised</p>
            <p className="text-3xl font-display font-bold">{formatCurrency(totalRaised)}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs uppercase tracking-wider">
            <TrendingUp className="w-4 h-4" />
            Participants
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{participants.length}</p>
          <p className="text-xs text-muted-foreground mt-1">{registeredCount} registered · {completedCount} completed</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs uppercase tracking-wider">
            <CheckCircle2 className="w-4 h-4" />
            Completed
          </div>
          <p className="text-3xl font-display font-bold text-foreground">{completedCount}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {participants.length > 0
              ? `${Math.round((completedCount / participants.length) * 100)}% of participants`
              : "No participants yet"}
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-border shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground mb-1 text-xs uppercase tracking-wider">
            <Footprints className="w-4 h-4" />
            Total Distance
          </div>
          <p className="text-3xl font-display font-bold text-foreground">
            {participants.reduce((sum, p) => sum + (p.distanceKm ?? 0), 0).toFixed(1)} km
          </p>
          <p className="text-xs text-muted-foreground mt-1">across all completed runners</p>
        </div>
      </div>

      {/* Participants Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted border-b border-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Participant</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold text-right">Pledge / km</th>
                <th className="px-4 py-3 font-semibold text-right">Distance</th>
                <th className="px-4 py-3 font-semibold text-right">Total Raised</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold text-right sticky right-0 z-20 bg-muted border-l border-border">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-muted-foreground">Loading participants...</td>
                </tr>
              ) : participants.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <Footprints className="w-10 h-10 opacity-30" />
                      <div>
                        <p className="font-medium">No participants yet</p>
                        <p className="text-xs mt-1">Click "Add Participant" to get started.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                participants.map(p => (
                  <tr key={p.id} className="hover:bg-muted/10 transition-colors group">
                    <td className="px-4 py-3">
                      <div className="font-semibold text-foreground whitespace-nowrap">{p.participantName}</div>
                      <div className="text-xs text-muted-foreground">
                        Added {format(parseISO(p.createdAt), "d MMM yyyy")}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[180px]">
                      {p.participantEmail
                        ? <a href={`mailto:${p.participantEmail}`} className="hover:text-primary transition-colors block truncate" title={p.participantEmail}>{p.participantEmail}</a>
                        : <span className="text-xs italic">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {p.pledgePerKm > 0 ? formatCurrency(p.pledgePerKm) : <span className="text-muted-foreground italic text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {p.distanceKm != null
                        ? <span className="font-mono">{p.distanceKm} km</span>
                        : <span className="text-muted-foreground italic text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right font-mono">
                      {p.totalRaised != null && p.totalRaised > 0
                        ? <span className="text-emerald-700 font-semibold">{formatCurrency(p.totalRaised)}</span>
                        : <span className="text-muted-foreground italic text-xs">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      {p.status === "completed"
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full whitespace-nowrap"><CheckCircle2 className="w-3 h-3" /> Completed</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full whitespace-nowrap"><Timer className="w-3 h-3" /> Registered</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[160px]">
                      {p.notes
                        ? <span className="text-xs truncate block" title={p.notes}>{p.notes}</span>
                        : <span className="text-xs italic">—</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-right sticky right-0 z-10 bg-white border-l border-border group-hover:bg-muted/10 transition-colors">
                      <div className="flex items-center justify-end gap-1">
                        {p.status === "registered" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => openRecordDistance(p)}
                          >
                            <Footprints className="w-3 h-3 mr-1" /> Record
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditModal(p)}
                          title="Edit"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                          onClick={() => handleDelete(p)}
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {participants.length > 0 && (
              <tfoot className="bg-muted/50 border-t border-border">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Totals</td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                    {formatCurrency(totalPledgedPipeline)}<span className="text-muted-foreground font-normal"> /km</span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold">
                    {participants.reduce((sum, p) => sum + (p.distanceKm ?? 0), 0).toFixed(1)} km
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs font-semibold text-emerald-700">
                    {formatCurrency(totalRaised)}
                  </td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingParticipant ? "Edit Participant" : "Add Participant"}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Name <span className="text-destructive">*</span>
            </label>
            <Input
              value={formValues.participantName}
              onChange={e => setFormValues(v => ({ ...v, participantName: e.target.value }))}
              placeholder="Full name"
              autoFocus
            />
            {formErrors.participantName && (
              <p className="text-xs text-destructive mt-1">{formErrors.participantName}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email</label>
            <Input
              type="email"
              value={formValues.participantEmail}
              onChange={e => setFormValues(v => ({ ...v, participantEmail: e.target.value }))}
              placeholder="email@example.com"
            />
            {formErrors.participantEmail && (
              <p className="text-xs text-destructive mt-1">{formErrors.participantEmail}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Pledge per km (HKD)</label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formValues.pledgePerKm}
              onChange={e => setFormValues(v => ({ ...v, pledgePerKm: e.target.value }))}
              placeholder="e.g. 100"
            />
            {formErrors.pledgePerKm && (
              <p className="text-xs text-destructive mt-1">{formErrors.pledgePerKm}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Distance run (km)
              <span className="text-muted-foreground font-normal ml-1">— leave blank until after the run</span>
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={formValues.distanceKm}
              onChange={e => setFormValues(v => ({ ...v, distanceKm: e.target.value }))}
              placeholder="e.g. 5.5"
            />
            {formErrors.distanceKm && (
              <p className="text-xs text-destructive mt-1">{formErrors.distanceKm}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <Input
              value={formValues.notes}
              onChange={e => setFormValues(v => ({ ...v, notes: e.target.value }))}
              placeholder="Optional notes"
            />
          </div>

          {formValues.pledgePerKm && formValues.distanceKm && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
              <span className="font-medium">Estimated total: </span>
              {formatCurrency(parseFloat(formValues.pledgePerKm || "0") * parseFloat(formValues.distanceKm || "0"))}
            </div>
          )}

          <div className="flex gap-3 pt-2 justify-end">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={formSubmitting}>
              {formSubmitting ? "Saving…" : editingParticipant ? "Save Changes" : "Add Participant"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Record Distance Modal */}
      <Modal
        isOpen={recordDistanceDialog.isOpen}
        onClose={() => setRecordDistanceDialog(prev => ({ ...prev, isOpen: false }))}
        title={`Record Distance — ${recordDistanceDialog.participant?.participantName ?? ""}`}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the distance this participant completed in the fun run.
          </p>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Distance (km) <span className="text-destructive">*</span>
            </label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={recordDistanceDialog.distanceKm}
              onChange={e => setRecordDistanceDialog(prev => ({ ...prev, distanceKm: e.target.value }))}
              placeholder="e.g. 5.5"
              autoFocus
            />
          </div>
          {recordDistanceDialog.participant && recordDistanceDialog.distanceKm && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-sm text-emerald-800">
              <span className="font-medium">Total raised: </span>
              {formatCurrency(
                recordDistanceDialog.participant.pledgePerKm * parseFloat(recordDistanceDialog.distanceKm || "0")
              )}
              <span className="text-emerald-600 ml-1">
                ({recordDistanceDialog.distanceKm} km × {formatCurrency(recordDistanceDialog.participant.pledgePerKm)}/km)
              </span>
            </div>
          )}
          <div className="flex gap-3 pt-2 justify-end">
            <Button variant="outline" onClick={() => setRecordDistanceDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button onClick={handleRecordDistance} disabled={!recordDistanceDialog.distanceKm}>
              <CheckCircle2 className="w-4 h-4 mr-2" /> Record & Mark Complete
            </Button>
          </div>
        </div>
      </Modal>

      {/* Confirm Dialog */}
      <Modal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
        title={confirmDialog.title}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{confirmDialog.message}</p>
          <div className="flex gap-3 pt-2 justify-end">
            <Button variant="outline" onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDialog.onConfirm}>
              Confirm
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
