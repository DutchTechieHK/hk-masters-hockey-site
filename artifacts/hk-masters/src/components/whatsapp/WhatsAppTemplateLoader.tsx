import { useState } from "react"
import {
  useListWhatsappTemplates,
  useCreateWhatsappTemplate,
  useDeleteWhatsappTemplate,
  useUpdateWhatsappTemplate,
  useListEmailTemplates,
} from "@workspace/api-client-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BookMarked, Trash2, ChevronDown, ChevronUp, Plus, Pencil, Check, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface WhatsAppTemplateLoaderProps {
  currentTitle: string
  currentBody: string
  onLoad: (title: string, body: string) => void
}

interface EditState {
  id: number
  name: string
  title: string
  body: string
}

export function WhatsAppTemplateLoader({ currentTitle, currentBody, onLoad }: WhatsAppTemplateLoaderProps) {
  const { toast } = useToast()
  const { data: templates = [] } = useListWhatsappTemplates()
  const { data: emailTemplates = [] } = useListEmailTemplates()
  const createTemplate = useCreateWhatsappTemplate()
  const deleteTemplate = useDeleteWhatsappTemplate()
  const updateTemplate = useUpdateWhatsappTemplate()

  const [selectedId, setSelectedId] = useState("")
  const [showSave, setShowSave] = useState(false)
  const [showManage, setShowManage] = useState(false)
  const [saveName, setSaveName] = useState("")
  const [editState, setEditState] = useState<EditState | null>(null)

  const handleLoad = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val.startsWith("email-")) {
      const id = Number(val.slice("email-".length))
      const tpl = emailTemplates.find((t) => t.id === id)
      if (tpl) {
        onLoad(tpl.subject, tpl.body)
      }
    } else if (val.startsWith("wa-")) {
      const id = Number(val.slice("wa-".length))
      const tpl = templates.find((t) => t.id === id)
      if (tpl) {
        onLoad(tpl.title, tpl.body)
      }
    }
    setSelectedId("")
  }

  const handleSave = async () => {
    if (!saveName.trim()) return
    try {
      await createTemplate.mutateAsync({
        name: saveName.trim(),
        title: currentTitle.trim(),
        body: currentBody.trim(),
      })
      toast({ title: `Template "${saveName.trim()}" saved` })
      setSaveName("")
      setShowSave(false)
    } catch {
      toast({ title: "Failed to save template", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Delete template "${name}"?`)) return
    try {
      await deleteTemplate.mutateAsync(id)
      toast({ title: `Template "${name}" deleted` })
    } catch {
      toast({ title: "Failed to delete template", variant: "destructive" })
    }
  }

  const startEdit = (tpl: { id: number; name: string; title: string; body: string }) => {
    setEditState({ id: tpl.id, name: tpl.name, title: tpl.title, body: tpl.body })
  }

  const cancelEdit = () => setEditState(null)

  const handleUpdate = async () => {
    if (!editState || !editState.name.trim() || !editState.title.trim() || !editState.body.trim()) return
    try {
      await updateTemplate.mutateAsync({
        id: editState.id,
        body: {
          name: editState.name.trim(),
          title: editState.title.trim(),
          body: editState.body.trim(),
        },
      })
      toast({ title: `Template "${editState.name.trim()}" updated` })
      setEditState(null)
    } catch {
      toast({ title: "Failed to update template", variant: "destructive" })
    }
  }

  const canSave = currentTitle.trim().length > 0 && currentBody.trim().length > 0

  return (
    <div className="space-y-2">
      {/* Row: dropdown + save button */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <BookMarked className="w-4 h-4 text-muted-foreground shrink-0" />
          <select
            value={selectedId}
            onChange={handleLoad}
            aria-label="Load a saved template"
            onKeyDown={(e) => { if (e.key === "Escape") e.stopPropagation() }}
            className="flex-1 min-w-0 h-9 rounded-lg border border-border bg-white text-sm px-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
          >
            <option value="" disabled>
              {templates.length === 0 && emailTemplates.length === 0
                ? "No saved templates yet"
                : "Load a saved template…"}
            </option>
            {templates.length > 0 && (
              <optgroup label="WhatsApp templates">
                {templates.map((t) => (
                  <option key={`wa-${t.id}`} value={`wa-${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
            {emailTemplates.length > 0 && (
              <optgroup label="Email templates">
                {emailTemplates.map((t) => (
                  <option key={`email-${t.id}`} value={`email-${t.id}`}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </div>

        <button
          type="button"
          onClick={() => {
            const nextShow = !showSave
            setShowSave(nextShow)
            setSaveName(nextShow ? currentTitle.slice(0, 40).trim() : "")
            setShowManage(false)
            setEditState(null)
          }}
          disabled={!canSave}
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border transition-all bg-white border-border text-muted-foreground hover:text-foreground hover:border-primary/50 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
          Save as template
        </button>

        {templates.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setShowManage((v) => !v)
              setShowSave(false)
              setEditState(null)
            }}
            className="flex items-center gap-1 h-9 px-2.5 rounded-lg text-sm text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all shrink-0"
          >
            Manage
            {showManage ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      {/* Save form */}
      {showSave && (
        <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Input
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder="Template name, e.g. Training reminder"
            className="h-8 text-sm flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); handleSave() }
              if (e.key === "Escape") setShowSave(false)
            }}
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!saveName.trim() || createTemplate.isPending}
            className="h-8 px-3 shrink-0"
          >
            {createTemplate.isPending ? "Saving…" : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => { setShowSave(false); setSaveName("") }}
            className="h-8 px-3 shrink-0"
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Manage — list with edit + delete icons */}
      {showManage && templates.length > 0 && (
        <div className="rounded-xl border border-border bg-white overflow-hidden">
          <ul className="divide-y divide-border">
            {templates.map((t) => {
              const isEditing = editState?.id === t.id
              return (
                <li key={t.id}>
                  {isEditing && editState ? (
                    /* ── Inline edit form ── */
                    <div className="flex flex-col gap-2 px-4 py-3 bg-primary/5">
                      <Input
                        value={editState.name}
                        onChange={(e) => setEditState({ ...editState, name: e.target.value })}
                        placeholder="Template name"
                        className="h-8 text-sm"
                        aria-label="Edit template name"
                        autoFocus
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
                      />
                      <Input
                        value={editState.title}
                        onChange={(e) => setEditState({ ...editState, title: e.target.value })}
                        placeholder="Title"
                        className="h-8 text-sm"
                        aria-label="Edit template title"
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
                      />
                      <textarea
                        value={editState.body}
                        onChange={(e) => setEditState({ ...editState, body: e.target.value })}
                        placeholder="Message"
                        rows={4}
                        aria-label="Edit template message"
                        className="w-full rounded-lg border border-border bg-white text-sm px-3 py-2 resize-y focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                        onKeyDown={(e) => { if (e.key === "Escape") cancelEdit() }}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <Button
                          type="button"
                          size="sm"
                          onClick={handleUpdate}
                          disabled={
                            !editState.name.trim() ||
                            !editState.title.trim() ||
                            !editState.body.trim() ||
                            updateTemplate.isPending
                          }
                          className="h-8 px-3 gap-1.5"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {updateTemplate.isPending ? "Saving…" : "Save changes"}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={cancelEdit}
                          className="h-8 px-3 gap-1.5"
                        >
                          <X className="w-3.5 h-3.5" />
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* ── Normal row ── */
                    <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{t.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{t.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => startEdit(t)}
                        className="p-1.5 text-muted-foreground hover:text-primary rounded border border-transparent hover:border-primary/30 transition-all shrink-0"
                        title={`Edit template "${t.name}"`}
                        aria-label={`Edit template ${t.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(t.id, t.name)}
                        disabled={deleteTemplate.isPending}
                        className="p-1.5 text-muted-foreground hover:text-rose-600 rounded border border-transparent hover:border-rose-200 transition-all shrink-0"
                        title={`Delete template "${t.name}"`}
                        aria-label={`Delete template ${t.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
