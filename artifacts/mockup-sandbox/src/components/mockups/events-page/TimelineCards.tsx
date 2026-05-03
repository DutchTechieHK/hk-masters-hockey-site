import { Dumbbell, Users, Coffee, MapPin, Edit2, Trash2, ClipboardList, Globe, Upload, Plus } from "lucide-react"

const KIND = {
  training: { label: "Training", icon: Dumbbell, dot: "bg-emerald-500", bar: "border-l-emerald-500", dateBg: "bg-emerald-50", dateText: "text-emerald-800" },
  meeting:  { label: "Meeting",  icon: Users,    dot: "bg-blue-500",    bar: "border-l-blue-500",    dateBg: "bg-blue-50",    dateText: "text-blue-800" },
  social:   { label: "Social",   icon: Coffee,   dot: "bg-amber-500",   bar: "border-l-amber-500",   dateBg: "bg-amber-50",   dateText: "text-amber-800" },
}

const EVENTS = [
  { id: 1, kind: "training", title: "Technical and Physical Session", date: "Fri", day: 24, month: "Apr", time: "20:30–22:00", location: "HKFC",           isPublic: false, yes: 12, maybe: 3, no: 1 },
  { id: 2, kind: "training", title: "Tactical / Game-play Session",   date: "Fri", day:  1, month: "May", time: "17:00–18:30", location: "HKFC",           isPublic: true,  yes: 8,  maybe: 2, no: 0 },
  { id: 3, kind: "training", title: "Technical and Physical Session", date: "Mon", day:  4, month: "May", time: "20:00–21:30", location: "HKFC",           isPublic: false, yes: 14, maybe: 1, no: 2 },
  { id: 4, kind: "training", title: "Monday Training | MO40 & MO50",  date: "Mon", day:  4, month: "May", time: "20:00–21:30", location: "HKFC Astro",     isPublic: true,  yes: 11, maybe: 0, no: 1 },
  { id: 5, kind: "meeting",  title: "Pre-Tour Squad Briefing",        date: "Wed", day:  6, month: "May", time: "19:00–20:00", location: "HKFC Boardroom", isPublic: false, yes: 18, maybe: 2, no: 0 },
  { id: 6, kind: "training", title: "Tactical / Game-play Session",   date: "Fri", day:  8, month: "May", time: "19:00–21:00", location: "HKFC",           isPublic: false, yes: 9,  maybe: 4, no: 1 },
  { id: 7, kind: "social",   title: "FUNdraising Run",                date: "Sat", day: 30, month: "May", time: "TBC",         location: "TBC",            isPublic: true,  yes: 7,  maybe: 5, no: 3 },
]

const MONTHS = ["Apr 2026", "May 2026"]
const byMonth: Record<string, typeof EVENTS> = {}
MONTHS.forEach(m => { byMonth[m] = EVENTS.filter(e => `${e.month} 2026` === m) })

export function TimelineCards() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <div className="bg-white border-b border-gray-200 px-8 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-sm text-gray-500 mt-0.5">Training sessions, team meetings, and social events.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
              <Upload className="w-4 h-4" /> Import
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#006B3C] rounded-lg">
              <Plus className="w-4 h-4" /> Add Event
            </button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto space-y-8">
        {MONTHS.filter(m => byMonth[m]?.length > 0).map(month => (
          <section key={month}>
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-sm font-bold text-gray-400 uppercase tracking-widest">{month}</h2>
              <div className="flex-1 h-px bg-gray-200" />
              <span className="text-xs text-gray-400">{byMonth[month].length} events</span>
            </div>

            <div className="space-y-2">
              {byMonth[month].map(ev => {
                const meta = KIND[ev.kind as keyof typeof KIND]
                const Icon = meta.icon
                return (
                  <div key={ev.id} className={`group flex items-stretch bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all overflow-hidden border-l-4 ${meta.bar}`}>
                    {/* Date block */}
                    <div className={`flex flex-col items-center justify-center px-4 py-4 min-w-[72px] shrink-0 ${meta.dateBg}`}>
                      <span className="text-[10px] font-bold text-gray-400 uppercase">{ev.date}</span>
                      <span className={`text-3xl font-black leading-none ${meta.dateText}`}>{ev.day}</span>
                      <span className="text-[10px] font-medium text-gray-400 uppercase">{ev.month}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex items-center px-4 py-3 gap-4 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full ${meta.dateBg} ${meta.dateText}`}>
                            <Icon className="w-2.5 h-2.5" /> {meta.label}
                          </span>
                          {ev.isPublic && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-green-100 text-[#006B3C]">
                              <Globe className="w-2.5 h-2.5" /> Public
                            </span>
                          )}
                        </div>
                        <div className="text-sm font-semibold text-gray-900 truncate">{ev.title}</div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-gray-400 font-mono">{ev.time}</span>
                          {ev.location && ev.location !== "TBC" && (
                            <span className="flex items-center gap-0.5 text-xs text-gray-400">
                              <MapPin className="w-3 h-3" />{ev.location}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-semibold">✓ {ev.yes}</span>
                        <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-semibold">? {ev.maybe}</span>
                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-semibold">✕ {ev.no}</span>
                      </div>

                      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <button className="p-2 text-gray-400 hover:text-emerald-600 rounded-lg hover:bg-emerald-50 transition-colors"><ClipboardList className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors"><Edit2 className="w-4 h-4" /></button>
                        <button className="p-2 text-gray-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
