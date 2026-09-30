import { useMemo, useRef, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getListPlayersQueryKey, useListPlayers, useUpdateMemberPassportCopy } from "@workspace/api-client-react"
import type { Player } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, Check, CheckCircle2, ExternalLink, FileText, RefreshCw, Search, ShieldCheck, Upload, X } from "lucide-react"

type StatusFilter = "all" | "missing" | "review" | "reviewed"

function cloudinaryViewUrl(url: string): string {
  if (url.includes("res.cloudinary.com") && url.includes("/image/upload/")) {
    if (url.toLowerCase().endsWith(".pdf")) return url.replace(/\.pdf$/i, ".jpg")
    if (/\.(heic|heif)$/i.test(url)) return url.replace(/\.(heic|heif)$/i, ".jpg")
  }
  return url
}

function uploadDate(value?: string | null) {
  if (!value) return "Date not recorded"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "Date not recorded"
  return new Intl.DateTimeFormat("en-HK", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)
}

function errorMessage(error: unknown) {
  if (error && typeof error === "object" && "status" in error && error.status === 409) {
    return "This member or passport copy changed. The list has been refreshed; please check it before trying again."
  }
  return error instanceof Error && error.message ? error.message : "Please try again."
}

export default function PassportDocuments() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { data: players = [], isLoading, isError, isFetching, refetch } = useListPlayers()
  const updatePassportCopy = useUpdateMemberPassportCopy()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<StatusFilter>("all")
  const [busyId, setBusyId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  // The ref locks immediately, before React has a chance to render a disabled button.
  const busyRef = useRef<number | null>(null)

  const currentMembers = useMemo(
    () => players.filter(player => player.memberStatus !== "archived").sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  )
  const withCopy = currentMembers.filter(player => !!player.passportCopyUrl).length
  const awaitingReview = currentMembers.filter(player => player.passportCopyUrl && !player.passportCopyReviewed).length
  const reviewed = currentMembers.filter(player => player.passportCopyUrl && player.passportCopyReviewed).length
  const filtered = currentMembers.filter(player => {
    const term = search.trim().toLocaleLowerCase()
    const matchesSearch = !term || player.name.toLocaleLowerCase().includes(term) || player.email?.toLocaleLowerCase().includes(term)
    const matchesFilter =
      filter === "all" ||
      (filter === "missing" && !player.passportCopyUrl) ||
      (filter === "review" && !!player.passportCopyUrl && !player.passportCopyReviewed) ||
      (filter === "reviewed" && !!player.passportCopyUrl && !!player.passportCopyReviewed)
    return matchesSearch && matchesFilter
  })

  const release = () => {
    busyRef.current = null
    setBusyId(null)
  }

  const savePassport = async (player: Player, values: { copyUrl?: string; reviewed: boolean }) => {
    await updatePassportCopy.mutateAsync({
      id: player.id,
      data: {
        expectedCopyUrl: player.passportCopyUrl || null,
        expectedReviewed: !!player.passportCopyReviewed,
        ...values,
      },
    })
    await queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
  }

  const toggleReview = async (player: Player) => {
    if (!player.passportCopyUrl || busyRef.current !== null) return
    busyRef.current = player.id
    setBusyId(player.id)
    setError(null)
    try {
      await savePassport(player, { reviewed: !player.passportCopyReviewed })
      toast({ title: player.passportCopyReviewed ? "Review removed" : "Passport copy marked reviewed" })
    } catch (cause) {
      await queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
      const message = `Could not update ${player.name}'s review status. ${errorMessage(cause)}`
      setError(message)
      toast({ title: "Review could not be saved", description: errorMessage(cause), variant: "destructive" })
    } finally {
      release()
    }
  }

  const uploadPassport = (player: Player) => {
    if (busyRef.current !== null) return
    if (!window.cloudinary || typeof window.cloudinary.openUploadWidget !== "function") {
      const message = "Upload service is not ready. Please try again shortly."
      setError(message)
      toast({ title: message, variant: "destructive" })
      return
    }
    if (player.passportCopyUrl && !window.confirm(`Replace the existing passport copy for ${player.name}? The previous copy will no longer be linked to this member.`)) return

    busyRef.current = player.id
    setBusyId(player.id)
    setError(null)
    let receivedSuccess = false
    try {
      window.cloudinary.openUploadWidget(
        {
          cloudName: "djyvdrhal",
          uploadPreset: "hk_masters_unsigned",
          sources: ["local", "camera"],
          multiple: false,
          resourceType: "auto",
          accessMode: "public",
          clientAllowedFormats: ["jpg", "jpeg", "png", "pdf", "heic", "webp"],
          maxFileSize: 10000000,
          folder: "passport-copies",
          cropping: false,
          showAdvancedOptions: false,
          showPoweredBy: false,
        },
        async (widgetError, result) => {
          if (receivedSuccess) return
          if (widgetError) {
            release()
            const message = "Upload failed. Please try again."
            setError(message)
            toast({ title: message, variant: "destructive" })
            return
          }
          if (result.event === "close") {
            release()
            return
          }
          if (result.event !== "success") return
          receivedSuccess = true
          const url = result.info?.secure_url
          if (!url) {
            release()
            const message = "Upload finished, but no file URL was returned."
            setError(message)
            toast({ title: message, variant: "destructive" })
            return
          }
          try {
            await savePassport(player, { copyUrl: url, reviewed: true })
            toast({ title: `Passport copy saved for ${player.name}`, description: "Marked reviewed." })
          } catch (cause) {
            await queryClient.invalidateQueries({ queryKey: getListPlayersQueryKey() })
            const message = `File uploaded, but could not be saved to ${player.name}'s record. ${errorMessage(cause)}`
            setError(message)
            toast({ title: "Passport copy could not be saved", description: errorMessage(cause), variant: "destructive" })
          } finally {
            release()
          }
        },
      )
    } catch (cause) {
      release()
      const message = `Could not open the upload service. ${errorMessage(cause)}`
      setError(message)
      toast({ title: "Upload unavailable", description: errorMessage(cause), variant: "destructive" })
    }
  }

  return (
    <PageLayout
      title="Passport documents"
      description="A private working list of passport copies for current members."
      action={
        <Button variant="outline" onClick={() => { setError(null); void refetch() }} disabled={isFetching} data-testid="button-refresh-passports">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="flex flex-col gap-4 rounded-xl border border-primary/15 bg-secondary/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
            <div>
              <h2 className="font-display font-semibold text-foreground">Sensitive documents</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">Open copies only when needed. New uploads made here are marked reviewed automatically.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 pl-11 text-sm sm:pl-0">
            <span data-testid="text-passport-copy-count"><strong className="font-semibold text-foreground">{withCopy}</strong> on file</span>
            <span data-testid="text-passport-review-count"><strong className="font-semibold text-foreground">{awaitingReview}</strong> to review</span>
            <span data-testid="text-passport-missing-count"><strong className="font-semibold text-foreground">{currentMembers.length - withCopy}</strong> missing</span>
          </div>
        </div>

        {error && (
          <div role="alert" data-testid="status-passport-error" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" className="rounded p-0.5 hover:bg-destructive/10" onClick={() => setError(null)} aria-label="Dismiss error" data-testid="button-dismiss-passport-error"><X className="h-4 w-4" /></button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          <div className="flex flex-col gap-4 border-b border-border p-4 sm:px-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Search members by name or email" data-testid="input-search-passports" placeholder="Search name or email" className="pl-9" value={search} onChange={event => setSearch(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-1 rounded-lg bg-muted p-1" role="group" aria-label="Filter passport status">
              {([
                ["all", "All", currentMembers.length],
                ["review", "To review", awaitingReview],
                ["missing", "Missing", currentMembers.length - withCopy],
                ["reviewed", "Reviewed", reviewed],
              ] as const).map(([value, label, count]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={filter === value}
                  data-testid={`button-filter-passports-${value}`}
                  onClick={() => setFilter(value)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === value ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {label} <span className="ml-1 opacity-65">{count}</span>
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="divide-y divide-border" aria-label="Loading members" data-testid="status-passports-loading">
              {[0, 1, 2, 3, 4].map(index => (
                <div key={index} className="flex animate-pulse items-center gap-5 px-5 py-5">
                  <div className="h-9 w-9 shrink-0 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-2"><div className="h-3 w-36 rounded bg-muted" /><div className="h-2.5 w-48 rounded bg-muted" /></div>
                  <div className="hidden h-4 w-24 rounded bg-muted sm:block" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="alert" data-testid="status-passports-load-error">
              <AlertCircle className="h-8 w-8 text-destructive" />
              <h3 className="font-display text-lg font-semibold">Could not load member documents</h3>
              <p className="text-sm text-muted-foreground">Your records have not been changed. Try loading the list again.</p>
              <Button variant="outline" onClick={() => void refetch()} data-testid="button-retry-passports">Try again</Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-16 text-center" data-testid="status-passports-empty">
              <FileText className="mb-1 h-8 w-8 text-muted-foreground/50" />
              <h3 className="font-display text-lg font-semibold">{currentMembers.length === 0 ? "No current members" : "No matching members"}</h3>
              <p className="text-sm text-muted-foreground">{currentMembers.length === 0 ? "Current members will appear here when available." : "Try a different search or status filter."}</p>
              {currentMembers.length > 0 && <Button variant="ghost" onClick={() => { setSearch(""); setFilter("all") }} data-testid="button-clear-passport-filters">Clear filters</Button>}
            </div>
          ) : (
            <>
              <div className="hidden grid-cols-[minmax(180px,2fr)_minmax(130px,1fr)_minmax(160px,1fr)_minmax(100px,1fr)_minmax(245px,auto)] gap-4 border-b border-border bg-muted/40 px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground lg:grid">
                <span>Member</span><span>Copy</span><span>Uploaded</span><span>Review</span><span className="text-right">Actions</span>
              </div>
              <div className="divide-y divide-border">
                {filtered.map(player => {
                  const hasCopy = !!player.passportCopyUrl
                  const busy = busyId === player.id
                  return (
                    <div key={player.id} data-testid={`row-passport-${player.id}`} className={`grid gap-3 px-4 py-4 transition-colors sm:px-5 lg:grid-cols-[minmax(180px,2fr)_minmax(130px,1fr)_minmax(160px,1fr)_minmax(100px,1fr)_minmax(245px,auto)] lg:items-center lg:gap-4 ${busy ? "bg-primary/5" : "hover:bg-muted/25"}`}>
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-foreground" data-testid={`text-passport-member-${player.id}`}>{player.name}</div>
                        <div className="truncate text-xs text-muted-foreground">{player.email || "No email on file"}{player.memberStatus === "inactive" ? " · Inactive" : ""}</div>
                      </div>
                      <div>
                        <span data-testid={`status-passport-copy-${player.id}`} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium ${hasCopy ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {hasCopy ? <FileText className="h-3.5 w-3.5" /> : <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />}
                          {hasCopy ? "On file" : "Not uploaded"}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground" data-testid={`text-passport-uploaded-${player.id}`}>
                        {hasCopy ? uploadDate(player.passportCopyUploadedAt) : "—"}
                        {hasCopy && player.passportCopyUploadedIsUpdate && <span className="ml-1.5 text-primary">Updated</span>}
                      </div>
                      <div data-testid={`status-passport-reviewed-${player.id}`} className={`flex items-center gap-1.5 text-xs font-medium ${!hasCopy ? "text-muted-foreground" : player.passportCopyReviewed ? "text-emerald-700" : "text-amber-700"}`}>
                        {hasCopy && (player.passportCopyReviewed ? <CheckCircle2 className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-amber-600" />)}
                        {!hasCopy ? "—" : player.passportCopyReviewed ? "Reviewed" : "To review"}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                        {hasCopy && (
                          <Button variant="outline" size="sm" asChild>
                            <a href={cloudinaryViewUrl(player.passportCopyUrl!)} target="_blank" rel="noopener noreferrer" data-testid={`link-view-passport-${player.id}`} aria-label={`View passport copy for ${player.name}`}>
                              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />View
                            </a>
                          </Button>
                        )}
                        <Button size="sm" variant="outline" disabled={busyId !== null} onClick={() => uploadPassport(player)} data-testid={`button-upload-passport-${player.id}`}>
                          <Upload className="mr-1.5 h-3.5 w-3.5" />{busy ? "Working…" : hasCopy ? "Replace" : "Upload"}
                        </Button>
                        {hasCopy && (
                          <Button size="sm" variant={player.passportCopyReviewed ? "ghost" : "default"} disabled={busyId !== null} onClick={() => void toggleReview(player)} data-testid={`button-review-passport-${player.id}`}>
                            {player.passportCopyReviewed ? "Unreview" : <><Check className="mr-1.5 h-3.5 w-3.5" />Mark reviewed</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
          {!isLoading && !isError && <div className="border-t border-border bg-muted/20 px-5 py-3 text-xs text-muted-foreground" data-testid="text-passport-results">Showing {filtered.length} of {currentMembers.length} current members</div>}
        </div>
      </div>
    </PageLayout>
  )
}