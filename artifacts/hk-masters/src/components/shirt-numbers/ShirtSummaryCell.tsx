import type { ShirtSummary } from "@workspace/api-client-react"

export function ShirtSummaryCell({ summary, testId }: { summary?: ShirtSummary | null; testId?: string }) {
  const current = summary?.current ?? []
  const legacy = summary?.legacyNumber ?? null
  if (current.length === 0 && legacy == null) {
    return <span data-testid={testId} className="text-xs text-muted-foreground">None</span>
  }
  return (
    <div data-testid={testId} className="flex flex-col gap-1 min-w-[8rem]">
      {current.map((a) => (
        <div key={a.id} className="flex items-center gap-1.5" title={`${a.contextName} - ${a.teamName}`}>
          <span className="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-md bg-primary/10 text-primary font-bold text-xs tabular-nums">{a.number}</span>
          <span className="text-[11px] leading-tight text-muted-foreground truncate max-w-[9rem]">{a.contextName} · {a.teamName}</span>
        </div>
      ))}
      {legacy != null && (
        <div className="flex items-center gap-1.5" title="Original number, competition not yet confirmed">
          <span className="inline-flex h-6 min-w-6 px-1 items-center justify-center rounded-md border border-dashed border-amber-400 text-amber-700 font-bold text-xs tabular-nums">{legacy}</span>
          <span className="text-[11px] leading-tight text-amber-700">Legacy, unresolved</span>
        </div>
      )}
    </div>
  )
}
