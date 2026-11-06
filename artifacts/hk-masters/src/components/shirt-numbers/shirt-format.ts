import type { ShirtAssignment, ShirtSummary } from "@workspace/api-client-react"

export function assignmentLabel(a: Pick<ShirtAssignment, "number" | "contextName" | "teamName">): string {
  return `#${a.number} ${a.contextName} / ${a.teamName}`
}

/** Labelled, context-aware summary. Never presents a universal number. */
export function shirtSummaryText(summary: ShirtSummary | undefined | null, fallbackLegacy?: number | null): string {
  if (!summary) return fallbackLegacy != null ? `#${fallbackLegacy} (original record)` : ""
  const parts = summary.current.map(assignmentLabel)
  if (summary.legacyNumber != null) parts.push(`#${summary.legacyNumber} legacy, context unknown`)
  return parts.join("; ")
}

export function formatShirtDate(value: string | null | undefined): string {
  if (!value) return "Unknown"
  const d = new Date(`${value.slice(0, 10)}T00:00:00`)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
}
