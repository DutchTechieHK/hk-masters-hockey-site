import { useEffect, useState } from "react"
import { MapPin, Plane } from "lucide-react"

const TOURNAMENT_START = new Date("2026-07-22T09:00:00+02:00")

const DAYS_UNTIL = Math.max(0, Math.ceil((TOURNAMENT_START.getTime() - Date.now()) / 86400000))

const EVENTS = [
  { id: 1, kind: "training",   date: "FRI 1 MAY",  day: "1 May 2026",   time: "17:00–18:30", title: "Technical & Physical Session",  location: "HKFC" },
  { id: 2, kind: "training",   date: "MON 4 MAY",  day: "4 May 2026",   time: "20:00–21:30", title: "Monday Training | MO40 & MO50", location: "HKFC Astro" },
  { id: 3, kind: "social",     date: "SAT 30 MAY", day: "30 May 2026",  time: "TBC",          title: "FUNdraising Run",               location: "Victoria Park" },
  { id: 4, kind: "programme",  date: "TUE 21 JUL", day: "21 Jul 2026",  time: "09:00–19:00",  title: "Teamchecks",                    location: "HC Rotterdam" },
  { id: 5, kind: "social",     date: "WED 22 JUL", day: "22 Jul 2026",  time: "18:00–21:00",  title: "Dinner & Opening Ceremony",     location: "HC Rotterdam" },
  { id: 6, kind: "programme",  date: "THU 23 JUL", day: "23 Jul 2026",  time: "09:00 daily",  title: "Tournament Matches",            location: "HC Rotterdam & HV Victoria" },
  { id: 7, kind: "social",     date: "SUN 26 JUL", day: "26 Jul 2026",  time: "18:00–21:00",  title: "Social Evening",                location: "HC Rotterdam" },
  { id: 8, kind: "programme",  date: "SAT 1 AUG",  day: "1 Aug 2026",   time: "09:00–19:00",  title: "Finals",                        location: "HC Rotterdam" },
  { id: 9, kind: "social",     date: "SAT 1 AUG",  day: "1 Aug 2026",   time: "19:00–23:59",  title: "Closing Ceremony & Wrap Party", location: "HC Rotterdam" },
]

const KIND = {
  training:  { label: "Training",  line: "border-l-emerald-400", dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-800" },
  programme: { label: "Programme", line: "border-l-blue-400",    dot: "bg-blue-400",    badge: "bg-blue-100 text-blue-800" },
  social:    { label: "Social",    line: "border-l-amber-400",   dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-800" },
}

const grouped = EVENTS.reduce<Record<string, typeof EVENTS>>((acc, e) => {
  if (!acc[e.day]) acc[e.day] = []
  acc[e.day].push(e)
  return acc
}, {})

const isRotterdam = (day: string) => {
  const d = new Date(day)
  return d >= new Date("2026-07-21") && d <= new Date("2026-08-01")
}

export function JourneyTimeline() {
  const [daysLeft, setDaysLeft] = useState(DAYS_UNTIL)
  useEffect(() => {
    const id = setInterval(() => {
      setDaysLeft(Math.max(0, Math.ceil((TOURNAMENT_START.getTime() - Date.now()) / 86400000)))
    }, 60000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="min-h-screen bg-[#f8f9fa] font-sans">

      {/* ── HERO + JOURNEY STRIP ── */}
      <div className="bg-[#006B3C]">
        <div className="max-w-4xl mx-auto px-8 pt-12 pb-10">
          <span className="inline-block bg-[#DE2910] text-white text-[11px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            Rotterdam 2026
          </span>
          <h1 className="text-5xl font-extrabold text-white mb-2 leading-none">Events</h1>
          <p className="text-green-200 text-lg max-w-xl">
            Our journey — from Hong Kong training fields to the World Masters stage in Rotterdam.
          </p>
        </div>

        {/* Journey route strip */}
        <div className="border-t border-white/10 bg-white/5">
          <div className="max-w-4xl mx-auto px-8 py-6 flex items-center gap-0">
            {/* HK */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-3xl mb-1">🇭🇰</span>
              <span className="text-white text-xs font-bold uppercase tracking-wide">Hong Kong</span>
              <span className="text-green-300 text-[10px]">Training</span>
            </div>

            {/* Route line */}
            <div className="flex-1 flex items-center gap-0 relative mx-4">
              <div className="flex-1 border-t-2 border-dashed border-white/30" />
              <div className="relative flex flex-col items-center px-4">
                <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-4 py-2.5 flex flex-col items-center border border-white/20">
                  <Plane className="w-5 h-5 text-white mb-0.5" />
                  <span className="text-2xl font-black text-white tabular-nums">{daysLeft}</span>
                  <span className="text-[10px] text-green-300 uppercase tracking-widest leading-none">days to go</span>
                </div>
              </div>
              <div className="flex-1 border-t-2 border-dashed border-white/30" />
            </div>

            {/* Rotterdam */}
            <div className="flex flex-col items-center shrink-0">
              <span className="text-3xl mb-1">🇳🇱</span>
              <span className="text-white text-xs font-bold uppercase tracking-wide">Rotterdam</span>
              <span className="text-green-300 text-[10px]">22 Jul – 1 Aug</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── TIMELINE ── */}
      <div className="max-w-4xl mx-auto px-8 py-10">
        <div className="relative">
          {/* Vertical spine */}
          <div className="absolute left-[19px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-[#006B3C] via-[#006B3C]/40 to-amber-300/60" />

          <div className="space-y-0">
            {Object.entries(grouped).map(([day, events], gi) => {
              const rotterdam = isRotterdam(day)
              return (
                <div key={day}>
                  {/* Day heading */}
                  <div className="flex items-center gap-4 mb-3 mt-6 first:mt-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 ${rotterdam ? "bg-[#006B3C]" : "bg-[#DE2910]"} shadow-md`}>
                      <span className="text-white text-[10px] font-black uppercase leading-none text-center px-1">
                        {events[0].date.split(" ")[0]}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <h3 className={`text-sm font-bold uppercase tracking-widest ${rotterdam ? "text-[#006B3C]" : "text-[#DE2910]"}`}>
                        {day}
                      </h3>
                      {rotterdam && (
                        <span className="text-[10px] bg-[#006B3C]/10 text-[#006B3C] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                          🇳🇱 Rotterdam
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Events for this day */}
                  <div className="ml-14 space-y-2 mb-2">
                    {events.map(ev => {
                      const meta = KIND[ev.kind as keyof typeof KIND]
                      return (
                        <div key={ev.id} className={`bg-white rounded-xl border border-gray-100 border-l-4 ${meta.line} shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.badge}`}>
                                  {meta.label}
                                </span>
                                <span className="text-xs font-mono text-gray-500">{ev.time}</span>
                              </div>
                              <h4 className="font-bold text-gray-900 leading-snug">{ev.title}</h4>
                              <p className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                                <MapPin className="w-3 h-3 shrink-0" />{ev.location}
                              </p>
                            </div>
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${meta.dot}`} />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
