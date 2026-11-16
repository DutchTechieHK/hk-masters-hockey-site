export type RosterSortable = { selected?: boolean; shirtNumber?: number | null; name: string }

/**
 * Roster and squad order used on the Teams page:
 * selection status first, then shirt number (no number last), then name.
 */
export function compareRosterOrder(a: RosterSortable, b: RosterSortable): number {
  const bySelection = Number(Boolean(b.selected)) - Number(Boolean(a.selected))
  if (bySelection !== 0) return bySelection
  const aNumber = a.shirtNumber ?? Number.POSITIVE_INFINITY
  const bNumber = b.shirtNumber ?? Number.POSITIVE_INFINITY
  if (aNumber !== bNumber) return aNumber < bNumber ? -1 : 1
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}
