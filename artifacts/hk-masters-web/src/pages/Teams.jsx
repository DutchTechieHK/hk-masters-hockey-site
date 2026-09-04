export default function Teams() {
  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            2026/27 Season
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">
            Masters Teams — 2026/27 Season
          </h1>
          <p className="text-[#BFD9F5] text-lg max-w-3xl">
            A new men&apos;s team enters Division 1, and three ladies&apos; teams return to the league this season.
          </p>
        </div>
      </div>

      {/* Men's Masters */}
      <section className="bg-[#F2E8D5] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-2">
              <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
                New for 2026/27
              </span>
              <h2 className="text-3xl font-extrabold text-[#1E3A6E] mb-4">
                Men&apos;s Masters Return to Division 1
              </h2>
              <p className="text-[#5A4F45] text-lg leading-relaxed">
                For the first time in many years, HK Masters Hockey will field a men&apos;s team in the Hong Kong Hockey League, competing in the First Division. The season kicks off Friday 2 October, with fixtures every Friday night at 20:30 at the Hong Kong Football Club (HKFC).
              </p>
            </div>

            <aside className="bg-white rounded-2xl border border-[#D9C9A8] shadow-sm p-6 sm:p-8">
              <div className="w-12 h-1 rounded-full bg-[#5B9FE0] mb-5" />
              <h3 className="text-xl font-bold text-[#1E3A6E] mb-3">Trial Information</h3>
              <p className="text-[#5A4F45] leading-relaxed">
                <strong className="text-[#1E3A6E]">Trials — Friday 18 September &amp; Friday 25 September, 20:00 at HKFC.</strong>{" "}
                All Masters-eligible players (35+) welcome, whatever your experience level.
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1E3A6E] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="reveal text-3xl font-extrabold text-white mb-4">Trials Start 18 September</h2>
          <p className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed">
            Come try out for HK&apos;s first men&apos;s Masters team in years.
          </p>
          <a
            href="https://caramel-havarti-6da.notion.site/79a429c0d2cc4ccb96417607a58775f9?pvs=105"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
          >
            Sign Up to Join →
          </a>
        </div>
      </section>

      {/* Ladies Masters */}
      <section className="bg-[#F2E8D5] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-[#D9C9A8] shadow-sm p-8 sm:p-10">
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              Ladies Masters
            </span>
            <h2 className="text-3xl font-extrabold text-[#1E3A6E] mb-4">
              Three Teams Again This Season
            </h2>
            <p className="text-[#5A4F45] text-lg leading-relaxed max-w-4xl">
              For another season, Hong Kong Masters Hockey fields three ladies&apos; Masters teams (35+) in the Hong Kong Hockey League, drawn from our club&apos;s Premier League players. Masters A and Masters B compete in Division 1, Masters C in Division 2.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
