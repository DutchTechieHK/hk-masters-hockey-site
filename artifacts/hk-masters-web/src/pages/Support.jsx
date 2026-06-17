import { useEffect, useState } from "react";
import FundraisingThermometer from "../components/FundraisingThermometer";
import PledgeForm from "../components/PledgeForm";
import LegoJarSection from "../components/LegoJarSection";
import { API_BASE } from "../utils/api";

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

const TIERS = [
  {
    name: "Supporter",
    amount: "HK$500",
    blurb: "Your name added to the team's official supporter wall.",
  },
  {
    name: "Friend of the Team",
    amount: "HK$1,000",
    blurb: "Supporter wall + a personal thank-you from the team captains.",
  },
  {
    name: "Patron",
    amount: "HK$2,500",
    blurb: "Friend benefits + a signed team photo from Rotterdam.",
  },
  {
    name: "Champ",
    amount: "HK$5,000+",
    blurb: "All of the above + recognition on the public website and team kit (subject to design approval).",
  },
];

const REASONS = [
  {
    title: "Tournament entry & officials",
    body: "Two HK squads competing at the World Masters Hockey Cup — entry fees, umpiring, and tournament administration.",
  },
  {
    title: "Travel & accommodation",
    body: "Flights to Rotterdam, accommodation for ~36 players plus coaches and managers across 11 days of competition.",
  },
  {
    title: "Kit & equipment",
    body: "Match kit, training kit, training equipment, and team merchandise so the squads represent HK with pride.",
  },
];

export default function Support() {
  const supporters = useSupporterWall();
  const [auctionLive, setAuctionLive] = useState(false);

  useEffect(() => {
    window.scrollTo(0, 0);
    fetch(`${API_BASE}/api/public/auction`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setAuctionLive(!!d.isLive); })
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* Page Header */}
      <div className="bg-[#1E3A6E] text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <span className="inline-block bg-[#DE2910] text-white text-xs font-bold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            Rotterdam 2026
          </span>
          <h1 className="text-4xl sm:text-5xl font-extrabold mb-3">
            Support the Team
          </h1>
          <p className="text-[#BFD9F5] text-lg max-w-2xl leading-relaxed">
            Help send Hong Kong's MO40 and MO50 squads to the World Masters Hockey Cup —
            22 July to 1 August 2026, Rotterdam.
          </p>
        </div>
      </div>

      {/* Thermometer + Pledge */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          <div>
            <h2 className="text-2xl font-bold text-[#1E3A6E] mb-2">Where We Are</h2>
            <p className="text-gray-600 text-sm mb-6">
              Real-time fundraising progress for the Rotterdam 2026 campaign.
            </p>
            <FundraisingThermometer />

            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-6">
              <h3 className="font-bold text-gray-900 mb-3">Why we're raising funds</h3>
              <ul className="space-y-3">
                {REASONS.map((r) => (
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

          <div>
            <h2 className="text-2xl font-bold text-[#1E3A6E] mb-2">Pledge Your Support</h2>
            <p className="text-gray-600 text-sm mb-6">
              Thanks for your pledge
            </p>
            <PledgeForm />
          </div>
        </div>
      </section>

      {/* Tiers */}
      <section className="bg-[#EDE0C4] border-y border-[#D9C9A8] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-extrabold text-gray-900 mb-3">Supporter Tiers</h2>
            <p className="text-gray-600 max-w-xl mx-auto">
              Every contribution makes a difference. Here's how we'll thank you for backing
              the team.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {TIERS.map((tier) => (
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
            <h2 className="text-2xl font-extrabold text-gray-900 mb-2">Our Supporters</h2>
            <p className="text-gray-500 text-sm">
              Thank you to everyone who has pledged their support for Rotterdam 2026.
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

      {/* Corporate sponsorship link */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl p-6 sm:p-8 border border-[#D9C9A8] text-center">
          <p className="text-gray-600 text-sm mb-3">
            Looking to partner with us as a corporate sponsor?
          </p>
          <a
            href="/sponsors"
            className="inline-block text-[#1E3A6E] font-semibold text-sm hover:underline"
          >
            View our sponsorship packages →
          </a>
        </div>
      </section>
    </div>
  );
}
