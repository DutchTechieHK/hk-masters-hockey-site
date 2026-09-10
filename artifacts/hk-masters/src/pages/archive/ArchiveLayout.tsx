import { ReactNode, useEffect } from "react"
import { Archive } from "lucide-react"

export default function ArchiveLayout({ children }: { children: ReactNode }) {
  // A safe approach to hide typical mutation buttons in non-reusable World Cup pages
  // without breaking exports, tabs, or filtering.
  useEffect(() => {
    const style = document.createElement("style")
    style.innerHTML = `
      .archive-scope button:has(svg.lucide-plus),
      .archive-scope button:has(svg.lucide-trash-2),
      .archive-scope button:has(svg.lucide-edit-2),
      .archive-scope button:has(svg.lucide-pencil),
      .archive-scope button:has(svg.lucide-save),
      .archive-scope button:has(svg.lucide-send) {
        display: none !important;
      }
      .archive-scope button[type="submit"] {
        display: none !important;
      }
    `
    document.head.appendChild(style)

    const blockFormSubmit = (event: Event) => {
      event.preventDefault()
      event.stopPropagation()
    }
    const blockMutationClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      const button = target.closest("button")
      if (!button) return

      const label = `${button.textContent ?? ""} ${button.getAttribute("aria-label") ?? ""} ${button.getAttribute("title") ?? ""}`.toLowerCase()
      const hasMutationIcon = Boolean(button.querySelector([
        "svg.lucide-plus",
        "svg.lucide-trash-2",
        "svg.lucide-edit-2",
        "svg.lucide-pencil",
        "svg.lucide-save",
        "svg.lucide-send",
        "svg.lucide-upload",
      ].join(",")))
      const looksMutating = /\b(add|create|delete|edit|save|send|upload|remove|approve|reject|mark paid|record payment|distribute|publish|unpublish)\b/.test(label)

      if (button.type === "submit" || hasMutationIcon || looksMutating) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    document.addEventListener("submit", blockFormSubmit, true)
    document.addEventListener("click", blockMutationClick, true)
    return () => {
      document.removeEventListener("submit", blockFormSubmit, true)
      document.removeEventListener("click", blockMutationClick, true)
      document.head.removeChild(style)
    }
  }, [])

  return (
    <div className="relative archive-scope">
      <div className="fixed top-0 inset-x-0 z-50 h-10 bg-amber-400 text-amber-950 flex items-center justify-center font-bold text-sm tracking-wide md:left-56 shadow-md border-b border-amber-500">
        <Archive className="w-4 h-4 mr-2" />
        WORLD CUP 2026 ARCHIVE (READ-ONLY)
      </div>
      <div className="pt-10">
        <div className="fixed inset-0 pointer-events-none bg-amber-50/30 -z-10 mix-blend-multiply"></div>
        {children}
      </div>
    </div>
  )
}
