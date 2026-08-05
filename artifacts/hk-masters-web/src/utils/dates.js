/**
 * Date display utilities shared across public pages.
 *
 * All ISO timestamps from the API are sliced to YYYY-MM-DD before parsing.
 * This makes the rendered calendar day timezone-safe: the public pages show
 * the same date the admin chose regardless of the viewer's local timezone.
 */
import { format, parseISO } from "date-fns";

/**
 * Pick the display date for a news post, preferring reportDate over publishedAt.
 *
 * @param {string|null|undefined} reportDate
 * @param {string|null|undefined} publishedAt
 * @returns {string|null} Formatted date like "15 Jun 2025", or null.
 */
export function newsDisplayDate(reportDate, publishedAt) {
  const iso = reportDate || publishedAt;
  if (!iso) return null;
  return format(parseISO(iso.slice(0, 10)), "d MMM yyyy");
}

/**
 * Pick the display date for a journal contribution, preferring reportDate
 * over createdAt.
 *
 * @param {string|null|undefined} reportDate
 * @param {string|null|undefined} createdAt
 * @returns {string|null} Formatted date like "15 Jun 2025", or null.
 */
export function contributionDisplayDate(reportDate, createdAt) {
  const iso = reportDate || createdAt;
  if (!iso) return null;
  return format(parseISO(iso.slice(0, 10)), "d MMM yyyy");
}

/**
 * Extract the YYYY-MM-DD calendar day from an ISO timestamp.
 * Use this when you need the raw day string rather than a formatted label.
 *
 * @param {string|null|undefined} isoTimestamp
 * @returns {string|null}
 */
export function isoToCalendarDay(isoTimestamp) {
  if (!isoTimestamp) return null;
  return isoTimestamp.slice(0, 10);
}
