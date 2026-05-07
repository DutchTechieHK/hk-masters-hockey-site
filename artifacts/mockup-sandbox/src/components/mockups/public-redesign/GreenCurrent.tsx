import React from 'react';

export function GreenCurrent() {
  return (
    <div className="min-h-screen bg-white font-sans text-gray-900">
      {/* Navigation bar */}
      <nav className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#006B3C] flex items-center justify-center">
            <div className="w-4 h-4 rounded-full border-2 border-white" />
          </div>
          <span className="font-bold text-[#006B3C] text-xl tracking-tight">HK Masters</span>
        </div>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
          <a href="#" className="hover:text-[#DE2910] transition-colors border-b-2 border-transparent hover:border-[#DE2910]">Home</a>
          <a href="#" className="hover:text-[#DE2910] transition-colors border-b-2 border-transparent hover:border-[#DE2910]">Teams</a>
          <a href="#" className="hover:text-[#DE2910] transition-colors border-b-2 border-transparent hover:border-[#DE2910]">Events</a>
          <a href="#" className="hover:text-[#DE2910] transition-colors border-b-2 border-transparent hover:border-[#DE2910]">Rotterdam 2026</a>
          <a href="#" className="hover:text-[#DE2910] transition-colors border-b-2 border-transparent hover:border-[#DE2910]">Journal</a>
        </div>
      </nav>

      {/* Hero section */}
      <section className="bg-[#006B3C] px-6 py-20 md:py-32">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="inline-block px-3 py-1 bg-[#DE2910] text-white text-xs font-bold uppercase tracking-wider rounded-full">
              Rotterdam 2026 Masters World Cup
            </span>
            <h1 className="text-4xl md:text-6xl font-extrabold text-white leading-tight">
              Two Teams. One Flag. One World Cup.
            </h1>
            <p className="text-[#86efac] text-xl font-medium">
              MO40 · MO50 — at the World Masters Hockey World Cup
            </p>
            <p className="text-green-200 text-lg max-w-lg leading-relaxed">
              Hong Kong sends its finest veteran players to compete on the world stage. Follow our journey to Rotterdam as we train, prepare, and represent our city.
            </p>
            <div className="flex flex-wrap gap-4 pt-4">
              <button className="bg-[#DE2910] hover:bg-red-700 text-white font-bold py-3 px-6 rounded-lg transition-colors flex items-center gap-2">
                Meet the Squads
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </button>
              <button className="bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                About HK Masters
              </button>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-[4/3] bg-[#004A2A] rounded-2xl flex items-center justify-center overflow-hidden">
              <svg className="w-64 h-64 text-green-600 opacity-30" viewBox="0 0 24 24" fill="currentColor">
                <path d="M14 2a2 2 0 100 4 2 2 0 000-4zm-3.5 5c-.83 0-1.5.67-1.5 1.5v4.56l-1.5 4.94A1.5 1.5 0 008.93 20h.07a1.5 1.5 0 001.43-1.07L11.5 15h1.22l3.41 4.54a1.5 1.5 0 002.4-1.8l-4.22-5.63V8.5c0-.83-.67-1.5-1.5-1.5h-2.31zM4 17.5c0 1.93 1.57 3.5 3.5 3.5h.5v-2h-.5c-.83 0-1.5-.67-1.5-1.5S6.67 16 7.5 16h.5v-2h-.5C5.57 14 4 15.57 4 17.5z" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* Photo strip */}
      <section className="bg-[#005030] py-8">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex overflow-x-auto pb-4 gap-4 no-scrollbar">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="flex-none w-44 h-28 rounded-xl bg-[#004A2A] opacity-80 bg-gradient-to-tr from-[#004A2A] to-[#006B3C]"></div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-8 mt-8 border-t border-green-800/50 pt-8 text-center">
            <div>
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">2 Squads</div>
              <div className="text-green-300 font-medium uppercase tracking-widest text-sm">Men Over 40 & 50</div>
            </div>
            <div>
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">Rotterdam 2026</div>
              <div className="text-green-300 font-medium uppercase tracking-widest text-sm">Host City</div>
            </div>
            <div>
              <div className="text-3xl md:text-5xl font-bold text-white mb-2">22 Jul – 1 Aug</div>
              <div className="text-green-300 font-medium uppercase tracking-widest text-sm">Tournament Dates</div>
            </div>
          </div>
        </div>
      </section>

      {/* Countdown section */}
      <section className="bg-[#004A2A] py-20 px-6 text-center">
        <div className="max-w-4xl mx-auto">
          <p className="text-[#DE2910] font-bold uppercase tracking-widest mb-4">Rotterdam 2026 Masters World Cup</p>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-12">The clock is ticking…</h2>
          
          <div className="flex justify-center items-center gap-4 md:gap-8 mb-12">
            <div className="bg-white/10 border border-white/20 rounded-2xl w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center">
              <span className="text-4xl md:text-5xl font-bold text-white">76</span>
              <span className="text-xs md:text-sm text-green-300 font-medium mt-1">DAYS</span>
            </div>
            <span className="text-4xl font-bold text-white/50">:</span>
            <div className="bg-white/10 border border-white/20 rounded-2xl w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center">
              <span className="text-4xl md:text-5xl font-bold text-white">14</span>
              <span className="text-xs md:text-sm text-green-300 font-medium mt-1">HOURS</span>
            </div>
            <span className="text-4xl font-bold text-white/50">:</span>
            <div className="bg-white/10 border border-white/20 rounded-2xl w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center">
              <span className="text-4xl md:text-5xl font-bold text-white">32</span>
              <span className="text-xs md:text-sm text-green-300 font-medium mt-1">MINUTES</span>
            </div>
            <span className="text-4xl font-bold text-white/50">:</span>
            <div className="bg-white/10 border border-white/20 rounded-2xl w-24 h-24 md:w-32 md:h-32 flex flex-col items-center justify-center">
              <span className="text-4xl md:text-5xl font-bold text-white">08</span>
              <span className="text-xs md:text-sm text-green-300 font-medium mt-1">SECONDS</span>
            </div>
          </div>

          <p className="text-green-400 text-lg mb-8 font-medium">
            22 July – 1 August 2026 · Rotterdam, Netherlands
          </p>
          <button className="bg-[#DE2910] hover:bg-red-700 text-white font-bold py-2 px-5 rounded-lg transition-colors text-sm inline-flex items-center gap-2">
            Tournament details
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
          </button>
        </div>
      </section>

      {/* Squads section */}
      <section className="bg-white py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">About the Tournament</h2>
            <p className="text-gray-600 text-lg leading-relaxed">
              The World Masters Hockey World Cup brings together the best veteran players from across the globe. Hong Kong is proud to be represented by two dedicated squads competing at the highest level of masters hockey.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-[#F9FAFB] rounded-xl border border-gray-100 shadow-sm p-8 hover:shadow-md transition-shadow">
              <span className="inline-block px-3 py-1 bg-[#DE2910] text-white text-xs font-bold rounded mb-4">MO40</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Men Over 40</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                The Men's Over 40 squad brings intensity and experience to the pitch. With rigorous training schedules and deep tactical knowledge, they are ready to face the world's best.
              </p>
              <a href="#" className="text-[#006B3C] font-bold flex items-center gap-2 hover:underline">
                View Squad
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </a>
            </div>
            
            <div className="bg-[#F9FAFB] rounded-xl border border-gray-100 shadow-sm p-8 hover:shadow-md transition-shadow">
              <span className="inline-block px-3 py-1 bg-[#DE2910] text-white text-xs font-bold rounded mb-4">MO50</span>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Men Over 50</h3>
              <p className="text-gray-600 mb-8 leading-relaxed">
                Combining decades of hockey wisdom with enduring passion for the game, the Men's Over 50 squad exemplifies the enduring spirit of Hong Kong hockey on the global stage.
              </p>
              <a href="#" className="text-[#006B3C] font-bold flex items-center gap-2 hover:underline">
                View Squad
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Sponsor strip */}
      <section className="bg-white border-t border-gray-100 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <p className="text-center text-gray-400 text-sm font-medium uppercase tracking-widest mb-8">Our Sponsors</p>
          <div className="flex flex-wrap justify-center gap-8 md:gap-16">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 w-32 bg-gray-100 rounded opacity-50"></div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#004A2A] text-white py-12 px-6 text-center border-t border-green-900">
        <div className="max-w-7xl mx-auto">
          <div className="font-bold text-2xl mb-4">HK Masters Hockey</div>
          <p className="text-green-400 text-sm">© 2026 Hong Kong Masters Hockey. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
