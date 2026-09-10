export const ROTTERDAM_ARCHIVE_CATEGORIES = new Set(["MO40", "MO50"])

export function isTeamVisibleForScope(category: string, scope?: string): boolean {
  const isArchiveCategory = ROTTERDAM_ARCHIVE_CATEGORIES.has(category)
  return scope === "world_cup_2026" ? isArchiveCategory : !isArchiveCategory
}