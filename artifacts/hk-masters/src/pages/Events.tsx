import { useState, useEffect, useCallback } from "react"
import { useListTeams } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Edit2, CalendarDays, MapPin, Clock, Users, Coffee, Dumbbell, ClipboardList, Upload, Globe, EyeOff, RefreshCw } from "lucide-react"
import { format } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getStoredAdminToken } from "@/lib/admin-auth"
import EventsCsvImport from "@/components/ui/EventsCsvImport"

type EventRow = {
  id: number
  kind: "training" | "meeting" | "social"
  title: string
  startsAt: string
  endsAt: string | null
  location: string | null
  description: string | null
  teamId: number | null
  teamName: string | null
  isPublic: boolean
  rsvpCounts?: { yes: number; no: number; maybe: number }
}

type RsvpResponse = {
  playerId: number
  playerName: string
  shirtNumber: number | null
  teamId: number | null
  teamName: string | null
  status: "yes" | "no" | "maybe"
  respondedAt: string
}

type RsvpRoster = {
  event: EventRow
  counts: { yes: number; no: number; maybe: number; noResponse: number; invited: number }
  responses: RsvpResponse[]
  noResponse: Array<{ playerId: number; playerName: string; shirtNumber: number | null; teamId: number | null; teamName: string | null }>
}

type FormState = {
  kind: "training" | "meeting" | "social"
  title: string
  startsAt: string
  endsAt: string
  location: string
  description: string
  teamId: string
  isPublic: boolean
}

const EMPTY_FORM: FormState = {
  kind: "training",
  title: "",
  startsAt: "",
  endsAt: "",
  location: "",
  description: "",
  teamId: "",
  isPublic: false,
}

const KIND_META: Record<string, { label: string; icon: typeof Dumbbell; colour: string }> = {
  training: { label: "Training", icon: Dumbbell, colour: "bg-emerald-100 text-emerald-800" },
  meeting: { label: "Meeting", icon: Users, colour: "bg-blue-100 text-blue-800" },
  social: { label: "Social", icon: Coffee, colour: "bg-amber-100 text-amber-800" },
}

const HK_TZ        = "Asia/Hong_Kong"
const ROTTERDAM_TZ = "Europe/Amsterdam"

// Midnight HKT on the first Rotterdam match day — same threshold as the public site
const RTM_START_EPOCH = new Date("2026-07-21T00:00:00+08:00").getTime()

// HK training events → HKT.  Rotterdam tournament events → CEST.
function eventTz(startsAt: string): string {
  return new Date(startsAt).getTime() >= RTM_START_EPOCH ? ROTTERDAM_TZ : HK_TZ
}

// Given a "YYYY-MM-DDTHH:mm" datetime-local value (no zone), guess which IANA
// zone to use for saving — same threshold as eventTz but operating on the raw
// local string (treated as UTC for comparison purposes, which is accurate enough
// since May vs July are far apart).
function formTz(localDt: string): string {
  return new Date(`${localDt}:00Z`).getTime() >= RTM_START_EPOCH ? ROTTERDAM_TZ : HK_TZ
}

// Format a UTC instant as a "YYYY-MM-DDTHH:mm" string in a given IANA time zone.
function toZoneInputValue(iso: string, tz: string): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    })
      .formatToParts(new Date(iso))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`
}

// Compute the offset (wall_in_zone - utc_instant, in ms) for a UTC instant in a given zone.
function zoneOffsetMs(instant: number, tz: string): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: tz, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    })
      .formatToParts(new Date(instant))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  ) as Record<string, string>
  const wallAsUtc = Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    Number(parts.hour), Number(parts.minute), Number(parts.second),
  )
  return wallAsUtc - instant
}

// Treat a "YYYY-MM-DDTHH:mm" string as wall-clock time in the given IANA zone
// and return the corresponding UTC instant as an ISO string. Uses a two-pass
// resolver so DST transitions (spring-forward / fall-back) are handled correctly.
function zoneInputToIso(localDateTime: string, tz: string): string {
  const target = new Date(`${localDateTime}:00Z`).getTime()
  // First guess using offset at the pretend-UTC instant
  let offset = zoneOffsetMs(target, tz)
  let instant = target - offset
  // Refine using offset at the guessed instant — corrects for DST jumps
  offset = zoneOffsetMs(instant, tz)
  instant = target - offset
  return new Date(instant).toISOString()
}

function authHeaders(): HeadersInit {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token } : {}
}

export default function Events() {
  const { toast } = useToast()
  const { data: teams = [] } = useListTeams()
  const [events, setEvents] = useState<EventRow[]>([])
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editing, setEditing] = useState<EventRow | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [rosterEventId, setRosterEventId] = useState<number | null>(null)
  const [roster, setRoster] = useState<RsvpRoster | null>(null)
  const [rosterLoading, setRosterLoading] = useState(false)
  const [reminding, setReminding] = useState(false)
  const [remindResult, setRemindResult] = useState<{ sent: number; skippedNoEmail: number } | null>(null)
  const [showCsvImport, setShowCsvImport] = useState(false)
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [bulkWorking, setBulkWorking] = useState(false)

  const openRoster = async (id: number) => {
    setRosterEventId(id)
    setRoster(null)
    setRosterLoading(true)
    setRemindResult(null)
    try {
      const res = await fetch(`/api/events/${id}/rsvps`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load RSVPs")
      setRoster(await res.json())
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
      setRosterEventId(null)
    } finally {
      setRosterLoading(false)
    }
  }

  const refreshRoster = async () => {
    if (rosterEventId == null) return
    setRosterLoading(true)
    try {
      const res = await fetch(`/api/events/${rosterEventId}/rsvps`, { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to refresh RSVPs")
      setRoster(await res.json())
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setRosterLoading(false)
    }
  }

  const sendReminders = async () => {
    if (rosterEventId == null || !roster || roster.noResponse.length === 0) return
    setReminding(true)
    setRemindResult(null)
    try {
      const res = await fetch(`/api/events/${rosterEventId}/rsvps/remind`, {
        method: "POST",
        headers: authHeaders(),
      })
      if (!res.ok) throw new Error("Failed to send reminders")
      const data = await res.json() as { sent: number; total: number; skippedNoEmail: number }
      setRemindResult({ sent: data.sent, skippedNoEmail: data.skippedNoEmail })
      const skippedMsg = data.skippedNoEmail > 0 ? ` (${data.skippedNoEmail} skipped — no email on file)` : ""
      toast({ title: `Reminder${data.sent !== 1 ? "s" : ""} sent to ${data.sent} player${data.sent !== 1 ? "s" : ""}${skippedMsg}` })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setReminding(false)
    }
  }

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/events", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load events")
      const data = await res.json() as EventRow[]
      setEvents(data)
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { refresh() }, [refresh])

  const openAddModal = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setIsModalOpen(true)
  }

  const openEditModal = (e: EventRow) => {
    setEditing(e)
    const tz = eventTz(e.startsAt)
    setForm({
      kind: e.kind,
      title: e.title,
      startsAt: toZoneInputValue(e.startsAt, tz),
      endsAt: e.endsAt ? toZoneInputValue(e.endsAt, tz) : "",
      location: e.location ?? "",
      description: e.description ?? "",
      teamId: e.teamId ? String(e.teamId) : "",
      isPublic: e.isPublic ?? false,
    })
    setFormError(null)
    setIsModalOpen(true)
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const allIds = events.map(e => e.id)
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id))
  const someSelected = selected.size > 0

  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(allIds))
  }

  const handleBulkSetPublic = async (isPublic: boolean) => {
    setBulkWorking(true)
    let ok = 0; let fail = 0
    for (const id of selected) {
      const ev = events.find(e => e.id === id)
      if (!ev) continue
      try {
        const res = await fetch(`/api/events/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            kind: ev.kind,
            title: ev.title,
            startsAt: ev.startsAt,
            endsAt: ev.endsAt,
            location: ev.location,
            description: ev.description,
            teamId: ev.teamId,
            isPublic,
          }),
        })
        res.ok ? ok++ : fail++
      } catch { fail++ }
    }
    setBulkWorking(false)
    setSelected(new Set())
    toast({ title: `${ok} event${ok !== 1 ? "s" : ""} updated${fail ? ` (${fail} failed)` : ""}` })
    refresh()
  }

  const handleDelete = async (id: number, title: string) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    try {
      const res = await fetch(`/api/events/${id}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error("Delete failed")
      toast({ title: "Event deleted" })
      refresh()
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    }
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) { setFormError("Title is required"); return }
    if (!form.startsAt) { setFormError("Start time is required"); return }
    if (form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) {
      setFormError("End must be after start"); return
    }
    setSaving(true)
    try {
      const tz = formTz(form.startsAt)
      const payload = {
        kind: form.kind,
        title: form.title.trim(),
        startsAt: zoneInputToIso(form.startsAt, tz),
        endsAt: form.endsAt ? zoneInputToIso(form.endsAt, tz) : null,
        location: form.location.trim() || null,
        description: form.description.trim() || null,
        teamId: form.teamId ? Number(form.teamId) : null,
        isPublic: form.isPublic,
      }
      const url = editing ? `/api/events/${editing.id}` : "/api/events"
      const method = editing ? "PATCH" : "POST"
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? "Save failed")
      }
      toast({ title: editing ? "Event updated" : "Event added" })
      setIsModalOpen(false)
      refresh()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  // group by month — use the event's correct timezone so headers match displayed dates
  const grouped = events.reduce<Record<string, EventRow[]>>((acc, ev) => {
    const key = new Date(ev.startsAt).toLocaleDateString("en-GB", {
      month: "long", year: "numeric", timeZone: eventTz(ev.startsAt),
    })
    if (!acc[key]) acc[key] = []
    acc[key].push(ev)
    return acc
  }, {})

  return (
    <PageLayout
      title="Events"
      description="Training sessions, team meetings, and social events. Visible to logged-in players."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setShowCsvImport(true)}>
            <Upload className="w-4 h-4 mr-1.5" /> Import CSV
          </Button>
          <Button onClick={openAddModal}>
            <Plus className="w-5 h-5 mr-2" /> Add Event
          </Button>
        </div>
      }
    >
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-12 text-center">
          <CalendarDays className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">No events yet. Add the first training, meeting or social.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([month, items]) => (
            <section key={month}>
              <h2 className="text-lg font-bold text-foreground mb-3">{month}</h2>
              <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
                      <tr>
                        <th className="px-4 py-3 w-8">
                          <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="w-4 h-4 rounded accent-[#006B3C]" />
                        </th>
                        <th className="px-6 py-3 font-semibold">When</th>
                        <th className="px-6 py-3 font-semibold">Kind</th>
                        <th className="px-6 py-3 font-semibold">Title</th>
                        <th className="px-6 py-3 font-semibold">Where</th>
                        <th className="px-6 py-3 font-semibold">Visibility</th>
                        <th className="px-6 py-3 font-semibold">Attendance</th>
                        <th className="px-6 py-3 font-semibold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {items.map((ev) => {
                        const meta = KIND_META[ev.kind] ?? KIND_META.meeting
                        const Icon = meta.icon
                        return (
                          <tr key={ev.id} className={`hover:bg-muted/10 ${selected.has(ev.id) ? "bg-green-50/50" : ""}`}>
                            <td className="px-4 py-4">
                              <input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggleSelect(ev.id)} className="w-4 h-4 rounded accent-[#006B3C]" />
                            </td>
                            <td className="px-6 py-4">
                              {(() => {
                                const tz = eventTz(ev.startsAt)
                                const isRtm = tz === ROTTERDAM_TZ
                                return (
                                  <>
                                    <div className="font-semibold text-foreground">
                                      {new Date(ev.startsAt).toLocaleDateString("en-GB", {
                                        weekday: "short", day: "numeric", month: "short", timeZone: tz,
                                      })}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {new Date(ev.startsAt).toLocaleTimeString("en-GB", {
                                        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
                                      })}
                                      {ev.endsAt && ` – ${new Date(ev.endsAt).toLocaleTimeString("en-GB", {
                                        hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz,
                                      })}`}
                                      <span className={`ml-1 text-[10px] uppercase tracking-wide ${isRtm ? "text-[#006B3C]" : "text-blue-500"}`}>
                                        {isRtm ? "RTM" : "HKT"}
                                      </span>
                                    </div>
                                  </>
                                )
                              })()}
                            </td>
                            <td className="px-6 py-4">
                              <Badge className={`${meta.colour} border-0 inline-flex items-center gap-1`}>
                                <Icon className="w-3 h-3" /> {meta.label}
                              </Badge>
                            </td>
                            <td className="px-6 py-4 font-medium text-foreground">{ev.title}</td>
                            <td className="px-6 py-4 text-muted-foreground">{ev.location || "—"}</td>
                            <td className="px-6 py-4 text-muted-foreground">
                              <div className="flex flex-col gap-1">
                                <span>{ev.teamName || "All squads"}</span>
                                {ev.isPublic && (
                                  <span className="inline-flex w-fit items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-[#006B3C] text-[10px] font-bold uppercase tracking-wide">
                                    Public
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <button
                                onClick={() => openRoster(ev.id)}
                                className="inline-flex items-center gap-2 text-xs font-medium text-foreground hover:underline"
                                title="View roster"
                              >
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">✅ {ev.rsvpCounts?.yes ?? 0}</span>
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">🤔 {ev.rsvpCounts?.maybe ?? 0}</span>
                                <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800">❌ {ev.rsvpCounts?.no ?? 0}</span>
                              </button>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex justify-end items-center gap-1">
                                <button onClick={() => openRoster(ev.id)} title="View RSVPs" className="p-1.5 text-muted-foreground hover:text-emerald-600 rounded border border-transparent hover:border-emerald-200 transition-all">
                                  <ClipboardList className="w-4 h-4" />
                                </button>
                                <button onClick={() => openEditModal(ev)} title="Edit" className="p-1.5 text-muted-foreground hover:text-blue-600 rounded border border-transparent hover:border-blue-200 transition-all">
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button onClick={() => handleDelete(ev.id, ev.title)} title="Delete" className="p-1.5 text-muted-foreground hover:text-rose-600 rounded border border-transparent hover:border-rose-200 transition-all">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          ))}
        </div>
      )}

      {someSelected && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <div className="w-px h-5 bg-white/20" />
          <button
            onClick={() => handleBulkSetPublic(true)}
            disabled={bulkWorking}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-400 hover:text-green-300 disabled:opacity-50"
          >
            <Globe className="w-4 h-4" /> Make public
          </button>
          <button
            onClick={() => handleBulkSetPublic(false)}
            disabled={bulkWorking}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-400 hover:text-gray-300 disabled:opacity-50"
          >
            <EyeOff className="w-4 h-4" /> Make private
          </button>
          <div className="w-px h-5 bg-white/20" />
          <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-white">✕ Clear</button>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editing ? "Edit Event" : "Add Event"}>
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Kind</label>
            <Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as FormState["kind"] })}>
              <option value="training">Training</option>
              <option value="meeting">Meeting</option>
              <option value="social">Social</option>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Title</label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Wednesday training" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Starts{" "}
                {form.startsAt
                  ? formTz(form.startsAt) === ROTTERDAM_TZ
                    ? "(Rotterdam time, CEST)"
                    : "(Hong Kong time, HKT)"
                  : form.isPublic ? "(Rotterdam time, CEST)" : "(Hong Kong time, HKT)"}
              </label>
              <Input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" /> Ends (optional)
              </label>
              <Input type="datetime-local" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
            </div>
          </div>
          {form.startsAt && (
            <p className="text-xs text-muted-foreground -mt-2">
              {formTz(form.startsAt) === ROTTERDAM_TZ
                ? "Rotterdam tournament event — times interpreted as CEST (Europe/Amsterdam)."
                : "Hong Kong event — times interpreted as HKT (Asia/Hong_Kong)."}
            </p>
          )}

          <div className="space-y-2">
            <label className="text-sm font-semibold flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> Location
            </label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="e.g. Hong Kong Football Club" />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Visibility</label>
            <Select value={form.teamId} onChange={(e) => setForm({ ...form, teamId: e.target.value })}>
              <option value="">All squads</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">Choose a single team or leave as "All squads" to show everyone.</p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-semibold">Description (optional)</label>
            <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} placeholder="Anything else players should know" />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-border p-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 rounded border-border text-[#006B3C] focus:ring-[#006B3C]"
              checked={form.isPublic}
              onChange={(e) => {
                // Don't touch the typed time values — just change the interpretation.
                // The label updates to show whether the time is read as browser-local
                // or Rotterdam-local, so what you see is what gets saved.
                setForm({ ...form, isPublic: e.target.checked })
              }}
            />
            <div className="text-sm">
              <div className="font-semibold">Show on public website</div>
              <p className="text-xs text-muted-foreground mt-0.5">Tournament programme, ceremonies, social events. Leave off for internal team activities.</p>
            </div>
          </label>

          {formError && <p className="text-sm text-destructive">{formError}</p>}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : editing ? "Update Event" : "Add Event"}
            </Button>
          </div>
        </form>
      </Modal>

      {showCsvImport && (
        <EventsCsvImport
          teams={teams}
          onClose={() => setShowCsvImport(false)}
          onImported={() => { setShowCsvImport(false); refresh() }}
        />
      )}

      <Modal
        isOpen={rosterEventId !== null}
        onClose={() => { setRosterEventId(null); setRoster(null) }}
        title={roster ? `RSVPs · ${roster.event.title}` : "RSVPs"}
      >
        {rosterLoading || !roster ? (
          <div className="py-8 text-center text-muted-foreground">Loading…</div>
        ) : (
          <div className="space-y-5">
            <div className="flex justify-end">
              <button
                onClick={refreshRoster}
                disabled={rosterLoading}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" /> Refresh
              </button>
            </div>
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-2xl font-bold text-emerald-800">{roster.counts.yes}</div>
                <div className="text-emerald-700">Going</div>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
                <div className="text-2xl font-bold text-amber-800">{roster.counts.maybe}</div>
                <div className="text-amber-700">Maybe</div>
              </div>
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-3">
                <div className="text-2xl font-bold text-rose-800">{roster.counts.no}</div>
                <div className="text-rose-700">Not going</div>
              </div>
              <div className="rounded-lg bg-muted/40 border border-border p-3">
                <div className="text-2xl font-bold text-foreground">{roster.counts.noResponse}</div>
                <div className="text-muted-foreground">No reply</div>
              </div>
            </div>

            {(["yes", "maybe", "no"] as const).map((status) => {
              const list = roster.responses.filter((r) => r.status === status)
              if (list.length === 0) return null
              const labels = { yes: "✅ Going", maybe: "🤔 Maybe", no: "❌ Not going" } as const
              return (
                <div key={status}>
                  <h4 className="text-sm font-semibold mb-2">{labels[status]} ({list.length})</h4>
                  <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {list.map((r) => (
                      <li key={r.playerId} className="px-3 py-2 text-sm flex justify-between items-center bg-white">
                        <span>
                          {r.shirtNumber != null && <span className="text-muted-foreground mr-2">#{r.shirtNumber}</span>}
                          <span className="font-medium">{r.playerName}</span>
                          {r.teamName && <span className="text-muted-foreground"> · {r.teamName}</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{format(new Date(r.respondedAt), "d MMM HH:mm")}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })}

            {roster.noResponse.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold">No reply yet ({roster.noResponse.length})</h4>
                  <button
                    onClick={sendReminders}
                    disabled={reminding || remindResult !== null}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition"
                  >
                    {reminding ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" /> Sending…
                      </>
                    ) : remindResult !== null ? (
                      <>✓ Sent to {remindResult.sent}{remindResult.skippedNoEmail > 0 ? ` (${remindResult.skippedNoEmail} skipped)` : ""}</>
                    ) : (
                      "Remind non-responders"
                    )}
                  </button>
                </div>
                <ul className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {roster.noResponse.map((p) => (
                    <li key={p.playerId} className="px-3 py-2 text-sm bg-white">
                      {p.shirtNumber != null && <span className="text-muted-foreground mr-2">#{p.shirtNumber}</span>}
                      <span className="font-medium">{p.playerName}</span>
                      {p.teamName && <span className="text-muted-foreground"> · {p.teamName}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {roster.responses.length === 0 && roster.noResponse.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">No one has been invited yet.</p>
            )}
          </div>
        )}
      </Modal>
    </PageLayout>
  )
}
