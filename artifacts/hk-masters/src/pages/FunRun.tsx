import { useState, useEffect, useCallback, useMemo } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import { Plus, Trash2, Edit2, Download, Upload, DollarSign, TrendingUp, Loader2, X, ChevronsUpDown, ChevronUp, ChevronDown } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { getStoredAdminToken } from "@/lib/admin-auth"

const CATEGORIES = [
  { value: "entry_fee", label: "Entry fee", color: "bg-blue-100 text-blue-800" },
  { value: "pledge", label: "Pledge", color: "bg-purple-100 text-purple-800" },
  { value: "drinks_cookies", label: "Drinks & cookies", color: "bg-amber-100 text-amber-800" },
  { value: "other", label: "Other", color: "bg-gray-100 text-gray-700" },
] as const

type Category = typeof CATEGORIES[number]["value"]

type IncomeRow = {
  id: number
  date: string
  payerName: string
  description: string | null
  category: Category
  amountHkd: number
  notes: string | null
  createdAt: string
}

type RowForm = {
  date: string
  payerName: string
  description: string
  category: Category
  amountHkd: string
  notes: string
}

const EMPTY_FORM: RowForm = {
  date: "",
  payerName: "",
  description: "",
  category: "entry_fee",
  amountHkd: "",
  notes: "",
}

type SortField = "date" | "payerName" | "category" | "amountHkd"
type SortDir = "asc" | "desc"

// ── Column mapping types ─────────────────────────────────────────────────────
type ColRole = "date" | "payerName" | "description" | "amountHkd" | "notes" | "ignore"
const COL_ROLES: { value: ColRole; label: string }[] = [
  { value: "date", label: "Date" },
  { value: "payerName", label: "Payer / Name" },
  { value: "description", label: "Description" },
  { value: "amountHkd", label: "Amount HKD" },
  { value: "notes", label: "Notes" },
  { value: "ignore", label: "Ignore" },
]

type BulkStep = "paste" | "map" | "preview"

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return token
    ? { "x-session-token": token, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" }
}

function CategoryBadge({ category }: { category: Category }) {
  const cat = CATEGORIES.find(c => c.value === category)
  return (
    <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${cat?.color ?? "bg-gray-100 text-gray-700"}`}>
      {cat?.label ?? category}
    </span>
  )
}

const hkd = new Intl.NumberFormat("en-HK", { style: "currency", currency: "HKD", minimumFractionDigits: 0, maximumFractionDigits: 0 })

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField | null; sortDir: SortDir }) {
  if (sortField !== field) return <ChevronsUpDown className="w-3 h-3 inline ml-1 opacity-40" />
  return sortDir === "asc"
    ? <ChevronUp className="w-3 h-3 inline ml-1 text-primary" />
    : <ChevronDown className="w-3 h-3 inline ml-1 text-primary" />
}

function parseRawLines(raw: string): string[][] {
  return raw
    .split("\n")
    .map(l => l.trim())
    .filter(Boolean)
    .map(l => (l.includes("\t") ? l.split("\t") : l.split(",")).map(c => c.trim().replace(/^"|"$/g, "")))
    .filter(cols => cols.length > 0)
}

function guessRoles(sample: string[]): ColRole[] {
  const dateRx = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
  const amountRx = /^[\d,]+(\.\d{1,2})?$/
  return sample.map(v => {
    if (dateRx.test(v)) return "date"
    if (amountRx.test(v.replace(/,/g, ""))) return "amountHkd"
    return "ignore"
  })
}

function autoGuessRoles(cols: number, firstDataRow: string[]): ColRole[] {
  const roles: ColRole[] = Array(cols).fill("ignore")
  const dateRx = /^\d{1,2}\/\d{1,2}\/\d{2,4}$/
  const amountRx = /^[\d,]+(\.\d{1,2})?$/
  let payerAssigned = false
  for (let i = 0; i < firstDataRow.length; i++) {
    const v = firstDataRow[i]
    if (dateRx.test(v)) { roles[i] = "date"; continue }
    if (amountRx.test(v.replace(/,/g, ""))) { roles[i] = "amountHkd"; continue }
    if (!payerAssigned && v.length > 0) { roles[i] = "payerName"; payerAssigned = true; continue }
  }
  return roles
}

function applyMapping(lines: string[][], roles: ColRole[], defaultCategory: Category): Partial<RowForm>[] {
  const results: Partial<RowForm>[] = []
  for (const cols of lines) {
    const row: Record<string, string> = {}
    cols.forEach((v, i) => {
      const role = roles[i]
      if (!role || role === "ignore") return
      row[role] = (row[role] ? row[role] + " " : "") + v
    })
    const amount = parseFloat((row.amountHkd || "").replace(/,/g, ""))
    if (isNaN(amount) || !row.payerName) continue
    results.push({
      date: row.date || "",
      payerName: row.payerName.trim(),
      description: (row.description || "").trim(),
      category: defaultCategory,
      amountHkd: String(amount),
      notes: (row.notes || "").trim(),
    })
  }
  return results
}

export default function FunRun() {
  const { toast } = useToast()
  const [rows, setRows] = useState<IncomeRow[]>([])
  const [loading, setLoading] = useState(true)

  // ── Sort state ───────────────────────────────────────────────────────────────
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const sortedRows = useMemo(() => {
    if (!sortField) return rows
    return [...rows].sort((a, b) => {
      let av: string | number = a[sortField]
      let bv: string | number = b[sortField]
      if (sortField === "amountHkd") {
        av = Number(av); bv = Number(bv)
        return sortDir === "asc" ? av - bv : bv - av
      }
      av = String(av).toLowerCase(); bv = String(bv).toLowerCase()
      if (av < bv) return sortDir === "asc" ? -1 : 1
      if (av > bv) return sortDir === "asc" ? 1 : -1
      return 0
    })
  }, [rows, sortField, sortDir])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/fun-run", { headers: authHeaders() })
      if (!res.ok) throw new Error("Failed to load")
      setRows(await res.json())
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  // ── Add / Edit ───────────────────────────────────────────────────────────────
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingRow, setEditingRow] = useState<IncomeRow | null>(null)
  const [form, setForm] = useState<RowForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)

  const openAdd = () => { setEditingRow(null); setForm(EMPTY_FORM); setIsAddOpen(true) }
  const openEdit = (r: IncomeRow) => {
    setEditingRow(r)
    setForm({ date: r.date, payerName: r.payerName, description: r.description ?? "", category: r.category, amountHkd: String(r.amountHkd), notes: r.notes ?? "" })
    setIsAddOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const body = {
        date: form.date.trim(),
        payerName: form.payerName.trim(),
        description: form.description.trim() || null,
        category: form.category,
        amountHkd: parseFloat(form.amountHkd) || 0,
        notes: form.notes.trim() || null,
      }
      if (editingRow) {
        const res = await fetch(`/api/fun-run/${editingRow.id}`, { method: "PUT", headers: authHeaders(), body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to update")
        const updated: IncomeRow = await res.json()
        setRows(prev => prev.map(r => r.id === updated.id ? updated : r))
        toast({ title: "Row updated" })
      } else {
        const res = await fetch("/api/fun-run", { method: "POST", headers: authHeaders(), body: JSON.stringify(body) })
        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Failed to add")
        const created: IncomeRow = await res.json()
        setRows(prev => [...prev, created])
        toast({ title: "Row added" })
      }
      setIsAddOpen(false)
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (r: IncomeRow) => {
    if (!confirm(`Delete entry for "${r.payerName}" (${hkd.format(r.amountHkd)})?`)) return
    try {
      const res = await fetch(`/api/fun-run/${r.id}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Delete failed")
      setRows(prev => prev.filter(x => x.id !== r.id))
      toast({ title: "Entry deleted" })
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    }
  }

  const handleExport = async () => {
    try {
      const res = await fetch("/api/fun-run/export", { headers: authHeaders() })
      if (!res.ok) throw new Error("Export failed — are you signed in?")
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `fun-run-income-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    }
  }

  // ── Bulk import (3 steps: paste → map → preview) ─────────────────────────────
  const [isBulkOpen, setIsBulkOpen] = useState(false)
  const [bulkStep, setBulkStep] = useState<BulkStep>("paste")
  const [bulkText, setBulkText] = useState("")
  const [bulkLines, setBulkLines] = useState<string[][]>([])
  const [colRoles, setColRoles] = useState<ColRole[]>([])
  const [bulkPreview, setBulkPreview] = useState<Partial<RowForm>[]>([])
  const [bulkWarning, setBulkWarning] = useState<string | undefined>()
  const [bulkCategory, setBulkCategory] = useState<Category>("entry_fee")
  const [bulkSaving, setBulkSaving] = useState(false)

  const closeBulk = () => {
    setIsBulkOpen(false)
    setBulkStep("paste")
    setBulkText("")
    setBulkLines([])
    setColRoles([])
    setBulkPreview([])
    setBulkWarning(undefined)
  }

  const handleBulkParsePaste = () => {
    const lines = parseRawLines(bulkText)
    if (lines.length === 0) return
    setBulkLines(lines)
    const ncols = Math.max(...lines.map(l => l.length))
    const firstRow = lines[0]
    const guessed = autoGuessRoles(ncols, firstRow)
    setColRoles(guessed)
    setBulkStep("map")
  }

  const applyMappingStep = () => {
    const hasPayerCol = colRoles.some(r => r === "payerName")
    const hasAmountCol = colRoles.some(r => r === "amountHkd")
    if (!hasPayerCol || !hasAmountCol) {
      setBulkWarning("Please assign at least one column as 'Payer / Name' and one as 'Amount HKD'.")
      return
    }
    setBulkWarning(undefined)
    const parsed = applyMapping(bulkLines, colRoles, bulkCategory)
    const skipped = bulkLines.length - parsed.length
    setBulkPreview(parsed)
    setBulkWarning(skipped > 0 ? `${skipped} row(s) skipped (missing payer name or amount).` : undefined)
    setBulkStep("preview")
  }

  const handleBulkSave = async () => {
    if (bulkPreview.length === 0) return
    setBulkSaving(true)
    try {
      const payload = bulkPreview.map(r => ({ ...r, category: r.category || bulkCategory }))
      const res = await fetch("/api/fun-run/bulk", { method: "POST", headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data?.error || "Bulk import failed")
      toast({ title: `${data.inserted} rows imported` })
      closeBulk()
      load()
    } catch (err) {
      toast({ title: (err as Error).message, variant: "destructive" })
    } finally {
      setBulkSaving(false)
    }
  }

  const updateBulkRow = (i: number, field: keyof RowForm, value: string) => {
    setBulkPreview(prev => prev.map((r, idx) => idx === i ? { ...r, [field]: value } : r))
  }
  const removeBulkRow = (i: number) => {
    setBulkPreview(prev => prev.filter((_, idx) => idx !== i))
  }

  const ncols = bulkLines.length > 0 ? Math.max(...bulkLines.map(l => l.length)) : 0
  const SAMPLE_ROWS = bulkLines.slice(0, 4)

  // ── Totals ──────────────────────────────────────────────────────────────────
  const total = rows.reduce((s, r) => s + r.amountHkd, 0)
  const byCategory = CATEGORIES.map(c => ({
    ...c,
    amount: rows.filter(r => r.category === c.value).reduce((s, r) => s + r.amountHkd, 0),
  }))

  const thBtn = (field: SortField, label: string, align?: "right") => (
    <th
      className={`px-4 py-3 font-semibold cursor-pointer select-none hover:text-foreground transition-colors${align ? " text-right" : ""}`}
      onClick={() => handleSort(field)}
    >
      {label}<SortIcon field={field} sortField={sortField} sortDir={sortDir} />
    </th>
  )

  return (
    <PageLayout
      title="Fun Run"
      description="Income received from the Fun Run event."
      action={
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleExport} className="gap-2">
            <Download className="w-4 h-4" /> Export CSV
          </Button>
          <Button variant="outline" onClick={() => setIsBulkOpen(true)} className="gap-2">
            <Upload className="w-4 h-4" /> Bulk Import
          </Button>
          <Button onClick={openAdd} className="gap-2">
            <Plus className="w-4 h-4" /> Add Row
          </Button>
        </div>
      }
    >
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <div className="lg:col-span-2 bg-gradient-to-br from-emerald-600 to-emerald-900 rounded-2xl p-6 text-white shadow-lg shadow-emerald-900/20 relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 translate-x-1/4 translate-y-1/4">
            <DollarSign className="w-32 h-32" />
          </div>
          <p className="text-emerald-100 font-medium mb-1 uppercase tracking-wider text-xs">Total Raised</p>
          <p className="text-4xl font-bold">{hkd.format(total)}</p>
          <p className="text-emerald-200 text-sm mt-1">{rows.length} entries</p>
        </div>
        {byCategory.map(c => (
          <div key={c.value} className="bg-white rounded-2xl p-5 border border-border shadow-sm">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">{c.label}</p>
            <p className="text-2xl font-bold text-foreground">{hkd.format(c.amount)}</p>
            <p className="text-xs text-muted-foreground mt-1">{rows.filter(r => r.category === c.value).length} entries</p>
          </div>
        ))}
      </div>

      {/* Income table */}
      <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-muted-foreground uppercase bg-muted border-b border-border">
              <tr>
                {thBtn("date", "Date")}
                {thBtn("payerName", "Payer / Name")}
                <th className="px-4 py-3 font-semibold">Description</th>
                {thBtn("category", "Category")}
                {thBtn("amountHkd", "Amount HKD", "right")}
                <th className="px-4 py-3 font-semibold">Notes</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">Loading…</td></tr>
              ) : sortedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <TrendingUp className="w-10 h-10 opacity-30" />
                      <div>
                        <p className="font-medium">No income entries yet</p>
                        <p className="text-xs mt-1">Use "Add Row" for single entries or "Bulk Import" to paste from a spreadsheet.</p>
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                sortedRows.map(r => (
                  <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{r.date || "—"}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{r.payerName}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                      <span className="block truncate text-xs" title={r.description ?? ""}>{r.description || <span className="italic">—</span>}</span>
                    </td>
                    <td className="px-4 py-3"><CategoryBadge category={r.category} /></td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-emerald-700">{hkd.format(r.amountHkd)}</td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[160px]">
                      <span className="block truncate text-xs" title={r.notes ?? ""}>{r.notes || <span className="italic">—</span>}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => openEdit(r)} title="Edit" className="p-1.5 text-muted-foreground hover:text-primary rounded transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(r)} title="Delete" className="p-1.5 text-muted-foreground hover:text-rose-600 rounded transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {sortedRows.length > 0 && (
              <tfoot className="bg-muted/50 border-t border-border">
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase">Total</td>
                  <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">{hkd.format(total)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Add / Edit modal */}
      <Modal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} title={editingRow ? "Edit entry" : "Add income entry"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Date</label>
              <Input value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} placeholder="e.g. 01/06/2026" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold">Amount HKD *</label>
              <Input type="number" min="0" step="0.01" required value={form.amountHkd} onChange={e => setForm(f => ({ ...f, amountHkd: e.target.value }))} placeholder="100" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Payer / Name *</label>
            <Input required value={form.payerName} onChange={e => setForm(f => ({ ...f, payerName: e.target.value }))} placeholder="e.g. Brian Thomas" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Description</label>
            <Input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="e.g. Bank transfer reference" />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Category</label>
            <select
              className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              value={form.category}
              onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
            >
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold">Notes</label>
            <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingRow ? "Save changes" : "Add entry"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Bulk import modal — 3-step: paste → map columns → preview */}
      <Modal
        isOpen={isBulkOpen}
        onClose={closeBulk}
        title={
          bulkStep === "paste" ? "Bulk Import — Step 1 of 3: Paste data"
          : bulkStep === "map" ? "Bulk Import — Step 2 of 3: Map columns"
          : "Bulk Import — Step 3 of 3: Review & confirm"
        }
      >
        <div className="space-y-4">

          {/* Step 1: Paste */}
          {bulkStep === "paste" && (
            <>
              <p className="text-sm text-muted-foreground">
                Copy and paste rows directly from your spreadsheet. Tabs or commas are both fine as separators. You'll get to assign which column is which in the next step.
              </p>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold">Default category for all imported rows</label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  value={bulkCategory}
                  onChange={e => setBulkCategory(e.target.value as Category)}
                >
                  {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
              <Textarea
                className="font-mono text-xs min-h-[200px]"
                placeholder={"01/06/2026\tMiss Cheuk Ho San\t100\n30/05/2026\tBrian Thomas\t400\t..."}
                value={bulkText}
                onChange={e => setBulkText(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeBulk}>Cancel</Button>
                <Button onClick={handleBulkParsePaste} disabled={!bulkText.trim()}>Next: Map columns →</Button>
              </div>
            </>
          )}

          {/* Step 2: Map columns */}
          {bulkStep === "map" && (
            <>
              <p className="text-sm text-muted-foreground">
                Tell us what each column in your data represents. We've made a best guess — adjust any that look wrong.
              </p>
              {bulkWarning && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">{bulkWarning}</p>}
              <div className="overflow-x-auto border border-border rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-muted border-b border-border">
                    <tr>
                      {Array.from({ length: ncols }, (_, i) => (
                        <th key={i} className="px-3 py-2 text-left font-semibold text-muted-foreground">Column {i + 1}</th>
                      ))}
                    </tr>
                    <tr className="border-b border-border">
                      {Array.from({ length: ncols }, (_, i) => (
                        <th key={i} className="px-2 py-1.5">
                          <select
                            className="w-full h-7 text-xs border border-input rounded px-1 bg-background font-medium"
                            value={colRoles[i] ?? "ignore"}
                            onChange={e => setColRoles(prev => {
                              const next = [...prev]
                              next[i] = e.target.value as ColRole
                              return next
                            })}
                          >
                            {COL_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                          </select>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {SAMPLE_ROWS.map((line, ri) => (
                      <tr key={ri} className="hover:bg-muted/20">
                        {Array.from({ length: ncols }, (_, ci) => (
                          <td key={ci} className="px-3 py-1.5 text-foreground truncate max-w-[120px]">
                            {line[ci] ?? <span className="text-muted-foreground italic">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                    {bulkLines.length > 4 && (
                      <tr>
                        <td colSpan={ncols} className="px-3 py-1.5 text-muted-foreground italic">
                          … and {bulkLines.length - 4} more rows
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between gap-2">
                <Button variant="outline" onClick={() => { setBulkWarning(undefined); setBulkStep("paste") }}>← Back</Button>
                <Button onClick={applyMappingStep}>Next: Preview rows →</Button>
              </div>
            </>
          )}

          {/* Step 3: Preview */}
          {bulkStep === "preview" && (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{bulkPreview.length} rows — review before saving</p>
                <button onClick={() => { setBulkWarning(undefined); setBulkStep("map") }} className="text-xs text-primary hover:underline">← Back to mapping</button>
              </div>
              {bulkWarning && <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">{bulkWarning}</p>}
              <div className="max-h-80 overflow-y-auto border border-border rounded-lg divide-y divide-border text-xs">
                {bulkPreview.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 px-3 py-2">
                    <span className="w-20 shrink-0 text-muted-foreground">{r.date || "—"}</span>
                    <span className="flex-1 font-medium truncate">{r.payerName}</span>
                    <select
                      className="h-6 text-xs border border-input rounded px-1 shrink-0"
                      value={r.category || bulkCategory}
                      onChange={e => updateBulkRow(i, "category", e.target.value)}
                    >
                      {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                    </select>
                    <span className="font-mono font-semibold text-emerald-700 shrink-0">HK${Number(r.amountHkd || 0).toLocaleString()}</span>
                    <button onClick={() => removeBulkRow(i)} className="text-muted-foreground hover:text-rose-600 shrink-0"><X className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  Total: {hkd.format(bulkPreview.reduce((s, r) => s + (parseFloat(r.amountHkd || "0") || 0), 0))}
                </span>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={closeBulk}>Cancel</Button>
                  <Button onClick={handleBulkSave} disabled={bulkSaving || bulkPreview.length === 0}>
                    {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    Import {bulkPreview.length} rows
                  </Button>
                </div>
              </div>
            </>
          )}

        </div>
      </Modal>
    </PageLayout>
  )
}
