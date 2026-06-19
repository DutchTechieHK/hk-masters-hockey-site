import { useState } from "react"
import { PageLayout } from "@/components/layout/PageLayout"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Play, Megaphone, Mail, BarChart2 } from "lucide-react"

const BASE = "/admin-video-series"

function Thumbnail1() {
  return (
    <div className="w-full h-full bg-blue-50 flex items-center justify-center overflow-hidden relative">
      <div className="scale-[0.52] origin-center w-[340px] shrink-0">
        {/* Mini admin chrome */}
        <div className="bg-indigo-900 px-3 py-2 flex items-center gap-2 rounded-t-lg">
          <div className="w-4 h-4 rounded bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-white text-[7px] font-bold">HK</span>
          </div>
          <span className="text-white font-bold text-[9px]">HK Masters</span>
          <span className="text-white/50 text-[8px] ml-auto">Announcements</span>
        </div>
        <div className="bg-gray-50 px-3 pt-2 pb-3 rounded-b-lg space-y-2">
          {/* Tabs */}
          <div className="flex gap-0.5 bg-gray-100 border border-gray-200 rounded-lg p-0.5">
            <div className="flex-1 bg-white rounded-md px-2 py-1 shadow-sm flex items-center justify-center">
              <span className="text-[8px] font-semibold text-gray-800">📢 In-app feed</span>
            </div>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[8px] text-gray-400">✉️ Email players</span>
            </div>
          </div>
          {/* Modal */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-lg space-y-2">
            <div className="text-[9px] font-bold text-gray-900 border-b border-gray-100 pb-1.5">New announcement</div>
            <div className="space-y-0.5">
              <div className="text-[7px] font-semibold text-gray-600">Title</div>
              <div className="h-5 bg-gray-50 border border-gray-200 rounded px-1.5 flex items-center">
                <span className="text-gray-800 text-[7px]">Training moved to 7pm!</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[7px] font-semibold text-gray-600">Message</div>
              <div className="h-8 bg-gray-50 border border-gray-200 rounded px-1.5 py-1">
                <span className="text-gray-600 text-[7px] leading-relaxed">Pitch is wet. Meet at the turf at 7pm sharp.</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-3 h-3 rounded bg-indigo-600 flex items-center justify-center shrink-0">
                <span className="text-white text-[6px]">✓</span>
              </div>
              <span className="text-[7px] text-gray-600">Send push notification</span>
            </div>
            <div className="h-6 bg-indigo-700 rounded-lg flex items-center justify-center">
              <span className="text-white text-[8px] font-bold">Post</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Thumbnail2() {
  return (
    <div className="w-full h-full bg-violet-50 flex items-center justify-center overflow-hidden relative">
      <div className="scale-[0.52] origin-center w-[340px] shrink-0">
        <div className="bg-indigo-900 px-3 py-2 flex items-center gap-2 rounded-t-lg">
          <div className="w-4 h-4 rounded bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-white text-[7px] font-bold">HK</span>
          </div>
          <span className="text-white font-bold text-[9px]">HK Masters</span>
          <span className="text-white/50 text-[8px] ml-auto">Announcements</span>
        </div>
        <div className="bg-gray-50 px-3 pt-2 pb-3 rounded-b-lg space-y-2">
          {/* Tabs — Email players active */}
          <div className="flex gap-0.5 bg-gray-100 border border-gray-200 rounded-lg p-0.5">
            <div className="flex-1 flex items-center justify-center">
              <span className="text-[8px] text-gray-400">📢 In-app feed</span>
            </div>
            <div className="flex-1 bg-white rounded-md px-2 py-1 shadow-sm flex items-center justify-center">
              <span className="text-[8px] font-semibold text-gray-800">✉️ Email players</span>
            </div>
          </div>
          {/* Email composer */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2">
            <div className="text-[8px] font-bold text-gray-700">✉ Compose email</div>
            <div className="space-y-0.5">
              <div className="text-[6px] font-semibold text-gray-500 uppercase tracking-wide">Audience</div>
              <div className="flex gap-1">
                <div className="flex-1 bg-indigo-700 text-white text-[6px] font-semibold rounded py-0.5 text-center">All players</div>
                <div className="flex-1 border border-gray-200 text-gray-400 text-[6px] rounded py-0.5 text-center">By squad</div>
                <div className="flex-1 border border-gray-200 text-gray-400 text-[6px] rounded py-0.5 text-center">Individuals</div>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[6px] font-semibold text-gray-500 uppercase tracking-wide">Subject</div>
              <div className="h-5 bg-gray-50 border border-gray-200 rounded px-1.5 flex items-center">
                <span className="text-gray-800 text-[7px]">Tournament fees due Friday</span>
              </div>
            </div>
            <div className="space-y-0.5">
              <div className="text-[6px] font-semibold text-gray-500 uppercase tracking-wide">Message</div>
              <div className="h-8 bg-gray-50 border border-gray-200 rounded px-1.5 py-1">
                <span className="text-gray-600 text-[7px]">Hi all, please pay your tournament fees by end of Friday.</span>
              </div>
            </div>
            <div className="h-6 bg-indigo-700 rounded-lg flex items-center justify-center gap-1">
              <span className="text-white text-[8px] font-bold">✉ Send to 48 players</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Thumbnail3() {
  return (
    <div className="w-full h-full bg-emerald-50 flex items-center justify-center overflow-hidden relative">
      <div className="scale-[0.52] origin-center w-[340px] shrink-0">
        <div className="bg-indigo-900 px-3 py-2 flex items-center gap-2 rounded-t-lg">
          <div className="w-4 h-4 rounded bg-white/10 border border-white/20 flex items-center justify-center">
            <span className="text-white text-[7px] font-bold">HK</span>
          </div>
          <span className="text-white font-bold text-[9px]">HK Masters</span>
          <span className="text-white/50 text-[8px] ml-auto">Polls</span>
        </div>
        <div className="bg-gray-50 px-3 pt-2 pb-3 rounded-b-lg space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[9px] font-bold text-gray-900">Polls</div>
              <div className="text-[7px] text-gray-500">Create scheduling polls & collect responses</div>
            </div>
            <div className="bg-indigo-700 text-white text-[7px] font-bold px-2 py-1 rounded-lg">+ New poll</div>
          </div>
          {/* Poll card with results */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[6px] font-medium bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded-full">All players</span>
                <div className="text-[9px] font-bold text-gray-900 mt-0.5">Can you make training on Friday?</div>
                <div className="text-[7px] text-gray-400 mt-0.5">Deadline: Fri 20 Jun · 12 votes</div>
              </div>
              <div className="flex gap-1 text-gray-400 text-[9px]">
                <span>✉</span><span>🔒</span><span>🗑️</span>
              </div>
            </div>
            {/* Progress bars */}
            <div className="space-y-1.5">
              <div>
                <div className="flex justify-between text-[7px] mb-0.5">
                  <span className="text-gray-800 font-medium">Yes</span>
                  <span className="text-gray-500">9 (75%)</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-600 rounded-full" style={{ width: "75%" }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[7px] mb-0.5">
                  <span className="text-gray-800 font-medium">No</span>
                  <span className="text-gray-500">3 (25%)</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-300 rounded-full" style={{ width: "25%" }} />
                </div>
              </div>
            </div>
            <div className="text-[7px] text-gray-400">▾ Show voters &amp; non-responders</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const CLIPS = [
  {
    id: "clip1",
    title: "In-App Announcements",
    description: "Send instant notifications to players directly inside the app — from the Announcements section of the admin panel.",
    icon: Megaphone,
    accent: "border-blue-200",
    Thumb: Thumbnail1,
    url: `${BASE}/clip1`,
  },
  {
    id: "clip2",
    title: "Email Players",
    description: "Compose and send emails to all players or a specific squad from the dedicated Email players tab on the Announcements page.",
    icon: Mail,
    accent: "border-violet-200",
    Thumb: Thumbnail2,
    url: `${BASE}/clip2`,
  },
  {
    id: "clip3",
    title: "Quick Polls",
    description: "Collect structured player feedback — availability checks, preference votes — with live results and a close deadline.",
    icon: BarChart2,
    accent: "border-emerald-200",
    Thumb: Thumbnail3,
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
            const Thumb = clip.Thumb
            return (
              <button
                key={clip.id}
                onClick={() => setActiveClip(clip)}
                className={`group text-left bg-white rounded-2xl border ${clip.accent} shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-primary`}
              >
                {/* Thumbnail */}
                <div className={`relative h-44 border-b ${clip.accent} overflow-hidden`}>
                  <Thumb />
                  {/* Overlay dims on hover to make play button pop */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-200" />
                  {/* Play button */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="flex items-center justify-center w-12 h-12 rounded-full bg-white/85 shadow-lg group-hover:scale-110 transition-transform duration-200">
                      <Play className="w-5 h-5 text-primary fill-primary ml-0.5" />
                    </span>
                  </div>
                  {/* Chapter badge */}
                  <span className="absolute top-2.5 right-2.5 text-[10px] font-semibold uppercase tracking-wider bg-white/80 text-gray-600 px-2 py-0.5 rounded-full">
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
