import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { useListEmailBlasts, useListOnboardingInviteLog } from "@workspace/api-client-react"
import type { OnboardingInviteLogItem } from "@workspace/api-client-react"
import { format } from "date-fns"
import { Clock, ChevronDown, ChevronUp, Mail, Users, User, AlertTriangle, CheckCircle2, RefreshCw, Send, CheckCircle, LogIn } from "lucide-react"
import type { EmailBlastItem } from "@workspace/api-client-react"

function audienceLabel(blast: EmailBlastItem): string {
  if (blast.audienceType === "onboarding") {
    try {
      const ids: number[] = JSON.parse(blast.playerIds ?? "[]")
      return `${ids.length} player${ids.length !== 1 ? "s" : ""} invited`
    } catch {
      return "Players invited"
    }
  }
  if (blast.audienceType === "all") return "All players"
  if (blast.audienceType === "teams") {
    try {
      const ids: number[] = JSON.parse(blast.teamIds ?? "[]")
      return `Teams: ${ids.length}`
    } catch {
      return "Teams"
    }
  }
  const names = blast.recipientNames ?? []
  if (names.length === 1) return names[0]
  if (names.length === 2) return `${names[0]}, ${names[1]}`
  if (names.length > 2) return `${names[0]} + ${names.length - 1} more`
  try {
    const ids: number[] = JSON.parse(blast.playerIds ?? "[]")
    return `Individuals: ${ids.length}`
  } catch {
    return "Selected players"
  }
}

function AudienceIcon({ audienceType }: { audienceType: string }) {
  if (audienceType === "onboarding") return <Send className="w-3.5 h-3.5" />
  if (audienceType === "all") return <Users className="w-3.5 h-3.5" />
  if (audienceType === "teams") return <Users className="w-3.5 h-3.5" />
  return <User className="w-3.5 h-3.5" />
}

function OnboardingLogSection({ items }: { items: OnboardingInviteLogItem[] }) {
  const [expanded, setExpanded] = useState(false)

  if (items.length === 0) return null

  const shown = expanded ? items : items.slice(0, 5)

  return (
    <div className="mt-8">
      <div className="flex items-center gap-3 mb-3 px-1">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wide">Onboarding Invite Log</h2>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
          {items.length} player{items.length !== 1 ? "s" : ""} invited (all-time)
        </span>
      </div>
      <p className="text-xs text-muted-foreground px-1 mb-3">
        Every player who has received an onboarding invite, most recent first. Future invites are also recorded in the blast log above.
      </p>
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/30 border-b border-border text-xs text-muted-foreground uppercase">
              <th className="px-4 py-3 text-left font-semibold">Player</th>
              <th className="px-4 py-3 text-left font-semibold hidden sm:table-cell">Team</th>
              <th className="px-4 py-3 text-left font-semibold hidden md:table-cell">Email</th>
              <th className="px-4 py-3 text-left font-semibold">Portal</th>
              <th className="px-4 py-3 text-right font-semibold">Invited</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {shown.map(item => (
              <tr key={item.id} className="hover:bg-muted/10 transition-colors">
                <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                  {item.teamName ?? <span className="text-xs">—</span>}
                </td>
                <td className="px-4 py-3 text-muted-foreground hidden md:table-cell text-xs">{item.email}</td>
                <td className="px-4 py-3">
                  {item.lastLoginAt ? (
                    <div className="flex flex-col gap-0.5">
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                        <CheckCircle className="w-3 h-3" /> Logged in
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(item.lastLoginAt), "d MMM yyyy HH:mm")}
                      </span>
                    </div>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <LogIn className="w-3 h-3" /> Not yet
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-right text-xs text-muted-foreground whitespace-nowrap">
                  <span className="flex items-center justify-end gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(item.invitedAt), "d MMM yyyy")}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length > 5 && (
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-full py-3 text-xs font-medium text-primary hover:bg-muted/20 transition-colors flex items-center justify-center gap-1 border-t border-border"
          >
            {expanded ? (
              <><ChevronUp className="w-3.5 h-3.5" /> Show less</>
            ) : (
              <><ChevronDown className="w-3.5 h-3.5" /> Show all {items.length} players</>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default function EmailHistory() {
  const { data: blasts = [], isLoading, isError, refetch } = useListEmailBlasts()
  const { data: inviteLog = [] } = useListOnboardingInviteLog()
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const toggle = (id: number) => setExpandedId((prev) => (prev === id ? null : id))

  return (
    <PageLayout
      title="Email History"
      description="A log of every bulk email and onboarding invite sent to players."
    >
      {isError ? (
        <div className="bg-white rounded-2xl border border-rose-200 p-16 text-center">
          <AlertTriangle className="w-10 h-10 mx-auto text-rose-400 mb-3" />
          <p className="font-semibold text-foreground">Couldn't load email history</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            There was a problem fetching the blast log.
          </p>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Try again
          </button>
        </div>
      ) : isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-4 animate-pulse">
              <div className="h-4 bg-muted rounded w-1/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/4" />
            </div>
          ))}
        </div>
      ) : blasts.length === 0 ? (
        <>
          <div className="bg-white rounded-2xl border border-border p-16 text-center">
            <Mail className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-semibold text-foreground">No bulk emails sent yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Emails sent from the Announcements page and onboarding invites will appear here.
            </p>
          </div>
          <OnboardingLogSection items={inviteLog} />
        </>
      ) : (
        <>
          <div className="space-y-2">
            {/* Summary bar */}
            <div className="flex items-center gap-4 mb-4 px-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">{blasts.length}</span> blast{blasts.length !== 1 ? "s" : ""} sent
              </p>
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">
                  {blasts.reduce((s, b) => s + b.sentCount, 0)}
                </span>{" "}
                total deliveries
              </p>
              {blasts.some((b) => b.failedCount > 0) && (
                <p className="text-sm text-rose-600 flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span className="font-semibold">{blasts.reduce((s, b) => s + b.failedCount, 0)}</span> failed
                </p>
              )}
            </div>

            {blasts.map((blast) => {
              const isExpanded = expandedId === blast.id
              const hasFailed = blast.failedCount > 0
              const allSent = blast.failedCount === 0 && blast.sentCount > 0
              const isOnboarding = blast.audienceType === "onboarding"

              return (
                <div
                  key={blast.id}
                  className={`bg-white rounded-xl border transition-all ${
                    hasFailed ? "border-rose-200" : "border-border"
                  }`}
                >
                  <button
                    onClick={() => toggle(blast.id)}
                    className="w-full flex items-start gap-4 px-5 py-4 text-left hover:bg-muted/20 rounded-xl transition-colors"
                  >
                    {/* Status icon */}
                    <div className="shrink-0 mt-0.5">
                      {hasFailed ? (
                        <AlertTriangle className="w-4 h-4 text-rose-500" />
                      ) : (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                    </div>

                    {/* Subject + meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-foreground truncate">{blast.subject}</p>
                        {isOnboarding && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                            <Send className="w-2.5 h-2.5" /> Onboarding
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(blast.sentAt), "d MMM yyyy 'at' HH:mm")}
                        </span>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <AudienceIcon audienceType={blast.audienceType} />
                          {audienceLabel(blast)}
                        </span>
                      </div>
                    </div>

                    {/* Sent / failed badges */}
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                        allSent
                          ? "bg-green-50 text-green-700 border border-green-200"
                          : hasFailed
                            ? "bg-rose-50 text-rose-700 border border-rose-200"
                            : "bg-muted text-muted-foreground border border-border"
                      }`}>
                        {blast.sentCount} / {blast.recipientCount} sent
                      </span>
                      {hasFailed && (
                        <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                          {blast.failedCount} failed
                        </span>
                      )}
                      {isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground" />
                      }
                    </div>
                  </button>

                  {/* Expanded body preview */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-0">
                      <div className="border-t border-border pt-4">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          {isOnboarding ? "Delivery summary" : "Message body"}
                        </p>
                        <div className="bg-muted/30 rounded-xl border border-border px-4 py-3 text-sm text-foreground whitespace-pre-line leading-relaxed max-h-64 overflow-y-auto">
                          {blast.body}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <OnboardingLogSection items={inviteLog} />
        </>
      )}
    </PageLayout>
  )
}
