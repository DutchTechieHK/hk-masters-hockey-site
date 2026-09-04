import { useEffect, useState } from "react";
import FundraisingThermometer from "../components/FundraisingThermometer";
import LegoJarSection from "../components/LegoJarSection";
import { API_BASE } from "../utils/api";
import content from "../content/support.json";
import { usePageTexts } from "../utils/pageTexts";

const TIER_THRESHOLDS = [
  { min: 5000, label: "Champ" },
  { min: 2500, label: "Patron" },
  { min: 1000, label: "Friend of the Team" },
  { min: 500,  label: "Supporter" },
];

function tierLabel(amount) {
  for (const t of TIER_THRESHOLDS) {
    if (amount >= t.min) return t.label;
  }
  return null;
}

function useSupporterWall() {
  const [supporters, setSupporters] = useState(null);
  useEffect(() => {
    fetch(`${API_BASE}/api/pledges/public`)
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setSupporters(Array.isArray(data) ? data : []))
      .catch(() => setSupporters([]));
  }, []);
  return supporters;
}

export default function Support() {
  const t = usePageTexts("support", content);
  const supporters = useSupporterWall();
  const [auctionLive, setAuctionLive] = useState(false);

  useEffect(() => {
    if (!window.location.hash) window.scrollTo(0, 0);
    fetch(`${API_BASE}/api/public/auction`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAuctionLive(!!d.isLive); })
      .catch(() => {});
  }, []);

  // The Supporter Wall loads async and sits above the LEGO section, causing
  // a layout shift that lands the browser at the wrong scroll position.
  // Re-scroll to the hash once supporters data is settled (null → array).
  useEffect(() => {
    if (supporters === null) return;
    if (!window.location.hash) return;
    const id = window.location.hash.slice(1);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, [supporters]);

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
          <p className="text-[#BFD9F5] text-lg max-w-2xl leading-relaxed">
            {t.header_subtitle}
          </p>
        </div>
      </div>

      {/* Final fundraising result */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div>
          <h2 className="text-2xl font-bold text-[#1E3A6E] mb-2">{t.result_heading}</h2>
          <p className="text-gray-600 text-sm mb-6">
            {t.result_text}
          </p>
          <FundraisingThermometer />

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
            <h3 className="font-bold text-gray-900 mb-3">{t.reasons_heading}</h3>
            <ul className="space-y-3">
              {t.reasons.map((r) => (
                <li key={r.title} className="flex gap-3">
                  <div className="w-2 h-2 bg-[#1E3A6E] rounded-full mt-2 shrink-0" />
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{r.title}</p>
                    <p className="text-sm text-gray-600 leading-relaxed">{r.body}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="bg-[#EDE0C4] border-y border-[#D9C9A8] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">{t.tiers_heading}</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              {t.tiers_intro}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.tiers.map((tier) => (
              <div
                key={tier.name}
                className="tilt-card reveal bg-white rounded-2xl p-6 border border-[#1E3A6E]/10 shadow-sm flex flex-col"
              >
                <p className="text-xs font-bold uppercase tracking-wider text-[#1E3A6E] mb-2">
                  {tier.name}
                </p>
                <p className="text-2xl font-extrabold text-gray-900 mb-3">{tier.amount}</p>
                <p className="text-sm text-gray-600 leading-relaxed flex-1">{tier.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Supporter Wall */}
      {supporters !== null && supporters.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">{t.supporters_heading}</h2>
            <p className="text-gray-500 text-sm">
              {t.supporters_text}
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            {supporters.map((s, i) => {
              const tier = tierLabel(s.amountPledged);
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1.5 bg-[#1E3A6E]/8 border border-[#1E3A6E]/15 text-[#1E3A6E] font-semibold text-sm px-4 py-2 rounded-full"
                >
                  <span className="text-base leading-none">🏑</span>
                  {s.name}
                  {tier && (
                    <span className="text-[#1E3A6E]/60 font-normal">· {tier}</span>
                  )}
                </span>
              );
            })}
          </div>
        </section>
      )}

      {/* LEGO Jar Challenge */}
      <LegoJarSection />

      {/* Auction teaser */}
      {auctionLive && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-[#1E3A6E] rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-3 uppercase tracking-wide">
                Live now
              </span>
              <h3 className="text-xl font-extrabold text-white mb-1">Silent Auction</h3>
              <p className="text-[#BFD9F5] text-sm leading-relaxed">
                Bid on exclusive items to raise funds for the Rotterdam campaign. Bids update in real time.
              </p>
            </div>
            <a
              href="/auction"
              className="shrink-0 inline-block bg-white text-[#1E3A6E] font-bold text-sm px-6 py-3 rounded-xl hover:bg-[#F2E8D5] transition-colors"
            >
              View Auction →
            </a>
          </div>
        </section>
      )}

    </div>
  );
}
