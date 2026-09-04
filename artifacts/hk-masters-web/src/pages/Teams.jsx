import content from "../content/teams.json";
import { usePageTexts } from "../utils/pageTexts";

export default function Teams() {
  const t = usePageTexts("teams", content);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            {t.header_badge}
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">
            {t.header_title}
          </h1>
          <p className="text-[#BFD9F5] text-lg max-w-3xl">
            {t.header_subtitle}
          </p>
        </div>
      </div>

      {/* Men's Masters */}
      <section className="bg-[#F2E8D5] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-2">
              <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
                {t.mens_badge}
              </span>
              <h2 className="text-3xl font-extrabold text-[#1E3A6E] mb-4">
                {t.mens_heading}
              </h2>
              <p className="text-[#5A4F45] text-lg leading-relaxed">
                {t.mens_text}
              </p>
            </div>

            <aside className="bg-white rounded-2xl border border-[#D9C9A8] shadow-sm p-6 sm:p-8">
              <div className="w-12 h-1 rounded-full bg-[#5B9FE0] mb-5" />
              <h3 className="text-xl font-bold text-[#1E3A6E] mb-3">{t.trials_heading}</h3>
              <p className="text-[#5A4F45] leading-relaxed">
                <strong className="text-[#1E3A6E]">{t.trials_details}</strong>{" "}
                {t.trials_text}
              </p>
            </aside>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#1E3A6E] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="reveal text-3xl font-extrabold text-white mb-4">{t.join_heading}</h2>
          <p className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed">
            {t.join_text}
          </p>
          <a
            href={t.join_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
          >
            {t.join_button_label}
          </a>
        </div>
      </section>

      {/* Ladies Masters */}
      <section className="bg-[#F2E8D5] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-2xl border border-[#D9C9A8] shadow-sm p-8 sm:p-10">
            <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
              {t.ladies_badge}
            </span>
            <h2 className="text-3xl font-extrabold text-[#1E3A6E] mb-4">
              {t.ladies_heading}
            </h2>
            <p className="text-[#5A4F45] text-lg leading-relaxed max-w-4xl">
              {t.ladies_text}
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
