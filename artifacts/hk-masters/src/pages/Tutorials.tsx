import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Play, Megaphone, Mail, BarChart2 } from "lucide-react"

const BASE = "/admin-video-series"

const CLIPS = [
  {
    id: "clip1",
    title: "In-App Announcements",
    description: "Send instant notifications to players directly inside the app — from the Announcements section of the admin panel.",
    icon: Megaphone,
    color: "bg-blue-50 text-blue-600",
    accent: "border-blue-200",
    url: `${BASE}/clip1`,
  },
  {
    id: "clip2",
    title: "Email Announcements",
    description: "Double your reach by toggling \"Send via Email\" when publishing an announcement, delivering it both in-app and to inboxes.",
    icon: Mail,
    color: "bg-violet-50 text-violet-600",
    accent: "border-violet-200",
    url: `${BASE}/clip2`,
  },
  {
    id: "clip3",
    title: "Quick Polls",
    description: "Collect structured player feedback — availability checks, preference votes — with live results and a close deadline.",
    icon: BarChart2,
    color: "bg-emerald-50 text-emerald-600",
    accent: "border-emerald-200",
    url: `${BASE}/clip3`,
  },
]

export default function Tutorials() {
  const [activeClip, setActiveClip] = useState<(typeof CLIPS)[number] | null>(null)

  return (
    <PageLayout title="Tutorials">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Short walkthroughs covering the key admin features. Click any card to watch.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CLIPS.map((clip) => {
            const Icon = clip.icon
            return (
              <button
                key={clip.id}
                onClick={() => setActiveClip(clip)}
                className={`group text-left bg-white rounded-2xl border ${clip.accent} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                {/* Thumbnail area */}
                <div className={`relative flex items-center justify-center h-40 ${clip.color.split(" ")[0]} border-b ${clip.accent}`}>
                  <Icon className={`w-12 h-12 ${clip.color.split(" ")[1]} opacity-20 group-hover:opacity-30 transition-opacity`} />
                  {/* Play overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center justify-center w-14 h-14 rounded-full bg-white/80 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <Play className="w-6 h-6 text-primary fill-primary ml-1" />
                    </span>
                  </div>
                  {/* Chapter badge */}
                  <span className="absolute top-3 right-3 text-[10px] font-semibold uppercase tracking-wider bg-white/70 text-gray-600 px-2 py-0.5 rounded-full">
                    {clip.id === "clip1" ? "Ch. 1" : clip.id === "clip2" ? "Ch. 2" : "Ch. 3"}
                  </span>
                </div>

                {/* Card body */}
                <div className="px-5 py-4">
                  <h3 className="font-semibold text-gray-900 text-sm mb-1">{clip.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{clip.description}</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      <Dialog open={!!activeClip} onOpenChange={(open) => { if (!open) setActiveClip(null) }}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="px-6 pt-5 pb-3 border-b">
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              {activeClip && (() => {
                const Icon = activeClip.icon
                return <Icon className="w-4 h-4 text-muted-foreground" />
              })()}
              {activeClip?.title}
            </DialogTitle>
          </DialogHeader>
          {activeClip && (
            <div className="relative w-full" style={{ paddingBottom: "56.25%" }}>
              <iframe
                key={activeClip.id}
                src={activeClip.url}
                className="absolute inset-0 w-full h-full border-0"
                allow="autoplay"
                title={activeClip.title}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </PageLayout>
  )
}
