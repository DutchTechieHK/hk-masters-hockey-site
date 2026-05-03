import { useEffect, useState } from "react"
import { MapPin, Plane } from "lucide-react"

const TOURNAMENT_START = new Date("2026-07-22T09:00:00+02:00")

function useCountdown(target: Date) {
  const calc = () => {
    const ms = target.getTime() - Date.now()
    if (ms <= 0) return { d: 0, h: 0, m: 0, s: 0 }
    const sec = Math.floor(ms / 1000)
    return { d: Math.floor(sec / 86400), h: Math.floor((sec % 86400) / 3600), m: Math.floor((sec % 3600) / 60), s: sec % 60 }
  }
  const [t, setT] = useState(calc)
  useEffect(() => { const id = setInterval(() => setT(calc()), 1000); return () => clearInterval(id) }, [])
  return t
}

const EVENTS = [
  {
    id: 1, kind: "training",   title: "Technical & Physical Session",  date: "Fri 1 May",  time: "17:00–18:30", location: "HKFC",
    img: "https://images.unsplash.com/photo-1607627000458-210e8d2bdb1d?w=600&q=70",
  },
  {
    id: 2, kind: "training",   title: "Monday Training | MO40 & MO50", date: "Mon 4 May",  time: "20:00–21:30", location: "HKFC Astro",
    img: "https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=600&q=70",
  },
  {
    id: 3, kind: "social",     title: "FUNdraising Run",               date: "Sat 30 May", time: "TBC",          location: "Victoria Park",
    img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&q=70",
  },
  {
    id: 4, kind: "programme",  title: "Teamchecks",                    date: "Tue 21 Jul", time: "09:00–19:00",  location: "HC Rotterdam",
    img: "https://images.unsplash.com/photo-1562887189-6c19a14e5b08?w=600&q=70",
  },
  {
    id: 5, kind: "social",     title: "Dinner & Opening Ceremony",     date: "Wed 22 Jul", time: "18:00–21:00",  location: "HC Rotterdam",
    img: "https://images.unsplash.com/photo-1555244162-803834f70033?w=600&q=70",
  },
  {
    id: 6, kind: "programme",  title: "Tournament Matches",            date: "Thu 23 Jul", time: "09:00 daily",  location: "HC Rotterdam & HV Victoria",
    img: "https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&q=70",
  },
  {
    id: 7, kind: "social",     title: "Social Evening",                date: "Sun 26 Jul", time: "18:00–21:00",  location: "HC Rotterdam",
    img: "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600&q=70",
  },
  {
    id: 8, kind: "programme",  title: "Finals",                        date: "Sat 1 Aug",  time: "09:00–19:00",  location: "HC Rotterdam",
    img: "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=600&q=70",
  },
  {
    id: 9, kind: "social",     title: "Closing Ceremony & Wrap Party", date: "Sat 1 Aug",  time: "19:00–23:59",  location: "HC Rotterdam",
    img: "https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=600&q=70",
  },
]

const KIND = {
  training:  { label: "Training",   bg: "bg-emerald-100", text: "text-emerald-800" },
  programme: { label: "Programme",  bg: "bg-blue-100",    text: "text-blue-800" },
  social:    { label: "Social",     bg: "bg-amber-100",   text: "text-amber-800" },
}

const TABS = ["All", "Training", "Programme", "Social"]

function Pad({ n }: { n: number }) {
  return <>{String(n).padStart(2, "0")}</>
}

export function Combined() {
  const [tab, setTab] = useState("All")
  const { d, h, m, s } = useCountdown(TOURNAMENT_START)

  const filtered = tab === "All" ? EVENTS : EVENTS.filter(e => e.kind === tab.toLowerCase())

  return (
    <div className="min-h-screen bg-gray-50 font-sans">

      {/* ─── HERO: Rotterdam photo + countdown ─── */}
      <div className="relative overflow-hidden" style={{ minHeight: 340 }}>
        <img
          src="https://images.unsplash.com/photo-1562887189-6c19a14e5b08?w=1400&q=80"
          alt="Rotterdam"
          className="absolute inset-0 w-full h-full object-cover object-center scale-105"
          style={{ filter: "brightness(0.85)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#003d22]/75 via-[#006B3C]/55 to-[#005a2e]/90" />

        <div className="relative px-8 pt-12 pb-0 max-w-5xl mx-auto">
          <span className="inline-block bg-[#DE2910] text-white text-[11px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
            Rotterdam 2026
          </span>
          <h1 className="text-5xl font-extrabold text-white mb-2 leading-none">Events</h1>
          <p className="text-green-200 text-lg mb-8 max-w-xl">
            The full tournament programme, club events, and social nights — all in one place.
          </p>

          {/* Live countdown */}
          <div className="inline-flex items-center gap-1 bg-black/25 backdrop-blur-sm border border-white/15 rounded-2xl px-6 py-3.5 mb-10">
            <span className="text-green-300 text-sm font-medium mr-4">Rotterdam in</span>
            {[{ v: d, l: "days" }, { v: h, l: "hrs" }, { v: m, l: "min" }, { v: s, l: "sec" }].map(({ v, l }, i) => (
              <div key={l} className="flex items-center gap-1">
                {i > 0 && <span className="text-white/25 text-xl font-light mx-1.5">:</span>}
                <div className="flex flex-col items-center min-w-[2.2rem]">
                  <span className="text-3xl font-black text-white tabular-nums leading-none"><Pad n={v} /></span>
                  <span className="text-[10px] text-green-300 uppercase tracking-widest mt-0.5">{l}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── JOURNEY STRIP ─── */}
      <div className="bg-[#005a2e] border-t border-white/10">
        <div className="max-w-5xl mx-auto px-8 py-5 flex items-center">
          {/* HK */}
          <div className="flex flex-col items-center shrink-0">
            <span className="text-2xl mb-0.5">🇭🇰</span>
            <span className="text-white text-[11px] font-bold uppercase tracking-wide">Hong Kong</span>
            <span className="text-green-400 text-[10px]">Training</span>
          </div>

          {/* Route */}
          <div className="flex-1 flex items-center mx-4">
            <div className="flex-1 border-t-2 border-dashed border-white/20" />
            <div className="mx-3 bg-white/10 border border-white/20 rounded-xl px-5 py-2.5 flex items-center gap-3">
              <Plane className="w-4 h-4 text-green-300 shrink-0" />
              <div className="flex flex-col items-center">
                <span className="text-2xl font-black text-white tabular-nums leading-none">{d}</span>
                <span className="text-[9px] text-green-300 uppercase tracking-widest leading-none mt-0.5">days to go</span>
              </div>
            </div>
            <div className="flex-1 border-t-2 border-dashed border-white/20" />
          </div>

          {/* Rotterdam */}
          <div className="flex flex-col items-center shrink-0">
            <span className="text-2xl mb-0.5">🇳🇱</span>
            <span className="text-white text-[11px] font-bold uppercase tracking-wide">Rotterdam</span>
            <span className="text-green-400 text-[10px]">22 Jul – 1 Aug</span>
          </div>
        </div>
      </div>

      {/* ─── FILTER TABS ─── */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-8 flex items-center gap-1">
          {TABS.map(t => {
            const count = t === "All" ? null : EVENTS.filter(e => e.kind === t.toLowerCase()).length
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-5 py-3.5 text-sm font-semibold border-b-2 transition-colors ${
                  tab === t ? "border-[#006B3C] text-[#006B3C]" : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {t}
                {count !== null && (
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                    tab === t ? "bg-[#006B3C] text-white" : "bg-gray-100 text-gray-500"
                  }`}>{count}</span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* ─── PHOTO CARDS ─── */}
      <div className="max-w-5xl mx-auto px-8 py-10">
        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-16">No events in this category.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map(ev => {
              const meta = KIND[ev.kind as keyof typeof KIND]
              return (
                <div
                  key={ev.id}
                  className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-200 cursor-pointer group"
                >
                  {/* Photo header */}
                  <div className="relative h-40 overflow-hidden">
                    <img
                      src={ev.img}
                      alt={ev.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                    <span className={`absolute top-3 left-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${meta.bg} ${meta.text}`}>
                      {meta.label}
                    </span>
                  </div>
                  {/* Card body */}
                  <div className="p-4">
                    <div className="flex items-center gap-2 mb-1.5 text-xs text-gray-500">
                      <span className="font-semibold">{ev.date}</span>
                      <span className="text-gray-200">·</span>
                      <span className="font-mono">{ev.time}</span>
                    </div>
                    <h3 className="font-bold text-gray-900 leading-snug mb-2">{ev.title}</h3>
                    <p className="flex items-center gap-1 text-xs text-gray-400">
                      <MapPin className="w-3 h-3 shrink-0" />{ev.location}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
