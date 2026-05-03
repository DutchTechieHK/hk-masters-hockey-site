import { useState, useEffect } from "react"
import {
  useListMatches,
  useCreateMatch,
  useUpdateMatch,
  useDeleteMatch,
  getListMatchesQueryKey,
  useListTeams,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, Lock, CalendarDays, MapPin, Clock, Radio, Flag, Ban, Upload } from "lucide-react"
import MatchesCsvImport from "@/components/ui/MatchesCsvImport"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import type { Match } from "@workspace/api-client-react/src/generated/api.schemas"
import { useToast } from "@/hooks/use-toast"

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

const matchSchema = z.object({
  teamId: z.coerce.number().int().min(1, "Team is required"),
  opponent: z.string().min(1, "Opponent is required"),
  kickoffAt: z.string().min(1, "Date and time required"),
  venue: z.string().optional(),
  status: z.enum(["scheduled", "in_progress", "final", "cancelled"]),
  ourScore: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  theirScore: z.union([z.coerce.number().int().min(0), z.literal("")]).optional(),
  notes: z.string().optional(),
})

type MatchFormValues = z.infer<typeof matchSchema>

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Scheduled",
  in_progress: "Live",
  final: "Final",
  cancelled: "Cancelled",
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800",
  in_progress: "bg-emerald-100 text-emerald-800 animate-pulse",
  final: "bg-gray-100 text-gray-700",
  cancelled: "bg-rose-100 text-rose-700",
}

function toLocalInputValue(iso: string): string {
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function Schedule() {
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

  const { data: matches = [], isLoading } = useListMatches(undefined, { query: { enabled: !!sessionToken } })
  const { data: teams = [] } = useListTeams({ query: { enabled: !!sessionToken } })

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<Match | null>(null)
  const [showCsvImport, setShowCsvImport] = useState(false)

  const createMutation = useCreateMatch()
  const updateMutation = useUpdateMatch()
  const deleteMutation = useDeleteMatch()

  const { register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = useForm<MatchFormValues>({
    resolver: zodResolver(matchSchema),
    defaultValues: { status: "scheduled" },
  })

  const watchStatus = watch("status")
  const showScores = watchStatus === "in_progress" || watchStatus === "final"

  const openAddModal = () => {
    setEditing(null)
    reset({
      teamId: teams[0]?.id ?? 0,
      opponent: "",
      kickoffAt: "",
      venue: "",
      status: "scheduled",
      ourScore: "",
      theirScore: "",
      notes: "",
    })
    setIsModalOpen(true)
  }

  const openEditModal = (m: Match) => {
    setEditing(m)
    reset({
      teamId: m.teamId,
      opponent: m.opponent,
      kickoffAt: toLocalInputValue(m.kickoffAt),
      venue: m.venue || "",
      status: m.status,
      ourScore: m.ourScore ?? "",
      theirScore: m.theirScore ?? "",
      notes: m.notes || "",
    })
    setIsModalOpen(true)
  }

  const quickStatus = async (m: Match, status: Match["status"]) => {
    try {
      await updateMutation.mutateAsync({
        id: m.id,
        data: {
          teamId: m.teamId,
          opponent: m.opponent,
          kickoffAt: m.kickoffAt,
          venue: m.venue ?? undefined,
          status,
          ourScore: m.ourScore,
          theirScore: m.theirScore,
          notes: m.notes ?? undefined,
        },
      })
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() })
      const label = status === "in_progress" ? "Match marked live" : status === "cancelled" ? "Match cancelled" : "Match updated"
      toast({ title: label })
    } catch {
      toast({ title: "Failed to update match", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this match? This cannot be undone.")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() })
      toast({ title: "Match deleted" })
    } catch {
      toast({ title: "Failed to delete match", variant: "destructive" })
    }
  }

  const onSubmit = async (data: MatchFormValues) => {
    try {
      const payload = {
        teamId: data.teamId,
        opponent: data.opponent,
        kickoffAt: new Date(data.kickoffAt).toISOString(),
        venue: data.venue || undefined,
        status: data.status,
        ourScore: data.ourScore === "" || data.ourScore === undefined ? null : Number(data.ourScore),
        theirScore: data.theirScore === "" || data.theirScore === undefined ? null : Number(data.theirScore),
        notes: data.notes || undefined,
      }
      if (editing) {
        await updateMutation.mutateAsync({ id: editing.id, data: payload })
        toast({ title: "Match updated" })
      } else {
        await createMutation.mutateAsync({ data: payload })
        toast({ title: "Match added" })
      }
      queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  // group by team
  const groupedByTeam = teams.map((t) => ({
    team: t,
    matches: matches
      .filter((m) => m.teamId === t.id)
      .sort((a, b) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime()),
  }))

  if (!sessionChecked) {
    return (
      <PageLayout title="Matches" description="Checking access...">
        <div className="flex items-center justify-center py-24 text-muted-foreground">Loading...</div>
      </PageLayout>
    )
  }

  if (!sessionToken) {
    return (
      <PageLayout title="Matches" description="Admin access required to manage matches.">
        <div className="max-w-sm mx-auto mt-12">
          <div className="bg-white rounded-2xl border border-border shadow-sm p-8">
            <div className="flex items-center justify-center w-12 h-12 bg-primary/10 rounded-full mx-auto mb-5">
              <Lock className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-center mb-1">Admin Login</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">Enter your admin password to manage matches.</p>
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
      title="Matches"
      description="Add and manage match fixtures. Visible on the public website."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCsvImport(true)} disabled={teams.length === 0}>
            <Upload className="w-4 h-4 mr-1.5" /> Import CSV
          </Button>
          <Button onClick={openAddModal} disabled={teams.length === 0}>
            <Plus className="w-5 h-5 mr-2" /> Add Match
          </Button>
        </div>
      }
    >
      {teams.length === 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800 mb-6">
          You need to create a team before you can add matches.
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading matches…</div>
      ) : matches.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-12 text-center">
          <CalendarDays className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No matches yet. Add the first fixture to get started.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedByTeam.map(({ team, matches: teamMatches }) => (
            <section key={team.id}>
              <div className="flex items-center gap-3 mb-3">
                <Badge>{team.category}</Badge>
                <h2 className="text-xl font-bold text-foreground">{team.name}</h2>
                <span className="text-sm text-muted-foreground">{teamMatches.length} match{teamMatches.length !== 1 ? "es" : ""}</span>
              </div>
              {teamMatches.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border bg-white px-5 py-6 text-sm text-muted-foreground text-center">
                  No matches scheduled for this team yet.
                </div>
              ) : (
                <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                        <tr>
                          <th className="px-6 py-3 font-semibold">When</th>
                          <th className="px-6 py-3 font-semibold">Opponent</th>
                          <th className="px-6 py-3 font-semibold">Venue</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold">Score</th>
                          <th className="px-6 py-3 font-semibold text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {teamMatches.map((m) => (
                          <tr key={m.id} className="hover:bg-muted/10 transition-colors group">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-foreground">{format(new Date(m.kickoffAt), "EEE d MMM yyyy")}</div>
                              <div className="text-xs text-muted-foreground">{format(new Date(m.kickoffAt), "HH:mm")}</div>
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground">{m.opponent}</td>
                            <td className="px-6 py-4 text-muted-foreground">{m.venue || "—"}</td>
                            <td className="px-6 py-4">
                              <Badge className={`${STATUS_COLORS[m.status] ?? ""} border-0 shadow-none`}>
                                {STATUS_LABELS[m.status] ?? m.status}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 font-mono text-foreground">
                              {m.ourScore !== null && m.theirScore !== null
                                ? `${m.ourScore} – ${m.theirScore}`
                                : <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-1 flex-wrap">
                                {m.status === "scheduled" && (
                                  <button
                                    onClick={() => quickStatus(m, "in_progress")}
                                    title="Mark as live (in progress)"
                                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-50 rounded border border-emerald-200 transition-colors"
                                  >
                                    <Radio className="w-3 h-3" /> Live
                                  </button>
                                )}
                                {(m.status === "scheduled" || m.status === "in_progress") && (
                                  <>
                                    <button
                                      onClick={() => openEditModal({ ...m, status: "final" })}
                                      title="Enter final score"
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded border border-gray-200 transition-colors"
                                    >
                                      <Flag className="w-3 h-3" /> Final
                                    </button>
                                    <button
                                      onClick={() => {
                                        if (confirm(`Cancel ${m.opponent} on ${format(new Date(m.kickoffAt), "EEE d MMM")}?`)) {
                                          quickStatus(m, "cancelled")
                                        }
                                      }}
                                      title="Cancel match"
                                      className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded border border-rose-200 transition-colors"
                                    >
                                      <Ban className="w-3 h-3" /> Cancel
                                    </button>
                                  </>
                                )}
                                <button onClick={() => openEditModal(m)} title="Edit" className="p-1.5 text-muted-foreground hover:text-blue-600 rounded border border-transparent hover:border-blue-200 transition-all">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(m.id)} title="Delete" className="p-1.5 text-muted-foreground hover:text-rose-600 rounded border border-transparent hover:border-rose-200 transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {showCsvImport && sessionToken && (
        <MatchesCsvImport
          teams={teams}
          sessionToken={sessionToken}
          onClose={() => setShowCsvImport(false)}
          onImported={() => {
            setShowCsvImport(false)
            queryClient.invalidateQueries({ queryKey: getListMatchesQueryKey() })
          }}
        />
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Edit Match" : "Add Match"}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Team</label>
            <Select {...register("teamId")}>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            {errors.teamId && <p className="text-xs text-destructive">{errors.teamId.message}</p>}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Opponent</label>
            <Input {...register("opponent")} placeholder="e.g. Netherlands MO40" />
            {errors.opponent && <p className="text-xs text-destructive">{errors.opponent.message}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Kick-off (local time)
              </label>
              <Input type="datetime-local" {...register("kickoffAt")} />
              {errors.kickoffAt && <p className="text-xs text-destructive">{errors.kickoffAt.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Venue
              </label>
              <Input {...register("venue")} placeholder="e.g. HC Rotterdam, Pitch 2" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Status</label>
            <Select {...register("status")}>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">Live (in progress)</option>
              <option value="final">Final</option>
              <option value="cancelled">Cancelled</option>
            </Select>
          </div>

          {showScores && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold">HK Score</label>
                <Input type="number" min={0} {...register("ourScore")} placeholder="0" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Opponent Score</label>
                <Input type="number" min={0} {...register("theirScore")} placeholder="0" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes (optional)</label>
            <Textarea {...register("notes")} rows={3} placeholder="Any internal notes about this fixture" />
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editing ? "Update Match" : "Add Match"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
