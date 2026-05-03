import { useEffect, useState } from "react"
import { MapPin, Filter } from "lucide-react"

const TOURNAMENT_START = new Date("2026-07-22T09:00:00+02:00")

const EVENTS = [
  {
    id: 1, kind: "training",   title: "Technical & Physical Session",   date: "Fri 1 May",  time: "17:00–18:30", location: "HKFC",            img: "https://images.unsplash.com/photo-1607627000458-210e8d2bdb1d?w=600&q=70",
  },
  {
    id: 2, kind: "social",    title: "FUNdraising Run",                 date: "Sat 30 May", time: "TBC",          location: "Victoria Park",   img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=70",
  },
  {
    id: 3, kind: "programme", title: "Teamchecks",                      date: "Tue 21 Jul", time: "09:00–19:00",  location: "HC Rotterdam",    img: "https://images.unsplash.com/photo-1562887189-6c19a14e5b08?w=600&q=70",
  },
  {
    id: 4, kind: "social",    title: "Dinner & Opening Ceremony",       date: "Wed 22 Jul", time: "18:00–21:00",  location: "HC Rotterdam",    img: "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=70",
  },
  {
    id: 5, kind: "programme", title: "Tournament Matches",              date: "Thu 23 Jul", time: "09:00 daily",  location: "HC Rotterdam & HV Victoria", img: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=70",
  },
  {
    id: 6, kind: "social",    title: "Social Evening",                  date: "Sun 26 Jul", time: "18:00–21:00",  location: "HC Rotterdam",    img: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600&q=70",
  },
  {
    id: 7, kind: "programme", title: "Finals",                          date: "Sat 1 Aug",  time: "09:00–19:00",  location: "HC Rotterdam",    img: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=70",
  },
  {
    id: 8, kind: "social",    title: "Closing Ceremony & Wrap Party",   date: "Sat 1 Aug",  time: "19:00–23:59",  location: "HC Rotterdam",    img: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=70",
  },
]

const KIND = {
  training:  { label: "Training",   bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-400" },
  programme: { label: "Programme",  bg: "bg-blue-100",    text: "text-blue-800",    dot: "bg-blue-400" },
  social:    { label: "Social",     bg: "bg-amber-100",   text: "text-amber-800",   dot: "bg-amber-400" },
}

const TABS = ["All", "Training", "Programme", "Social"]

function useCountdown(target: Date) {
  const calc = () => {
    const ms = target.getTime() - Date.now()
    if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 }
    const s = Math.floor(ms / 1000)
    return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 }
  }
  const [t, setT] = useState(calc)
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id) }, [])
  return t
}

function Pad({ n }: { n: number }) {
  return <>{String(n).padStart(2, "0")}</>
}

export function CountdownPhotoCards() {
  const [tab, setTab] = useState("All")
  const { d, h, m, s } = useCountdown(TOURNAMENT_START)

  const filtered = tab === "All" ? EVENTS : EVENTS.filter(e => e.kind === tab.toLowerCase())

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ── HERO ── */}
      <div className="relative overflow-hidden" style={{ minHeight: 360 }}>
        <img
          src="https://images.unsplash.com/photo-1562887189-6c19a14e5b08?w=1400&q=80"
          alt="Rotterdam"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#003d22]/80 via-[#006B3C]/60 to-[#006B3C]/90" />

        <div className="relative px-8 pt-14 pb-10 max-w-5xl mx-auto">
          <span className="inline-block bg-[#DE2910] text-white text-[11px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            Rotterdam 2026
          </span>
          <h1 className="text-5xl font-extrabold text-white mb-2 leading-none">Events</h1>
          <p className="text-green-200 text-lg mb-8 max-w-xl">
            The full tournament programme, club events, and social nights — all in one place.
          </p>

          {/* Countdown */}
          <div className="inline-flex items-center gap-1 bg-white/10 backdrop-blur-sm border border-white/20 rounded-2xl px-6 py-4">
            <span className="text-green-200 text-sm font-medium mr-3">Rotterdam in</span>
            {[{ v: d, l: "days" }, { v: h, l: "hrs" }, { v: m, l: "min" }, { v: s, l: "sec" }].map(({ v, l }, i) => (
              <div key={l} className="flex items-center gap-1">
                {i > 0 && <span className="text-white/30 text-xl font-light mx-1">:</span>}
                <div className="flex flex-col items-center">
                  <span className="text-3xl font-black text-white tabular-nums leading-none"><Pad n={v} /></span>
                  <span className="text-[10px] text-green-300 uppercase tracking-widest mt-0.5">{l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-8 flex items-center gap-1">
          {TABS.map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                tab === t ? "border-[#006B3C] text-[#006B3C]" : "border-transparent text-gray-500 hover:text-gray-800"
              }`}
            >
              {t}
              {t !== "All" && (
                <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  tab === t ? "bg-[#006B3C] text-white" : "bg-gray-100 text-gray-500"
                }`}>
                  {EVENTS.filter(e => e.kind === t.toLowerCase()).length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── CARDS ── */}
      <div className="max-w-5xl mx-auto px-8 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(ev => {
            const meta = KIND[ev.kind as keyof typeof KIND]
            return (
              <div key={ev.id} className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
                {/* Photo */}
                <div className="relative h-36 overflow-hidden">
                  <img
                    src={ev.img}
                    alt={ev.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                  <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                    {meta.label}
                  </span>
                </div>
                {/* Content */}
                <div className="p-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-semibold text-gray-500">{ev.date}</span>
                    <span className="text-gray-200">·</span>
                    <span className="text-xs text-gray-500 font-mono">{ev.time}</span>
                  </div>
                  <h3 className="font-bold text-gray-900 leading-snug mb-1.5">{ev.title}</h3>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <MapPin className="w-3 h-3 shrink-0" />{ev.location}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
