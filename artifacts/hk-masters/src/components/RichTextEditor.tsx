import { useEditor, EditorContent } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { Bold, Italic, Underline as UnderlineIcon, List } from "lucide-react"
import { useEffect } from "react"

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
  placeholder?: string
  minHeight?: number
}

export function RichTextEditor({ value, onChange, placeholder = "Write your message here…", minHeight = 140 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "focus:outline-none text-sm text-foreground",
        style: `min-height: ${minHeight}px; padding: 10px 12px;`,
      },
      transformPastedHTML(html) {
        return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
      },
    },
    onUpdate({ editor }) {
      onChange(editor.isEmpty ? "" : editor.getHTML())
    },
  })

  useEffect(() => {
    if (!editor) return
    const currentHtml = editor.isEmpty ? "" : editor.getHTML()
    if (currentHtml !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false })
    }
  }, [value, editor])

  function toolbarBtn(active: boolean, onClick: () => void, icon: React.ReactNode, title: string) {
    return (
      <button
        type="button"
        title={title}
        onClick={onClick}
        className={`p-1.5 rounded transition-colors ${
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        }`}
      >
        {icon}
      </button>
    )
  }

  return (
    <div className="border border-input rounded-md overflow-hidden bg-background ring-offset-background focus-within:outline-none focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
      <div className="flex items-center gap-0.5 border-b border-input px-2 py-1 bg-muted/30">
        {toolbarBtn(
          !!editor?.isActive("bold"),
          () => editor?.chain().focus().toggleBold().run(),
          <Bold className="w-3.5 h-3.5" />,
          "Bold"
        )}
        {toolbarBtn(
          !!editor?.isActive("italic"),
          () => editor?.chain().focus().toggleItalic().run(),
          <Italic className="w-3.5 h-3.5" />,
          "Italic"
        )}
        {toolbarBtn(
          !!editor?.isActive("underline"),
          () => editor?.chain().focus().toggleUnderline().run(),
          <UnderlineIcon className="w-3.5 h-3.5" />,
          "Underline"
        )}
        <div className="w-px h-4 bg-border mx-1" />
        {toolbarBtn(
          !!editor?.isActive("bulletList"),
          () => editor?.chain().focus().toggleBulletList().run(),
          <List className="w-3.5 h-3.5" />,
          "Bullet list"
        )}
      </div>

      <div className="relative">
        <EditorContent editor={editor} className="rich-text-editor" />
        {editor?.isEmpty && (
          <p className="absolute top-0 left-0 pointer-events-none text-sm text-muted-foreground px-3 py-2.5">
            {placeholder}
          </p>
        )}
      </div>
    </div>
  )
}
