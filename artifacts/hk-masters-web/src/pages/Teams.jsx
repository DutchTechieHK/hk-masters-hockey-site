import { Link } from "wouter";
import content from "../content/teams.json";
import { usePageTexts } from "../utils/pageTexts";
import RichText from "../components/RichText";

const ROTTERDAM_MODE_END = new Date("2026-08-02T00:00:00");
// Development preview: append ?preview=standard to see the post-tournament teams page.
const isStandardPreview = import.meta.env.DEV && (
  new URLSearchParams(window.location.search).get("preview") === "standard" ||
  window.location.pathname === "/preview/standard/teams"
);

export default function Teams() {
  const t = usePageTexts("teams", content);
  const rotterdamMode = !isStandardPreview && new Date() < ROTTERDAM_MODE_END;

  return (
    <div>
      {/* CTA */}
      <section className="bg-[#1E3A6E] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {rotterdamMode ? (
            <>
              <h2 className="reveal text-3xl font-extrabold text-white mb-4">Rotterdam 2026</h2>
              <p className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed">
                Tournament schedule, key dates, accommodation and more — everything you need for Rotterdam 2026.
              </p>
              <Link
                href="/rotterdam-2026"
                className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Full tournament details →
              </Link>
            </>
          ) : (
            <>
              <h2 className="reveal text-3xl font-extrabold text-white mb-4">{t.join_heading}</h2>
              <RichText content={t.join_text} className="text-[#D6E8F7] max-w-xl mx-auto mb-6 leading-relaxed" />
              <a
                href="https://caramel-havarti-6da.notion.site/79a429c0d2cc4ccb96417607a58775f9?pvs=105"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-shimmer inline-block bg-[#DE2910] text-white font-semibold px-8 py-3 rounded-lg hover:bg-red-700 transition-colors duration-150"
              >
                Sign Up to Join →
              </a>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
