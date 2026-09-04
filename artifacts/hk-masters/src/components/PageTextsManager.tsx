import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Plus, Trash2, ChevronUp, ChevronDown, Loader2 } from "lucide-react"

const ADMIN_SESSION_KEY = "hkm_admin_session"
const API_BASE = import.meta.env.VITE_API_BASE ?? ""

function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null
}

type PageTexts = Record<string, unknown>

// ── Field schema (labels borrowed from the old CMS config) ──────────────

interface TextField { kind: "text" | "textarea"; key: string; label: string; hint?: string }
interface ArrayField {
  kind: "array"
  key: string
  label: string
  hint?: string
  itemFields: { key: string; label: string; multiline?: boolean }[]
}
interface ObjectField {
  kind: "object"
  key: string
  label: string
  itemFields: { key: string; label: string }[]
}
type Field = TextField | ArrayField | ObjectField

interface PageDef { page: string; title: string; note?: string; fields: Field[] }

const PAGES: PageDef[] = [
  {
    page: "home",
    title: "Home",
    fields: [
      { kind: "text", key: "hero_title", label: "Hero Title" },
      { kind: "text", key: "hero_tagline", label: "Hero Tagline" },
      { kind: "textarea", key: "hero_intro", label: "Hero Intro" },
      { kind: "text", key: "welcome_heading", label: "Welcome Heading" },
      { kind: "textarea", key: "welcome_text", label: "Welcome Text" },
      {
        kind: "array", key: "stats", label: "Stats Bar",
        itemFields: [{ key: "stat", label: "Number" }, { key: "label", label: "Label" }],
      },
      { kind: "text", key: "rtm_badge", label: "World Cup Hero — Badge", hint: "Shown while the site is in Rotterdam 2026 mode" },
      { kind: "textarea", key: "rtm_title", label: "World Cup Hero — Headline", hint: "Use a line break to split the headline over two lines" },
      { kind: "text", key: "rtm_subtitle", label: "World Cup Hero — Subtitle" },
      { kind: "textarea", key: "rtm_intro", label: "World Cup Hero — Intro" },
      { kind: "text", key: "rtm_button", label: "World Cup Hero — Button Label" },
    ],
  },
  {
    page: "about",
    title: "About",
    fields: [
      { kind: "textarea", key: "mission_p1", label: "Mission Statement (Paragraph 1)", hint: "Supports **bold** and other Markdown" },
      { kind: "textarea", key: "mission_p2", label: "Mission Statement (Paragraph 2)", hint: "Supports Markdown" },
      { kind: "textarea", key: "history_intro", label: "History Introduction", hint: "Supports Markdown" },
      {
        kind: "array", key: "timeline", label: "Club History Timeline",
        itemFields: [
          { key: "year", label: "Year" },
          { key: "event", label: "Event" },
          { key: "detail", label: "Detail", multiline: true },
        ],
      },
      {
        kind: "array", key: "committee", label: "Committee Members",
        itemFields: [{ key: "name", label: "Name" }, { key: "role", label: "Role" }],
      },
    ],
  },
  {
    page: "teams",
    title: "Teams",
    note: "Season announcements and recruitment copy shown on the public Teams page.",
    fields: [
      { kind: "text", key: "header_badge", label: "Page Header — Badge" },
      { kind: "text", key: "header_title", label: "Page Header — Title" },
      { kind: "textarea", key: "header_subtitle", label: "Page Header — Subtitle" },
      { kind: "text", key: "mens_badge", label: "Men's Masters — Badge" },
      { kind: "text", key: "mens_heading", label: "Men's Masters — Heading" },
      { kind: "textarea", key: "mens_text", label: "Men's Masters — Text" },
      { kind: "text", key: "trials_heading", label: "Trial Box — Heading" },
      { kind: "textarea", key: "trials_details", label: "Trial Box — Dates and Venue", hint: "Shown in bold" },
      { kind: "textarea", key: "trials_text", label: "Trial Box — Supporting Text" },
      { kind: "text", key: "join_heading", label: "Recruitment CTA — Heading" },
      { kind: "textarea", key: "join_text", label: "Recruitment CTA — Text" },
      { kind: "text", key: "join_button_label", label: "Recruitment CTA — Button Label" },
      { kind: "text", key: "join_url", label: "Recruitment CTA — Sign-up URL" },
      { kind: "text", key: "ladies_badge", label: "Ladies Masters — Badge" },
      { kind: "text", key: "ladies_heading", label: "Ladies Masters — Heading" },
      { kind: "textarea", key: "ladies_text", label: "Ladies Masters — Text" },
    ],
  },
  {
    page: "rotterdam",
    title: "Rotterdam 2026",
    fields: [
      { kind: "text", key: "header_badge", label: "Header Badge (dates)" },
      { kind: "textarea", key: "overview_p1", label: "Overview (Paragraph 1)" },
      { kind: "textarea", key: "overview_p2", label: "Overview (Paragraph 2)" },
      { kind: "textarea", key: "overview_p3", label: "Overview (Paragraph 3)", hint: "Supports Markdown and links" },
      {
        kind: "array", key: "quick_facts", label: "Quick Facts",
        itemFields: [{ key: "label", label: "Label" }, { key: "value", label: "Value" }],
      },
    ],
  },
  {
    page: "contact",
    title: "Contact",
    fields: [
      { kind: "text", key: "email", label: "Email" },
      { kind: "text", key: "phone", label: "Phone" },
      { kind: "text", key: "address", label: "Address" },
      { kind: "text", key: "maps_embed_src", label: "Google Maps Embed URL", hint: "Leave blank to hide the map" },
      {
        kind: "object", key: "social", label: "Social Links",
        itemFields: [
          { key: "facebook", label: "Facebook" },
          { key: "instagram", label: "Instagram" },
          { key: "twitter", label: "Twitter / X" },
          { key: "youtube", label: "YouTube" },
        ],
      },
    ],
  },
  {
    page: "events",
    title: "Events",
    fields: [{ kind: "textarea", key: "intro", label: "Page Intro" }],
  },
  {
    page: "media",
    title: "Media",
    fields: [{ kind: "textarea", key: "intro", label: "Page Intro" }],
  },
]

class ConflictError extends Error {}

async function savePage(page: string, texts: PageTexts, updatedAt: string | null) {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["x-session-token"] = token
  const res = await fetch(`${API_BASE}/api/site-content/page-texts`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ page, texts, updatedAt }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = (err as { error?: string }).error || "Failed to save"
    if (res.status === 409) throw new ConflictError(message)
    throw new Error(message)
  }
  return (await res.json()) as { pages: Record<string, PageTexts>; updatedAt: string | null }
}

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"

export function PageTextsManager() {
  const { toast } = useToast()
  const [pages, setPages] = useState<Record<string, PageTexts> | null>(null)
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)
  const [activePage, setActivePage] = useState("home")
  const [draft, setDraft] = useState<PageTexts>({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/site-content/page-texts`)
      if (res.ok) {
        const data = await res.json()
        setPages(data.pages)
        setUpdatedAt((data.updatedAt as string | null) ?? null)
      } else {
        setPages({})
      }
    } catch {
      toast({ title: "Failed to load page text", variant: "destructive" })
      setPages({})
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  // Reset the draft when switching page or after (re)loading
  useEffect(() => {
    if (pages) {
      setDraft({ ...(pages[activePage] ?? {}) })
      setDirty(false)
    }
  }, [pages, activePage])

  if (pages === null) {
    return <div className="text-gray-400 text-sm py-8">Loading page text…</div>
  }

  const def = PAGES.find((p) => p.page === activePage)!

  const setField = (key: string, value: unknown) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const saved = await savePage(activePage, draft, updatedAt)
      setPages(saved.pages)
      setUpdatedAt(saved.updatedAt)
      setDirty(false)
      toast({ title: `${def.title} page text saved` })
    } catch (e) {
      if (e instanceof ConflictError) {
        toast({ title: "Save blocked", description: e.message, variant: "destructive" })
        await load()
      } else {
        toast({ title: (e as Error).message || "Failed to save", variant: "destructive" })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col sm:flex-row gap-5">
      {/* Page list */}
      <div className="sm:w-48 sm:shrink-0 space-y-1.5">
        {PAGES.map((p) => (
          <button
            key={p.page}
            onClick={() => {
              if (dirty && !window.confirm("Discard unsaved changes on this page?")) return
              setActivePage(p.page)
            }}
            className={`w-full text-left px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              p.page === activePage
                ? "bg-primary text-primary-foreground"
                : "bg-gray-50 hover:bg-gray-100 text-gray-800"
            }`}
          >
            {p.title}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex-1 min-w-0 space-y-5">
        {def.note && <p className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2">{def.note}</p>}

        {def.fields.map((field) => {
          if (field.kind === "text" || field.kind === "textarea") {
            const value = typeof draft[field.key] === "string" ? (draft[field.key] as string) : ""
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                {field.kind === "text" ? (
                  <input value={value} onChange={(e) => setField(field.key, e.target.value)} className={inputCls} />
                ) : (
                  <textarea
                    value={value}
                    onChange={(e) => setField(field.key, e.target.value)}
                    rows={Math.min(10, Math.max(3, value.split("\n").length + 1))}
                    className={inputCls}
                  />
                )}
                {field.hint && <p className="text-xs text-gray-400 mt-1">{field.hint}</p>}
              </div>
            )
          }

          if (field.kind === "object") {
            const obj = (draft[field.key] ?? {}) as Record<string, string>
            return (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">{field.label}</label>
                <div className="space-y-2">
                  {field.itemFields.map((f) => (
                    <div key={f.key} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-xs text-gray-500">{f.label}</span>
                      <input
                        value={typeof obj[f.key] === "string" ? obj[f.key] : ""}
                        onChange={(e) => setField(field.key, { ...obj, [f.key]: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )
          }

          // array field
          if (field.kind !== "array") return null
          const rows = Array.isArray(draft[field.key]) ? (draft[field.key] as Record<string, string>[]) : []
          const setRows = (next: Record<string, string>[]) => setField(field.key, next)
          return (
            <div key={field.key}>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-gray-700">{field.label}</label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setRows([...rows, Object.fromEntries(field.itemFields.map((f) => [f.key, ""]))])}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add
                </Button>
              </div>
              {field.hint && <p className="text-xs text-gray-400 mb-2">{field.hint}</p>}
              <div className="space-y-2">
                {rows.map((row, i) => (
                  <div key={i} className="flex gap-2 items-start bg-gray-50 rounded-lg p-2.5">
                    <div className="flex-1 min-w-0 grid gap-1.5" style={{ gridTemplateColumns: field.itemFields.some((f) => f.multiline) ? "1fr" : `repeat(${field.itemFields.length}, 1fr)` }}>
                      {field.itemFields.map((f) =>
                        f.multiline ? (
                          <textarea
                            key={f.key}
                            value={row[f.key] ?? ""}
                            placeholder={f.label}
                            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))}
                            rows={2}
                            className={inputCls}
                          />
                        ) : (
                          <input
                            key={f.key}
                            value={row[f.key] ?? ""}
                            placeholder={f.label}
                            onChange={(e) => setRows(rows.map((r, j) => (j === i ? { ...r, [f.key]: e.target.value } : r)))}
                            className={inputCls}
                          />
                        )
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button
                        onClick={() => { if (i > 0) { const next = [...rows]; [next[i - 1], next[i]] = [next[i], next[i - 1]]; setRows(next) } }}
                        disabled={i === 0}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move up"
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { if (i < rows.length - 1) { const next = [...rows]; [next[i + 1], next[i]] = [next[i], next[i + 1]]; setRows(next) } }}
                        disabled={i === rows.length - 1}
                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                        title="Move down"
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setRows(rows.filter((_, j) => j !== i))}
                        className="p-1 text-red-400 hover:text-red-600"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
          <Button onClick={handleSave} disabled={saving || !dirty}>
            {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
            Save {def.title} Text
          </Button>
          {dirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
        </div>
      </div>
    </div>
  )
}
