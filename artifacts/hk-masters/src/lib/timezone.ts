export const ROTTERDAM_TZ = "Europe/Amsterdam"
export const HK_TZ = "Asia/Hong_Kong"

export function getScopeTimezone(scope?: string): string {
  return scope === "world_cup_2026" ? ROTTERDAM_TZ : HK_TZ
}

export function getScopeTimezoneLabel(scope?: string): string {
  return scope === "world_cup_2026" ? "Rotterdam time" : "HKT"
}

export function zoneOffsetMs(instant: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(instant))
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  ) as Record<string, string>
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return wallAsUtc - instant
}

// Convert a UTC ISO string to a "YYYY-MM-DDTHH:mm" wall-clock string in the given zone.
export function toZoneInputValue(iso: string, tz: string): string {
  if (!iso) return ""
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, hour12: false,
        year: "numeric", month: "2-digit", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date(iso))
        .filter(p => p.type !== "literal")
        .map(p => [p.type, p.value])
    ) as Record<string, string>
    return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
  } catch (e) {
    return ""
  }
}

// Treat a "YYYY-MM-DDTHH:mm" string as wall-clock time in the given zone and return UTC ISO.
export function zoneInputToIso(localDateTime: string, tz: string): string {
  if (!localDateTime) return ""
  try {
    const target = new Date(`${localDateTime}:00Z`).getTime()
    let offset = zoneOffsetMs(target, tz)
    let instant = target - offset
    offset = zoneOffsetMs(instant, tz)
    instant = target - offset
    return new Date(instant).toISOString()
  } catch (e) {
    return ""
  }
}

// Format a UTC ISO string to a human-readable wall-clock string in the given zone.
export function formatZoneTime(iso: string, tz: string): string {
  if (!iso) return ""
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: tz, hour12: false,
        weekday: "short", day: "numeric", month: "short",
        hour: "2-digit", minute: "2-digit",
      }).formatToParts(new Date(iso))
        .filter(p => p.type !== "literal")
        .map(p => [p.type, p.value])
    ) as Record<string, string>
    // e.g. "Sun 11 Aug, 14:30"
    return `${parts.weekday} ${parts.day} ${parts.month}, ${parts.hour}:${parts.minute}`
  } catch (e) {
    return ""
  }
}
