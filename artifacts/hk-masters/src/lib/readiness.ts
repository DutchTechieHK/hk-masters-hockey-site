import type { Player } from "@workspace/api-client-react"

const TOURNAMENT_END = new Date("2026-08-01")

type GridCriterion = {
  key: string
  label: string
  short: string
  severity: "red" | "amber"
  pass: (p: Player) => boolean
}

export const GRID_CRITERIA: GridCriterion[] = [
  {
    key: "fee",
    label: "Fee paid",
    short: "Fee",
    severity: "amber",
    pass: (p) => p.feePaid === true,
  },
  {
    key: "passport-valid",
    label: "Passport not expired",
    short: "Passport",
    severity: "red",
    pass: (p) => {
      if (!p.passportExpiry) return false
      const d = new Date(p.passportExpiry)
      return !isNaN(d.getTime()) && d > TOURNAMENT_END
    },
  },
  {
    key: "passport-copy",
    label: "Passport copy uploaded",
    short: "Copy",
    severity: "amber",
    pass: (p) => !!p.passportCopyUrl,
  },
  {
    key: "passport-reviewed",
    label: "Passport copy reviewed",
    short: "Reviewed",
    severity: "amber",
    pass: (p) => !!p.passportCopyUrl && p.passportCopyReviewed === true,
  },
  {
    key: "flights",
    label: "Flights entered",
    short: "Flights",
    severity: "amber",
    pass: (p) => !!p.flightArrivalDateTime && !!p.flightDepartureDateTime,
  },
  {
    key: "emergency",
    label: "Emergency contact",
    short: "Emergency",
    severity: "red",
    pass: (p) => !!p.emergencyContactName && !!p.emergencyContactPhone,
  },
  {
    key: "kit",
    label: "Kit sizes filled",
    short: "Kit",
    severity: "amber",
    pass: (p) => !!p.shirtSize && !!p.shortsSize && !!p.jacketSize && !!p.poloSize && !!p.trackTopSize,
  },
]

export function computeReadiness(p: Player): Record<string, boolean> {
  return Object.fromEntries(GRID_CRITERIA.map((c) => [c.key, c.pass(p)]))
}

export function isFullyReady(p: Player): boolean {
  return GRID_CRITERIA.every((c) => c.pass(p))
}
