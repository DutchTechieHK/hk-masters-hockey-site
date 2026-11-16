import { useCallback, useMemo } from "react"
import { useListMembershipCategories, getListMembershipCategoriesQueryKey } from "@workspace/api-client-react"
import type { MembershipCategory } from "@workspace/api-client-react"
import type { QueryClient } from "@tanstack/react-query"

export const AWAITING_SELECTION_KEY = "awaiting_selection"
export const TRIALS_KEY = "trials"

/** Readable fallback for keys that are missing from the catalogue. */
export function humanizeCategoryKey(key: string | null | undefined): string {
  if (!key) return "Not set"
  const words = key.replace(/[_-]+/g, " ").trim()
  if (!words) return "Not set"
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export function normalizeCategoryToken(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

/** Resolve a CSV/import value (key or display name, any case/punctuation) to a catalogue key. */
export function resolveCategoryKey(value: string, categories: MembershipCategory[]): string | null {
  const token = normalizeCategoryToken(value)
  if (!token) return null
  const byKey = categories.find((c) => normalizeCategoryToken(c.key) === token)
  if (byKey) return byKey.key
  const byName = categories.find((c) => normalizeCategoryToken(c.name) === token)
  if (byName) return byName.key
  // Preserve old CSV forms like "community member"/"community_member", but
  // never silently choose one of two punctuation-distinct category names.
  const loose = (v: string) => normalizeCategoryToken(v).replace(/[\s_.-]+/g, "_")
  const matches = categories.filter(c => loose(c.key) === loose(value) || loose(c.name) === loose(value))
  return matches.length === 1 ? matches[0].key : null
}

/** Invalidate the catalogue plus every member, fee, dashboard and import query that shows category labels/fees. */
export function invalidateMembershipCategoryDependents(queryClient: QueryClient) {
  const prefixes = ["/api/membership-categories", "/api/players", "/api/dashboard", "/api/member-bulk-edits", "/api/teams"]
  return queryClient.invalidateQueries({
    predicate: (query) => {
      const head = query.queryKey[0]
      return typeof head === "string" && prefixes.some((p) => head.startsWith(p))
    },
  })
}

export function useMembershipCategories(options?: { enabled?: boolean }) {
  const query = useListMembershipCategories({
    query: {
      queryKey: getListMembershipCategoriesQueryKey(),
      enabled: options?.enabled ?? true,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      refetchInterval: 30_000,
    },
  })
  const categories = useMemo(() => query.data ?? [], [query.data])
  const active = useMemo(() => categories.filter((c) => !c.retired), [categories])
  const byKey = useMemo(() => new Map(categories.map((c) => [c.key, c])), [categories])
  const labelFor = useCallback(
    (key: string | null | undefined) => (key ? byKey.get(key)?.name ?? humanizeCategoryKey(key) : "Not set"),
    [byKey],
  )
  /** Options for an assignment select: active categories, plus the current value if it is retired/unknown. */
  const assignmentOptions = useCallback(
    (currentKey?: string | null) => {
      const opts = active.map((c) => ({ value: c.key, label: c.name, retired: false }))
      if (currentKey && !active.some((c) => c.key === currentKey)) {
        const known = byKey.get(currentKey)
        opts.push({ value: currentKey, label: known?.retired ? `${known.name} (retired)` : labelFor(currentKey), retired: !!known?.retired })
      }
      return opts
    },
    [active, byKey, labelFor],
  )
  return {
    categories,
    active,
    byKey,
    labelFor,
    assignmentOptions,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  }
}
