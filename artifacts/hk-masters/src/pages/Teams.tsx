import { useEffect, useState } from "react"
import {
  useListTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  getListTeamsQueryKey,
  useListPlayers,
  useListCurrentSquadCandidates,
  useUpdateCurrentSquadSelection,
  useSetSquadShirtNumber,
  getListCurrentSquadCandidatesQueryKey,
} from "@workspace/api-client-react"
import { useQueryClient } from "@tanstack/react-query"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit2, Trash2, Mail, Phone, Users, ChevronLeft, CheckCircle, XCircle } from "lucide-react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { format } from "date-fns"
import { useQuery } from "@tanstack/react-query"
import { getStoredAdminToken } from "@/lib/admin-auth"
import { isTeamVisibleForScope } from "@/lib/teamScope"
import { compareRosterOrder } from "@/lib/rosterOrder"
import { useMembershipCategories } from "@/lib/membership-categories"
import type { Team } from "@workspace/api-client-react"
import { useToast } from "@/hooks/use-toast"

// A team is defined by its section and the member categories it draws from.
// Manager, assistant manager, coach and captain are members picked from the
// list (kept outside this schema, see TeamStaffPicker below).
const teamSchema = z.object({
  name: z.string().min(1, "Name is required"),
  membershipSection: z.enum(["men", "women"], { message: "Choose Men or Women" }),
  whatsappGroupLink: z.string().optional(),
  targetPlayerCount: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? undefined : v),
    z.coerce.number().int().min(1).optional()
  ),
  kitNotes: z.string().optional(),
  notes: z.string().optional(),
  description: z.string().optional(),
})

const STAFF_ROLES = [
  { key: "managerPlayerId", label: "Manager", typed: "managerName" },
  { key: "assistantManagerPlayerId", label: "Assistant Manager", typed: "assistantManagerName" },
  { key: "coachPlayerId", label: "Coach", typed: "coachName" },
  { key: "captainPlayerId", label: "Captain", typed: "captainName" },
] as const
type StaffRoleKey = (typeof STAFF_ROLES)[number]["key"]
type StaffSelection = Record<StaffRoleKey, number | null>
const NO_STAFF: StaffSelection = { managerPlayerId: null, assistantManagerPlayerId: null, coachPlayerId: null, captainPlayerId: null }

const SECTION_LABELS: Record<string, string> = { men: "Men", women: "Women", not_set: "Section not set" }

/** "Men · League Player, Tournament Player" for a current team; the stored tag for archived teams. */
function teamBadgeLabel(team: Team, labelFor: (key: string) => string, scope?: string): string {
  if (scope) return team.category
  const section = SECTION_LABELS[team.membershipSection] ?? team.membershipSection
  const categories = (team.eligibleCategories ?? []).map((key) => labelFor(key))
  return categories.length ? `${section} · ${categories.join(", ")}` : section
}

type TeamFormValues = z.infer<typeof teamSchema>
const CANONICAL_TEAM_NAMES = new Set(["Awaiting Selection", "Masters Div. 1"])

/**
 * Shirt number for one squad member, edited in place. Saves on Enter or when
 * the field loses focus; an empty field clears the number.
 */
function SquadNumberField({ value, duplicate, disabled, onSave }: {
  value: number | null
  duplicate: boolean
  disabled: boolean
  onSave: (next: number | null) => Promise<boolean>
}) {
  const [text, setText] = useState(value == null ? "" : String(value))
  const [saving, setSaving] = useState(false)
  useEffect(() => { setText(value == null ? "" : String(value)) }, [value])

  const commit = async () => {
    const trimmed = text.trim()
    const next = trimmed === "" ? null : Number(trimmed)
    if (next === value) return
    if (next != null && (!Number.isInteger(next) || next < 1 || next > 99)) {
      setText(value == null ? "" : String(value))
      return
    }
    setSaving(true)
    const saved = await onSave(next)
    setSaving(false)
    if (!saved) setText(value == null ? "" : String(value))
  }

  return (
    <input
      type="text"
      inputMode="numeric"
      maxLength={2}
      value={text}
      disabled={disabled || saving}
      placeholder="—"
      aria-label="Shirt number"
      title={duplicate ? "Another squad member has this number" : "Shirt number for this squad. Leave empty for none."}
      onChange={(e) => setText(e.target.value.replace(/[^0-9]/g, ""))}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); (e.target as HTMLInputElement).blur() } }}
      className={`w-11 h-9 shrink-0 rounded-lg border-2 text-center font-bold text-sm tabular-nums focus:outline-none focus:border-primary disabled:opacity-60 ${duplicate ? "border-amber-400 bg-amber-50 text-amber-900" : "border-primary/20 bg-primary/5 text-primary"}`}
      data-testid="input-squad-shirt-number"
    />
  )
}

function TeamDetail({ team, onBack, onEdit, readOnly, scope }: { team: Team; onBack: () => void; onEdit: (team: Team) => void; readOnly?: boolean; scope?: string }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  // Every current team has a squad. The internal holding team and the
  // archived Rotterdam teams (shown with a scope) keep the plain roster.
  const isLeagueSquad = !scope && team.name !== "Awaiting Selection"
  const { labelFor } = useMembershipCategories()
  const teamCategories = team.eligibleCategories ?? []
  const { data: defaultPlayers = [], isLoading: defaultLoading } = useListPlayers({ teamId: team.id }, { query: { enabled: !scope } } as any)

  const { data: archivePlayers = [], isLoading: archiveLoading } = useQuery({
    queryKey: ["players", scope, team.id],
    queryFn: async () => {
      const token = getStoredAdminToken()
      const headers = { "Content-Type": "application/json", ...(token ? { "x-session-token": token } : {}) }
      const res = await fetch(`/api/players?scope=${scope}&teamId=${team.id}`, { headers })
      if (!res.ok) throw new Error("Failed to load players")
      return res.json() as Promise<any[]>
    },
    enabled: !!scope
  })

  const players = scope ? archivePlayers : defaultPlayers
  const isLoading = scope ? archiveLoading : defaultLoading

  const { data: squadCandidates = [], isLoading: squadLoading } = useListCurrentSquadCandidates(team.id, {
    query: {
      queryKey: getListCurrentSquadCandidatesQueryKey(team.id),
      enabled: isLeagueSquad,
      refetchInterval: isLeagueSquad ? 30_000 : false,
    },
  })
  const squadMutation = useUpdateCurrentSquadSelection()
  // Order: selected first, then shirt number (members without a number last), then name.
  const sortedCandidates = [...squadCandidates].sort(compareRosterOrder)
  const squadMembers = sortedCandidates.filter((candidate) => candidate.selected)
  const eligibleMembers = sortedCandidates.filter((candidate) => !candidate.selected)
  const selectedCount = squadMembers.length
  const sortedPlayers = [...players].sort(compareRosterOrder)

  const numberMutation = useSetSquadShirtNumber()
  // Numbers worn by more than one member of this squad.
  const duplicateNumbers = new Set(
    squadMembers
      .map((candidate) => candidate.shirtNumber)
      .filter((number, index, all): number is number => number != null && all.indexOf(number) !== index),
  )

  const saveShirtNumber = async (playerId: number, number: number | null): Promise<boolean> => {
    try {
      const result = await numberMutation.mutateAsync({ id: team.id, playerId, data: { number } })
      await queryClient.invalidateQueries({ queryKey: getListCurrentSquadCandidatesQueryKey(team.id) })
      if (result.warnings.length) {
        toast({ title: "Number saved, but check for a duplicate", description: result.warnings.join(" ") })
      } else {
        toast({ title: number == null ? "Shirt number cleared" : `Shirt number ${number} saved` })
      }
      return true
    } catch {
      toast({ title: "Could not save the shirt number", variant: "destructive" })
      return false
    }
  }

  const updateSquadSelection = async (playerId: number, selected: boolean) => {
    try {
      await squadMutation.mutateAsync({ id: team.id, playerId, data: { selected } })
      await queryClient.invalidateQueries({ queryKey: getListCurrentSquadCandidatesQueryKey(team.id) })
      toast({ title: selected ? "Member added to the squad" : "Member removed from the squad" })
    } catch {
      toast({ title: "Could not update the squad", variant: "destructive" })
    }
  }

  return (
    <div>
      {/* Back header */}
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary mb-6 transition-colors"
      >
        <ChevronLeft className="w-4 h-4" />
        Back to Teams
      </button>

      {/* Team header card */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden mb-6">
        <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <Badge className="mb-2">{teamBadgeLabel(team, labelFor, scope)}</Badge>
            <h2 className="text-3xl font-bold text-primary">{team.name}</h2>
            {team.createdAt && (
              <p className="text-xs text-muted-foreground mt-1">Created {format(new Date(team.createdAt), 'd MMM yyyy')}</p>
            )}
          </div>
          {!readOnly && (
            <Button variant="outline" onClick={() => onEdit(team)} className="shrink-0">
              <Edit2 className="w-4 h-4 mr-2" /> Edit Team
            </Button>
          )}
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Manager</p>
            <p className="font-semibold text-foreground">{team.managerName}</p>
          </div>
          <div>
            <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> Email</p>
            <a href={`mailto:${team.managerEmail}`} className="font-semibold text-primary hover:underline">{team.managerEmail}</a>
          </div>
          <div>
            <p className="text-muted-foreground font-medium mb-1 flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Phone</p>
            <a href={`tel:${team.managerPhone}`} className="font-semibold text-foreground">{team.managerPhone}</a>
          </div>
        </div>
      </div>

      {/* Current league squad selection */}
      {isLeagueSquad ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold text-foreground">Squad</h3>
              <p className="text-sm text-muted-foreground mt-0.5">
                {selectedCount} in the squad, {eligibleMembers.length} more eligible member{eligibleMembers.length !== 1 ? "s" : ""} to pick from
              </p>
            </div>
            <Badge variant="outline">2026/27 season</Badge>
          </div>
          <div className="px-6 py-4 bg-primary/5 border-b border-border text-sm text-muted-foreground space-y-1.5">
            <p><span className="font-semibold text-foreground">Team</span> is the entry in the league: its name, manager and coach.</p>
            <p><span className="font-semibold text-foreground">Squad</span> is the group of members selected to play for this team this season.</p>
            <p><span className="font-semibold text-foreground">Eligible members</span> are active members of this team&apos;s section{teamCategories.length > 0 ? <> who hold one of its categories ({teamCategories.map((key) => labelFor(key)).join(", ")})</> : <> (no categories are set on this team, so the whole section is listed)</>}. They are not in the squad until you add them.</p>
            <p>A member can be in more than one squad in the same season, for example a league team and a tournament team.</p>
            <p><span className="font-semibold text-foreground">Shirt numbers</span> are set here, per squad: type the number in the box in front of a squad member. The same member can have a different number in another squad. Leaving the squad closes the number and keeps it in their history.</p>
            <p>Adding or removing a member only changes this team&apos;s squad. Their other squads, membership category, fees, and Rotterdam team remain unchanged.</p>
          </div>

          {squadLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading current members...</div>
          ) : squadCandidates.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No current members are available.</p>
            </div>
          ) : (
            <>
              {[
                { key: "squad", title: "In the squad", empty: "Nobody has been added to the squad yet.", rows: squadMembers },
                { key: "eligible", title: "Eligible members, not in the squad", empty: "Every eligible member is already in the squad.", rows: eligibleMembers },
              ].map((group) => (
                <div key={group.key} data-testid={`squad-group-${group.key}`}>
                  <div className="px-6 py-2.5 bg-muted/30 border-b border-border text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.title} ({group.rows.length})
                  </div>
                  {group.rows.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-muted-foreground border-b border-border">{group.empty}</p>
                  ) : (
                    <div className="divide-y divide-border border-b border-border">
                      {group.rows.map((candidate) => (
                        <div key={candidate.playerId} className="px-6 py-4 flex items-center justify-between gap-4 hover:bg-muted/10">
                          <div className="flex items-center gap-3 min-w-0">
                            {candidate.selected && !readOnly ? (
                              <SquadNumberField
                                value={candidate.shirtNumber ?? null}
                                duplicate={candidate.shirtNumber != null && duplicateNumbers.has(candidate.shirtNumber)}
                                disabled={squadMutation.isPending}
                                onSave={(next) => saveShirtNumber(candidate.playerId, next)}
                              />
                            ) : candidate.shirtNumber != null ? (
                              <div className="w-11 h-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">{candidate.shirtNumber}</div>
                            ) : (
                              <div className="w-11 h-9 shrink-0 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-xs">—</div>
                            )}
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-semibold text-foreground truncate">{candidate.name}</p>
                                {candidate.selected && <Badge variant="success">Selected</Badge>}
                                {candidate.selected && candidate.shirtNumber != null && duplicateNumbers.has(candidate.shirtNumber) && (
                                  <Badge variant="outline" className="text-amber-800 border-amber-400 bg-amber-50">Duplicate number</Badge>
                                )}
                                {candidate.categoryMismatch && (
                                  <Badge variant="outline" className="text-amber-800 border-amber-400 bg-amber-50" title="This member holds none of the categories this team draws from. They stay in the squad until you remove them.">Category mismatch</Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate">
                                {candidate.position || "Position not set"}
                                {(candidate.membershipCategories ?? []).length > 0 ? ` · ${(candidate.membershipCategories ?? []).map((key) => labelFor(key)).join(", ")}` : ""}
                              </p>
                            </div>
                          </div>
                          {!readOnly && (
                            <Button
                              variant={candidate.selected ? "outline" : "default"}
                              disabled={squadMutation.isPending}
                              onClick={() => updateSquadSelection(candidate.playerId, !candidate.selected)}
                            >
                              {candidate.selected ? "Remove" : "Add to squad"}
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      ) : (
      /* Archived Rotterdam roster */
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div>
            <h3 className="text-xl font-bold text-foreground">Team Roster</h3>
            <p className="text-sm text-muted-foreground mt-0.5">{players.length} player{players.length !== 1 ? 's' : ''} registered</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <Users className="w-5 h-5 text-primary" />
          </div>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">Loading players...</div>
        ) : players.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="font-medium">No players in this team yet.</p>
            <p className="text-sm mt-1">Add players from the Players section.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-6 py-3 font-semibold">#</th>
                  <th className="px-6 py-3 font-semibold">Name</th>
                  <th className="px-6 py-3 font-semibold hidden sm:table-cell">Position</th>
                  <th className="px-6 py-3 font-semibold">Fee Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedPlayers.map(player => (
                  <tr key={player.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-6 py-3">
                      {player.shirtNumber != null ? (
                        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {player.shirtNumber}
                        </div>
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-muted/50 text-muted-foreground flex items-center justify-center text-xs">—</div>
                      )}
                    </td>
                    <td className="px-6 py-3 font-semibold text-foreground">{player.name}</td>
                    <td className="px-6 py-3 hidden sm:table-cell text-muted-foreground">{player.position || '—'}</td>
                    <td className="px-6 py-3">
                      {player.feePaid ? (
                        <Badge variant="success" className="gap-1"><CheckCircle className="w-3 h-3" /> Paid</Badge>
                      ) : (
                        <Badge variant="destructive" className="gap-1 bg-rose-100 text-rose-800"><XCircle className="w-3 h-3" /> Unpaid</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}
    </div>
  )
}

export default function Teams({ scope, readOnly }: { scope?: string, readOnly?: boolean }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const membershipCategories = useMembershipCategories()
  // Members to pick staff from. Loaded only for the current-season view.
  const { data: allMembers = [] } = useListPlayers(undefined, { query: { enabled: !scope } } as any)
  const pickableMembers = [...allMembers]
    .filter((member) => member.memberStatus !== "archived")
    .sort((a, b) => a.name.localeCompare(b.name))
  const [teamCategoryKeys, setTeamCategoryKeys] = useState<string[]>([])
  const [staff, setStaff] = useState<StaffSelection>(NO_STAFF)
  const { data: defaultTeams = [], isLoading: defaultLoading } = useListTeams(
    undefined,
    { query: { queryKey: getListTeamsQueryKey(), enabled: !scope } },
  )
  const { data: archiveTeams = [], isLoading: archiveLoading } = useQuery({
    queryKey: ["teams", scope],
    queryFn: async () => {
      const token = getStoredAdminToken()
      const headers = {
        "Content-Type": "application/json",
        ...(token ? { "x-session-token": token } : {}),
      }
      const res = await fetch(`/api/teams?scope=${scope}`, { headers })
      if (!res.ok) throw new Error("Failed to load")
      return res.json() as Promise<Team[]>
    },
    enabled: !!scope
  })

  const teams = scope ? archiveTeams : defaultTeams
  const isLoading = scope ? archiveLoading : defaultLoading

  const currentTeams = teams.filter((team) => isTeamVisibleForScope(team.category, scope))

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingTeam, setEditingTeam] = useState<Team | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)

  const createMutation = useCreateTeam()
  const updateMutation = useUpdateTeam()
  const deleteMutation = useDeleteTeam()

  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema)
  })

  const openAddModal = () => {
    setEditingTeam(null)
    reset({
      name: "", membershipSection: "men",
      whatsappGroupLink: "", targetPlayerCount: undefined, kitNotes: "", notes: "", description: "",
    })
    setTeamCategoryKeys([])
    setStaff(NO_STAFF)
    setIsModalOpen(true)
  }

  const openEditModal = (team: Team) => {
    setEditingTeam(team)
    reset({
      name: team.name,
      // A team without a section yet makes the administrator choose one.
      membershipSection: (team.membershipSection === "men" || team.membershipSection === "women" ? team.membershipSection : "") as "men" | "women",
      whatsappGroupLink: team.whatsappGroupLink || "",
      targetPlayerCount: team.targetPlayerCount ?? undefined,
      kitNotes: team.kitNotes || "",
      notes: team.notes || "",
      description: team.description || "",
    })
    setTeamCategoryKeys(team.eligibleCategories ?? [])
    setStaff({
      managerPlayerId: team.managerPlayerId ?? null,
      assistantManagerPlayerId: team.assistantManagerPlayerId ?? null,
      coachPlayerId: team.coachPlayerId ?? null,
      captainPlayerId: team.captainPlayerId ?? null,
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this team?")) return
    try {
      await deleteMutation.mutateAsync({ id })
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() })
      toast({ title: "Team deleted successfully" })
      if (selectedTeam?.id === id) setSelectedTeam(null)
    } catch {
      toast({ title: "Failed to delete team", variant: "destructive" })
    }
  }

  const onSubmit = async (formData: TeamFormValues) => {
    try {
      const data = { ...formData, eligibleCategories: teamCategoryKeys, ...staff }
      if (editingTeam) {
        const saved = await updateMutation.mutateAsync({ id: editingTeam.id, data })
        toast({ title: "Team updated successfully" })
        if (selectedTeam?.id === editingTeam.id) setSelectedTeam(saved)
      } else {
        await createMutation.mutateAsync({ data })
        toast({ title: "Team created successfully" })
      }
      queryClient.invalidateQueries({ queryKey: getListTeamsQueryKey() })
      setIsModalOpen(false)
    } catch {
      toast({ title: "An error occurred", variant: "destructive" })
    }
  }

  return (
    <PageLayout
      title="Teams"
      description="Manage current Hong Kong Masters hockey teams and league squads."
      action={
        !selectedTeam && !readOnly ? (
          <Button onClick={openAddModal}>
            <Plus className="w-5 h-5 mr-2" /> Add Team
          </Button>
        ) : undefined
      }
    >
      {/* Team detail view */}
      {selectedTeam ? (
        <TeamDetail
          team={selectedTeam}
          onBack={() => setSelectedTeam(null)}
          onEdit={(team) => openEditModal(team)}
          readOnly={readOnly}
          scope={scope}
        />
      ) : (
        <>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
              {[1,2,3].map(i => <div key={i} className="h-64 bg-white rounded-2xl border border-border"></div>)}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentTeams.map(team => (
                <div
                  key={team.id}
                  className="bg-white rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col group hover:border-primary/30"
                  onClick={() => setSelectedTeam(team)}
                >
                  <div className="p-6 border-b border-border bg-gradient-to-br from-primary/5 to-transparent relative">
                    {!readOnly && (
                      <div className="absolute top-4 right-4 flex space-x-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEditModal(team) }}
                          className="p-1.5 bg-white rounded-md shadow text-blue-600 hover:bg-blue-50 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {!CANONICAL_TEAM_NAMES.has(team.name) && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleDelete(team.id) }}
                            className="p-1.5 bg-white rounded-md shadow text-rose-600 hover:bg-rose-50 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}
                    <Badge className="mb-3">{teamBadgeLabel(team, membershipCategories.labelFor, scope)}</Badge>
                    <h3 className="text-2xl font-display font-bold text-primary">{team.name}</h3>
                    {team.createdAt && <p className="text-xs text-muted-foreground mt-1">Created {format(new Date(team.createdAt), 'd MMM yyyy')}</p>}
                  </div>
                  <div className="p-6 flex-1 flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center"><Users className="w-4 h-4 mr-2"/> Manager</p>
                      <p className="font-medium text-foreground">{team.managerName}</p>
                    </div>
                    <div className="space-y-2">
                      <a href={`mailto:${team.managerEmail}`} onClick={e => e.stopPropagation()} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Mail className="w-4 h-4 mr-3" /> {team.managerEmail}
                      </a>
                      <a href={`tel:${team.managerPhone}`} onClick={e => e.stopPropagation()} className="flex items-center text-sm text-muted-foreground hover:text-primary transition-colors">
                        <Phone className="w-4 h-4 mr-3" /> {team.managerPhone}
                      </a>
                    </div>
                    {team.notes && (
                      <div className="mt-auto pt-4 border-t border-border">
                        <p className="text-sm italic text-muted-foreground line-clamp-2">{team.notes}</p>
                      </div>
                    )}
                    <div className="mt-auto pt-3 border-t border-border/50 text-xs font-medium text-primary flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" /> Click to view the squad →
                    </div>
                  </div>
                </div>
              ))}
              {currentTeams.length === 0 && (
                <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-border">
                  <Users className="w-12 h-12 mx-auto text-muted-foreground/50 mb-4" />
                  <h3 className="text-lg font-bold text-foreground">No teams yet</h3>
                  <p className="text-muted-foreground mt-1 mb-4">Add your first team to get started.</p>
                  <Button onClick={openAddModal} variant="outline">Create a Team</Button>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingTeam ? "Edit Team" : "Add New Team"}
        description={editingTeam ? "Update team details below." : "Enter details for the new team."}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Team Name</label>
              <Input
                placeholder="e.g. Hong Kong Dragons"
                readOnly={editingTeam != null && CANONICAL_TEAM_NAMES.has(editingTeam.name)}
                className={editingTeam != null && CANONICAL_TEAM_NAMES.has(editingTeam.name) ? "bg-muted/40" : undefined}
                {...register("name")}
              />
              {editingTeam != null && CANONICAL_TEAM_NAMES.has(editingTeam.name) && (
                <p className="text-xs text-muted-foreground">This team name is fixed because it identifies a system-managed squad.</p>
              )}
              {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Section</label>
              <Select {...register("membershipSection")} data-testid="select-team-section">
                <option value="">Choose section...</option>
                <option value="men">Men</option>
                <option value="women">Women</option>
              </Select>
              {errors.membershipSection && <p className="text-xs text-destructive">{errors.membershipSection.message}</p>}
            </div>
          </div>

          <div className="space-y-2" data-testid="field-team-categories">
            <label className="text-sm font-semibold">Draws its squad from</label>
            <p className="text-xs text-muted-foreground">Tick the member categories this team picks from. With none ticked, every member of the section is eligible.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {membershipCategories.categories
                .filter((category) => !category.protected && (!category.retired || teamCategoryKeys.includes(category.key)))
                .map((category) => {
                  const checked = teamCategoryKeys.includes(category.key)
                  return (
                    <label key={category.key} className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2 text-sm cursor-pointer transition-colors ${checked ? "border-primary bg-primary/5" : "border-input bg-background"}`}>
                      <input
                        type="checkbox"
                        className="w-4 h-4 accent-primary"
                        checked={checked}
                        onChange={(e) => setTeamCategoryKeys((current) => e.target.checked ? [...current, category.key] : current.filter((key) => key !== category.key))}
                        data-testid={`checkbox-team-category-${category.key}`}
                      />
                      <span className="flex-1 min-w-0 font-medium leading-tight">{category.name}{category.retired ? " (retired)" : ""}</span>
                    </label>
                  )
                })}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border" data-testid="field-team-staff">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Team Staff</h4>
            <p className="text-xs text-muted-foreground">Pick a member for each role. Their name and contact details come from their member record. A role here does not give login access; that is done under Staff Access.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {STAFF_ROLES.map((role) => {
                const typedName = editingTeam ? (editingTeam[role.typed] ?? "") : ""
                const linkedId = staff[role.key]
                const linkedMissing = linkedId != null && !pickableMembers.some((member) => member.id === linkedId)
                return (
                  <div key={role.key} className="space-y-2">
                    <label className="text-sm font-semibold">{role.label}</label>
                    <Select
                      value={linkedId == null ? "" : String(linkedId)}
                      onChange={(e) => setStaff((current) => ({ ...current, [role.key]: e.target.value === "" ? null : Number(e.target.value) }))}
                      data-testid={`select-team-staff-${role.key}`}
                    >
                      <option value="">Not set</option>
                      {linkedMissing && <option value={String(linkedId)}>{typedName || `Member #${linkedId}`}</option>}
                      {pickableMembers.map((member) => (
                        <option key={member.id} value={String(member.id)}>{member.name}</option>
                      ))}
                    </Select>
                    {linkedId == null && typedName.trim() !== "" && (
                      <p className="text-xs text-amber-800">Typed earlier, not linked to a member: <strong>{typedName}</strong>. Pick the member above to link them.</p>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Public Profile</h4>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Public Description</label>
              <textarea
                className="flex w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all min-h-[80px]"
                placeholder="Short description shown on the public Teams page..."
                {...register("description")}
              />
            </div>
          </div>

          <div className="space-y-4 pt-4 border-t border-border">
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider">Team Info</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold">WhatsApp Group Link</label>
                <Input placeholder="https://chat.whatsapp.com/..." {...register("whatsappGroupLink")} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-semibold">Target Player Count</label>
                <Input type="number" min="1" placeholder="e.g. 16" {...register("targetPlayerCount")} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Kit & Clothing Notes</label>
              <Input placeholder="Colours, design preferences, supplier notes..." {...register("kitNotes")} />
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t border-border">
            <label className="text-sm font-semibold">General Notes (Optional)</label>
            <textarea
              className="flex w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/10 transition-all min-h-[80px]"
              placeholder="Any additional info..."
              {...register("notes")}
            />
          </div>

          <div className="pt-4 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : editingTeam ? "Update Team" : "Create Team"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
