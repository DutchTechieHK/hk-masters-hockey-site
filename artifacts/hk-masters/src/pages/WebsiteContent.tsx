import { useState, useRef, useEffect, useCallback, DragEvent } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Upload, Trash2, Plus, Globe, ImageIcon, GripVertical, Star, AlertTriangle } from "lucide-react"
import { MediaAlbumsManager } from "@/components/MediaAlbumsManager"
import { PageTextsManager } from "@/components/PageTextsManager"
import { YouTubeVideosManager } from "@/components/YouTubeVideosManager"

const ADMIN_SESSION_KEY = "hkm_admin_session"
const API_BASE = import.meta.env.VITE_API_BASE ?? ""

interface SiteContent {
  heroImage: string
  mo40Photo: string
  mo50Photo: string
  galleryImages: { url: string; caption?: string }[]
  galleryUpdatedAt?: string | null
}

class ConflictError extends Error {}

function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null
}

async function uploadImage(file: File): Promise<string> {
  const token = getToken()
  const formData = new FormData()
  formData.append("file", file)
  const headers: Record<string, string> = {}
  if (token) headers["x-session-token"] = token
  const res = await fetch(`${API_BASE}/api/site-content/upload-image`, {
    method: "POST",
    headers,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Upload failed")
  }
  const { imageUrl } = await res.json()
  return imageUrl as string
}

async function saveContent(content: Partial<SiteContent>): Promise<SiteContent> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["x-session-token"] = token
  const res = await fetch(`${API_BASE}/api/site-content`, {
    method: "PUT",
    headers,
    body: JSON.stringify(content),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    const message = (err as { error?: string }).error || "Failed to save"
    if (res.status === 409) throw new ConflictError(message)
    throw new Error(message)
  }
  return res.json() as Promise<SiteContent>
}

function useIsPortrait(url: string) {
  const [isPortrait, setIsPortrait] = useState(false)
  useEffect(() => {
    setIsPortrait(false)
    if (!url) return
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setIsPortrait(img.naturalHeight > img.naturalWidth)
    }
    img.src = url
    return () => { cancelled = true }
  }, [url])
  return isPortrait
}

function PhotoCard({
  label,
  description,
  url,
  onUpload,
  onClear,
  uploading,
}: {
  label: string
  description: string
  url: string
  onUpload: (file: File) => void
  onClear: () => void
  uploading: boolean
}) {
  const fileRef = useRef<HTMLInputElement>(null)

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="relative h-48 bg-gray-100">
        {url ? (
          <img src={url} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageIcon className="w-10 h-10 opacity-40" />
            <p className="text-xs">No photo set</p>
          </div>
        )}
        {uploading && (
          <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      <div className="p-4">
        <p className="font-semibold text-sm text-gray-900 mb-0.5">{label}</p>
        <p className="text-xs text-gray-500 mb-3">{description}</p>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex-1"
          >
            <Upload className="w-3.5 h-3.5 mr-1.5" />
            {url ? "Replace" : "Upload"}
          </Button>
          {url && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={uploading}
              className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onUpload(f)
          e.target.value = ""
        }}
      />
    </div>
  )
}

export default function WebsiteContent() {
  const { toast } = useToast()
  const [content, setContent] = useState<SiteContent | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploadingField, setUploadingField] = useState<string | null>(null)
  const [savingGallery, setSavingGallery] = useState(false)
  const [savingCaptionIndex, setSavingCaptionIndex] = useState<number | null>(null)
  const galleryFileRef = useRef<HTMLInputElement>(null)
  const heroIsPortrait = useIsPortrait(content?.heroImage ?? "")
  const [addingToGallery, setAddingToGallery] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/site-content`)
      if (res.ok) setContent(await res.json())
    } catch {
      toast({ title: "Failed to load site content", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const handlePhotoUpload = async (field: "heroImage" | "mo40Photo" | "mo50Photo", file: File) => {
    setUploadingField(field)
    try {
      const imageUrl = await uploadImage(file)
      const updated = await saveContent({ [field]: imageUrl })
      setContent(updated)
      toast({ title: "Photo updated successfully" })
    } catch (e) {
      toast({ title: (e as Error).message || "Upload failed", variant: "destructive" })
    } finally {
      setUploadingField(null)
    }
  }

  const handlePhotoClear = async (field: "heroImage" | "mo40Photo" | "mo50Photo") => {
    if (!content) return
    setUploadingField(field)
    try {
      const updated = await saveContent({ [field]: "" })
      setContent(updated)
      toast({ title: "Photo removed" })
    } catch {
      toast({ title: "Failed to remove photo", variant: "destructive" })
    } finally {
      setUploadingField(null)
    }
  }

  // Saves a new gallery list with an optimistic-concurrency check. If another
  // admin changed the gallery since this page loaded, the server rejects the
  // save (409) — we surface the message and reload the latest content.
  const saveGallery = useCallback(async (newGallery: { url: string; caption?: string }[]) => {
    if (!content) throw new Error("Not loaded")
    try {
      const updated = await saveContent({
        galleryImages: newGallery,
        galleryUpdatedAt: content.galleryUpdatedAt ?? null,
      })
      setContent(updated)
      return true
    } catch (e) {
      if (e instanceof ConflictError) {
        toast({ title: "Save blocked", description: e.message, variant: "destructive" })
        await load() // pull the latest gallery so the admin can redo their edit
        return false
      }
      throw e
    }
  }, [content, load, toast])

  const handleGalleryAdd = async (files: FileList) => {
    if (!content) return
    setAddingToGallery(true)
    try {
      const newUrls: { url: string; caption?: string }[] = []
      for (const file of Array.from(files)) {
        const imageUrl = await uploadImage(file)
        newUrls.push({ url: imageUrl })
      }
      const newGallery = [...content.galleryImages, ...newUrls]
      if (await saveGallery(newGallery)) {
        toast({ title: `${newUrls.length} photo${newUrls.length > 1 ? "s" : ""} added to gallery` })
      }
    } catch (e) {
      toast({ title: (e as Error).message || "Upload failed", variant: "destructive" })
    } finally {
      setAddingToGallery(false)
    }
  }

  const handleGalleryRemove = async (index: number) => {
    if (!content) return
    setSavingGallery(true)
    try {
      const newGallery = content.galleryImages.filter((_, i) => i !== index)
      if (await saveGallery(newGallery)) {
        toast({ title: "Photo removed from gallery" })
      }
    } catch {
      toast({ title: "Failed to remove photo", variant: "destructive" })
    } finally {
      setSavingGallery(false)
    }
  }

  const handleGalleryCaption = async (index: number, caption: string) => {
    if (!content) return
    const current = content.galleryImages[index]?.caption ?? ""
    if (caption.trim() === current.trim()) return
    setSavingGallery(true)
    setSavingCaptionIndex(index)
    try {
      const newGallery = content.galleryImages.map((img, i) =>
        i === index ? { url: img.url, caption: caption.trim() || undefined } : img
      )
      if (await saveGallery(newGallery)) {
        toast({ title: caption.trim() ? "Caption saved" : "Caption removed" })
      }
    } catch {
      toast({ title: "Failed to save caption", variant: "destructive" })
    } finally {
      setSavingGallery(false)
      setSavingCaptionIndex(null)
    }
  }

  const handleSetAsHero = async (url: string) => {
    if (!content) return
    setUploadingField("heroImage")
    try {
      const updated = await saveContent({ heroImage: url })
      setContent(updated)
      toast({ title: "Hero photo updated" })
    } catch {
      toast({ title: "Failed to set hero photo", variant: "destructive" })
    } finally {
      setUploadingField(null)
    }
  }

  const handleGalleryReorder = useCallback(async (fromIndex: number, toIndex: number) => {
    if (!content || fromIndex === toIndex) return
    const newGallery = [...content.galleryImages]
    const [moved] = newGallery.splice(fromIndex, 1)
    newGallery.splice(toIndex, 0, moved)
    setSavingGallery(true)
    try {
      if (await saveGallery(newGallery)) {
        toast({ title: "Gallery order saved" })
      }
    } catch {
      toast({ title: "Failed to reorder gallery", variant: "destructive" })
    } finally {
      setSavingGallery(false)
    }
  }, [content, saveGallery, toast])

  const handleDragStart = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    dragIndexRef.current = index
    e.dataTransfer.effectAllowed = "move"
    // Use a transparent 1×1 pixel as ghost to avoid the default image ghost
    const ghost = document.createElement("div")
    ghost.style.position = "fixed"
    ghost.style.top = "-1000px"
    document.body.appendChild(ghost)
    e.dataTransfer.setDragImage(ghost, 0, 0)
    setTimeout(() => ghost.remove(), 0)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOverIndex(index)
  }, [])

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>, toIndex: number) => {
    e.preventDefault()
    const fromIndex = dragIndexRef.current
    dragIndexRef.current = null
    setDragOverIndex(null)
    if (fromIndex !== null && fromIndex !== toIndex) {
      void handleGalleryReorder(fromIndex, toIndex)
    }
  }, [handleGalleryReorder])

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null
    setDragOverIndex(null)
  }, [])

  const handleGalleryReplace = async (index: number, file: File) => {
    if (!content) return
    setSavingGallery(true)
    try {
      const imageUrl = await uploadImage(file)
      const newGallery = content.galleryImages.map((img, i) => i === index ? { ...img, url: imageUrl } : img)
      if (await saveGallery(newGallery)) {
        toast({ title: "Gallery photo replaced" })
      }
    } catch (e) {
      toast({ title: (e as Error).message || "Upload failed", variant: "destructive" })
    } finally {
      setSavingGallery(false)
    }
  }

  if (loading) {
    return (
      <PageLayout title="Website" description="Manage public website photos">
        <div className="flex items-center justify-center h-64 text-gray-400">Loading…</div>
      </PageLayout>
    )
  }

  if (!content) {
    return (
      <PageLayout title="Website" description="Manage public website photos">
        <div className="flex items-center justify-center h-64 text-red-500">Failed to load content</div>
      </PageLayout>
    )
  }

  return (
    <PageLayout
      title="Website"
      description="Manage photos shown on the public website — changes go live immediately"
    >
      <div className="space-y-10 max-w-5xl">

        {/* ── Hero Photo ──────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Homepage Hero Photo</h2>
            <p className="text-sm text-gray-500 mt-0.5">The large photo shown in the homepage banner</p>
          </div>
          <div className="max-w-md">
            <PhotoCard
              label="Hero Photo"
              description="Shown on the right side of the homepage banner. Landscape photos work best."
              url={content.heroImage}
              uploading={uploadingField === "heroImage"}
              onUpload={(f) => handlePhotoUpload("heroImage", f)}
              onClear={() => handlePhotoClear("heroImage")}
            />
            {heroIsPortrait && (
              <div className="mt-3 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
                <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>This photo is portrait (taller than wide). Landscape photos look best here.</p>
              </div>
            )}
          </div>
        </section>

        {/* ── Squad Photos ────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Squad Photos</h2>
            <p className="text-sm text-gray-500 mt-0.5">Team photos shown on the Teams page</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 max-w-2xl">
            <PhotoCard
              label="MO40 Squad Photo"
              description="Shown on the Teams page alongside the MO40 squad details."
              url={content.mo40Photo}
              uploading={uploadingField === "mo40Photo"}
              onUpload={(f) => handlePhotoUpload("mo40Photo", f)}
              onClear={() => handlePhotoClear("mo40Photo")}
            />
            <PhotoCard
              label="MO50 Squad Photo"
              description="Shown on the Teams page alongside the MO50 squad details."
              url={content.mo50Photo}
              uploading={uploadingField === "mo50Photo"}
              onUpload={(f) => handlePhotoUpload("mo50Photo", f)}
              onClear={() => handlePhotoClear("mo50Photo")}
            />
          </div>
        </section>

        {/* ── Gallery Strip ────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-gray-900">Homepage Gallery Strip</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                The scrollable photo strip below the homepage hero — {content.galleryImages.length} photo{content.galleryImages.length !== 1 ? "s" : ""}
              </p>
            </div>
            <div>
              <Button
                onClick={() => galleryFileRef.current?.click()}
                disabled={addingToGallery || savingGallery}
                size="sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                Add Photos
              </Button>
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleGalleryAdd(e.target.files)
                  e.target.value = ""
                }}
              />
            </div>
          </div>

          {content.galleryImages.length === 0 ? (
            <div className="border-2 border-dashed border-gray-200 rounded-xl h-40 flex flex-col items-center justify-center gap-3 text-gray-400">
              <ImageIcon className="w-8 h-8 opacity-40" />
              <p className="text-sm">No gallery photos yet — click Add Photos to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {content.galleryImages.map((img, i) => (
                <GalleryThumb
                  key={`${img.url}-${i}`}
                  url={img.url}
                  caption={img.caption ?? ""}
                  index={i}
                  disabled={savingGallery}
                  savingCaption={savingCaptionIndex === i}
                  isHero={content.heroImage === img.url}
                  isDragOver={dragOverIndex === i}
                  onSetAsHero={() => handleSetAsHero(img.url)}
                  onRemove={() => handleGalleryRemove(i)}
                  onReplace={(f) => handleGalleryReplace(i, f)}
                  onCaption={(c) => handleGalleryCaption(i, c)}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDrop={(e) => handleDrop(e, i)}
                  onDragEnd={handleDragEnd}
                />
              ))}

              {/* Add more tile */}
              <button
                onClick={() => galleryFileRef.current?.click()}
                disabled={addingToGallery || savingGallery}
                className="h-32 rounded-xl border-2 border-dashed border-gray-200 hover:border-gray-400 flex flex-col items-center justify-center gap-1.5 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-40"
              >
                {addingToGallery ? (
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <Plus className="w-5 h-5" />
                    <span className="text-xs font-medium">Add</span>
                  </>
                )}
              </button>
            </div>
          )}
        </section>

        {/* ── Page Text ────────────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Page Text</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Edit the written content of the public website pages — headings, intros, timelines, and contact details
            </p>
          </div>
          <PageTextsManager />
        </section>

        {/* ── Media Page Albums ────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">Media Page Albums</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Photo &amp; video albums shown on the public Media page — uploads are stored on Cloudinary automatically
            </p>
          </div>
          <MediaAlbumsManager />
        </section>

        {/* ── YouTube Videos ───────────────────────────────────── */}
        <section>
          <div className="mb-4">
            <h2 className="text-base font-semibold text-gray-900">YouTube Videos</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              The "Videos" section on the public Media page — paste YouTube links with a title and description
            </p>
          </div>
          <YouTubeVideosManager />
        </section>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100 text-sm text-blue-700 max-w-2xl">
          <Globe className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>
            Changes to hero and squad photos go live on the public website immediately.
            Gallery changes are also immediate. No need to republish the site.
          </p>
        </div>

      </div>
    </PageLayout>
  )
}

function GalleryThumb({
  url,
  caption,
  index,
  disabled,
  savingCaption,
  isHero,
  isDragOver,
  onSetAsHero,
  onRemove,
  onReplace,
  onCaption,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  url: string
  caption: string
  index: number
  disabled: boolean
  savingCaption: boolean
  isHero: boolean
  isDragOver: boolean
  onSetAsHero: () => void
  onRemove: () => void
  onReplace: (f: File) => void
  onCaption: (caption: string) => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragOver: (e: DragEvent<HTMLDivElement>) => void
  onDrop: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: (e: DragEvent<HTMLDivElement>) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(caption)

  useEffect(() => { setDraft(caption) }, [caption])

  const commit = () => {
    setEditing(false)
    onCaption(draft)
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`transition-all ${isDragOver ? "ring-2 ring-primary ring-offset-1 rounded-xl scale-[1.02]" : ""}`}
    >
    <div className="relative h-32 rounded-xl overflow-hidden group bg-gray-100">
      <img
        src={url}
        alt={caption || `Gallery photo ${index + 1}`}
        className="w-full h-full object-cover"
        draggable={false}
      />
      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
        <button
          onClick={onSetAsHero}
          disabled={disabled || isHero}
          title={isHero ? "Current hero photo" : "Set as hero"}
          className="p-1.5 bg-white/90 rounded-lg text-amber-500 hover:bg-white transition-colors disabled:opacity-50"
        >
          <Star className={`w-3.5 h-3.5 ${isHero ? "fill-amber-400" : ""}`} />
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={disabled}
          title="Replace"
          className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors disabled:opacity-50"
        >
          <Upload className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onRemove}
          disabled={disabled}
          title="Remove"
          className="p-1.5 bg-white/90 rounded-lg text-red-600 hover:bg-white transition-colors disabled:opacity-50"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="absolute top-1.5 left-1.5 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
        {index + 1}
      </div>
      {isHero && (
        <div className="absolute top-1.5 right-1.5 bg-amber-400 text-amber-900 text-[10px] font-bold px-1.5 py-0.5 rounded flex items-center gap-0.5">
          <Star className="w-2.5 h-2.5 fill-amber-900" />
          Hero
        </div>
      )}
      {/* Drag handle — bottom-left, visible on hover */}
      <div
        className="absolute bottom-1.5 left-1.5 p-1 bg-black/50 rounded text-white opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing"
        title="Drag to reorder"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) onReplace(f)
          e.target.value = ""
        }}
      />
    </div>
    {savingCaption ? (
      <div className="mt-1.5 w-full flex items-center gap-1.5 px-2 py-1 text-xs text-gray-400">
        <div className="w-3 h-3 border border-gray-400 border-t-transparent rounded-full animate-spin flex-shrink-0" />
        <span className="truncate">Saving…</span>
      </div>
    ) : editing ? (
      <input
        autoFocus
        type="text"
        value={draft}
        maxLength={200}
        placeholder="Add a caption…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit()
          if (e.key === "Escape") { setDraft(caption); setEditing(false) }
        }}
        className="mt-1.5 w-full text-xs px-2 py-1 border border-primary rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
      />
    ) : (
      <button
        onClick={() => { if (!disabled) setEditing(true) }}
        disabled={disabled}
        title={caption ? "Click to edit caption" : "Click to add caption"}
        className={`mt-1.5 w-full text-left text-xs px-2 py-1 rounded-md truncate transition-colors ${
          caption ? "text-gray-700 hover:bg-gray-100" : "text-gray-400 italic hover:bg-gray-100 hover:text-gray-600"
        } disabled:opacity-50`}
      >
        {caption || "Add caption…"}
      </button>
    )}
    </div>
  )
}
