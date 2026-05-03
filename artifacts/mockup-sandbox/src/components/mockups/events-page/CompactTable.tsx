import { Dumbbell, Users, Coffee, MapPin, Edit2, Trash2, ClipboardList, Globe, Upload, Plus } from "lucide-react"

const KIND = {
  training: { label: "Training", icon: Dumbbell, bg: "bg-emerald-100", text: "text-emerald-800", stripe: "bg-emerald-500" },
  meeting:  { label: "Meeting",  icon: Users,    bg: "bg-blue-100",    text: "text-blue-800",    stripe: "bg-blue-500" },
  social:   { label: "Social",   icon: Coffee,   bg: "bg-amber-100",   text: "text-amber-800",   stripe: "bg-amber-500" },
}

const EVENTS = [
  { id: 1, kind: "training", title: "Technical and Physical Session", date: "Fri 24 Apr", time: "20:30", location: "HKFC",           isPublic: false, yes: 12, maybe: 3, no: 1 },
  { id: 2, kind: "training", title: "Tactical / Game-play Session",   date: "Fri 1 May",  time: "17:00", location: "HKFC",           isPublic: true,  yes: 8,  maybe: 2, no: 0 },
  { id: 3, kind: "training", title: "Technical and Physical Session", date: "Mon 4 May",  time: "20:00", location: "HKFC",           isPublic: false, yes: 14, maybe: 1, no: 2 },
  { id: 4, kind: "training", title: "Monday Training | MO40 & MO50",  date: "Mon 4 May",  time: "20:00", location: "HKFC Astro",     isPublic: true,  yes: 11, maybe: 0, no: 1 },
  { id: 5, kind: "meeting",  title: "Pre-Tour Squad Briefing",        date: "Wed 6 May",  time: "19:00", location: "HKFC Boardroom", isPublic: false, yes: 18, maybe: 2, no: 0 },
  { id: 6, kind: "training", title: "Tactical / Game-play Session",   date: "Fri 8 May",  time: "19:00", location: "HKFC",           isPublic: false, yes: 9,  maybe: 4, no: 1 },
  { id: 7, kind: "social",   title: "FUNdraising Run",                date: "Sat 30 May", time: "TBC",   location: "TBC",            isPublic: true,  yes: 7,  maybe: 5, no: 3 },
  { id: 8, kind: "training", title: "Technical and Physical Session", date: "Mon 1 Jun",  time: "20:00", location: "HKFC",           isPublic: false, yes: 10, maybe: 2, no: 0 },
  { id: 9, kind: "training", title: "Tactical / Game-play Session",   date: "Fri 5 Jun",  time: "19:00", location: "HKFC",           isPublic: false, yes: 8,  maybe: 3, no: 2 },
]

const MONTHS = [
  { label: "April 2026", count: 1 },
  { label: "May 2026",   count: 6 },
  { label: "June 2026",  count: 2 },
]

export function CompactTable() {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header + month tabs */}
      <div className="bg-white border-b border-gray-200 px-8 pt-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Events</h1>
            <p className="text-sm text-gray-500 mt-0.5">Training sessions, team meetings, and social events.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg">
              <Upload className="w-4 h-4" /> Import
            </button>
            <button className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-[#006B3C] rounded-lg">
              <Plus className="w-4 h-4" /> Add Event
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-5 -mb-px">
          {MONTHS.map((m, i) => (
            <button key={m.label} className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition-colors ${i === 1 ? "border-[#006B3C] text-[#006B3C]" : "border-transparent text-gray-500"}`}>
              {m.label}
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${i === 1 ? "bg-[#006B3C] text-white" : "bg-gray-100 text-gray-500"}`}>{m.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-5">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="w-8 px-3 py-2.5">
                  <input type="checkbox" className="w-3.5 h-3.5 rounded accent-[#006B3C]" />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">When · Where</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Event</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-wide">RSVP</th>
                <th className="px-3 py-2.5 pr-4" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {EVENTS.map(ev => {
                const meta = KIND[ev.kind as keyof typeof KIND]
                const Icon = meta.icon
                const total = ev.yes + ev.maybe + ev.no + 2
                return (
                  <tr key={ev.id} className="group hover:bg-gray-50/80 transition-colors">
                    <td className="px-3 py-2.5">
                      <input type="checkbox" className="w-3.5 h-3.5 rounded accent-[#006B3C]" />
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="text-xs font-semibold text-gray-800">{ev.date}</div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-[11px] text-gray-400 font-mono">{ev.time}</span>
                        {ev.location && ev.location !== "TBC" && (
                          <>
                            <span className="text-gray-200">·</span>
                            <span className="flex items-center gap-0.5 text-[11px] text-gray-400"><MapPin className="w-2.5 h-2.5" />{ev.location}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-1 rounded-full shrink-0 self-stretch ${meta.stripe}`} style={{ minHeight: 30 }} />
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${meta.bg} ${meta.text}`}>
                              <Icon className="w-2.5 h-2.5" />{meta.label}
                            </span>
                            {ev.isPublic && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-50 text-[#006B3C]">
                                <Globe className="w-2.5 h-2.5" />Public
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-medium text-gray-900 leading-snug">{ev.title}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="text-emerald-700">{ev.yes}✓</span>
                        <span className="text-amber-600">{ev.maybe}?</span>
                        <span className="text-rose-500">{ev.no}✕</span>
                      </div>
                      <div className="flex rounded-full overflow-hidden h-1 w-20 mt-1.5 bg-gray-100">
                        <div className="bg-emerald-400 transition-all" style={{ width: `${(ev.yes / total) * 100}%` }} />
                        <div className="bg-amber-300 transition-all" style={{ width: `${(ev.maybe / total) * 100}%` }} />
                        <div className="bg-rose-300 transition-all" style={{ width: `${(ev.no / total) * 100}%` }} />
                      </div>
                    </td>
                    <td className="px-3 py-2.5 pr-4">
                      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button className="p-1.5 text-gray-400 hover:text-emerald-600 rounded hover:bg-emerald-50"><ClipboardList className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50"><Edit2 className="w-3.5 h-3.5" /></button>
                        <button className="p-1.5 text-gray-400 hover:text-rose-500 rounded hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="border-t border-gray-100 px-4 py-2.5 flex items-center justify-between bg-gray-50/40">
            <span className="text-xs text-gray-400">9 events shown</span>
            <div className="flex items-center gap-3 text-xs text-gray-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />97 going</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-300 inline-block" />22 maybe</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
