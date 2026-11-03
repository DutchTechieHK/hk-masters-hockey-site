import { useCallback, useEffect, useMemo, useState } from "react"
import { Link } from "wouter"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import { Plus, Edit2, Trash2, UsersRound, RefreshCw, Search, AlertTriangle, Check } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import {
  ApiError, createGroup, deleteGroup, fetchGroupMembers, fetchGroups, updateGroup,
  type GroupMemberOption, type MemberGroup,
} from "@/lib/member-groups"

type Draft = { name: string; description: string; memberIds: Set<number> }

const sectionLabel = (s: string | null) => (s === "men" ? "Men" : s === "women" ? "Women" : null)

export default function Groups() {
  const { toast } = useToast()
  const [groups, setGroups] = useState<MemberGroup[]>([])
  const [members, setMembers] = useState<GroupMemberOption[]>([])
  const [loading, setLoading] = useState(true)
  const [groupsError, setGroupsError] = useState<string | null>(null)
  const [membersError, setMembersError] = useState<string | null>(null)

  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<MemberGroup | null>(null)
  const [draft, setDraft] = useState<Draft>({ name: "", description: "", memberIds: new Set() })
  const [initialKey, setInitialKey] = useState("")
  const [search, setSearch] = useState("")
  const [onlySelected, setOnlySelected] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [stale, setStale] = useState(false)

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const [g, m] = await Promise.allSettled([fetchGroups(), fetchGroupMembers()])
    if (g.status === "fulfilled") { setGroups(g.value); setGroupsError(null) } else setGroupsError((g.reason as Error).message)
    if (m.status === "fulfilled") { setMembers(m.value); setMembersError(null) } else setMembersError((m.reason as Error).message)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    const onFocus = () => { load(true) }
    window.addEventListener("focus", onFocus)
    return () => window.removeEventListener("focus", onFocus)
  }, [load])

  const memberById = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  const keyOf = (d: Draft) => JSON.stringify([d.name, d.description, [...d.memberIds].sort((a, b) => a - b)])
  const dirty = open && keyOf(draft) !== initialKey

  const openEditor = (g: MemberGroup | null) => {
    const d: Draft = g
      ? { name: g.name, description: g.description ?? "", memberIds: new Set(g.memberIds) }
      : { name: "", description: "", memberIds: new Set() }
    setEditing(g); setDraft(d); setInitialKey(keyOf(d))
    setSearch(""); setOnlySelected(false); setFormError(null); setStale(false); setOpen(true)
  }

  const closeEditor = () => {
    if (dirty && !confirm("Discard unsaved changes to this group?")) return
    setOpen(false)
  }

  const reloadFromServer = async () => {
    if (!editing) return
    if (dirty && !confirm("Reloading replaces your unsaved edits with the latest saved version. Continue?")) return
    try {
      const list = await fetchGroups()
      setGroups(list)
      const fresh = list.find((x) => x.id === editing.id)
      if (!fresh) { toast({ title: "This group was deleted by someone else", variant: "destructive" }); setOpen(false); return }
      openEditor(fresh)
    } catch (err) { setFormError((err as Error).message) }
  }

  const toggleMember = (id: number) => setDraft((d) => {
    const next = new Set(d.memberIds); next.has(id) ? next.delete(id) : next.add(id)
    return { ...d, memberIds: next }
  })

  const q = search.trim().toLowerCase()
  const visibleMembers = useMemo(() => members
    .filter((m) => !onlySelected || draft.memberIds.has(m.id))
    .filter((m) => !q || [m.name, m.teamName, m.memberStatus, sectionLabel(m.membershipSection)].some((v) => v?.toLowerCase().includes(q)))
    .sort((a, b) => a.name.localeCompare(b.name)), [members, onlySelected, draft.memberIds, q])

  const selectVisible = (on: boolean) => setDraft((d) => {
    const next = new Set(d.memberIds)
    visibleMembers.forEach((m) => (on ? next.add(m.id) : next.delete(m.id)))
    return { ...d, memberIds: next }
  })

  const unsafe = !!membersError || !!groupsError
  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (unsafe) { setFormError("Cannot save while member or group data failed to load. Retry first."); return }
    if (!draft.name.trim()) { setFormError("Name is required"); return }
    if (editing && editing.eventCount > 0 && !confirm(
      `This group is used by ${editing.eventCount} event${editing.eventCount === 1 ? "" : "s"}. Changing membership changes who can see those events and their current attendance counts. Historical replies are kept. No notifications will be sent. Continue?`,
    )) return
    setSaving(true)
    const body = { name: draft.name.trim(), description: draft.description.trim() || null, memberIds: [...draft.memberIds] }
    try {
      if (editing) await updateGroup(editing.id, { ...body, version: editing.version })
      else await createGroup(body)
      toast({ title: editing ? "Group updated" : "Group created" })
      setOpen(false)
      load(true)
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setStale(true)
        setFormError("Someone else changed this group since you opened it. Your edits are still here; reload the latest version before saving.")
      } else setFormError((err as Error).message)
    } finally { setSaving(false) }
  }

  const remove = async (g: MemberGroup) => {
    if (g.eventCount > 0) return
    if (!confirm(`Delete group "${g.name}"? This cannot be undone.`)) return
    try {
      await deleteGroup(g.id, g.version)
      toast({ title: "Group deleted" })
    } catch (err) {
      const msg = err instanceof ApiError && err.status === 409
        ? "Group is in use by an event or was changed elsewhere. List refreshed."
        : (err as Error).message
      toast({ title: msg, variant: "destructive" })
    }
    load(true)
  }

  return (
    <PageLayout
      title="Invitee Groups"
      description="Hand-picked lists of members to invite to events. Groups never change squads, Notion records or World Cup history."
      action={
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => load()} data-testid="button-refresh-groups"><RefreshCw className="w-4 h-4 mr-1.5" /> Refresh</Button>
          <Button onClick={() => openEditor(null)} disabled={unsafe || loading} data-testid="button-new-group"><Plus className="w-5 h-5 mr-2" /> New Group</Button>
        </div>
      }
    >
      {(groupsError || membersError) && (
        <div className="mb-4 flex items-start justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
          <div className="flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
            <div>
              {groupsError && <p>Groups failed to load: {groupsError}</p>}
              {membersError && <p>Member directory failed to load: {membersError}</p>}
              <p className="text-xs mt-1">Saving is disabled until both load, to avoid overwriting memberships.</p>
            </div>
          </div>
          <Button size="sm" variant="outline" onClick={() => load()}>Retry</Button>
        </div>
      )}

      <p className="mb-4 text-xs text-muted-foreground">
        Use groups from <Link href="/events" className="underline font-medium text-foreground">Events</Link> by choosing the "Invitee groups" audience. Events with several groups invite everyone in any of them.
      </p>

      {loading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : groups.length === 0 && !groupsError ? (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-12 text-center">
          <UsersRound className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="font-semibold">No groups yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create one for a social crowd, a committee, or a mixed-squad training invite.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border">
              <tr>
                <th className="px-6 py-3 font-semibold">Group</th>
                <th className="px-6 py-3 font-semibold">Members</th>
                <th className="px-6 py-3 font-semibold">Used by</th>
                <th className="px-6 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {groups.map((g) => {
                const names = g.memberIds.map((id) => memberById.get(id)?.name).filter(Boolean) as string[]
                return (
                  <tr key={g.id} className="hover:bg-muted/10" data-testid={`row-group-${g.id}`}>
                    <td className="px-6 py-3">
                      <div className="font-semibold">{g.name}</div>
                      {g.description && <div className="text-xs text-muted-foreground">{g.description}</div>}
                    </td>
                    <td className="px-6 py-3">
                      <div className="font-medium">{g.memberIds.length}</div>
                      <div className="text-xs text-muted-foreground max-w-xs truncate">{names.slice(0, 4).join(", ")}{names.length > 4 ? ` +${names.length - 4}` : ""}</div>
                    </td>
                    <td className="px-6 py-3 text-muted-foreground">{g.eventCount} event{g.eventCount === 1 ? "" : "s"}</td>
                    <td className="px-6 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button onClick={() => openEditor(g)} disabled={unsafe} title="Edit" data-testid={`button-edit-group-${g.id}`} className="p-1.5 text-muted-foreground hover:text-blue-600 rounded border border-transparent hover:border-blue-200 disabled:opacity-40">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => remove(g)} disabled={g.eventCount > 0} data-testid={`button-delete-group-${g.id}`}
                          title={g.eventCount > 0 ? "Used by events; remove it from those events first" : "Delete"}
                          className="p-1.5 text-muted-foreground hover:text-rose-600 rounded border border-transparent hover:border-rose-200 disabled:opacity-40 disabled:hover:text-muted-foreground">
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
      )}

      <Modal isOpen={open} onClose={closeEditor} title={editing ? `Edit group: ${editing.name}` : "New invitee group"}>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold">Name</label>
            <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="e.g. Sunday socials crew" data-testid="input-group-name" />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold">Description (optional)</label>
            <Textarea rows={2} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
          </div>

          {editing && editing.eventCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
              Used by {editing.eventCount} event{editing.eventCount === 1 ? "" : "s"}. Changing members changes who sees those events and their current attendance counts. Historical replies are kept, and no one is notified.
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold">Members <span className="text-muted-foreground font-normal">({draft.memberIds.size} selected of {members.length})</span></label>
              <label className="text-xs flex items-center gap-1.5 text-muted-foreground cursor-pointer">
                <input type="checkbox" checked={onlySelected} onChange={(e) => setOnlySelected(e.target.checked)} className="accent-[#1E3A6E]" /> Selected only
              </label>
            </div>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, team, section, status" data-testid="input-member-search" />
            </div>
            <div className="flex gap-3 text-xs">
              <button type="button" onClick={() => selectVisible(true)} className="text-primary font-medium hover:underline">Select {visibleMembers.length} shown</button>
              <button type="button" onClick={() => selectVisible(false)} className="text-muted-foreground hover:underline">Clear shown</button>
            </div>
            <ul className="max-h-72 overflow-y-auto divide-y divide-border border border-border rounded-lg">
              {membersError ? (
                <li className="p-4 text-sm text-rose-700">Member directory unavailable.</li>
              ) : visibleMembers.length === 0 ? (
                <li className="p-4 text-sm text-muted-foreground text-center">No members match.</li>
              ) : visibleMembers.map((m) => {
                const on = draft.memberIds.has(m.id)
                const sec = sectionLabel(m.membershipSection)
                return (
                  <li key={m.id}>
                    <button type="button" onClick={() => toggleMember(m.id)} data-testid={`toggle-member-${m.id}`}
                      className={`w-full flex items-center gap-3 px-3 py-2 text-left text-sm transition-colors ${on ? "bg-primary/5" : "hover:bg-muted/40"}`}>
                      <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${on ? "bg-primary border-primary text-white" : "border-border bg-white"}`}>
                        {on && <Check className="w-3 h-3" />}
                      </span>
                      <span className="font-medium flex-1 truncate">{m.name}</span>
                      <span className="flex gap-1 text-[10px] uppercase tracking-wide">
                        {m.teamName && <span className="px-1.5 py-0.5 rounded bg-secondary text-secondary-foreground">{m.teamName}</span>}
                        {sec && <span className="px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{sec}</span>}
                        {m.memberStatus && m.memberStatus !== "active" && <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">{m.memberStatus}</span>}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
            <p className="text-xs text-muted-foreground">Inactive or archived members can be listed, but the server decides whether they are actually invited.</p>
          </div>

          {formError && (
            <div className="text-sm text-destructive flex items-start justify-between gap-3">
              <span>{formError}</span>
              {stale && <Button type="button" size="sm" variant="outline" onClick={reloadFromServer}>Reload latest</Button>}
            </div>
          )}

          <div className="pt-4 flex justify-end gap-3 border-t">
            <Button type="button" variant="outline" onClick={closeEditor}>Cancel</Button>
            <Button type="submit" disabled={saving || unsafe || stale} data-testid="button-save-group">
              {saving ? "Saving..." : editing ? "Save Group" : "Create Group"}
            </Button>
          </div>
        </form>
      </Modal>
    </PageLayout>
  )
}
