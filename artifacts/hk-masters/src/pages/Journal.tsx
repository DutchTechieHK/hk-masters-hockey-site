import { useState } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Modal } from "@/components/ui/modal"
import { CheckCircle, XCircle, Clock, FileText, Image, FileImage, ChevronDown, ChevronUp } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { format, parseISO } from "date-fns"

const ADMIN_KEY = import.meta.env.VITE_ADMIN_API_KEY as string

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

async function fetchContributions(status?: Status): Promise<Contribution[]> {
  const url = status ? `/api/contributions?status=${status}` : `/api/contributions`
  const res = await fetch(url, { headers: { "x-admin-key": ADMIN_KEY } })
  if (!res.ok) throw new Error(`Failed to fetch contributions: ${res.status}`)
  return res.json()
}

async function updateContribution(
  id: number,
  body: { status: "approved" | "declined"; adminNote?: string }
): Promise<Contribution> {
  const res = await fetch(`/api/contributions/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", "x-admin-key": ADMIN_KEY },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Failed to update contribution: ${res.status}`)
  return res.json()
}

const STATUS_CONFIG: Record<Status, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: "Pending", className: "bg-amber-100 text-amber-800", icon: Clock },
  approved: { label: "Approved", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle },
  declined: { label: "Declined", className: "bg-rose-100 text-rose-800", icon: XCircle },
}

const CONTENT_TYPE_CONFIG: Record<ContentType, { label: string; icon: React.ElementType }> = {
  article: { label: "Article", icon: FileText },
  photo: { label: "Photos", icon: Image },
  both: { label: "Article + Photos", icon: FileImage },
}

const STATUS_ORDER: Status[] = ["pending", "approved", "declined"]

function StatusBadge({ status }: { status: Status }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <Badge className={`${config.className} gap-1 border-0 shadow-none capitalize whitespace-nowrap`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </Badge>
  )
}

function TypeBadge({ type }: { type: ContentType }) {
  const config = CONTENT_TYPE_CONFIG[type]
  const Icon = config.icon
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="w-3.5 h-3.5" />
      {config.label}
    </span>
  )
}

function SectionHeading({ status, count }: { status: Status; count: number }) {
  const config = STATUS_CONFIG[status]
  const Icon = config.icon
  return (
    <div className="flex items-center gap-2 px-6 py-3 bg-muted/30 border-b border-border">
      <Icon className={`w-4 h-4 ${status === "pending" ? "text-amber-600" : status === "approved" ? "text-emerald-600" : "text-rose-600"}`} />
      <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{config.label}</span>
      <span className="ml-auto text-xs text-muted-foreground font-medium">{count} submission{count !== 1 ? "s" : ""}</span>
    </div>
  )
}

export default function Journal() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null)
  const [adminNote, setAdminNote] = useState("")
  const [expandedSections, setExpandedSections] = useState<Record<Status, boolean>>({
    pending: true,
    approved: false,
    declined: false,
  })

  const { data: contributions = [], isLoading, error } = useQuery<Contribution[]>({
    queryKey: ["contributions"],
    queryFn: () => fetchContributions(),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status, note }: { id: number; status: "approved" | "declined"; note?: string }) =>
      updateContribution(id, { status, adminNote: note }),
    onSuccess: (updated) => {
      queryClient.setQueryData<Contribution[]>(["contributions"], (old = []) =>
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

  if (error) {
    return (
      <PageLayout title="Journal" description="Review community submissions.">
        <div className="bg-white rounded-2xl border border-border p-12 text-center">
          <XCircle className="w-10 h-10 text-rose-500 mx-auto mb-3" />
          <p className="text-muted-foreground">Failed to load submissions. Check that the admin API key is configured.</p>
        </div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Journal"
      description="Review and moderate community-submitted articles and photos."
    >
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        {isLoading ? (
          <div className="px-6 py-12 text-center text-muted-foreground">Loading submissions...</div>
        ) : contributions.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            No submissions yet. They will appear here once community members contribute via the public website.
          </div>
        ) : (
          STATUS_ORDER.map((status) => {
            const items = grouped[status]
            const isExpanded = expandedSections[status]
            return (
              <div key={status} className="border-b border-border last:border-0">
                <button
                  className="w-full text-left hover:bg-muted/10 transition-colors"
                  onClick={() => toggleSection(status)}
                >
                  <div className="flex items-center gap-2 px-6 py-3 bg-muted/30">
                    {(() => {
                      const Icon = STATUS_CONFIG[status].icon
                      return <Icon className={`w-4 h-4 ${status === "pending" ? "text-amber-600" : status === "approved" ? "text-emerald-600" : "text-rose-600"}`} />
                    })()}
                    <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      {STATUS_CONFIG[status].label}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground font-medium">
                      {items.length} submission{items.length !== 1 ? "s" : ""}
                    </span>
                    <span className="ml-auto">
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
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
                          <tr
                            key={c.id}
                            className="hover:bg-muted/10 transition-colors cursor-pointer"
                            onClick={() => openDetail(c)}
                          >
                            <td className="px-6 py-4">
                              <div className="font-semibold text-foreground">{c.authorName}</div>
                              <div className="text-xs text-muted-foreground">{c.authorEmail}</div>
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground max-w-xs truncate">
                              {c.title}
                            </td>
                            <td className="px-6 py-4 hidden md:table-cell">
                              <TypeBadge type={c.contentType} />
                            </td>
                            <td className="px-6 py-4 hidden sm:table-cell text-muted-foreground text-xs">
                              {format(parseISO(c.createdAt), "d MMM yyyy")}
                            </td>
                            <td className="px-6 py-4">
                              <StatusBadge status={c.status as Status} />
                            </td>
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
              <StatusBadge status={selectedContribution.status as Status} />
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
              <Button
                variant="outline"
                onClick={() => { setSelectedContribution(null); setAdminNote("") }}
              >
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
