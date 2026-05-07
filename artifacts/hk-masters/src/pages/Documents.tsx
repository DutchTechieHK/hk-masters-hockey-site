import { useState, useEffect } from "react"
import { useListDocuments, useCreateDocument, useDeleteDocument } from "@workspace/api-client-react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Download, FolderOpen, FileText, AlertTriangle, Upload, X } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { DocumentItem } from "@workspace/api-client-react"

const CLOUD_NAME = "djyvdrhal"
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || "hk_masters_unsigned"

type DocCategory = "mandatory-form" | "regulation" | "information"

const CATEGORIES: { value: DocCategory; label: string; color: string; description: string }[] = [
  {
    value: "mandatory-form",
    label: "Mandatory Form",
    color: "bg-red-100 text-red-700 border-red-200",
    description: "Forms that must be completed by players or managers",
  },
  {
    value: "regulation",
    label: "Regulation",
    color: "bg-blue-100 text-blue-700 border-blue-200",
    description: "Tournament rules and federation regulation documents",
  },
  {
    value: "information",
    label: "Information",
    color: "bg-green-100 text-green-700 border-green-200",
    description: "General information PDFs, guides, and reference documents",
  },
]

function categoryMeta(value: DocCategory) {
  return CATEGORIES.find((c) => c.value === value) ?? CATEGORIES[2]
}

function formatBytes(bytes?: number | null): string {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(iso?: string) {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

interface CloudinaryWidget {
  open: () => void
}
declare global {
  interface Window {
    cloudinary: {
      createUploadWidget: (
        opts: Record<string, unknown>,
        cb: (err: unknown, result: { event: string; info: { secure_url: string; original_filename: string; bytes: number; format: string } }) => void
      ) => CloudinaryWidget
    }
  }
}

export default function Documents() {
  const { toast } = useToast()
  const { data: documents = [], isLoading } = useListDocuments()
  const createMutation = useCreateDocument()
  const deleteMutation = useDeleteDocument()

  const [isModalOpen, setIsModalOpen] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [widgetLoaded, setWidgetLoaded] = useState(false)
  const [uploading, setUploading] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [category, setCategory] = useState<DocCategory>("mandatory-form")
  const [uploadedFile, setUploadedFile] = useState<{ url: string; name: string; size: number } | null>(null)

  useEffect(() => {
    if (document.getElementById("cloudinary-widget-script")) {
      setWidgetLoaded(true)
      return
    }
    const script = document.createElement("script")
    script.id = "cloudinary-widget-script"
    script.src = "https://upload-widget.cloudinary.com/global/all.js"
    script.onload = () => setWidgetLoaded(true)
    document.head.appendChild(script)
  }, [])

  const openUploadWidget = () => {
    if (!widgetLoaded || !window.cloudinary) return
    setUploading(true)
    const w = window.cloudinary.createUploadWidget(
      {
        cloudName: CLOUD_NAME,
        uploadPreset: UPLOAD_PRESET,
        multiple: false,
        maxFiles: 1,
        resourceType: "auto",
        sources: ["local"],
        clientAllowedFormats: ["pdf"],
        maxFileSize: 20000000,
      },
      (err, result) => {
        if (err) {
          setUploading(false)
          toast({ title: "Upload failed", variant: "destructive" })
          return
        }
        if (result.event === "success") {
          const info = result.info
          const ext = info.format ? `.${info.format}` : ""
          const name = info.original_filename
            ? `${info.original_filename}${ext}`
            : info.secure_url.split("/").pop() ?? "document"
          setUploadedFile({ url: info.secure_url, name, size: info.bytes })
          if (!title) setTitle(info.original_filename ?? "")
          setUploading(false)
        }
        if (result.event === "close") {
          setUploading(false)
        }
      }
    )
    w.open()
  }

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setCategory("mandatory-form")
    setUploadedFile(null)
  }

  const handleSave = async () => {
    if (!title.trim()) {
      toast({ title: "Please enter a title", variant: "destructive" })
      return
    }
    if (!uploadedFile) {
      toast({ title: "Please upload a file", variant: "destructive" })
      return
    }
    try {
      await createMutation.mutateAsync({
        title: title.trim(),
        description: description.trim() || undefined,
        category,
        fileUrl: uploadedFile.url,
        fileName: uploadedFile.name,
        fileSize: uploadedFile.size,
      })
      toast({ title: "Document saved" })
      setIsModalOpen(false)
      resetForm()
    } catch {
      toast({ title: "Failed to save document", variant: "destructive" })
    }
  }

  const handleDelete = async (id: number) => {
    try {
      await deleteMutation.mutateAsync(id)
      toast({ title: "Document deleted" })
      setConfirmDeleteId(null)
    } catch {
      toast({ title: "Failed to delete document", variant: "destructive" })
    }
  }

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    docs: documents.filter((d: DocumentItem) => d.category === cat.value),
  }))

  return (
    <PageLayout
      title="Documents"
      description="Repository of forms, regulations, and information PDFs for managers."
      action={
        <Button onClick={() => { resetForm(); setIsModalOpen(true) }}>
          <Plus className="w-4 h-4 mr-2" /> Upload Document
        </Button>
      }
    >
      {isLoading ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-8 text-center text-muted-foreground">
          Loading documents...
        </div>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-border p-12 text-center">
          <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground font-medium">No documents yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1">Upload your first document using the button above.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(({ value, label, color, docs }) => {
            if (docs.length === 0) return null
            return (
              <div key={value} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="px-5 py-4 border-b border-border bg-muted/20 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
                      {label}
                    </span>
                    <span className="text-sm text-muted-foreground">{docs.length} document{docs.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>
                <div className="divide-y divide-border">
                  {docs.map((doc: DocumentItem) => (
                    <div key={doc.id} className="flex items-start gap-4 px-5 py-4 hover:bg-muted/5 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground text-sm leading-tight">{doc.title}</div>
                        {doc.description && (
                          <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.description}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                          <span className="font-mono truncate max-w-[200px]">{doc.fileName}</span>
                          {doc.fileSize && <span>{formatBytes(doc.fileSize)}</span>}
                          {doc.uploadedAt && <span>Added {formatDate(doc.uploadedAt)}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={doc.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                          Download
                        </a>
                        <button
                          onClick={() => setConfirmDeleteId(doc.id)}
                          className="p-1.5 text-muted-foreground hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete document"
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
        </div>
      )}

      {/* Upload modal */}
      <Modal isOpen={isModalOpen} onClose={() => { setIsModalOpen(false); resetForm() }} title="Upload Document">
        <div className="space-y-4 p-4">
          {/* Category */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">Category</label>
            <div className="grid grid-cols-1 gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.value}
                  type="button"
                  onClick={() => setCategory(cat.value)}
                  className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border text-left transition-all ${
                    category === cat.value
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/10"
                  }`}
                >
                  <div className={`mt-0.5 w-2.5 h-2.5 rounded-full shrink-0 ${category === cat.value ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <div>
                    <div className="text-sm font-medium text-foreground">{cat.label}</div>
                    <div className="text-xs text-muted-foreground">{cat.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-2">File</label>
            {uploadedFile ? (
              <div className="flex items-center gap-3 p-3 rounded-lg border border-green-200 bg-green-50">
                <FileText className="w-5 h-5 text-green-600 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-green-800 truncate">{uploadedFile.name}</div>
                  <div className="text-xs text-green-600">{formatBytes(uploadedFile.size)}</div>
                </div>
                <button
                  type="button"
                  onClick={() => setUploadedFile(null)}
                  className="p-1 text-green-600 hover:text-green-800 rounded"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={openUploadWidget}
                disabled={!widgetLoaded || uploading}
                className="w-full flex flex-col items-center gap-2 p-6 rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/10 transition-all disabled:opacity-50"
              >
                <Upload className="w-6 h-6 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {uploading ? "Uploading…" : !widgetLoaded ? "Loading uploader…" : "Click to upload PDF or document"}
                </span>
                <span className="text-xs text-muted-foreground/60">PDF only — up to 20 MB</span>
              </button>
            )}
          </div>

          {/* Title */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Medical Declaration Form"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1.5">Description <span className="font-normal">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief note about this document…"
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => { setIsModalOpen(false); resetForm() }}>Cancel</Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || !uploadedFile || !title.trim()}>
              {createMutation.isPending ? "Saving…" : "Save Document"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete confirmation modal */}
      <Modal isOpen={confirmDeleteId !== null} onClose={() => setConfirmDeleteId(null)} title="Delete Document">
        <div className="p-4 space-y-4">
          <div className="flex items-start gap-3 p-3 rounded-lg bg-red-50 border border-red-100">
            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
            <p className="text-sm text-red-700">This will permanently delete the document record. The file on Cloudinary will remain but will no longer be accessible from here.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => confirmDeleteId !== null && handleDelete(confirmDeleteId)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  )
}
