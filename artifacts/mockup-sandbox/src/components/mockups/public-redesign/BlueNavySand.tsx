import React, { useEffect, useState, useRef } from 'react';
import './_group.css';

export function BlueNavySand() {
  const [scrolled, setScrolled] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    observerRef.current = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
        }
      });
    }, { threshold: 0.1 });

    const elements = document.querySelectorAll('.reveal');
    elements.forEach(el => observerRef.current?.observe(el));

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#1E3A6E] font-sans selection:bg-[#5B9FE0] selection:text-white overflow-x-hidden">

      {/* Navigation — sand background, strong denim border */}
      <nav className="fixed top-0 w-full z-50 bg-[#F2E8D5] border-b-[3px] border-[#1E3A6E] shadow-sm">
        <div className="container mx-auto px-6 flex justify-between items-center py-3.5">
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" fill="#1E3A6E" />
              <path d="M12 6L6 12L12 18L18 12L12 6Z" fill="#5B9FE0" />
            </svg>
            <div className="flex flex-col leading-tight">
              <span className="text-[#1E3A6E] font-black text-[17px] tracking-tight">HK Masters</span>
              <span className="text-[#5B9FE0] text-[9px] font-bold uppercase tracking-[0.18em]">Hockey · Rotterdam 2026</span>
            </div>
          </div>

          {/* Nav links */}
          <div className="hidden md:flex items-center gap-0.5">
            {['Home', 'Squads', 'Tournament', 'Sponsors'].map((item) => (
              <a
                key={item}
                href="#"
                className="px-4 py-2 text-[#1E3A6E] hover:text-[#2A5298] hover:bg-[#E8D9C0] transition-all duration-200 text-sm font-semibold rounded relative group"
              >
                {item}
                <span className="absolute bottom-1 left-4 right-4 h-0.5 bg-[#1E3A6E] scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left rounded-full"></span>
              </a>
            ))}
            <div className="w-px h-5 bg-[#C8B99A] mx-3"></div>
            <button className="px-5 py-2 bg-[#DE2910] hover:bg-[#b91e0a] text-white text-sm font-bold rounded-lg transition-colors shadow-sm tracking-wide">
              Register
            </button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden text-[#1E3A6E]">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M4 6H20M4 12H20M4 18H20" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative hero-bg-light pt-36 pb-24 lg:pt-52 lg:pb-36 overflow-hidden">
        <div className="absolute top-16 right-16 w-[560px] h-[560px] border border-[#5B9FE0]/15 rounded-full floating-shape pointer-events-none"></div>
        <div className="absolute top-36 right-36 w-[360px] h-[360px] border border-[#5B9FE0]/25 rounded-full floating-shape pointer-events-none" style={{ animationDelay: '-5s' }}></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="reveal">
              {/* Event badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#F2E8D5] text-[#1E3A6E] text-[11px] font-bold uppercase tracking-widest mb-8">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DE2910] shrink-0"></span>
                Rotterdam 2026 · Masters World Cup
              </div>

              <h1 className="text-5xl lg:text-6xl xl:text-[5rem] font-black text-white leading-[1.05] tracking-tight mb-7 font-['Barlow_Condensed'] uppercase">
                Two Teams.<br />
                <span className="text-[#BFD9F5]">One Flag.</span><br />
                One World Cup.
              </h1>

              <p className="text-lg text-[#D6E8F7] font-medium mb-3 max-w-md leading-snug">
                Hong Kong's finest veteran players take on the world stage.
              </p>
              <p className="text-[#8FBDE8] mb-10 max-w-md text-base leading-relaxed">
                Our MO40 and MO50 squads prepare for the ultimate challenge at HC Rotterdam — 22 Jul to 1 Aug 2026.
              </p>

              <div className="flex flex-wrap gap-3">
                <button className="px-7 py-3.5 bg-[#DE2910] hover:bg-[#b91e0a] text-white font-bold rounded-lg transition-all shadow-lg shadow-[#DE2910]/25 flex items-center gap-2 text-sm tracking-wide">
                  Meet the Squads
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="px-7 py-3.5 bg-white/10 hover:bg-white/20 border border-[#F2E8D5]/30 hover:border-[#F2E8D5]/60 text-[#F2E8D5] font-semibold rounded-lg transition-all text-sm tracking-wide">
                  About HK Masters
                </button>
              </div>
            </div>

            {/* Hero image placeholder */}
            <div className="reveal relative lg:ml-auto w-full max-w-[400px]" style={{ animationDelay: '0.2s' }}>
              <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-[#2A5298] to-[#5B9FE0]/60 relative overflow-hidden shadow-2xl shadow-[#0D1E3C]/50 group">
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-white/10 pointer-events-none"></div>
                {/* Sand corner accent */}
                <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#F2E8D5]/10 rounded-tl-[80px]"></div>
                <div className="w-full h-full flex items-center justify-center">
                  <svg className="w-2/3 h-2/3 opacity-20 text-white" viewBox="0 0 100 100" fill="currentColor">
                    <path d="M70,80 L40,20 C38,16 34,14 30,16 C26,18 24,22 26,26 L50,74 C52,78 56,80 60,78 C64,76 66,72 64,68 L58,56 L76,92 C78,96 84,98 88,96 C92,94 94,88 92,84 L70,80 Z" />
                  </svg>
                </div>
              </div>
              {/* Floating sand tag */}
              <div className="absolute -bottom-4 -left-4 bg-[#F2E8D5] text-[#1E3A6E] text-xs font-bold px-4 py-2 rounded-xl shadow-lg">
                MO40 · MO50
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Bar */}
      <section className="bg-[#16305D] py-5 border-y border-white/10 relative z-20">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-3 divide-x divide-[#5B9FE0]/20 text-center">
            {[
              { value: '2', label: 'Squads' },
              { value: 'Rotterdam', label: '2026 Host City' },
              { value: '22 Jul – 1 Aug', label: 'Tournament Dates' },
            ].map((stat) => (
              <div key={stat.label} className="reveal px-4 py-2">
                <div className="text-xl font-black text-white mb-0.5">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-[#8FBDE8] font-semibold">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Photo Strip */}
      <section className="bg-[#16305D] pb-6 relative z-10">
        <div className="container mx-auto px-6">
          <div className="flex flex-nowrap overflow-x-auto gap-3 snap-x no-scrollbar">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div
                key={i}
                className="min-w-[130px] w-[130px] h-[86px] rounded-xl bg-[#5B9FE0]/15 border border-[#5B9FE0]/25 snap-center shrink-0 overflow-hidden relative group cursor-pointer hover:border-[#5B9FE0]/60 transition-all"
              >
                <div className="absolute inset-0 bg-[#5B9FE0]/20 group-hover:bg-transparent transition-colors duration-300"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Countdown Section */}
      <section className="bg-[#1E3A6E] py-24 relative overflow-hidden border-t border-[#5B9FE0]/20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(91,159,224,0.08)_0%,transparent_70%)] pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10 text-center reveal">
          <p className="text-[#8FBDE8] text-xs font-bold uppercase tracking-[0.2em] mb-3">Opening Match · 22 July 2026</p>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">The clock is ticking</h2>

          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6 mb-10">
            {[
              { value: '76', label: 'Days' },
              { value: '14', label: 'Hours' },
              { value: '32', label: 'Mins' },
              { value: '08', label: 'Secs' },
            ].map((unit, i, arr) => (
              <React.Fragment key={unit.label}>
                <div className="bg-[#16305D] border border-[#5B9FE0]/30 rounded-2xl p-6 min-w-[110px] md:min-w-[130px] shadow-xl shadow-[#0D1E3C]/40">
                  <div className="text-5xl md:text-6xl font-extrabold text-white mb-1.5 font-['Barlow_Condensed'] tabular-nums">{unit.value}</div>
                  <div className="text-[10px] font-bold text-[#8FBDE8] tracking-[0.2em] uppercase">{unit.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:block text-3xl font-black text-[#5B9FE0]/40 mb-4">:</div>
                )}
              </React.Fragment>
            ))}
          </div>

          <button className="px-7 py-3.5 bg-[#DE2910] hover:bg-[#b91e0a] text-white font-bold rounded-lg transition-all inline-flex items-center gap-2 shadow-lg shadow-[#DE2910]/20 text-sm tracking-wide">
            Tournament Details
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* Squads Section */}
      <section className="bg-[#F2E8D5] py-24">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-xl mx-auto mb-14 reveal">
            <p className="text-[#5B9FE0] text-xs font-bold uppercase tracking-[0.2em] mb-3">Hong Kong · Rotterdam 2026</p>
            <h2 className="text-4xl md:text-5xl font-black text-[#1E3A6E] mb-5 font-['Barlow_Condensed'] uppercase tracking-tight">Our Squads</h2>
            <p className="text-[#4A3F35] text-base leading-relaxed">
              Two representative squads. One flag. Hong Kong sends its finest veteran players to compete at the highest level of Masters hockey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            {[
              { id: 'MO40', title: 'Men Over 40', desc: 'A blend of pace, experience and tactical nous — our MO40 squad is built to compete from the first whistle.' },
              { id: 'MO50', title: 'Men Over 50', desc: 'Deep in skill and composure, our MO50 squad brings decades of top-level hockey to the Rotterdam stage.' },
            ].map((squad, i) => (
              <div
                key={squad.id}
                className="bg-white rounded-2xl p-8 shadow-sm border border-[#E5D5BC] hover:-translate-y-1.5 hover:shadow-lg transition-all duration-300 group reveal"
                style={{ animationDelay: `${i * 0.15}s` }}
              >
                <div className="flex items-center gap-3 mb-5">
                  <div className="px-3 py-1 rounded-lg bg-[#1E3A6E] text-white text-sm font-black tracking-wide">
                    {squad.id}
                  </div>
                  <div className="h-px flex-1 bg-[#E5D5BC]"></div>
                </div>
                <h3 className="text-xl font-bold text-[#1E3A6E] mb-3">{squad.title}</h3>
                <p className="text-[#5A4F45] text-sm mb-7 leading-relaxed">{squad.desc}</p>
                <a href="#" className="inline-flex items-center gap-2 text-[#2A5298] text-sm font-bold group-hover:gap-3 transition-all">
                  View Squad
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sponsor Strip */}
      <section className="bg-[#EDE0C4] py-10 border-t border-[#D9C9A8]">
        <div className="container mx-auto px-6">
          <p className="text-center text-[#8A7A6A] font-bold uppercase tracking-[0.2em] text-[10px] mb-7 reveal">Our Sponsors</p>
          <div className="flex flex-wrap justify-center gap-5 reveal" style={{ animationDelay: '0.15s' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="w-32 h-14 bg-white border border-[#D9C9A8] rounded-xl shadow-sm flex items-center justify-center opacity-60 hover:opacity-100 hover:shadow-md transition-all cursor-pointer"
              >
                <span className="text-[#C0B0A0] text-[10px] font-semibold tracking-widest">SPONSOR</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#1E3A6E] text-white py-10">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-2.5 mb-4">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" fill="#F2E8D5" />
              <path d="M12 6L6 12L12 18L18 12L12 6Z" fill="#5B9FE0" />
            </svg>
            <span className="font-black text-lg tracking-tight">HK Masters Hockey</span>
          </div>
          <p className="text-[#5B9FE0] text-[10px] font-bold uppercase tracking-[0.2em] mb-6">Rotterdam 2026 · Masters World Cup</p>
          <div className="w-16 h-px bg-[#5B9FE0]/30 mx-auto mb-5"></div>
          <p className="text-[#8FBDE8] text-xs">
            © 2026 Hong Kong Masters Hockey. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
