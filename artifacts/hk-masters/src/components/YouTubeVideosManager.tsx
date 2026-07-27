import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { Trash2, Plus, Pencil, Check, X, ChevronUp, ChevronDown, Youtube } from "lucide-react"

const ADMIN_SESSION_KEY = "hkm_admin_session"
const API_BASE = import.meta.env.VITE_API_BASE ?? ""

interface YtVideo {
  youtube_id: string
  title: string
  description?: string
}

function getToken() {
  return typeof localStorage !== "undefined" ? localStorage.getItem(ADMIN_SESSION_KEY) : null
}

function getYouTubeId(input: string): string {
  if (!input) return ""
  const short = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (short) return short[1]
  const long = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (long) return long[1]
  const embed = input.match(/embed\/([a-zA-Z0-9_-]{11})/)
  if (embed) return embed[1]
  return input.trim()
}

function isValidYouTube(input: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(getYouTubeId(input))
}

async function saveVideos(videos: YtVideo[]): Promise<YtVideo[]> {
  const token = getToken()
  const headers: Record<string, string> = { "Content-Type": "application/json" }
  if (token) headers["x-session-token"] = token
  const res = await fetch(`${API_BASE}/api/site-content/media-videos`, {
    method: "PUT",
    headers,
    body: JSON.stringify({ videos }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || "Failed to save videos")
  }
  const data = await res.json()
  return data.videos as YtVideo[]
}

function VideoForm({
  initial,
  saving,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: YtVideo | null
  saving: boolean
  onSubmit: (v: YtVideo) => void
  onCancel: () => void
  submitLabel: string
}) {
  const [link, setLink] = useState(initial?.youtube_id ?? "")
  const [title, setTitle] = useState(initial?.title ?? "")
  const [description, setDescription] = useState(initial?.description ?? "")

  const linkOk = isValidYouTube(link)
  const canSubmit = linkOk && title.trim().length > 0 && !saving

  return (
    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50 space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">YouTube link</label>
        <input
          autoFocus
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://www.youtube.com/watch?v=… or https://youtu.be/…"
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {link.trim() && !linkOk && (
          <p className="text-xs text-red-500 mt-1">That doesn't look like a YouTube link or video ID</p>
        )}
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title shown on the Media page"
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description (optional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          placeholder="Short description shown under the title"
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={!canSubmit}
          onClick={() =>
            onSubmit({
              youtube_id: link.trim(),
              title: title.trim(),
              ...(description.trim() ? { description: description.trim() } : {}),
            })
          }
        >
          <Check className="w-3.5 h-3.5 mr-1.5" /> {submitLabel}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={saving}>
          <X className="w-3.5 h-3.5 mr-1.5" /> Cancel
        </Button>
      </div>
    </div>
  )
}

export function YouTubeVideosManager() {
  const { toast } = useToast()
  const [videos, setVideos] = useState<YtVideo[] | null>(null)
  const [saving, setSaving] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/site-content/media-videos`)
      if (res.ok) {
        const data = await res.json()
        setVideos(data.videos)
      } else {
        setVideos([])
      }
    } catch {
      toast({ title: "Failed to load videos", variant: "destructive" })
      setVideos([])
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const persist = async (next: YtVideo[], successMsg: string) => {
    setSaving(true)
    const prev = videos
    setVideos(next) // optimistic
    try {
      const saved = await saveVideos(next)
      setVideos(saved)
      toast({ title: successMsg })
    } catch (e) {
      setVideos(prev)
      toast({ title: (e as Error).message || "Failed to save", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  if (videos === null) {
    return <div className="text-gray-400 text-sm py-8">Loading videos…</div>
  }

  const handleAdd = async (v: YtVideo) => {
    setAdding(false)
    await persist([...videos, v], "Video added")
  }

  const handleEdit = async (index: number, v: YtVideo) => {
    setEditingIndex(null)
    await persist(videos.map((x, i) => (i === index ? v : x)), "Video updated")
  }

  const handleRemove = async (index: number) => {
    const v = videos[index]
    if (!window.confirm(`Remove "${v.title}" from the Media page? The video stays on YouTube.`)) return
    await persist(videos.filter((_, i) => i !== index), "Video removed")
  }

  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= videos.length) return
    const next = [...videos]
    ;[next[index], next[target]] = [next[target], next[index]]
    await persist(next, "Order updated")
  }

  return (
    <div className="space-y-3 max-w-3xl">
      {videos.length === 0 && !adding && (
        <div className="border-2 border-dashed border-gray-200 rounded-xl h-32 flex flex-col items-center justify-center gap-2 text-gray-400">
          <Youtube className="w-8 h-8 opacity-40" />
          <p className="text-sm">No videos yet — add a YouTube link to get started</p>
        </div>
      )}

      {videos.map((video, i) =>
        editingIndex === i ? (
          <VideoForm
            key={`edit-${i}`}
            initial={video}
            saving={saving}
            submitLabel="Save"
            onSubmit={(v) => handleEdit(i, v)}
            onCancel={() => setEditingIndex(null)}
          />
        ) : (
          <div
            key={`${video.youtube_id}-${i}`}
            className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-3 shadow-sm"
          >
            <img
              src={`https://img.youtube.com/vi/${getYouTubeId(video.youtube_id)}/mqdefault.jpg`}
              alt=""
              className="w-24 h-14 object-cover rounded-lg bg-gray-100 shrink-0"
              loading="lazy"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{video.title}</p>
              {video.description && (
                <p className="text-xs text-gray-500 truncate">{video.description}</p>
              )}
              <a
                href={`https://www.youtube.com/watch?v=${getYouTubeId(video.youtube_id)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-red-600 hover:text-red-700"
              >
                Watch on YouTube
              </a>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => handleMove(i, -1)}
                disabled={saving || i === 0}
                title="Move up"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleMove(i, 1)}
                disabled={saving || i === videos.length - 1}
                title="Move down"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setEditingIndex(i); setAdding(false) }}
                disabled={saving}
                title="Edit"
                className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleRemove(i)}
                disabled={saving}
                title="Remove"
                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 disabled:opacity-30"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )
      )}

      {adding ? (
        <VideoForm
          initial={null}
          saving={saving}
          submitLabel="Add Video"
          onSubmit={handleAdd}
          onCancel={() => setAdding(false)}
        />
      ) : (
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setAdding(true); setEditingIndex(null) }}
          disabled={saving}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" /> Add YouTube Video
        </Button>
      )}
    </div>
  )
}
