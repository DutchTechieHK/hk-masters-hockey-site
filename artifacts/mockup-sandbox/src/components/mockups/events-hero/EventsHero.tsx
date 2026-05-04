export function EventsHero() {
  const imgUrl =
    "https://a3cd5e9d-bcce-41c5-a7a8-e29b19971e42-00-mu4o6oldqf13.kirk.replit.dev:5904/hc-rotterdam.jpg";

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-start pt-8 gap-8 px-4">
      <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
        Events Page — Hero mockup
      </p>

      {/* ── Mockup: hero with HC Rotterdam photo ── */}
      <div className="w-full max-w-4xl rounded-2xl overflow-hidden shadow-2xl">
        <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
          <img
            src={imgUrl}
            alt="HC Rotterdam stadium"
            className="absolute inset-0 w-full h-full object-cover object-center"
            style={{ filter: "brightness(0.75)" }}
          />
          {/* dark green gradient overlay — matches site palette */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#003d22]/80 via-[#006B3C]/55 to-[#005a2e]/92" />
          <div className="relative max-w-6xl mx-auto px-8 pt-14 pb-12">
            <span className="inline-block bg-[#DE2910] text-white text-[11px] font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-widest">
              Rotterdam 2026
            </span>
            <h1 className="text-5xl font-extrabold text-white mb-3 leading-none">
              Events
            </h1>
            <p className="text-green-200 text-lg max-w-xl">
              The full tournament programme, club events, and social nights — all in one place.
            </p>
          </div>
        </div>

        {/* journey strip preview */}
        <div className="bg-[#005a2e] border-t border-white/10">
          <div className="max-w-6xl mx-auto px-8 py-5 flex items-center">
            <div className="flex flex-col items-center shrink-0">
              <span className="text-2xl mb-0.5">🇭🇰</span>
              <span className="text-white text-[11px] font-bold uppercase tracking-wide">Hong Kong</span>
              <span className="text-green-400 text-[10px]">Training</span>
            </div>
            <div className="flex-1 flex items-center mx-4">
              <div className="flex-1 border-t-2 border-dashed border-white/20" />
              <div className="mx-3 bg-white/10 border border-white/20 rounded-xl px-5 py-2.5 flex items-center gap-3 shrink-0">
                <span className="text-xl">✈️</span>
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-black text-white tabular-nums leading-none">78</span>
                  <span className="text-[9px] text-green-300 uppercase tracking-widest leading-none mt-0.5">days to go</span>
                </div>
              </div>
              <div className="flex-1 border-t-2 border-dashed border-white/20" />
            </div>
            <div className="flex flex-col items-center shrink-0">
              <span className="text-2xl mb-0.5">🇳🇱</span>
              <span className="text-white text-[11px] font-bold uppercase tracking-wide">Rotterdam</span>
              <span className="text-green-400 text-[10px]">22 Jul – 1 Aug</span>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 max-w-xl text-center">
        The current hero uses a placeholder image. This mockup shows the HC Rotterdam stadium photo in its place — same overlay, same layout.
      </p>
    </div>
  );
}
