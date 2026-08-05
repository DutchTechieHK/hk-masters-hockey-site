import { useState, useEffect, useCallback, useRef } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Modal } from "@/components/ui/modal"
import {
  Plus, Trash2, Pencil, Eye, EyeOff, Globe, FileText, Image as ImageIcon,
  Bold, Italic, Underline as UnderlineIcon, List, ListOrdered, Quote,
  Heading1, Heading2, Heading3, Minus, Link as LinkIcon, Undo2, Redo2,
  Upload, X, AlignLeft, AlignCenter, AlignRight,
} from "lucide-react"
import { format, parseISO } from "date-fns"
import { useToast } from "@/hooks/use-toast"
import { getStoredAdminToken } from "@/lib/admin-auth"
import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import UnderlineExt from "@tiptap/extension-underline"
import LinkExt from "@tiptap/extension-link"
import ImageExt from "@tiptap/extension-image"
import TextAlign from "@tiptap/extension-text-align"

function authHeaders(): Record<string, string> {
  const token = getStoredAdminToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { "x-session-token": token } : {}),
  }
}

function authHeadersForUpload(): Record<string, string> {
  const token = getStoredAdminToken()
  return token ? { "x-session-token": token } : {}
}

type NewsPost = {
  id: number
  title: string
  slug: string
  excerpt: string | null
  bodyHtml: string | null
  coverImage: string | null
  category: string | null
  author: string | null
  status: "draft" | "published"
  publishedAt: string | null
  reportDate: string | null
  createdAt: string
  updatedAt: string
}

type PostForm = {
  title: string
  slug: string
  excerpt: string
  coverImage: string
  category: string
  author: string
  status: "draft" | "published"
  reportDate: string
}

const EMPTY_FORM: PostForm = {
  title: "",
  slug: "",
  excerpt: "",
  coverImage: "",
  category: "",
  author: "",
  status: "draft",
  reportDate: "",
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

/* ── TipTap toolbar button ──────────────────────────────── */
function ToolbarBtn({
  onClick, active, title, children, disabled,
}: {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`p-1.5 rounded text-sm transition-colors ${
        active
          ? "bg-primary text-white"
          : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
      } disabled:opacity-40 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  )
}

/* ── Image insert dialog ────────────────────────────────── */
function ImageDialog({ onInsert, onClose }: { onInsert: (url: string) => void; onClose: () => void }) {
  const [tab, setTab] = useState<"upload" | "url">("upload")
  const [url, setUrl] = useState("")
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await fetch("/api/news/upload-image", {
        method: "POST",
        headers: authHeadersForUpload(),
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      onInsert(data.url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Insert image</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex border-b border-gray-100">
          {(["upload", "url"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 py-2.5 text-sm font-medium transition-colors ${tab === t ? "text-primary border-b-2 border-primary" : "text-gray-500 hover:text-gray-700"}`}
            >
              {t === "upload" ? "Upload file" : "Insert URL"}
            </button>
          ))}
        </div>
        <div className="p-5">
          {tab === "upload" ? (
            <div>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-8 flex flex-col items-center gap-3 hover:border-primary hover:bg-primary/5 transition-colors disabled:opacity-50"
              >
                <Upload className="w-8 h-8 text-gray-400" />
                <p className="text-sm text-gray-600 font-medium">{uploading ? "Uploading…" : "Click to select a photo"}</p>
                <p className="text-xs text-gray-400">JPEG, PNG, GIF, WebP · max 10 MB</p>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="https://example.com/photo.jpg"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) { onInsert(url.trim()); } }}
              />
              <Button className="w-full" onClick={() => url.trim() && onInsert(url.trim())} disabled={!url.trim()}>Insert</Button>
            </div>
          )}
          {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}

/* ── Link dialog ────────────────────────────────────────── */
function LinkDialog({ current, onInsert, onRemove, onClose }: { current: string; onInsert: (url: string) => void; onRemove: () => void; onClose: () => void }) {
  const [url, setUrl] = useState(current)
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">Insert link</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Input placeholder="https://example.com" value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && url.trim()) onInsert(url.trim()) }} autoFocus />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={() => url.trim() && onInsert(url.trim())} disabled={!url.trim()}>Apply</Button>
            {current && <Button variant="outline" onClick={onRemove}>Remove</Button>}
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── TipTap editor with toolbar ─────────────────────────── */
function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const [showImage, setShowImage] = useState(false)
  const [showLink, setShowLink] = useState(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      UnderlineExt,
      LinkExt.configure({ openOnClick: false }),
      ImageExt.configure({ inline: false }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
    ],
    content: value,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: "prose prose-sm sm:prose-base max-w-none focus:outline-none min-h-[300px] px-4 py-3",
      },
    },
  })

  useEffect(() => {
    if (editor && value !== editor.getHTML()) {
      editor.commands.setContent(value, false)
    }
  }, [])

  if (!editor) return null

  const currentLink = editor.getAttributes("link").href || ""

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary transition-all">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-0.5 p-1.5 border-b border-gray-100 bg-gray-50">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo2 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo2 className="w-4 h-4" /></ToolbarBtn>
        <span className="w-px h-6 bg-gray-200 mx-1 self-center" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive("heading", { level: 1 })} title="Heading 1"><Heading1 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2"><Heading2 className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3"><Heading3 className="w-4 h-4" /></ToolbarBtn>
        <span className="w-px h-6 bg-gray-200 mx-1 self-center" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold"><Bold className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic"><Italic className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline"><UnderlineIcon className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough"><span className="text-xs font-medium line-through">S</span></ToolbarBtn>
        <span className="w-px h-6 bg-gray-200 mx-1 self-center" />
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("left").run()} active={editor.isActive({ textAlign: "left" })} title="Align left"><AlignLeft className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("center").run()} active={editor.isActive({ textAlign: "center" })} title="Align center"><AlignCenter className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setTextAlign("right").run()} active={editor.isActive({ textAlign: "right" })} title="Align right"><AlignRight className="w-4 h-4" /></ToolbarBtn>
        <span className="w-px h-6 bg-gray-200 mx-1 self-center" />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list"><List className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list"><ListOrdered className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote"><Quote className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule"><Minus className="w-4 h-4" /></ToolbarBtn>
        <span className="w-px h-6 bg-gray-200 mx-1 self-center" />
        <ToolbarBtn onClick={() => setShowLink(true)} active={editor.isActive("link")} title="Insert link"><LinkIcon className="w-4 h-4" /></ToolbarBtn>
        <ToolbarBtn onClick={() => setShowImage(true)} title="Insert image"><ImageIcon className="w-4 h-4" /></ToolbarBtn>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />

      {showImage && (
        <ImageDialog
          onInsert={(url) => { editor.chain().focus().setImage({ src: url }).run(); setShowImage(false) }}
          onClose={() => setShowImage(false)}
        />
      )}
      {showLink && (
        <LinkDialog
          current={currentLink}
          onInsert={(url) => { editor.chain().focus().setLink({ href: url }).run(); setShowLink(false) }}
          onRemove={() => { editor.chain().focus().unsetLink().run(); setShowLink(false) }}
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  )
}

/* ── Cover image input ──────────────────────────────────── */
function CoverImageInput({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("image", file)
      const res = await fetch("/api/news/upload-image", {
        method: "POST",
        headers: authHeadersForUpload(),
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Upload failed")
      onChange(data.url)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-gray-700">Cover image</label>
      <div className="flex gap-2">
        <Input
          placeholder="https://example.com/cover.jpg  or upload →"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1"
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          title="Upload image"
          className="px-3 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors disabled:opacity-50"
        >
          {uploading ? <span className="text-xs">…</span> : <Upload className="w-4 h-4" />}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }} />
      </div>
      {value && (
        <div className="relative w-full aspect-[16/5] rounded-lg overflow-hidden bg-gray-100 border border-gray-100">
          <img src={value} alt="Cover preview" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }} />
        </div>
      )}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  )
}

/* ── Post card ──────────────────────────────────────────── */
function PostCard({
  post,
  onEdit,
  onDelete,
  onTogglePublish,
}: {
  post: NewsPost
  onEdit: () => void
  onDelete: () => void
  onTogglePublish: () => void
}) {
  const isPublished = post.status === "published"
  const dateStr = post.publishedAt
    ? format(parseISO(post.publishedAt), "d MMM yyyy")
    : format(parseISO(post.createdAt), "d MMM yyyy") + " (draft)"

  return (
    <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden flex">
      {post.coverImage && (
        <div className="w-24 sm:w-36 shrink-0 bg-gray-100">
          <img src={post.coverImage} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex-1 p-4 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${isPublished ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-amber-50 text-amber-700 border border-amber-200"}`}>
                {isPublished ? "Published" : "Draft"}
              </span>
              {post.category && <span className="text-xs text-gray-500 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded-full">{post.category}</span>}
              <span className="text-xs text-gray-400">{dateStr}</span>
            </div>
            <h3 className="font-semibold text-gray-900 leading-snug truncate">{post.title}</h3>
            {post.author && <p className="text-sm text-gray-500 mt-0.5">By {post.author}</p>}
            {post.excerpt && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{post.excerpt}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onTogglePublish}
              title={isPublished ? "Unpublish" : "Publish"}
              className={`p-1.5 rounded border transition-all ${isPublished ? "text-emerald-600 border-emerald-200 hover:bg-emerald-50" : "text-amber-600 border-amber-200 hover:bg-amber-50"}`}
            >
              {isPublished ? <Globe className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
            <button onClick={onEdit} title="Edit" className="p-1.5 text-gray-500 hover:text-primary rounded border border-transparent hover:border-border transition-all">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={onDelete} title="Delete" className="p-1.5 text-gray-500 hover:text-rose-600 rounded border border-transparent hover:border-rose-200 transition-all">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ── Main page ──────────────────────────────────────────── */
export default function NewsAdmin() {
  const { toast } = useToast()
  const [posts, setPosts] = useState<NewsPost[]>([])
  const [loading, setLoading] = useState(true)

  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editingPost, setEditingPost] = useState<NewsPost | null>(null)
  const [form, setForm] = useState<PostForm>(EMPTY_FORM)
  const [bodyHtml, setBodyHtml] = useState("")
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<NewsPost | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/news/admin/all", { headers: authHeaders() })
      const data = await res.json()
      setPosts(data.posts ?? [])
    } catch {
      toast({ title: "Failed to load posts", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditingPost(null)
    setForm(EMPTY_FORM)
    setBodyHtml("")
    setFormError(null)
    setIsEditorOpen(true)
  }

  const openEdit = (post: NewsPost) => {
    setEditingPost(post)
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? "",
      coverImage: post.coverImage ?? "",
      category: post.category ?? "",
      author: post.author ?? "",
      status: post.status,
      reportDate: post.reportDate ? post.reportDate.slice(0, 10) : "",
    })
    setBodyHtml(post.bodyHtml ?? "")
    setFormError(null)
    setIsEditorOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim()) { setFormError("Title is required"); return }
    setSaving(true)
    try {
      const payload = {
        title: form.title.trim(),
        slug: form.slug.trim() || slugify(form.title.trim()),
        excerpt: form.excerpt.trim() || null,
        bodyHtml: bodyHtml || null,
        coverImage: form.coverImage.trim() || null,
        category: form.category.trim() || null,
        author: form.author.trim() || null,
        status: form.status,
        reportDate: form.reportDate ? `${form.reportDate}T12:00:00.000Z` : null,
      }
      const url = editingPost ? `/api/news/${editingPost.id}` : "/api/news"
      const method = editingPost ? "PATCH" : "POST"
      const res = await fetch(url, { method, headers: authHeaders(), body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Save failed")
      toast({ title: editingPost ? "Post saved" : "Post created", description: form.status === "published" ? "Now live on the website" : "Saved as draft" })
      setIsEditorOpen(false)
      load()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleTogglePublish = async (post: NewsPost) => {
    const newStatus = post.status === "published" ? "draft" : "published"
    try {
      const res = await fetch(`/api/news/${post.id}`, {
        method: "PATCH",
        headers: authHeaders(),
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error("Failed")
      toast({ title: newStatus === "published" ? "Post published" : "Post unpublished" })
      load()
    } catch {
      toast({ title: "Failed to update status", variant: "destructive" })
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/news/${deleteTarget.id}`, { method: "DELETE", headers: authHeaders() })
      if (!res.ok) throw new Error("Failed")
      toast({ title: "Post deleted" })
      setDeleteTarget(null)
      load()
    } catch {
      toast({ title: "Failed to delete post", variant: "destructive" })
    } finally {
      setDeleting(false)
    }
  }

  const published = posts.filter((p) => p.status === "published")
  const drafts = posts.filter((p) => p.status === "draft")

  return (
    <PageLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">News</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Write and publish news articles for the public website</p>
          </div>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="w-4 h-4" /> New post
          </Button>
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-white border border-gray-100 rounded-2xl animate-pulse" />
            ))}
          </div>
        )}

        {!loading && posts.length === 0 && (
          <div className="bg-gray-50 border border-gray-100 rounded-2xl p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="font-semibold text-gray-700 mb-1">No news posts yet</p>
            <p className="text-sm text-gray-500 mb-4">Create your first post and it'll appear on the public website when published.</p>
            <Button onClick={openCreate} size="sm" className="gap-2"><Plus className="w-4 h-4" /> Write first post</Button>
          </div>
        )}

        {!loading && published.length > 0 && (
          <section className="mb-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Published — {published.length}</h2>
            <div className="space-y-3">
              {published.map((p) => (
                <PostCard key={p.id} post={p} onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget(p)} onTogglePublish={() => handleTogglePublish(p)} />
              ))}
            </div>
          </section>
        )}

        {!loading && drafts.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">Drafts — {drafts.length}</h2>
            <div className="space-y-3">
              {drafts.map((p) => (
                <PostCard key={p.id} post={p} onEdit={() => openEdit(p)} onDelete={() => setDeleteTarget(p)} onTogglePublish={() => handleTogglePublish(p)} />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Editor modal */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-white overflow-y-auto">
          <div className="sticky top-0 z-10 bg-white border-b border-gray-100 px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900">{editingPost ? "Edit post" : "New post"}</h2>
            <div className="flex items-center gap-2">
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as "draft" | "published" }))}
                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
              <Button size="sm" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingPost ? "Save" : "Create"}</Button>
              <button onClick={() => setIsEditorOpen(false)} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
          </div>

          <div className="flex-1 max-w-3xl mx-auto w-full px-4 sm:px-6 py-6 space-y-5">
            {formError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{formError}</p>}

            <div>
              <label className="text-sm font-medium text-gray-700">Title <span className="text-rose-500">*</span></label>
              <Input
                className="mt-1 text-lg font-semibold"
                placeholder="Article headline…"
                value={form.title}
                onChange={(e) => {
                  const title = e.target.value
                  setForm((f) => ({
                    ...f,
                    title,
                    slug: f.slug && f.slug !== slugify(f.title) ? f.slug : slugify(title),
                  }))
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">Author</label>
                <Input className="mt-1" placeholder="Your name" value={form.author} onChange={(e) => setForm((f) => ({ ...f, author: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Category</label>
                <Input className="mt-1" placeholder="e.g. Match report, Announcement" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Report date <span className="text-gray-400 font-normal">(shown on the website and used for ordering — set a past date to backdate)</span></label>
              <Input type="date" className="mt-1 sm:w-56" value={form.reportDate} onChange={(e) => setForm((f) => ({ ...f, reportDate: e.target.value }))} />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Excerpt <span className="text-gray-400 font-normal">(short preview shown on the news list)</span></label>
              <Textarea
                className="mt-1 resize-none"
                rows={2}
                placeholder="One or two sentences summarising this article…"
                value={form.excerpt}
                onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
              />
            </div>

            <CoverImageInput value={form.coverImage} onChange={(url) => setForm((f) => ({ ...f, coverImage: url }))} />

            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1.5">Article body</label>
              <RichEditor key={editingPost?.id ?? "new"} value={bodyHtml} onChange={setBodyHtml} />
            </div>

            <details className="border border-gray-100 rounded-xl p-4">
              <summary className="text-sm font-medium text-gray-600 cursor-pointer">Advanced — slug</summary>
              <div className="mt-3">
                <label className="text-xs text-gray-500">URL slug (auto-generated, edit if needed)</label>
                <Input
                  className="mt-1 font-mono text-sm"
                  placeholder="my-article-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                />
                <p className="text-xs text-gray-400 mt-1">Will be published at /news/{form.slug || "(slug)"}</p>
              </div>
            </details>

            <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
              <Button variant="outline" onClick={() => setIsEditorOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editingPost ? "Save changes" : "Create post"}</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete post">
        <p className="text-sm text-gray-600 mb-4">
          Are you sure you want to delete <strong>"{deleteTarget?.title}"</strong>? This cannot be undone.
          {deleteTarget?.status === "published" && " It will be removed from the public website immediately."}
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting}>{deleting ? "Deleting…" : "Delete"}</Button>
        </div>
      </Modal>
    </PageLayout>
  )
}
