import { format } from "date-fns"
import type { FundraisingEntry, Player } from "@workspace/api-client-react"

export const PASSPORT_WARN_DATE = new Date("2026-10-31")

export function passportStatus(expiry?: string | null) {
  if (!expiry) return "missing"
  const d = new Date(expiry)
  return d > PASSPORT_WARN_DATE ? "ok" : "expiring"
}

export const PASSPORT_STATUS_LABEL: Record<ReturnType<typeof passportStatus>, string> = {
  ok: "OK",
  expiring: "Expiring",
  missing: "Missing",
}

export type ReportColumn = {
  /** Unique key (used by the build-your-own picker) */
  key: string
  /** Column header text */
  header: string
  /** Plain-text value for a player */
  value: (p: Player) => string
  /** Optional status pill class for the PDF (e.g. "ok" | "expiring" | "missing") */
  pdfStatus?: (p: Player) => string
}

function v(value: string | number | null | undefined): string {
  return value == null ? "" : String(value)
}

/**
 * Neutralize spreadsheet formula injection: cells starting with =, +, -, @,
 * or a tab/CR (which Excel/Sheets may interpret as a formula) get a leading
 * apostrophe so they are treated as plain text.
 */
function csvSafe(value: string): string {
  if (/^[=+\-@\t\r]/.test(value)) return `'${value}`
  return value
}

export function scopeSlug(scopeLabel: string): string {
  return scopeLabel.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "all-teams"
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function exportReportCSV(opts: {
  players: Player[]
  columns: ReportColumn[]
  scopeLabel: string
  filenameBase: string
}) {
  const { players, columns, scopeLabel, filenameBase } = opts
  const headers = columns.map(c => c.header)
  const rows = players.map(p => columns.map(c => c.value(p)))

  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${csvSafe(String(cell)).replace(/"/g, '""')}"`).join(","))
    .join("\n")

  const slug = scopeSlug(scopeLabel)
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${filenameBase}-${slug}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export function exportReportPDF(opts: {
  players: Player[]
  columns: ReportColumn[]
  title: string
  scopeLabel: string
}) {
  const { players, columns, title, scopeLabel } = opts
  const generatedAt = format(new Date(), "d MMM yyyy 'at' HH:mm")

  const headHtml = columns.map(c => `<th>${escapeHtml(c.header)}</th>`).join("")

  const bodyRows = players.map(p => {
    const tds = columns
      .map(c => {
        const text = escapeHtml(c.value(p))
        if (c.pdfStatus) {
          const status = c.pdfStatus(p)
          return `<td><span class="status status-${status}">${text}</span></td>`
        }
        return `<td>${text}</td>`
      })
      .join("")
    return `<tr>${tds}</tr>`
  }).join("")

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(title)}</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a1a1a; margin: 32px; }
  .header { display: flex; justify-content: space-between; align-items: flex-end; border-bottom: 2px solid #1a1a1a; padding-bottom: 12px; margin-bottom: 20px; }
  h1 { font-size: 20px; margin: 0 0 4px; }
  .meta { font-size: 11px; color: #555; }
  .count { font-size: 12px; font-weight: 600; text-align: right; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  thead th { background: #f1f1f1; text-align: left; padding: 8px 10px; border-bottom: 1px solid #ccc; font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
  tbody td { padding: 7px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
  tbody tr:nth-child(even) td { background: #fafafa; }
  .status { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 10px; font-weight: 600; }
  .status-ok { background: #dcfce7; color: #166534; }
  .status-expiring { background: #fef9c3; color: #854d0e; }
  .status-missing { background: #fee2e2; color: #991b1b; }
  .empty { padding: 24px; text-align: center; color: #777; font-size: 12px; }
  @media print { body { margin: 12mm; } thead { display: table-header-group; } tr { page-break-inside: avoid; } }
</style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(title)}</h1>
      <div class="meta">${escapeHtml(scopeLabel)} &middot; Generated ${escapeHtml(generatedAt)}</div>
    </div>
    <div class="count">${players.length} player${players.length === 1 ? "" : "s"}</div>
  </div>
  ${players.length === 0
    ? `<div class="empty">No players to display.</div>`
    : `<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyRows}</tbody></table>`}
  <script>window.onload = function () { window.focus(); window.print(); };<\/script>
</body>
</html>`

  const win = window.open("", "_blank")
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
}

const NAME_COL: ReportColumn = { key: "name", header: "Name", value: p => v(p.name) }
const TEAM_COL: ReportColumn = { key: "teamName", header: "Team", value: p => v(p.teamName) }

export const IDENTITY_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "nationality", header: "Nationality", value: p => v(p.nationality) },
  { key: "dateOfBirth", header: "Date of Birth", value: p => v(p.dateOfBirth) },
  { key: "hkidNumber", header: "HK ID Card Number", value: p => v(p.hkidNumber) },
  {
    key: "hkidCopyUrl",
    header: "HKID Copy",
    value: p => (p.hkidCopyUrl ? "Uploaded" : "Missing"),
    pdfStatus: p => (p.hkidCopyUrl ? "ok" : "missing"),
  },
  {
    key: "hkidCopyReviewed",
    header: "HKID Copy Reviewed",
    value: p => (p.hkidCopyReviewed ? "Yes" : "No"),
  },
  { key: "passportNumber", header: "Passport Number", value: p => v(p.passportNumber) },
  { key: "passportExpiry", header: "Passport Expiry", value: p => v(p.passportExpiry) },
  {
    key: "passportStatus",
    header: "Passport Status",
    value: p => PASSPORT_STATUS_LABEL[passportStatus(p.passportExpiry)],
    pdfStatus: p => passportStatus(p.passportExpiry),
  },
  {
    key: "passportCopyUrl",
    header: "Passport Copy",
    value: p => (p.passportCopyUrl ? "Uploaded" : "Missing"),
    pdfStatus: p => (p.passportCopyUrl ? "ok" : "missing"),
  },
  {
    key: "passportCopyReviewed",
    header: "Passport Copy Reviewed",
    value: p => (p.passportCopyReviewed ? "Yes" : "No"),
  },
]

export const FLIGHTS_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "outboundFlightNumber", header: "Outbound Flight #", value: p => v(p.outboundFlightNumber) },
  { key: "outboundDepartureDateTime", header: "Departs HK (HKT)", value: p => v(p.outboundDepartureDateTime) },
  { key: "flightArrivalDateTime", header: "Arrives Europe (local)", value: p => v(p.flightArrivalDateTime) },
  { key: "arrivalCity", header: "Arrival City/Airport", value: p => v(p.arrivalCity) },
  { key: "returnFlightNumber", header: "Return Flight #", value: p => v(p.returnFlightNumber) },
  { key: "flightDepartureDateTime", header: "Departs Europe (local)", value: p => v(p.flightDepartureDateTime) },
  { key: "returnArrivalDateTime", header: "Arrives HK (HKT)", value: p => v(p.returnArrivalDateTime) },
  { key: "travelDates", header: "Travel Dates", value: p => v(p.travelDates) },
]

export const EMERGENCY_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "phone", header: "Phone", value: p => v(p.phone) },
  { key: "email", header: "Email", value: p => v(p.email) },
  { key: "emergencyContactName", header: "Emergency Contact", value: p => v(p.emergencyContactName) },
  { key: "emergencyContactPhone", header: "Emergency Contact Phone", value: p => v(p.emergencyContactPhone) },
]

export const ROOM_SHARING_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "roomSharingPreference", header: "Room Sharing Preference", value: p => v(p.roomSharingPreference) },
  { key: "roomSharingWith", header: "Room Sharing With", value: p => v(p.roomSharingWith) },
]

export const ACCOMMODATION_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "accommodationName", header: "Hotel Name", value: p => v(p.accommodationName) },
  { key: "accommodationAddress", header: "Hotel Address", value: p => v(p.accommodationAddress) },
  { key: "accommodationPhone", header: "Hotel Phone", value: p => v(p.accommodationPhone) },
]

export const INSURANCE_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "insuranceProvider", header: "Insurance Provider", value: p => v(p.insuranceProvider) },
  { key: "insurancePolicyNumber", header: "Policy Number", value: p => v(p.insurancePolicyNumber) },
  { key: "insuranceEmergencyPhone", header: "24/7 Emergency Phone", value: p => v(p.insuranceEmergencyPhone) },
  { key: "insurancePolicyHolder", header: "Policy Holder", value: p => v(p.insurancePolicyHolder) },
  { key: "insuranceExpiry", header: "Policy Expiry", value: p => v(p.insuranceExpiry) },
  { key: "insuranceEmail", header: "Insurance Email", value: p => v(p.insuranceEmail) },
]

/** Full catalogue of fields available to the build-your-own column picker. */
export const ALL_REPORT_COLUMNS: ReportColumn[] = [
  NAME_COL,
  TEAM_COL,
  { key: "shirtNumber", header: "Shirt #", value: p => v(p.shirtNumber) },
  { key: "position", header: "Position", value: p => v(p.position) },
  { key: "email", header: "Email", value: p => v(p.email) },
  { key: "phone", header: "Phone", value: p => v(p.phone) },
  { key: "dateOfBirth", header: "Date of Birth", value: p => v(p.dateOfBirth) },
  { key: "nationality", header: "Nationality", value: p => v(p.nationality) },
  { key: "hkidNumber", header: "HK ID Card Number", value: p => v(p.hkidNumber) },
  { key: "passportNumber", header: "Passport Number", value: p => v(p.passportNumber) },
  { key: "passportExpiry", header: "Passport Expiry", value: p => v(p.passportExpiry) },
  {
    key: "passportStatus",
    header: "Passport Status",
    value: p => PASSPORT_STATUS_LABEL[passportStatus(p.passportExpiry)],
    pdfStatus: p => passportStatus(p.passportExpiry),
  },
  {
    key: "passportCopyUrl",
    header: "Passport Copy",
    value: p => (p.passportCopyUrl ? "Uploaded" : "Missing"),
    pdfStatus: p => (p.passportCopyUrl ? "ok" : "missing"),
  },
  {
    key: "passportCopyReviewed",
    header: "Passport Copy Reviewed",
    value: p => (p.passportCopyReviewed ? "Yes" : "No"),
  },
  {
    key: "hkidCopyUrl",
    header: "HKID Copy",
    value: p => (p.hkidCopyUrl ? "Uploaded" : "Missing"),
    pdfStatus: p => (p.hkidCopyUrl ? "ok" : "missing"),
  },
  {
    key: "hkidCopyReviewed",
    header: "HKID Copy Reviewed",
    value: p => (p.hkidCopyReviewed ? "Yes" : "No"),
  },
  { key: "emergencyContactName", header: "Emergency Contact", value: p => v(p.emergencyContactName) },
  { key: "emergencyContactPhone", header: "Emergency Contact Phone", value: p => v(p.emergencyContactPhone) },
  { key: "outboundFlightNumber", header: "Outbound Flight #", value: p => v(p.outboundFlightNumber) },
  { key: "outboundDepartureDateTime", header: "Departs HK (HKT)", value: p => v(p.outboundDepartureDateTime) },
  { key: "flightArrivalDateTime", header: "Arrives Europe (local)", value: p => v(p.flightArrivalDateTime) },
  { key: "arrivalCity", header: "Arrival City/Airport", value: p => v(p.arrivalCity) },
  { key: "returnFlightNumber", header: "Return Flight #", value: p => v(p.returnFlightNumber) },
  { key: "flightDepartureDateTime", header: "Departs Europe (local)", value: p => v(p.flightDepartureDateTime) },
  { key: "returnArrivalDateTime", header: "Arrives HK (HKT)", value: p => v(p.returnArrivalDateTime) },
  { key: "travelDates", header: "Travel Dates", value: p => v(p.travelDates) },
  { key: "roomSharingPreference", header: "Room Sharing Preference", value: p => v(p.roomSharingPreference) },
  { key: "roomSharingWith", header: "Room Sharing With", value: p => v(p.roomSharingWith) },
  { key: "accommodationName", header: "Hotel Name", value: p => v(p.accommodationName) },
  { key: "accommodationAddress", header: "Hotel Address", value: p => v(p.accommodationAddress) },
  { key: "accommodationPhone", header: "Hotel Phone", value: p => v(p.accommodationPhone) },
  { key: "shirtSize", header: "Shirt Size", value: p => v(p.shirtSize) },
  { key: "shortsSize", header: "Shorts Size", value: p => v(p.shortsSize) },
  { key: "jacketSize", header: "Jacket Size", value: p => v(p.jacketSize) },
  { key: "poloSize", header: "Polo Size", value: p => v(p.poloSize) },
  { key: "trackTopSize", header: "Track Top Size", value: p => v(p.trackTopSize) },
  { key: "goalieSmockSize", header: "Goalie Smock Size", value: p => v(p.goalieSmockSize) },
  { key: "dietaryRequirements", header: "Dietary Requirements", value: p => v(p.dietaryRequirements) },
  { key: "medicalNotes", header: "Medical Notes", value: p => v(p.medicalNotes) },
  { key: "feePaid", header: "Fee Paid", value: p => (p.feePaid ? "Yes" : "No") },
  { key: "paymentAmountDue", header: "Amount Due", value: p => v(p.paymentAmountDue) },
  { key: "paymentAmountPaid", header: "Amount Paid", value: p => v(p.paymentAmountPaid) },
  { key: "instagramHandle", header: "Instagram", value: p => v(p.instagramHandle) },
  { key: "facebookHandle", header: "Facebook", value: p => v(p.facebookHandle) },
  { key: "notes", header: "Notes", value: p => v(p.notes) },
  { key: "insuranceProvider", header: "Insurance Provider", value: p => v(p.insuranceProvider) },
  { key: "insurancePolicyNumber", header: "Policy Number", value: p => v(p.insurancePolicyNumber) },
  { key: "insuranceEmergencyPhone", header: "24/7 Emergency Phone", value: p => v(p.insuranceEmergencyPhone) },
  { key: "insurancePolicyHolder", header: "Policy Holder", value: p => v(p.insurancePolicyHolder) },
  { key: "insuranceExpiry", header: "Policy Expiry", value: p => v(p.insuranceExpiry) },
  { key: "insuranceEmail", header: "Insurance Email", value: p => v(p.insuranceEmail) },
]

export type PledgeTierKey = "champ" | "patron" | "friend" | "supporter" | "untiered"

export type PledgeTier = {
  key: PledgeTierKey
  label: string
  threshold: number
  deliverables: string
  accent: string
}

export type PledgeReportRow = FundraisingEntry & {
  tier: PledgeTier
  beneficiaryLabel: string
  balanceDue: number
}

export const PLEDGE_TIERS: PledgeTier[] = [
  {
    key: "champ",
    label: "Champ",
    threshold: 5000,
    deliverables: "All of the above + recognition on the public website and team kit (subject to design approval).",
    accent: "amber",
  },
  {
    key: "patron",
    label: "Patron",
    threshold: 2500,
    deliverables: "Friend benefits + a signed team photo from Rotterdam.",
    accent: "teal",
  },
  {
    key: "friend",
    label: "Friend of the Team",
    threshold: 1000,
    deliverables: "Supporter wall + a personal thank-you from the team captains.",
    accent: "blue",
  },
  {
    key: "supporter",
    label: "Supporter",
    threshold: 500,
    deliverables: "Your name added to the team's official supporter wall.",
    accent: "slate",
  },
]

export function pledgeTierForAmount(amount: number): PledgeTier {
  return PLEDGE_TIERS.find(tier => amount >= tier.threshold) ?? {
    key: "untiered",
    label: "Below tier",
    threshold: 0,
    deliverables: "No tier deliverables assigned",
    accent: "muted",
  }
}

export function pledgeBeneficiaryLabel(entry: FundraisingEntry): string {
  return entry.beneficiary?.trim() || entry.teamName?.trim() || "General"
}

export function toPledgeReportRow(entry: FundraisingEntry): PledgeReportRow {
  return {
    ...entry,
    tier: pledgeTierForAmount(Number(entry.amountPledged) || 0),
    beneficiaryLabel: pledgeBeneficiaryLabel(entry),
    balanceDue: Math.max(0, (Number(entry.amountPledged) || 0) - (Number(entry.amountReceived) || 0)),
  }
}

function pledgeDate(value?: string | null): string {
  if (!value) return "—"
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : format(date, "d MMM yyyy")
}

function pledgeCurrency(value: number): string {
  return `HK$${(Number(value) || 0).toLocaleString("en-HK", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function pledgeStatusLabel(status: FundraisingEntry["status"]): string {
  return status === "received" ? "Received" : status === "confirmed" ? "Confirmed" : "Pending"
}

export function exportPledgeReportCSV(rows: PledgeReportRow[], filenameBase = "pledge-supporter-report") {
  const headers = [
    "Donor",
    "Email",
    "Tier",
    "Deliverables",
    "Beneficiary",
    "Team",
    "Pledged",
    "Received",
    "Outstanding",
    "Payment status",
    "Pledge date",
    "Paid at",
    "Notes",
  ]
  const values = rows.map(row => [
    row.donorName,
    row.donorEmail ?? "",
    row.tier.label,
    row.tier.deliverables,
    row.beneficiaryLabel,
    row.teamName ?? "",
    pledgeCurrency(row.amountPledged),
    pledgeCurrency(row.amountReceived),
    pledgeCurrency(row.balanceDue),
    pledgeStatusLabel(row.status),
    pledgeDate(row.date ?? row.createdAt),
    pledgeDate(row.paidAt),
    row.notes ?? "",
  ])
  const csv = [headers, ...values]
    .map(row => row.map(cell => `"${csvSafe(String(cell)).replace(/"/g, '""')}"`).join(","))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filenameBase}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function exportPledgeReportPDF(rows: PledgeReportRow[], title = "Pledge & supporter tier report") {
  const generatedAt = format(new Date(), "d MMM yyyy 'at' HH:mm")
  const body = rows.map(row => `
    <tr>
      <td><strong>${escapeHtml(row.donorName)}</strong><br><span class="sub">${escapeHtml(row.donorEmail ?? "No email")}</span></td>
      <td><span class="tier tier-${row.tier.key}">${escapeHtml(row.tier.label)}</span><br><span class="sub">${escapeHtml(row.tier.deliverables)}</span></td>
      <td>${escapeHtml(row.beneficiaryLabel)}${row.teamName ? `<br><span class="sub">${escapeHtml(row.teamName)}</span>` : ""}</td>
      <td class="money">${escapeHtml(pledgeCurrency(row.amountPledged))}<br><span class="sub">Received ${escapeHtml(pledgeCurrency(row.amountReceived))}</span></td>
      <td><span class="status status-${row.status}">${escapeHtml(pledgeStatusLabel(row.status))}</span><br><span class="sub">${escapeHtml(pledgeDate(row.date ?? row.createdAt))}</span></td>
    </tr>`).join("")
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
    <style>
      *{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#163043;margin:30px;font-size:11px}
      .header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #e1a52d;padding-bottom:12px;margin-bottom:18px}
      h1{font-size:21px;margin:0 0 4px}.meta,.sub{color:#60727b;font-size:10px}.count{font-weight:bold}
      table{width:100%;border-collapse:collapse}th{text-align:left;background:#edf4f5;padding:8px;border-bottom:1px solid #c8d8da;font-size:9px;text-transform:uppercase;letter-spacing:.07em}
      td{padding:8px;border-bottom:1px solid #e5ecec;vertical-align:top}.money{font-weight:bold}.status,.tier{display:inline-block;padding:3px 7px;border-radius:12px;font-weight:bold;font-size:9px}
      .status-received{background:#d9f1e8;color:#14604c}.status-confirmed{background:#dcecf4;color:#1c526c}.status-pending{background:#fff0cf;color:#795514}
      .tier-champ{background:#fce4a5;color:#735216}.tier-patron{background:#d6efec;color:#14645c}.tier-friend{background:#dcecf4;color:#1c526c}.tier-supporter{background:#e9eff0;color:#435961}.tier-untiered{background:#eef1f1;color:#697879}
      .empty{padding:24px;text-align:center;color:#68777b}@media print{body{margin:12mm}thead{display:table-header-group}tr{page-break-inside:avoid}}
    </style></head><body><div class="header"><div><h1>${escapeHtml(title)}</h1><div class="meta">Hong Kong Masters Hockey 2026 · Generated ${escapeHtml(generatedAt)}</div></div><div class="count">${rows.length} record${rows.length === 1 ? "" : "s"}</div></div>
    ${rows.length ? `<table><thead><tr><th>Donor</th><th>Tier & deliverables</th><th>Beneficiary</th><th>Commitment</th><th>Payment</th></tr></thead><tbody>${body}</tbody></table>` : `<div class="empty">No pledge records to display.</div>`}
    <script>window.onload=function(){window.focus();window.print()}<\/script></body></html>`
  const win = window.open("", "_blank")
  if (!win) return
  win.document.open()
  win.document.write(html)
  win.document.close()
}
