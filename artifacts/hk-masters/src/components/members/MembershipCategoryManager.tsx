import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { useCreateMembershipCategory, useUpdateMembershipCategory } from "@workspace/api-client-react"
import type { MembershipCategory } from "@workspace/api-client-react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/hooks/use-toast"
import { formatMembershipCurrency as formatCurrency } from "@/lib/utils"
import { useMembershipCategories, invalidateMembershipCategoryDependents } from "@/lib/membership-categories"
import { AlertTriangle, Archive, ArchiveRestore, Edit2, Lock, Plus, RotateCcw } from "lucide-react"

const FEE_PATTERN = /^\d{1,8}(\.\d{1,2})?$/

function errStatus(err: unknown): number | null {
  const s = (err as { status?: unknown } | null)?.status
  return typeof s === "number" ? s : null
}
function errMessage(err: unknown): string {
  const data = (err as { data?: unknown } | null)?.data
  if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
    return (data as { error: string }).error
  }
  return (err as Error | null)?.message || "Unknown error"
}

type Draft = { mode: "create" } | { mode: "edit"; category: MembershipCategory }

function validate(name: string, fee: string, categories: MembershipCategory[], selfKey?: string) {
  const errors: { name?: string; fee?: string } = {}
  const trimmed = name.trim().replace(/\s+/g, " ")
  if (!trimmed) errors.name = "Enter a category name."
  else if (trimmed.length > 100) errors.name = "Keep the name to 100 characters or fewer."
  else if (categories.some((c) => c.key !== selfKey && c.name.trim().replace(/\s+/g, " ").toLowerCase() === trimmed.toLowerCase())) {
    errors.name = `"${trimmed}" is already used by another category (active or retired). Choose a different name.`
  }
  const f = fee.trim()
  if (f !== "") {
    if (f.startsWith("-")) errors.fee = "Fee cannot be negative. Use 0 for a free category."
    else if (!FEE_PATTERN.test(f)) errors.fee = "Enter an amount up to 99,999,999.99 with at most two decimal places."
  }
  return errors
}

function CategoryForm({ draft, categories, onDone }: { draft: Draft; categories: MembershipCategory[]; onDone: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const createMutation = useCreateMembershipCategory()
  const updateMutation = useUpdateMembershipCategory()
  const editing = draft.mode === "edit" ? draft.category : null
  const [name, setName] = useState(editing?.name ?? "")
  const [fee, setFee] = useState(editing?.defaultFee == null ? "" : String(editing.defaultFee))
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const [conflict, setConflict] = useState(false)

  const errors = validate(name, fee, categories, editing?.key)
  const hasErrors = !!errors.name || !!errors.fee
  const saving = createMutation.isPending || updateMutation.isPending

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (hasErrors) return
    setServerError(null)
    setConflict(false)
    const defaultFee = fee.trim() === "" ? null : Number(fee.trim())
    try {
      if (editing) {
        await updateMutation.mutateAsync({
          key: editing.key,
          data: { name: name.trim(), defaultFee, retired: editing.retired, version: editing.version },
        })
        toast({ title: "Category updated", description: name.trim() })
      } else {
        await createMutation.mutateAsync({ data: { name: name.trim(), defaultFee } })
        toast({ title: "Category created", description: `${name.trim()} is now available for new assignments.` })
      }
      await invalidateMembershipCategoryDependents(queryClient)
      onDone()
    } catch (err) {
      if (errStatus(err) === 409) {
        setConflict(true)
        setServerError(errMessage(err))
        await invalidateMembershipCategoryDependents(queryClient)
      } else {
        setServerError(errMessage(err))
      }
    }
  }

  return (
    <form onSubmit={submit} className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-4" data-testid="form-membership-category">
      <div className="flex items-center justify-between gap-2">
        <h4 className="font-display font-semibold">{editing ? `Edit ${editing.name}` : "New category"}</h4>
        {editing && <code className="text-[11px] text-muted-foreground bg-white border rounded px-1.5 py-0.5">key: {editing.key}</code>}
      </div>
      {editing?.protected && (
        <p className="text-xs text-muted-foreground flex gap-1.5">
          <Lock className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          Protected category. Its name and default fee can change, but it cannot be retired because signup and trials automation rely on it.
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_12rem] gap-3">
        <div className="space-y-1.5">
          <label htmlFor="category-name" className="text-sm font-semibold">Name</label>
          <Input id="category-name" value={name} maxLength={100} autoFocus className="bg-white"
            onChange={(e) => setName(e.target.value)} onBlur={() => setTouched(true)}
            aria-invalid={touched && !!errors.name} data-testid="input-category-name" />
          {touched && errors.name && <p className="text-xs text-destructive" data-testid="error-category-name">{errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="category-fee" className="text-sm font-semibold">Default fee (HK$)</label>
          <Input id="category-fee" inputMode="decimal" placeholder="Not set" value={fee} className="bg-white"
            onChange={(e) => setFee(e.target.value)} onBlur={() => setTouched(true)}
            aria-invalid={touched && !!errors.fee} data-testid="input-category-fee" />
          {touched && errors.fee
            ? <p className="text-xs text-destructive" data-testid="error-category-fee">{errors.fee}</p>
            : <p className="text-xs text-muted-foreground">Blank = not set. 0 = free.</p>}
        </div>
      </div>
      {serverError && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex gap-2" data-testid="status-category-error">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
          <span>
            {conflict
              ? <>Someone else changed this category since you opened it ({serverError}). The list has been refreshed. Close this form, review the latest values, and edit again.</>
              : serverError}
          </span>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone} disabled={saving} data-testid="button-category-cancel">Cancel</Button>
        <Button type="submit" disabled={saving || conflict} data-testid="button-category-save">
          {saving ? "Saving..." : editing ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  )
}

export function MembershipCategoryManager({ open, onClose }: { open: boolean; onClose: () => void }) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { categories, isLoading, isError, error, refetch } = useMembershipCategories({ enabled: open })
  const updateMutation = useUpdateMembershipCategory()
  const [draft, setDraft] = useState<Draft | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<MembershipCategory | null>(null)

  useEffect(() => { if (!open) { setDraft(null); setConfirmTarget(null) } }, [open])

  const sorted = [...categories].sort((a, b) =>
    Number(a.retired) - Number(b.retired) || Number(b.protected) - Number(a.protected) || a.name.localeCompare(b.name))

  const toggleRetired = async () => {
    const target = confirmTarget
    if (!target) return
    setConfirmTarget(null)
    try {
      await updateMutation.mutateAsync({
        key: target.key,
        data: { name: target.name, defaultFee: target.defaultFee, retired: !target.retired, version: target.version },
      })
      toast({ title: target.retired ? `${target.name} reactivated` : `${target.name} retired` })
      await invalidateMembershipCategoryDependents(queryClient)
    } catch (err) {
      if (errStatus(err) === 409) {
        await invalidateMembershipCategoryDependents(queryClient)
        toast({ title: "Category changed elsewhere", description: "The list has been refreshed. Review it and try again.", variant: "destructive" })
      } else {
        toast({ title: "Could not update category", description: errMessage(err), variant: "destructive" })
      }
    }
  }

  return (
    <>
      <Modal isOpen={open} onClose={onClose} title="Membership categories"
        description="Categories drive member assignment, fee defaults, filters and imports across the portal.">
        <div className="space-y-4" data-testid="dialog-membership-categories">
          <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
            <p>Each category has a permanent key used by imports and history. Keys cannot be edited or deleted; retire a category instead.</p>
            <p><strong className="text-foreground">Awaiting Selection</strong> and <strong className="text-foreground">Trials</strong> are protected and always stay available for signup and trials automation. You can still rename them and change their fee.</p>
            <p>Retired categories stay on existing members and in fee summaries, but cannot be chosen for new assignments.</p>
            <p>Default fees apply to new members and actual category changes only. Editing a default never recalculates existing dues or changes payments or squad selections.</p>
          </div>

          {draft?.mode === "create"
            ? <CategoryForm key="create" draft={draft} categories={categories} onDone={() => setDraft(null)} />
            : (
              <Button onClick={() => setDraft({ mode: "create" })} disabled={isLoading || isError} data-testid="button-category-new">
                <Plus className="w-4 h-4 mr-2" /> New category
              </Button>
            )}

          {isLoading ? (
            <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted animate-pulse" />)}</div>
          ) : isError ? (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm flex items-center justify-between gap-3">
              <span>Could not load categories. {errMessage(error)}</span>
              <Button size="sm" variant="outline" onClick={() => refetch()} data-testid="button-categories-retry"><RotateCcw className="w-4 h-4 mr-1.5" />Retry</Button>
            </div>
          ) : sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No categories yet. Create the first one above.</p>
          ) : (
            <ul className="divide-y divide-border rounded-xl border border-border overflow-hidden" data-testid="list-membership-categories">
              {sorted.map((c) => (
                <li key={c.key} className={c.retired ? "bg-muted/30" : "bg-white"} data-testid={`row-category-${c.key}`}>
                  {draft?.mode === "edit" && draft.category.key === c.key ? (
                    <div className="p-3"><CategoryForm key={`edit-${c.key}`} draft={draft} categories={categories} onDone={() => setDraft(null)} /></div>
                  ) : (
                    <div className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`font-semibold ${c.retired ? "text-muted-foreground" : "text-foreground"}`} data-testid={`text-category-name-${c.key}`}>{c.name}</span>
                          {c.retired
                            ? <Badge variant="outline" className="text-muted-foreground">Retired</Badge>
                            : <Badge className="bg-emerald-100 text-emerald-800 border-0 shadow-none">Active</Badge>}
                          {c.protected && <Badge variant="secondary" className="gap-1"><Lock className="w-3 h-3" />Protected</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">{c.key}</div>
                      </div>
                      <div className="text-sm tabular-nums sm:w-32 sm:text-right" data-testid={`text-category-fee-${c.key}`}>
                        {c.defaultFee == null ? <span className="text-muted-foreground text-xs">Fee not set</span>
                          : c.defaultFee === 0 ? <span className="font-medium">Free</span>
                          : <span className="font-medium">{formatCurrency(c.defaultFee)}</span>}
                      </div>
                      <div className="flex gap-1.5 sm:ml-2">
                        <Button size="sm" variant="outline" onClick={() => setDraft({ mode: "edit", category: c })} data-testid={`button-category-edit-${c.key}`}>
                          <Edit2 className="w-3.5 h-3.5 mr-1" />Edit
                        </Button>
                        {!c.protected && (
                          <Button size="sm" variant="outline" onClick={() => setConfirmTarget(c)} disabled={updateMutation.isPending}
                            data-testid={`button-category-${c.retired ? "reactivate" : "retire"}-${c.key}`}>
                            {c.retired ? <><ArchiveRestore className="w-3.5 h-3.5 mr-1" />Reactivate</> : <><Archive className="w-3.5 h-3.5 mr-1" />Retire</>}
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Modal>

      <AlertDialog open={!!confirmTarget} onOpenChange={(o) => { if (!o) setConfirmTarget(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmTarget?.retired ? `Reactivate ${confirmTarget?.name}?` : `Retire ${confirmTarget?.name}?`}</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTarget?.retired
                ? "It will be available again for new members, bulk edits and imports."
                : "It will no longer be offered for new assignments, bulk edits or imports. Members already in this category keep it, and fee summaries and filters still include it. You can reactivate it later."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-category-confirm-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void toggleRetired()} data-testid="button-category-confirm">
              {confirmTarget?.retired ? "Reactivate" : "Retire category"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
