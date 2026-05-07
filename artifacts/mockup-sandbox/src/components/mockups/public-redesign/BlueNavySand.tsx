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
    <div className="min-h-screen bg-[#0F172A] font-sans selection:bg-[#3B6EA5] selection:text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className={`fixed top-0 w-full z-50 transition-all duration-300 ${scrolled ? 'bg-[#0F172A]/80 backdrop-blur-md border-b border-white/5 py-4' : 'bg-transparent py-6'}`}>
        <div className="container mx-auto px-6 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" fill="#3B6EA5" />
              <path d="M12 6L6 12L12 18L18 12L12 6Z" fill="white" />
            </svg>
            <span className="text-white font-bold text-xl tracking-tight">HK Masters</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            {['Home', 'Squads', 'Tournament', 'Sponsors'].map((item) => (
              <a key={item} href="#" className="text-[#93C5FD] hover:text-white transition-colors duration-200 text-sm font-medium relative group">
                {item}
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-[#F2E8D5] transition-all duration-300 group-hover:w-full"></span>
              </a>
            ))}
          </div>
          <button className="md:hidden text-white">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 6H20M4 12H20M4 18H20" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative hero-bg pt-32 pb-20 lg:pt-48 lg:pb-32 overflow-hidden">
        {/* Decorative background shape */}
        <div className="absolute top-20 right-20 w-[600px] h-[600px] border border-[#3B6EA5]/10 rounded-full floating-shape pointer-events-none"></div>
        <div className="absolute top-40 right-40 w-[400px] h-[400px] border border-[#3B6EA5]/20 rounded-full floating-shape pointer-events-none" style={{ animationDelay: '-5s' }}></div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="reveal">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F2E8D5] text-[#0F172A] text-xs font-bold uppercase tracking-wider mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-[#DE2910]"></span>
                Rotterdam 2026 Masters World Cup
              </div>
              
              <h1 className="text-5xl lg:text-6xl xl:text-7xl font-black text-white leading-[1.1] tracking-tight mb-6 font-['Barlow_Condensed'] uppercase">
                Two Teams.<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-[#93C5FD]">One Flag.</span><br />
                One World Cup.
              </h1>
              
              <p className="text-xl text-[#93C5FD] font-medium mb-4 max-w-lg">
                Hong Kong's finest veteran players take on the world stage.
              </p>
              <p className="text-[#94A3B8] mb-10 max-w-lg text-lg leading-relaxed">
                Join our MO40 and MO50 squads as they prepare for the ultimate challenge at HC Rotterdam.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <button className="px-8 py-4 bg-[#DE2910] hover:bg-[#b91e0a] text-white font-bold rounded-lg transition-colors shadow-lg shadow-[#DE2910]/20 flex items-center gap-2">
                  Meet the Squads
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button className="px-8 py-4 bg-transparent border-2 border-[#F2E8D5]/30 hover:border-[#F2E8D5] text-[#F2E8D5] font-bold rounded-lg transition-colors">
                  About HK Masters
                </button>
              </div>
            </div>
            
            <div className="reveal relative lg:ml-auto w-full max-w-md" style={{ animationDelay: '0.2s' }}>
              <div className="aspect-[4/5] rounded-2xl bg-gradient-to-br from-[#1e3a5f] to-[#2563eb]/80 p-1 relative overflow-hidden shadow-2xl shadow-[#3B6EA5]/20 group">
                <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                {/* Inner glow effect via box-shadow inset */}
                <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_40px_rgba(255,255,255,0.1)] pointer-events-none"></div>
                <div className="w-full h-full rounded-xl border border-white/10 flex items-center justify-center relative overflow-hidden">
                  <svg className="w-3/4 h-3/4 opacity-20 text-white" viewBox="0 0 100 100" fill="currentColor">
                    <path d="M70,80 L40,20 C38,16 34,14 30,16 C26,18 24,22 26,26 L50,74 C52,78 56,80 60,78 C64,76 66,72 64,68 L58,56 L76,92 C78,96 84,98 88,96 C92,94 94,88 92,84 L70,80 Z" />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Photo Strip & Stats */}
      <section className="bg-[#1D3557] py-6 border-y border-white/5 relative z-20">
        <div className="container mx-auto px-6">
          <div className="flex flex-nowrap overflow-x-auto gap-4 pb-4 snap-x no-scrollbar">
            {[1, 2, 3, 4, 5, 6, 7].map((i) => (
              <div key={i} className="min-w-[120px] w-[120px] h-[80px] rounded-lg bg-[#3B6EA5]/20 border border-[#3B6EA5]/30 snap-center shrink-0 overflow-hidden relative group cursor-pointer">
                <div className="absolute inset-0 bg-[#3B6EA5] mix-blend-overlay opacity-40 group-hover:opacity-0 transition-opacity"></div>
              </div>
            ))}
          </div>
          
          <div className="grid grid-cols-3 gap-4 pt-6 border-t border-[#3B6EA5]/30 text-center">
            <div className="reveal" style={{ animationDelay: '0.1s' }}>
              <div className="text-3xl font-black text-white mb-1">2</div>
              <div className="text-xs uppercase tracking-widest text-[#93C5FD] font-bold">Squads</div>
            </div>
            <div className="reveal border-l border-[#3B6EA5]/30" style={{ animationDelay: '0.2s' }}>
              <div className="text-3xl font-black text-white mb-1">Rotterdam</div>
              <div className="text-xs uppercase tracking-widest text-[#93C5FD] font-bold">2026 Host</div>
            </div>
            <div className="reveal border-l border-[#3B6EA5]/30" style={{ animationDelay: '0.3s' }}>
              <div className="text-3xl font-black text-white mb-1">Jul-Aug</div>
              <div className="text-xs uppercase tracking-widest text-[#93C5FD] font-bold">22 Jul – 1 Aug</div>
            </div>
          </div>
        </div>
      </section>

      {/* Countdown Section */}
      <section className="bg-[#1E293B] py-24 relative overflow-hidden">
        {/* Decorative background grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(59,110,165,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(59,110,165,0.05)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none"></div>

        <div className="container mx-auto px-6 relative z-10 text-center reveal">
          <div className="inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-[#3B6EA5] text-white text-xs font-bold uppercase tracking-widest mb-6">
            Rotterdam 2026 Masters World Cup
          </div>
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-12">The clock is ticking...</h2>
          
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 mb-12">
            {[
              { value: '76', label: 'DAYS' },
              { value: '14', label: 'HOURS' },
              { value: '32', label: 'MINUTES' },
              { value: '08', label: 'SECONDS' }
            ].map((unit, i, arr) => (
              <React.Fragment key={unit.label}>
                <div className="bg-white/5 border border-[#60A5FA]/30 rounded-2xl p-6 min-w-[120px] md:min-w-[140px] backdrop-blur-sm shadow-xl">
                  <div className="text-5xl md:text-6xl font-extrabold text-white mb-2 font-['Barlow_Condensed']">{unit.value}</div>
                  <div className="text-xs md:text-sm font-bold text-[#93C5FD] tracking-widest uppercase">{unit.label}</div>
                </div>
                {i < arr.length - 1 && (
                  <div className="hidden md:block text-4xl font-black text-[#60A5FA]/50">:</div>
                )}
              </React.Fragment>
            ))}
          </div>
          
          <p className="text-[#93C5FD] font-medium text-lg mb-8">Opening Match: July 22, 2026</p>
          
          <button className="px-8 py-4 bg-[#DE2910] hover:bg-[#b91e0a] text-white font-bold rounded-lg transition-colors inline-flex items-center gap-2 shadow-lg shadow-[#DE2910]/20">
            Tournament Details
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12H19M19 12L12 5M19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </section>

      {/* Squads Section */}
      <section className="bg-[#F2E8D5] py-24 text-[#292320]">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-2xl mx-auto mb-16 reveal">
            <h2 className="text-4xl md:text-5xl font-bold text-[#0F172A] mb-6 font-['Barlow_Condensed'] uppercase">About the Tournament</h2>
            <p className="text-slate-700 text-lg leading-relaxed">
              Hong Kong is proudly sending two representative squads to compete at the highest level of Masters hockey. The squads combine experience, skill, and an unwavering commitment to representing the Bauhinia flag.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {[
              { id: 'MO40', title: 'Men Over 40' },
              { id: 'MO50', title: 'Men Over 50' }
            ].map((squad, i) => (
              <div key={squad.id} className="bg-white rounded-2xl p-8 shadow-md border border-[#EDE0C4] hover:-translate-y-2 hover:shadow-xl transition-all duration-300 group reveal" style={{ animationDelay: `${i * 0.2}s` }}>
                <div className="inline-block px-3 py-1 rounded bg-[#3B6EA5] text-white text-sm font-bold mb-6">
                  {squad.id}
                </div>
                <h3 className="text-2xl font-bold text-[#0F172A] mb-4">{squad.title}</h3>
                <p className="text-slate-600 mb-8 leading-relaxed">
                  The {squad.title} squad is undergoing rigorous preparation, combining tactical sessions with high-intensity fitness regimes to peak for the World Cup.
                </p>
                <a href="#" className="inline-flex items-center gap-2 text-[#3B6EA5] font-bold group-hover:gap-3 transition-all">
                  View Squad
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12H19M19 12L12 5M19 12L12 19" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Sponsor Strip */}
      <section className="bg-[#F2E8D5] py-12 border-t border-[#EDE0C4]">
        <div className="container mx-auto px-6">
          <h3 className="text-center text-slate-400 font-bold uppercase tracking-widest text-sm mb-8 reveal">Our Sponsors</h3>
          <div className="flex flex-wrap justify-center gap-6 reveal" style={{ animationDelay: '0.2s' }}>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="w-32 h-16 bg-white border border-[#EDE0C4] rounded-lg shadow-sm flex items-center justify-center opacity-70 hover:opacity-100 transition-opacity cursor-pointer">
                <span className="text-slate-300 text-xs font-medium">LOGO {i}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-[#0F172A] text-white py-12 border-t-4 border-[#3B6EA5]">
        <div className="container mx-auto px-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 12L12 22L22 12L12 2Z" fill="#3B6EA5" />
              <path d="M12 6L6 12L12 18L18 12L12 6Z" fill="white" />
            </svg>
            <span className="font-bold text-xl tracking-tight">HK Masters Hockey</span>
          </div>
          <div className="w-24 h-px bg-[#1e3a5f] mx-auto mb-6"></div>
          <p className="text-slate-500 text-sm">
            © 2026 Hong Kong Masters Hockey. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
