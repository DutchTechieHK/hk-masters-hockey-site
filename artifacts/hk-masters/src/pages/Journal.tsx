import { useState, useEffect, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import {
  CheckCircle, XCircle, Clock, FileText, Image, FileImage,
  ChevronDown, ChevronUp, LogOut, Lock,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"

const SESSION_KEY = "hkm_admin_session"

function getStoredToken(): string | null {
  try { return localStorage.getItem(SESSION_KEY) } catch { return null }
}
function storeToken(token: string) {
  try { localStorage.setItem(SESSION_KEY, token) } catch { /* noop */ }
}
function clearToken() {
  try { localStorage.removeItem(SESSION_KEY) } catch { /* noop */ }
}

type ContentType = "article" | "photo" | "both"
type Status = "pending" | "approved" | "declined"

interface Contribution {
  id: number
  title: string
  authorName: string
  authorEmail: string
  contentType: ContentType
  articleBody?: string
  photoUrls: string[]
  status: Status
  adminNote?: string
  createdAt: string
  reviewedAt?: string
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

async function fetchContributions(token: string): Promise<Contribution[]> {
  const res = await fetch("/api/contributions", { headers: { "x-session-token": token } })
  if (res.status === 401) throw Object.assign(new Error("Unauthorized"), { status: 401 })
  if (!res.ok) throw new Error(`Failed to fetch: ${res.status}`)
  return res.json()
}

async function updateContribution(
  token: string,
  id: number,
  body: { status: "approved" | "declined"; adminNote?: string }
): Promise<Contribution> {
  const res = await fetch(`/api/contributions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-session-token": token },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to update: ${res.status}`)
  return res.json()
}

const STATUS_CONFIG: Record<Status, { label: string; className: string; Icon: React.ElementType }> = {
  pending:  { label: "Pending",  className: "bg-amber-100 text-amber-800",   Icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800", Icon: CheckCircle },
  declined: { label: "Declined", className: "bg-rose-100 text-rose-800",    Icon: XCircle },
}

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; Icon: React.ElementType }> = {
  article: { label: "Article",          Icon: FileText },
  photo:   { label: "Photos",           Icon: Image },
  both:    { label: "Article + Photos", Icon: FileImage },
}

const STATUS_ORDER: Status[] = ["pending", "approved", "declined"]

function StatusBadge({ status }: { status: Status }) {
  const { label, className, Icon } = STATUS_CONFIG[status]
  return (
    <Badge className={`${className} gap-1 border-0 shadow-none capitalize whitespace-nowrap`}>
      <Icon className="w-3 h-3" /> {label}
    </Badge>
  )
}

function TypeBadge({ type }: { type: ContentType }) {
  const { label, Icon } = CONTENT_TYPE_CONFIG[type]
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5" /> {label}
    </span>
  )
}

function LoginPanel({ onLogin }: { onLogin: (token: string) => void }) {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const token = await apiLogin(password)
      onLogin(token)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-[400px]">
      <div className="bg-white rounded-2xl shadow-sm border border-border p-10 w-full max-w-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Lock className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="font-bold text-lg">Admin Login</h2>
            <p className="text-sm text-muted-foreground">Enter the admin password to continue</p>
          </div>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <Input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !password}>
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default function Journal() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null)
  const [adminNote, setAdminNote] = useState("")
  const [expandedSections, setExpandedSections] = useState<Record<Status, boolean>>({
    pending: true, approved: false, declined: false,
  })

  useEffect(() => {
    const token = getStoredToken()
    if (!token) { setSessionChecked(true); return }
    apiCheckSession(token).then((valid) => {
      if (valid) setSessionToken(token)
      else clearToken()
    }).finally(() => setSessionChecked(true))
  }, [])

  const handleLogin = useCallback((token: string) => {
    storeToken(token)
    setSessionToken(token)
  }, [])

  const handleLogout = useCallback(async () => {
    if (sessionToken) {
      await fetch("/api/admin/auth", {
        method: "DELETE",
        headers: { "x-session-token": sessionToken },
      }).catch(() => { /* noop */ })
    }
    clearToken()
    setSessionToken(null)
    queryClient.removeQueries({ queryKey: ["contributions"] })
  }, [sessionToken, queryClient])

  const { data: contributions = [], isLoading, error } = useQuery<Contribution[]>({
    queryKey: ["contributions", sessionToken],
    queryFn: () => fetchContributions(sessionToken!),
    enabled: !!sessionToken,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: "approved" | "declined"; note?: string }) =>
      updateContribution(sessionToken!, id, { status, adminNote: note }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Contribution[]>(["contributions", sessionToken], (old = []) =>
        old.map((c) => (c.id === updated.id ? updated : c))
      )
      setSelectedContribution(null)
      setAdminNote("")
      toast({ title: `Submission ${updated.status}` })
    },
    onError: () => {
      toast({ title: "Failed to update submission", variant: "destructive" })
    },
  })

  if (!sessionChecked) {
    return (
      <PageLayout title="Journal" description="Review and moderate community-submitted articles and photos.">
        <div className="text-center py-12 text-muted-foreground">Loading...</div>
      </PageLayout>
    )
  }

  if (!sessionToken) {
    return (
      <PageLayout title="Journal" description="Review and moderate community-submitted articles and photos.">
        <LoginPanel onLogin={handleLogin} />
      </PageLayout>
    )
  }

  const grouped = STATUS_ORDER.reduce<Record<Status, Contribution[]>>(
    (acc, s) => ({ ...acc, [s]: contributions.filter((c) => c.status === s) }),
    { pending: [], approved: [], declined: [] }
  )

  const openDetail = (c: Contribution) => {
    setSelectedContribution(c)
    setAdminNote(c.adminNote ?? "")
  }

  const toggleSection = (status: Status) => {
    setExpandedSections((prev) => ({ ...prev, [status]: !prev[status] }))
  }

  const handleDecision = (status: "approved" | "declined") => {
    if (!selectedContribution) return
    updateMutation.mutate({ id: selectedContribution.id, status, note: adminNote || undefined })
  }

  const isUnauthorized = error && (error as { status?: number }).status === 401

  if (isUnauthorized) {
    clearToken()
    setSessionToken(null)
    return null
  }

  return (
    <PageLayout
      title="Journal"
      description="Review and moderate community-submitted articles and photos."
      action={
        <Button variant="outline" size="sm" onClick={handleLogout} className="gap-2">
          <LogOut className="w-4 h-4" /> Sign Out
        </Button>
      }
    >
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-muted-foreground">Loading submissions...</div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-muted-foreground">Failed to load submissions.</div>
        ) : contributions.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            No submissions yet. They will appear here once community members contribute via the public website.
          </div>
        ) : (
          STATUS_ORDER.map((status) => {
            const items = grouped[status]
            const isExpanded = expandedSections[status]
            const { label, Icon } = STATUS_CONFIG[status]
            const iconColor = status === "pending" ? "text-amber-600" : status === "approved" ? "text-emerald-600" : "text-rose-600"
            return (
              <div key={status} className="border-b border-border last:border-0">
                <button className="w-full text-left hover:bg-muted/10 transition-colors" onClick={() => toggleSection(status)}>
                  <div className="flex items-center gap-2 px-6 py-3 bg-muted/30">
                    <Icon className={`w-4 h-4 ${iconColor}`} />
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
                    <span className="ml-2 text-xs text-muted-foreground font-medium">
                      {items.length} submission{items.length !== 1 ? "s" : ""}
                    </span>
                    <span className="ml-auto">
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  items.length === 0 ? (
                    <div className="px-6 py-6 text-sm text-muted-foreground italic">No {status} submissions.</div>
                  ) : (
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/10 border-b border-border">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Contributor</th>
                          <th className="px-6 py-3 font-semibold">Title</th>
                          <th className="px-6 py-3 font-semibold hidden md:table-cell">Type</th>
                          <th className="px-6 py-3 font-semibold hidden sm:table-cell">Submitted</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {items.map((c) => (
                          <tr key={c.id} className="hover:bg-muted/10 transition-colors cursor-pointer" onClick={() => openDetail(c)}>
                            <td className="px-6 py-4">
                              <div className="font-semibold text-foreground">{c.authorName}</div>
                              <div className="text-xs text-muted-foreground">{c.authorEmail}</div>
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground max-w-xs truncate">{c.title}</td>
                            <td className="px-6 py-4 hidden md:table-cell"><TypeBadge type={c.contentType} /></td>
                            <td className="px-6 py-4 hidden sm:table-cell text-muted-foreground text-xs">
                              {format(parseISO(c.createdAt), "d MMM yyyy")}
                            </td>
                            <td className="px-6 py-4"><StatusBadge status={c.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            )
          })
        )}
      </div>

      {selectedContribution && (
        <Modal
          isOpen={true}
          onClose={() => { setSelectedContribution(null); setAdminNote("") }}
          title={selectedContribution.title}
          description={`Submitted by ${selectedContribution.authorName} · ${format(parseISO(selectedContribution.createdAt), "d MMM yyyy")}`}
        >
          <div className="space-y-5">
            <div className="flex items-center gap-3 flex-wrap">
              <StatusBadge status={selectedContribution.status} />
              <TypeBadge type={selectedContribution.contentType} />
              <span className="text-xs text-muted-foreground">{selectedContribution.authorEmail}</span>
            </div>

            {selectedContribution.articleBody && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Article</h4>
                <div className="bg-muted/20 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap border border-border">
                  {selectedContribution.articleBody}
                </div>
              </div>
            )}

            {selectedContribution.photoUrls.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Photos ({selectedContribution.photoUrls.length})
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {selectedContribution.photoUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noreferrer" className="block rounded-lg overflow-hidden border border-border hover:opacity-80 transition-opacity">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-32 object-cover" loading="lazy" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedContribution.adminNote && selectedContribution.status !== "pending" && (
              <div className="bg-muted/20 rounded-xl p-3 border border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Previous Admin Note</p>
                <p className="text-sm">{selectedContribution.adminNote}</p>
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground block mb-2">
                Admin Note (optional)
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add an internal note about this decision..."
                rows={3}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div className="flex justify-between gap-3 pt-2 border-t">
              <Button variant="outline" onClick={() => { setSelectedContribution(null); setAdminNote("") }}>
                Close
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="border-rose-200 text-rose-700 hover:bg-rose-50"
                  disabled={updateMutation.isPending || selectedContribution.status === "declined"}
                  onClick={() => handleDecision("declined")}
                >
                  <XCircle className="w-4 h-4 mr-1.5" />
                  {updateMutation.isPending ? "Saving..." : "Decline"}
                </Button>
                <Button
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  disabled={updateMutation.isPending || selectedContribution.status === "approved"}
                  onClick={() => handleDecision("approved")}
                >
                  <CheckCircle className="w-4 h-4 mr-1.5" />
                  {updateMutation.isPending ? "Saving..." : "Approve"}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </PageLayout>
  )
}
