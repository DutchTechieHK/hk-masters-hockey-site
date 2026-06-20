import { useMemo, useState } from "react"
import { useListPlayers, useListTeams, getListPlayersQueryKey } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Download, Printer, FileText, Plane, Phone, BedDouble, SlidersHorizontal, Hotel } from "lucide-react"
import {
  exportReportCSV,
  exportReportPDF,
  IDENTITY_COLUMNS,
  FLIGHTS_COLUMNS,
  EMERGENCY_COLUMNS,
  ROOM_SHARING_COLUMNS,
  ACCOMMODATION_COLUMNS,
  ALL_REPORT_COLUMNS,
  type ReportColumn,
} from "@/lib/reports"

type PresetReport = {
  id: string
  title: string
  description: string
  icon: typeof FileText
  columns: ReportColumn[]
  filenameBase: string
}

const PRESET_REPORTS: PresetReport[] = [
  {
    id: "identity",
    title: "Identity & Passport",
    description: "Name, nationality, date of birth and passport details with expiry status.",
    icon: FileText,
    columns: IDENTITY_COLUMNS,
    filenameBase: "player-identity-report",
  },
  {
    id: "flights",
    title: "Flights & Travel",
    description: "Outbound and return flight numbers, times, arrival city and travel dates.",
    icon: Plane,
    columns: FLIGHTS_COLUMNS,
    filenameBase: "player-flights-report",
  },
  {
    id: "emergency",
    title: "Emergency Contacts",
    description: "Player phone, email and next-of-kin emergency contact details.",
    icon: Phone,
    columns: EMERGENCY_COLUMNS,
    filenameBase: "player-emergency-contacts-report",
  },
  {
    id: "rooms",
    title: "Room Sharing",
    description: "Accommodation room sharing preferences and requested roommates.",
    icon: BedDouble,
    columns: ROOM_SHARING_COLUMNS,
    filenameBase: "player-room-sharing-report",
  },
  {
    id: "accommodation",
    title: "Accommodation",
    description: "Hotel name, address and phone number for each player — useful for coaching staff in Rotterdam.",
    icon: Hotel,
    columns: ACCOMMODATION_COLUMNS,
    filenameBase: "player-accommodation-report",
  },
]

export default function Reports() {
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>("all")
  const [customKeys, setCustomKeys] = useState<string[]>(["name", "teamName"])

  const { data: teams = [] } = useListTeams()
  const { data: players = [], isLoading } = useListPlayers(
    selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined,
    {
      query: {
        queryKey: getListPlayersQueryKey(
          selectedTeamFilter !== "all" ? { teamId: parseInt(selectedTeamFilter) } : undefined,
        ),
      },
    },
  )

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players],
  )

  const scopeLabel =
    selectedTeamFilter === "all"
      ? "All teams"
      : teams.find(t => String(t.id) === selectedTeamFilter)?.name ?? "Selected team"

  const customColumns = useMemo(
    () => ALL_REPORT_COLUMNS.filter(c => customKeys.includes(c.key)),
    [customKeys],
  )
  // Keep custom report title/filename simple & scope-aware
  const customTitle = "Custom Player Report"

  const toggleKey = (key: string) => {
    setCustomKeys(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key],
    )
  }

  const hasPlayers = sortedPlayers.length > 0
  const hasCustomColumns = customColumns.length > 0

  return (
    <PageLayout
      title="Reports"
      description="Generate and export player reports for printing or sharing — filtered per team."
    >
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
        <Select
          className="sm:w-56 bg-white"
          value={selectedTeamFilter}
          onChange={e => setSelectedTeamFilter(e.target.value)}
        >
          <option value="all">All Teams</option>
          {teams.map(team => (
            <option key={team.id} value={String(team.id)}>
              {team.name}
            </option>
          ))}
        </Select>
        <span className="text-sm text-muted-foreground">
          {isLoading ? (
            "Loading players…"
          ) : (
            <>
              Reporting on <span className="font-semibold text-foreground">{scopeLabel}</span> ·{" "}
              {sortedPlayers.length} player{sortedPlayers.length === 1 ? "" : "s"}
            </>
          )}
        </span>
      </div>

      {/* Preset reports */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {PRESET_REPORTS.map(report => {
          const Icon = report.icon
          return (
            <div
              key={report.id}
              className="bg-white rounded-2xl shadow-sm border border-border p-5 flex flex-col"
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">{report.title}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{report.description}</p>
                </div>
              </div>
              <div className="flex gap-2 mt-auto pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPlayers}
                  onClick={() =>
                    exportReportCSV({
                      players: sortedPlayers,
                      columns: report.columns,
                      scopeLabel,
                      filenameBase: report.filenameBase,
                    })
                  }
                >
                  <Download className="w-4 h-4 mr-2" /> CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPlayers}
                  onClick={() =>
                    exportReportPDF({
                      players: sortedPlayers,
                      columns: report.columns,
                      title: `${report.title} — ${scopeLabel}`,
                      scopeLabel,
                    })
                  }
                >
                  <Printer className="w-4 h-4 mr-2" /> Print / PDF
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Build-your-own */}
      <div className="bg-white rounded-2xl shadow-sm border border-border p-5 mt-6">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <SlidersHorizontal className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-foreground">Build Your Own</h3>
            <p className="text-sm text-muted-foreground mt-0.5">
              Pick the columns to include, then export to CSV or a print-ready PDF.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-2 mb-4">
          {ALL_REPORT_COLUMNS.map(col => (
            <label
              key={col.key}
              className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none"
            >
              <input
                type="checkbox"
                className="rounded border-border text-primary focus:ring-primary"
                checked={customKeys.includes(col.key)}
                onChange={() => toggleKey(col.key)}
              />
              <span>{col.header}</span>
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPlayers || !hasCustomColumns}
            onClick={() =>
              exportReportCSV({
                players: sortedPlayers,
                columns: customColumns,
                scopeLabel,
                filenameBase: "custom-player-report",
              })
            }
          >
            <Download className="w-4 h-4 mr-2" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasPlayers || !hasCustomColumns}
            onClick={() =>
              exportReportPDF({
                players: sortedPlayers,
                columns: customColumns,
                title: `${customTitle} — ${scopeLabel}`,
                scopeLabel,
              })
            }
          >
            <Printer className="w-4 h-4 mr-2" /> Print / PDF
          </Button>
          {!hasCustomColumns && (
            <span className="text-xs text-muted-foreground">Select at least one column.</span>
          )}
        </div>
      </div>
    </PageLayout>
  )
}
