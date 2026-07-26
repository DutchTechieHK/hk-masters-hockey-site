import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  Upload, Trash2, Plus, ImageIcon, Pencil, Check, X,
  ChevronLeft, ChevronRight, Film,
} from "lucide-react"

const ADMIN_SESSION_KEY = "hkm_admin_session"
const API_BASE = import.meta.env.VITE_API_BASE ?? ""

interface Album {
  name: string
  photos: string[]
}

function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null
}

function isVideo(url: string) {
  return url.includes("/video/upload/")
}

function videoPoster(url: string) {
  return url
    .replace("/video/upload/", "/video/upload/w_400,q_auto,f_jpg,so_0/")
    .replace(/\.[^.]+$/, ".jpg")
}

function thumb(url: string) {
  if (isVideo(url)) return videoPoster(url)
  if (url.includes("cloudinary.com") && url.includes("/upload/")) {
    return url.replace("/upload/", "/upload/c_limit,w_400,q_auto,f_auto/")
  }
  return url
}

async function uploadMedia(file: File): Promise<string> {
  const token = getToken()
  const formData = new FormData()
  formData.append("file", file)
  const headers: Record<string, string> = {}
  if (token) headers["x-session-token"] = token
  const res = await fetch(`${API_BASE}/api/site-content/upload-media`, {
    method: "POST",
    headers,
    body: formData,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Upload failed")
  }
  const { url } = await res.json()
  return url as string
}

async function saveAlbums(albums: Album[]): Promise<Album[]> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["x-session-token"] = token
  const res = await fetch(`${API_BASE}/api/site-content/media-albums`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ albums }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Failed to save albums")
  }
  const data = await res.json()
  return data.albums as Album[]
}

export function MediaAlbumsManager() {
  const { toast } = useToast()
  const [albums, setAlbums] = useState<Album[] | null>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState("")
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState("")
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const fileRef = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/site-content/media-albums`)
      if (res.ok) {
        const data = await res.json()
        setAlbums(data.albums)
      } else {
        setAlbums([])
      }
    } catch {
      toast({ title: "Failed to load media albums", variant: "destructive" })
      setAlbums([])
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const persist = async (next: Album[], successMsg: string) => {
    setSaving(true)
    const prev = albums
    setAlbums(next) // optimistic
    try {
      const savedAlbums = await saveAlbums(next)
      setAlbums(savedAlbums)
      toast({ title: successMsg })
    } catch (e) {
      setAlbums(prev)
      toast({ title: (e as Error).message || "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (albums === null) {
    return <div className="text-gray-400 text-sm py-8">Loading albums…</div>
  }

  const active = albums[activeIndex] ?? null

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    if (albums.some((a) => a.name === name)) {
      toast({ title: "An album with that name already exists", variant: "destructive" })
      return
    }
    setCreating(false)
    setNewName("")
    await persist([...albums, { name, photos: [] }], "Album created")
    setActiveIndex(albums.length)
  }

  const handleRename = async () => {
    if (!active) return
    const name = nameDraft.trim()
    setRenaming(false)
    if (!name || name === active.name) return
    const next = albums.map((a, i) => (i === activeIndex ? { ...a, name } : a))
    await persist(next, "Album renamed")
  }

  const handleDeleteAlbum = async () => {
    if (!active) return
    if (!window.confirm(`Delete the album "${active.name}" and its ${active.photos.length} item(s) from the website? The files themselves are not deleted from Cloudinary.`)) return
    const next = albums.filter((_, i) => i !== activeIndex)
    setActiveIndex(0)
    await persist(next, "Album deleted")
  }

  const handleUploadFiles = async (files: FileList) => {
    if (!active) return
    setUploading(true)
    const uploaded: string[] = []
    let failed = 0
    const list = Array.from(files)
    try {
      for (let i = 0; i < list.length; i++) {
        setUploadProgress(list.length > 1 ? `Uploading ${i + 1} of ${list.length}…` : "Uploading…")
        try {
          uploaded.push(await uploadMedia(list[i]))
        } catch (e) {
          failed++
          toast({ title: `${list[i].name}: ${(e as Error).message}`, variant: "destructive" })
          // Credentials missing / server down — stop hammering the endpoint
          if ((e as Error).message.toLowerCase().includes("not configured")) break
        }
      }
      if (uploaded.length > 0) {
        const next = albums.map((a, i) =>
          i === activeIndex ? { ...a, photos: [...a.photos, ...uploaded] } : a
        )
        await persist(
          next,
          failed > 0
            ? `${uploaded.length} added, ${failed} failed`
            : `${uploaded.length} item${uploaded.length > 1 ? "s" : ""} added to album`
        )
      }
    } finally {
      setUploading(false)
      setUploadProgress("")
    }
  }

  const handleRemoveItem = async (index: number) => {
    if (!active) return
    const next = albums.map((a, i) =>
      i === activeIndex ? { ...a, photos: a.photos.filter((_, j) => j !== index) } : a
    )
    await persist(next, "Item removed from album")
  }

  const handleMoveItem = async (index: number, dir: -1 | 1) => {
    if (!active) return
    const target = index + dir
    if (target < 0 || target >= active.photos.length) return
    const photos = [...active.photos]
    ;[photos[index], photos[target]] = [photos[target], photos[index]]
    const next = albums.map((a, i) => (i === activeIndex ? { ...a, photos } : a))
    await persist(next, "Order updated")
  }

  return (
    <div className="flex flex-col sm:flex-row gap-5">
      {/* Album list */}
      <div className="sm:w-64 sm:shrink-0 space-y-1.5">
        {albums.map((album, i) => (
          <button
            key={i}
            onClick={() => { setActiveIndex(i); setRenaming(false) }}
            className={`w-full text-left px-3.5 py-2.5 rounded-lg text-sm transition-colors ${
              i === activeIndex
                ? "bg-primary text-primary-foreground"
                : "bg-gray-50 hover:bg-gray-100 text-gray-800"
            }`}
          >
            <span className="block font-medium leading-snug">{album.name}</span>
            <span className={`text-xs ${i === activeIndex ? "opacity-80" : "text-gray-400"}`}>
              {album.photos.length} item{album.photos.length !== 1 ? "s" : ""}
            </span>
          </button>
        ))}

        {creating ? (
          <div className="flex items-center gap-1.5 pt-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") { setCreating(false); setNewName("") } }}
              placeholder="Album name"
              className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            <Button size="sm" onClick={handleCreate} disabled={!newName.trim() || saving}><Check className="w-3.5 h-3.5" /></Button>
            <Button size="sm" variant="outline" onClick={() => { setCreating(false); setNewName("") }}><X className="w-3.5 h-3.5" /></Button>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="w-full mt-1" onClick={() => setCreating(true)} disabled={saving}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New Album
          </Button>
        )}
      </div>

      {/* Active album */}
      <div className="flex-1 min-w-0">
        {!active ? (
          <div className="border-2 border-dashed border-gray-200 rounded-xl h-40 flex flex-col items-center justify-center gap-2 text-gray-400">
            <ImageIcon className="w-8 h-8 opacity-40" />
            <p className="text-sm">No albums yet — create one to get started</p>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-4">
              {renaming ? (
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                  <input
                    autoFocus
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") handleRename(); if (e.key === "Escape") setRenaming(false) }}
                    className="flex-1 min-w-0 border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                  <Button size="sm" onClick={handleRename} disabled={saving}><Check className="w-3.5 h-3.5" /></Button>
                  <Button size="sm" variant="outline" onClick={() => setRenaming(false)}><X className="w-3.5 h-3.5" /></Button>
                </div>
              ) : (
                <>
                  <h3 className="font-semibold text-gray-900 text-sm flex-1 min-w-0 truncate">{active.name}</h3>
                  <Button size="sm" variant="outline" onClick={() => { setNameDraft(active.name); setRenaming(true) }} disabled={saving}>
                    <Pencil className="w-3.5 h-3.5 mr-1.5" /> Rename
                  </Button>
                  <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading || saving}>
                    <Upload className="w-3.5 h-3.5 mr-1.5" />
                    {uploading ? uploadProgress || "Uploading…" : "Add Photos / Videos"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDeleteAlbum}
                    disabled={saving || uploading}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 border-red-200"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </>
              )}
            </div>

            {active.photos.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl h-40 flex flex-col items-center justify-center gap-2 text-gray-400">
                <ImageIcon className="w-8 h-8 opacity-40" />
                <p className="text-sm">Empty album — add photos or videos</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {active.photos.map((url, i) => (
                  <div key={`${url}-${i}`} className="relative h-28 rounded-xl overflow-hidden group bg-gray-100">
                    <img src={thumb(url)} alt="" className="w-full h-full object-cover" loading="lazy" />
                    {isVideo(url) && (
                      <div className="absolute top-1.5 left-1.5 bg-black/60 rounded-md px-1.5 py-0.5 flex items-center gap-1">
                        <Film className="w-3 h-3 text-white" />
                        <span className="text-[10px] text-white font-medium">Video</span>
                      </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1.5 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={() => handleMoveItem(i, -1)}
                        disabled={saving || i === 0}
                        title="Move earlier"
                        className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors disabled:opacity-40"
                      >
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleMoveItem(i, 1)}
                        disabled={saving || i === active.photos.length - 1}
                        title="Move later"
                        className="p-1.5 bg-white/90 rounded-lg text-gray-700 hover:bg-white transition-colors disabled:opacity-40"
                      >
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleRemoveItem(i)}
                        disabled={saving}
                        title="Remove from album"
                        className="p-1.5 bg-white/90 rounded-lg text-red-600 hover:bg-white transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/quicktime,video/webm"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) handleUploadFiles(e.target.files)
          e.target.value = ""
        }}
      />
    </div>
  )
}
